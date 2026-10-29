use crate::discovery::{DRIVERS, DriverSpec, resolve_driver};
use serde::Serialize;
use std::{path::PathBuf, process::Stdio, time::Duration};
use tokio::{
    io::{AsyncRead, AsyncReadExt},
    process::Command,
    time::timeout,
};

const PROBE_TIMEOUT: Duration = Duration::from_secs(5);
const OUTPUT_LIMIT: u64 = 16 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProbe {
    pub driver: String,
    pub status: String,
    pub version: Option<String>,
    pub executable: Option<String>,
    pub reason: Option<String>,
}

async fn read_capped(reader: impl AsyncRead + Unpin) -> std::io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader.take(OUTPUT_LIMIT).read_to_end(&mut bytes).await?;
    Ok(bytes)
}

pub(crate) async fn probe(spec: &DriverSpec, paths: &[PathBuf]) -> AgentProbe {
    let mut result = AgentProbe {
        driver: spec.id.into(),
        status: "missing".into(),
        version: None,
        executable: None,
        reason: Some("cliProbePathMissing".into()),
    };
    let Some(launch) = resolve_driver(spec, paths) else {
        return result;
    };
    result.executable = Some(
        launch
            .args
            .first()
            .map(|entry| entry.to_string_lossy().into_owned())
            .unwrap_or_else(|| launch.program.to_string_lossy().into_owned()),
    );
    result.reason = None;
    let mut command = Command::new(&launch.program);
    crate::search_paths::configure_command(&mut command, paths);
    command
        .args(&launch.args)
        .arg("--version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    let Ok(mut child) = command.spawn() else {
        result.status = "error".into();
        result.reason = Some("cliProbeSpawnFailed".into());
        return result;
    };
    let Ok(_guard) = process_runtime::ProcessGuard::attach(&child) else {
        let _ = child.kill().await;
        result.status = "error".into();
        result.reason = Some("cliProbeSpawnFailed".into());
        return result;
    };
    let (Some(stdout), Some(stderr)) = (child.stdout.take(), child.stderr.take()) else {
        let _ = child.kill().await;
        result.status = "error".into();
        result.reason = Some("cliProbeVersionFailed".into());
        return result;
    };
    let output = timeout(PROBE_TIMEOUT, async {
        tokio::join!(child.wait(), read_capped(stdout), read_capped(stderr))
    })
    .await;
    match output {
        Ok((Ok(status), Ok(stdout), Ok(stderr))) if status.success() => {
            let bytes = if stdout.is_empty() { stderr } else { stdout };
            let version = String::from_utf8_lossy(&bytes).trim().to_string();
            if !version.is_empty() {
                result.version = Some(version);
                result.status = "found".into();
            } else {
                result.status = "error".into();
                result.reason = Some("cliProbeVersionEmpty".into());
            }
        }
        Err(_) => {
            let _ = child.kill().await;
            result.status = "timeout".into();
            result.reason = Some("cliProbeVersionTimeout".into());
        }
        _ => {
            result.status = "error".into();
            result.reason = Some("cliProbeVersionFailed".into());
        }
    }
    result
}

pub async fn probe_installed_agents() -> Vec<AgentProbe> {
    let paths = crate::search_paths::driver_search_paths();
    let mut results = Vec::new();
    for spec in &DRIVERS {
        results.push(probe(spec, &paths).await);
    }
    results
}
