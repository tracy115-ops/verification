use crate::{
    discovery::{DRIVERS, resolve_driver},
    protocol::ProtocolState,
    turn_types::{AgentEvent, DriverId, TurnOutcome, TurnRequest},
};
use process_runtime::ProcessGuard;
use std::{path::Path, process::Stdio, time::Duration};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWriteExt},
    process::Command,
    sync::{mpsc, oneshot},
    time::{Instant, interval, sleep_until},
};

const MAX_OUTPUT: usize = 2_097_152;
const MAX_LINE: usize = 262_144;

fn arguments(driver: DriverId) -> Vec<&'static str> {
    match driver {
        DriverId::Codeagent => vec![],
        DriverId::Codex => vec![
            "exec",
            "--json",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--disable",
            "shell_tool",
            "-c",
            "approval_policy=\"never\"",
            "-",
        ],
        DriverId::Claude => vec![
            "-p",
            "--output-format",
            "stream-json",
            "--verbose",
            "--include-partial-messages",
            "--no-session-persistence",
            "--tools",
            "",
            "--strict-mcp-config",
            "--mcp-config",
            "{\"mcpServers\":{}}",
        ],
        DriverId::Pi => vec![
            "-p",
            "--mode",
            "json",
            "--no-session",
            "--no-tools",
            "--no-mcp",
            "--no-extensions",
            "--no-skills",
            "--no-prompt-templates",
            "--no-context-files",
        ],
    }
}

async fn pump(
    mut reader: impl AsyncRead + Unpin,
    source: bool,
    sender: mpsc::Sender<(bool, Result<Vec<u8>, ()>)>,
) {
    let mut buffer = [0u8; 4096];
    let mut pending = Vec::new();
    loop {
        let count = match reader.read(&mut buffer).await {
            Ok(count) => count,
            Err(_) => {
                let _ = sender.send((source, Err(()))).await;
                return;
            }
        };
        if count == 0 {
            break;
        }
        pending.extend_from_slice(&buffer[..count]);
        while let Some(end) = pending.iter().position(|byte| *byte == b'\n') {
            if end > MAX_LINE {
                let _ = sender.send((source, Err(()))).await;
                return;
            }
            let line: Vec<u8> = pending.drain(..=end).collect();
            if sender.send((source, Ok(line))).await.is_err() {
                return;
            }
        }
        if pending.len() > MAX_LINE {
            let _ = sender.send((source, Err(()))).await;
            return;
        }
    }
    if !pending.is_empty() {
        let _ = sender.send((source, Ok(pending))).await;
    }
}

