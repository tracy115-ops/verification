use process_runtime::ProcessGuard;
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, process::Stdio, time::Duration};
use tauri::{AppHandle, Manager, State};
use tokio::{
    io::AsyncReadExt,
    process::{Child, Command},
    sync::Mutex,
    time::timeout,
};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInfo {
    version: u8,
    port: u16,
    addresses: Vec<String>,
    owner_token: Option<String>,
    discoverable: bool,
}
struct Hosted {
    child: Child,
    _guard: ProcessGuard,
    info: HostInfo,
}
#[derive(Default)]
pub struct CollaborationRuntime(Mutex<Option<Hosted>>);

fn node() -> Command {
    let mut command = Command::new("node");
    command
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    command
}
async fn node_version() -> Result<(), String> {
    let output = timeout(Duration::from_secs(3), node().arg("--version").output())
        .await
        .map_err(|_| "lan_node_required")?
        .map_err(|_| "lan_node_required")?;
    let version = String::from_utf8_lossy(&output.stdout);
    let major = version
        .trim()
        .trim_start_matches('v')
        .split('.')
        .next()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    if !output.status.success() || major < 24 {
        return Err("lan_node_required".into());
    }
    Ok(())
}
fn resources(app: &AppHandle) -> Result<PathBuf, String> {
    let packaged = app
        .path()
        .resource_dir()
        .map_err(|_| "lan_resources_missing")?
        .join("collaboration");
    if packaged.join("server.cjs").is_file() {
        return Ok(packaged);
    }
    #[cfg(debug_assertions)]
    {
        let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.runtime/team-bundle");
        if development.join("server.cjs").is_file() {
            return Ok(development);
        }
    }
    Err("lan_resources_missing".into())
}
async fn launch(root: PathBuf, data: PathBuf, port: u16, name: &str) -> Result<Hosted, String> {
    node_version().await?;
    // Node's entry-point realpath handling rejects Windows verbatim paths (\\?\D:\...).
    let root = dunce::simplified(&root);
    let data = dunce::simplified(&data);
    tokio::fs::create_dir_all(&data)
        .await
        .map_err(|_| "lan_start_failed")?;
    let mut child = node()
        .arg(root.join("server.cjs"))
        .args([
            "--host",
            "0.0.0.0",
            "--port",
            &port.to_string(),
            "--managed",
            "--discoverable",
            "--name",
            name,
        ])
        .arg("--data-dir")
        .arg(data)
        .arg("--static-root")
        .arg(root.join("web"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "lan_spawn_failed")?;
    let guard = ProcessGuard::attach(&child).map_err(|_| "lan_process_guard_failed")?;
    let stderr = child.stderr.take().ok_or("lan_start_failed")?;
    let diagnostic_path = data.join("startup-error.log");
    tokio::spawn(async move {
        let mut stderr = stderr.take(8192);
        let mut diagnostic = Vec::new();
        if stderr.read_to_end(&mut diagnostic).await.is_ok() && !diagnostic.is_empty() {
            let _ = tokio::fs::write(diagnostic_path, diagnostic).await;
        }
    });
    let stdout = child.stdout.take().ok_or("lan_start_failed")?;
    // Read just the readiness line; never retain unbounded process output or log the owner token.
    let info = timeout(Duration::from_secs(8), async {
        let mut stdout = stdout.take(8193);
        let mut line = Vec::new();
        loop {
            let byte = stdout.read_u8().await.map_err(|_| "lan_process_exited")?;
            if byte == b'\n' {
                break;
            }
            line.push(byte);
            if line.len() > 8192 {
                return Err("lan_start_failed");
            }
        }
        let info: HostInfo = serde_json::from_slice(&line).map_err(|_| "lan_ready_invalid")?;
        if info.version != 1 || info.port != port || info.addresses.is_empty() {
            return Err("lan_start_failed");
        }
        Ok(info)
    })
    .await
    .map_err(|_| "lan_start_timeout")?
    .map_err(str::to_owned)?;
    Ok(Hosted {
        child,
        _guard: guard,
        info,
    })
}

#[tauri::command]
pub async fn start_collaboration(
    app: AppHandle,
    state: State<'_, CollaborationRuntime>,
    port: u16,
    name: String,
) -> Result<HostInfo, String> {
    if port < 1024
        || name.trim().is_empty()
        || name.chars().count() > 80
        || name.chars().any(char::is_control)
    {
        return Err("lan_invalid".into());
    }
    let mut active = state.0.lock().await;
    if let Some(host) = active.as_mut()
        && host
            .child
            .try_wait()
            .map_err(|_| "lan_start_failed")?
            .is_none()
    {
        return Ok(host.info.clone());
    }
    *active = None;
    let data = app
        .path()
        .app_data_dir()
        .map_err(|_| "lan_start_failed")?
        .join("collaboration");
    let host = launch(resources(&app)?, data, port, name.trim()).await?;
    let info = host.info.clone();
    *active = Some(host);
    Ok(info)
}
#[tauri::command]
pub async fn collaboration_status(
    state: State<'_, CollaborationRuntime>,
) -> Result<Option<HostInfo>, String> {
    let mut active = state.0.lock().await;
    if let Some(host) = active.as_mut()
        && host
            .child
            .try_wait()
            .map_err(|_| "lan_start_failed")?
            .is_none()
    {
        return Ok(Some(host.info.clone()));
    }
    *active = None;
    Ok(None)
}
#[tauri::command]
pub async fn stop_collaboration(state: State<'_, CollaborationRuntime>) -> Result<(), String> {
    let mut active = state.0.lock().await;
    if let Some(mut host) = active.take() {
        host.child.kill().await.map_err(|_| "lan_stop_failed")?;
    }
    Ok(())
}
