use crate::update_release::{self, Release};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tauri::{AppHandle, Manager, State, ipc::Channel};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::{Mutex, RwLock, RwLockReadGuard, watch},
};

#[derive(Default)]
struct Data {
    release: Option<Release>,
    ready: Option<PathBuf>,
}
pub struct UpdateRuntime {
    data: Mutex<Data>,
    busy: Mutex<()>,
    cancel: watch::Sender<bool>,
    activity: RwLock<()>,
    installing: AtomicBool,
}
impl Default for UpdateRuntime {
    fn default() -> Self {
        Self {
            data: Mutex::new(Data::default()),
            busy: Mutex::new(()),
            cancel: watch::channel(false).0,
            activity: RwLock::new(()),
            installing: AtomicBool::new(false),
        }
    }
}
impl UpdateRuntime {
    pub fn network_change(&self) -> Result<tokio::sync::MutexGuard<'_, ()>, String> {
        if self.installing.load(Ordering::SeqCst) {
            return Err("update_installing".into());
        }
        self.busy.try_lock().map_err(|_| "update_busy".into())
    }
    pub fn task(&self) -> Result<RwLockReadGuard<'_, ()>, String> {
        if self.installing.load(Ordering::SeqCst) {
            return Err("update_installing".into());
        }
        self.activity
            .try_read()
            .map_err(|_| "update_installing".into())
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    current_version: String,
    supported: bool,
    release: Option<Release>,
    ready: bool,
}
#[derive(Clone, Serialize)]
pub struct Progress {
    downloaded: u64,
    total: u64,
}
fn supported() -> bool {
    cfg!(all(windows, target_arch = "x86_64"))
}
#[tauri::command]
pub async fn update_status(state: State<'_, UpdateRuntime>) -> Result<UpdateStatus, String> {
    Ok(snapshot(&state).await)
}
async fn snapshot(state: &UpdateRuntime) -> UpdateStatus {
    let data = state.data.lock().await;
    UpdateStatus {
        current_version: env!("CARGO_PKG_VERSION").into(),
        supported: supported(),
        release: data.release.clone(),
        ready: data.ready.is_some(),
    }
}
#[tauri::command]
pub async fn check_update(
    app: AppHandle,
    state: State<'_, UpdateRuntime>,
) -> Result<UpdateStatus, String> {
    if !supported() {
        return Err("update_unsupported".into());
    }
    let _busy = state.busy.try_lock().map_err(|_| "update_busy")?;
    state.cancel.send_replace(false);
    let mut cancel = state.cancel.subscribe();
    let network = super::update_network::load(&app)?;
    let result = tokio::select! { result=update_release::latest_with_config(env!("CARGO_PKG_VERSION"),&network) => result, _=cancel.wait_for(|value| *value) => Err("update_cancelled".into()) };
    match result {
        Ok(release) => {
            let mut data = state.data.lock().await;
            data.release = release;
            data.ready = None;
        }
        Err(error) => {
            crate::diagnostics::record(&app, "update.check_failed", json!({"code":error}));
            return Err(error);
        }
    }
    crate::diagnostics::record(&app, "update.checked", json!({}));
    Ok(snapshot(&state).await)
}
fn cache(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_cache_dir()
        .map_err(|_| "update_cache_failed")?
        .join("updates"))
}
async fn clean_cache(directory: &std::path::Path) -> Result<(), String> {
    tokio::fs::create_dir_all(directory)
        .await
        .map_err(|_| "update_cache_failed")?;
    let mut entries = tokio::fs::read_dir(directory)
        .await
        .map_err(|_| "update_cache_failed")?;
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|_| "update_cache_failed")?
    {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with("update-")
            && (name.ends_with(".exe") || name.ends_with(".part"))
            && entry
                .file_type()
                .await
                .map_err(|_| "update_cache_failed")?
                .is_file()
        {
            tokio::fs::remove_file(entry.path())
                .await
                .map_err(|_| "update_cache_failed")?;
        }
    }
    Ok(())
}
async fn download(
    release: &Release,
    path: &std::path::Path,
    channel: &Channel<Progress>,
    config: &super::update_network::NetworkConfig,
) -> Result<(), String> {
    let response =
        super::update_network::fetch(&release.download_url, Duration::from_secs(600), config)
            .await?;
    download_body(release, path, channel, response).await
}
async fn download_body(
    release: &Release,
    path: &std::path::Path,
    channel: &Channel<Progress>,
    mut response: reqwest::Response,
) -> Result<(), String> {
    if !response.status().is_success() {
        return Err("update_network_failed".into());
    }
    if response
        .content_length()
        .is_some_and(|size| size != release.size)
    {
        return Err("update_integrity_failed".into());
    }
    let mut file = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .await
        .map_err(|_| "update_cache_failed")?;
    let mut received = 0u64;
    let mut hash = Sha256::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(update_release::network_error)?
    {
        received += chunk.len() as u64;
        if received > release.size {
            return Err("update_integrity_failed".into());
        }
        file.write_all(&chunk)
            .await
            .map_err(|_| "update_cache_failed")?;
        hash.update(&chunk);
        channel
            .send(Progress {
                downloaded: received,
                total: release.size,
            })
            .map_err(|_| "update_cancelled")?;
    }
    file.flush().await.map_err(|_| "update_cache_failed")?;
    if received != release.size || format!("{:x}", hash.finalize()) != release.sha256 {
        return Err("update_integrity_failed".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    state: State<'_, UpdateRuntime>,
    on_event: Channel<Progress>,
) -> Result<UpdateStatus, String> {
    let _busy = state.busy.try_lock().map_err(|_| "update_busy")?;
    state.cancel.send_replace(false);
    let mut cancel = state.cancel.subscribe();
    let release = state
        .data
        .lock()
        .await
        .release
        .clone()
        .ok_or("update_check_first")?;
    state.data.lock().await.ready = None;
    let directory = cache(&app)?;
    clean_cache(&directory).await?;
    let partial = directory.join(format!("update-{}.part", release.version));
    let ready = directory.join(format!("update-{}.exe", release.version));
    let config = super::update_network::load(&app)?;
    let result = tokio::select! { result=download(&release,&partial,&on_event,&config) => result, _=cancel.wait_for(|v| *v) => Err("update_cancelled".into()) };
    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&partial).await;
        crate::diagnostics::record(&app, "update.download_failed", json!({"code":error}));
        return Err(error);
    }
    tokio::fs::rename(&partial, &ready)
        .await
        .map_err(|_| "update_cache_failed")?;
    state.data.lock().await.ready = Some(ready);
    crate::diagnostics::record(
        &app,
        "update.downloaded",
        json!({"version":release.version}),
    );
    Ok(snapshot(&state).await)
}
#[tauri::command]
pub fn cancel_update(state: State<'_, UpdateRuntime>) {
    state.cancel.send_replace(true);
}
#[tauri::command]
pub async fn clear_update_cache(
    app: AppHandle,
    state: State<'_, UpdateRuntime>,
) -> Result<(), String> {
    let _busy = state.busy.try_lock().map_err(|_| "update_busy")?;
    if state.installing.load(Ordering::SeqCst) {
        return Err("update_installing".into());
    }
    clean_cache(&cache(&app)?).await?;
    state.data.lock().await.ready = None;
    Ok(())
}
async fn verify(path: &std::path::Path, release: &Release) -> Result<(), String> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| "update_check_first")?;
    if file
        .metadata()
        .await
        .map_err(|_| "update_integrity_failed")?
        .len()
        != release.size
    {
        return Err("update_integrity_failed".into());
    }
    let mut hash = Sha256::new();
    let mut bytes = [0u8; 65536];
    loop {
        let n = file
            .read(&mut bytes)
            .await
            .map_err(|_| "update_integrity_failed")?;
        if n == 0 {
            break;
        }
        hash.update(&bytes[..n]);
    }
    if format!("{:x}", hash.finalize()) != release.sha256 {
        return Err("update_integrity_failed".into());
    }
    Ok(())
}
#[tauri::command]
pub async fn install_update(app: AppHandle, state: State<'_, UpdateRuntime>) -> Result<(), String> {
    if !supported() || cfg!(debug_assertions) {
        return Err("update_install_release_only".into());
    }
    let _busy = state.busy.try_lock().map_err(|_| "update_busy")?;
    let _activity = state
        .activity
        .try_write()
        .map_err(|_| "update_tasks_running")?;
    if crate::collaboration::collaboration_status(app.state())
        .await?
        .is_some()
    {
        return Err("update_host_running".into());
    }
    let (release, ready) = {
        let data = state.data.lock().await;
        (
            data.release.clone().ok_or("update_check_first")?,
            data.ready.clone().ok_or("update_check_first")?,
        )
    };
    if let Err(error) = verify(&ready, &release).await {
        state.data.lock().await.ready = None;
        let _ = tokio::fs::remove_file(&ready).await;
        crate::diagnostics::record(&app, "update.integrity_failed", json!({"code":error}));
        return Err(error);
    }
    let current = std::env::current_exe().map_err(|_| "update_install_failed")?;
    let parent = dunce::simplified(&current)
        .parent()
        .ok_or("update_install_failed")?;
    let mut command = std::process::Command::new(&ready);
    command.args(["/UPDATE", "/P", "/R"]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // NSIS requires /D to be last and unquoted, even for paths with spaces.
        // This is an exe invocation, not a shell command.
        command.raw_arg(format!("/D={}", parent.display()));
        command.creation_flags(0x08000000);
    }
    command.spawn().map_err(|_| "update_install_failed")?;
    state.installing.store(true, Ordering::SeqCst);
    crate::diagnostics::record(
        &app,
        "update.installing",
        json!({"version":release.version}),
    );
    app.exit(0);
    Ok(())
}

#[cfg(test)]
#[path = "updater_tests.rs"]
mod tests;