async fn supervise(
    mut child: tokio::process::Child,
    request: &TurnRequest,
    mut cancel: oneshot::Receiver<()>,
    sink: impl Fn(AgentEvent) -> bool,
) -> TurnOutcome {
    let Ok(guard) = ProcessGuard::attach(&child) else {
        let _ = child.kill().await;
        return TurnOutcome::failed("process_guard_failed");
    };
    let (Some(mut stdin), Some(stdout), Some(stderr)) =
        (child.stdin.take(), child.stdout.take(), child.stderr.take())
    else {
        return TurnOutcome::failed("cli_failed");
    };
    let input = request.prompt.as_bytes().to_vec();
    let mut writer = tokio::spawn(async move {
        stdin.write_all(&input).await?;
        stdin.shutdown().await
    });
    let (tx, mut rx) = mpsc::channel(32);
    let out = tokio::spawn(pump(stdout, true, tx.clone()));
    let err = tokio::spawn(pump(stderr, false, tx));
    let mut state = ProtocolState::default();
    let mut status = None;
    let mut streams_closed = false;
    let mut received = 0usize;
    let mut stderr_failure = None;
    let deadline = Instant::now() + Duration::from_secs(request.timeout_seconds);
    let mut heartbeat = interval(Duration::from_secs(1));
    let mut interrupted = None;
    while !(status.is_some() && streams_closed) {
        tokio::select! {
            _ = &mut cancel => { interrupted = Some(("cancelled", "cancelled")); break; }
            _ = sleep_until(deadline) => { interrupted = Some(("timed_out", "cli_timeout")); break; }
            _ = heartbeat.tick() => { if !sink(AgentEvent::Heartbeat) { interrupted = Some(("cancelled", "client_disconnected")); break; } }
            result = child.wait(), if status.is_none() => { status = Some(result); }
            frame = rx.recv(), if !streams_closed => {
                match frame {
                    None => streams_closed = true,
                    Some((_, Err(()))) => { interrupted = Some(("failed", "output_limit")); break; }
                    Some((stdout, Ok(line))) => {
                        received += line.len();
                        if received > MAX_OUTPUT { interrupted = Some(("failed", "output_limit")); break; }
                        if !stdout {
                            stderr_failure = crate::failure::classify(&String::from_utf8_lossy(&line)).or(stderr_failure);
                        }
                        if stdout && !line.iter().all(u8::is_ascii_whitespace) {
                            for event in state.consume(request.driver, &line) {
                                if !sink(event) { interrupted = Some(("cancelled", "client_disconnected")); break; }
                            }
                            if interrupted.is_some() { break; }
                        }
                    }
                }
            }
        }
    }
    drop(guard);
    if status.is_none() {
        let _ = child.kill().await;
    }
    let input_written = matches!(
        tokio::time::timeout(Duration::from_secs(1), &mut writer).await,
        Ok(Ok(Ok(())))
    );
    writer.abort();
    out.abort();
    err.abort();
    let text = state.final_text.unwrap_or(state.text);
    if let Some((status, code)) = interrupted {
        return TurnOutcome {
            status: status.into(),
            text,
            error_code: Some(code.into()),
            native_session_id: state.session_id,
        };
    }
    let exited_successfully = matches!(status, Some(Ok(status)) if status.success());
    let success = exited_successfully
        && input_written
        && state.terminal
        && !state.failed
        && !text.trim().is_empty();
    TurnOutcome {
        status: if success { "completed" } else { "failed" }.into(),
        text,
        error_code: (!success).then(|| {
            state
                .error_code
                .or(stderr_failure)
                .unwrap_or(if !input_written {
                    "cli_input_failed"
                } else if !exited_successfully {
                    "cli_exit_failed"
                } else if !state.terminal {
                    "cli_protocol_invalid"
                } else if state.failed {
                    "cli_failed"
                } else {
                    "cli_empty_output"
                })
                .into()
        }),
        native_session_id: state.session_id,
    }
}

pub async fn run_turn(
    request: TurnRequest,
    workspace: &Path,
    cancel: oneshot::Receiver<()>,
    sink: impl Fn(AgentEvent) -> bool,
) -> TurnOutcome {
    if let Err(code) = request.validate() {
        return TurnOutcome::failed(code);
    }
    let paths = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default();
    let spec = DRIVERS
        .iter()
        .find(|spec| spec.id == request.driver.as_str());
    let Some(launch) = spec.and_then(|spec| resolve_driver(spec, &paths)) else {
        return TurnOutcome::failed("cli_not_found");
    };
    let args: Vec<String> = if matches!(request.driver, DriverId::Codeagent) {
        let Some(args) = crate::codeagent::checked_arguments(&launch).await else {
            return TurnOutcome::failed("cli_capability_unverified");
        };
        args
    } else {
        arguments(request.driver)
            .into_iter()
            .map(str::to_string)
            .collect()
    };
    let mut command = Command::new(&launch.program);
    crate::proxy::configure(&mut command);
    command.args(&launch.args).args(args);
    if !request.model.is_empty() {
        command.arg("--model").arg(&request.model);
    }
    command
        .current_dir(workspace)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    match command.spawn() {
        Ok(child) => supervise(child, &request, cancel, sink).await,
        Err(_) => TurnOutcome::failed("cli_failed"),
    }
}
#[cfg(test)]
#[path = "conversation_tests.rs"]
mod tests;
