use crate::types::ExecutionEvent;
use process_runtime::ProcessGuard;
use std::{path::Path, process::Stdio, time::Duration};
use tokio::{
    io::AsyncReadExt,
    process::Command,
    sync::{mpsc, oneshot},
    time::{interval, sleep},
};

pub async fn python(
    executable: &str,
    workspace: &Path,
    mode: &str,
    target: &str,
    timeout: u64,
    mut cancel: oneshot::Receiver<()>,
    sink: &impl Fn(ExecutionEvent) -> bool,
) -> Result<(), String> {
    let mut command = Command::new(executable);
    command
        .args(["-I", "runner.py", mode])
        .current_dir(workspace)
        .env_clear()
        .env("PYTHONIOENCODING", "utf-8")
        .env("BLACKBOX_BASE_URL", target)
        .env("BLACKBOX_EVIDENCE_FILE", workspace.join("evidence.jsonl"))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    for name in [
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "HOME",
        "LANG",
    ] {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command.spawn().map_err(|_| "python_not_found")?;
    let guard = ProcessGuard::attach(&child).map_err(|_| "process_guard_failed")?;
    let out = child.stdout.take().ok_or("execution_failed")?;
    let err = child.stderr.take().ok_or("execution_failed")?;
    let (limits, mut limit_events) = mpsc::channel(2);
    let stdout = tokio::spawn(read_stream(out, limits.clone()));
    let stderr = tokio::spawn(read_stream(err, limits));
    let deadline = sleep(Duration::from_secs(timeout));
    tokio::pin!(deadline);
    let mut heartbeat = interval(Duration::from_millis(500));
    let result = loop {
        tokio::select! {
            _ = &mut cancel => break Err("execution_cancelled".to_string()),
            _ = &mut deadline => break Err("execution_timeout".to_string()),
            Some(()) = limit_events.recv() => break Err("execution_output_limit".to_string()),
            _ = heartbeat.tick() => {
                if !sink(ExecutionEvent::Heartbeat) { break Err("execution_disconnected".to_string()); }
                let too_large = ["result.json", "evidence.jsonl", "preflight.json"].iter().any(|file| std::fs::metadata(workspace.join(file)).is_ok_and(|metadata| metadata.len() > 1_048_576));
                if too_large { break Err("execution_output_limit".to_string()); }
            }
            status = child.wait() => break status.map_err(|_| "execution_failed".to_string()).and_then(|status| if status.success() { Ok(()) } else { Err("python_validation_failed".into()) }),
        }
    };
    drop(guard);
    if result.is_err() {
        let _ = child.kill().await;
    }
    if result.is_err() {
        stdout.abort();
        stderr.abort();
        return result;
    }
    let (out, err) = tokio::join!(stdout, stderr);
    let out = out
        .map_err(|_| "execution_output_limit")?
        .map_err(|_| "execution_output_limit")?;
    let err = err
        .map_err(|_| "execution_output_limit")?
        .map_err(|_| "execution_output_limit")?;
    tokio::fs::write(workspace.join("stdout.log"), out)
        .await
        .map_err(|_| "workspace_failed")?;
    tokio::fs::write(workspace.join("stderr.log"), err)
        .await
        .map_err(|_| "workspace_failed")?;
    Ok(())
}

async fn read_stream(
    reader: impl tokio::io::AsyncRead + Unpin,
    limits: mpsc::Sender<()>,
) -> Result<Vec<u8>, ()> {
    let mut bytes = Vec::new();
    if reader.take(131073).read_to_end(&mut bytes).await.is_err() || bytes.len() > 131072 {
        let _ = limits.send(()).await;
        return Err(());
    }
    Ok(bytes)
}
