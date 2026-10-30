use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub installer: PathBuf,
    pub application: PathBuf,
    pub parent_pid: u32,
    pub version: String,
    pub size: u64,
    pub sha256: String,
}

fn receipt(root: &Path, request: &Request, status: &str, exit_code: Option<i32>) {
    let value =
        serde_json::json!({"version":request.version,"status":status,"exit_code":exit_code});
    let _ = fs::write(root.join("last-install.json"), value.to_string());
}

#[cfg(windows)]
fn wait_for_parent(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, ERROR_INVALID_PARAMETER, GetLastError},
        System::Threading::{OpenProcess, WaitForSingleObject},
    };
    if pid == 0 {
        return Ok(());
    }
    let process = unsafe { OpenProcess(0x00100000, 0, pid) }; // SYNCHRONIZE
    if process.is_null() {
        return if unsafe { GetLastError() } == ERROR_INVALID_PARAMETER {
            Ok(())
        } else {
            Err("parent_wait_failed".into())
        };
    }
    let result = unsafe { WaitForSingleObject(process, 60000) };
    unsafe {
        CloseHandle(process);
    }
    if result == 0 {
        Ok(())
    } else {
        Err("parent_exit_timeout".into())
    }
}
#[cfg(not(windows))]
fn wait_for_parent(_pid: u32) -> Result<(), String> {
    Err("unsupported".into())
}

fn verify(request: &Request, root: &Path) -> Result<(), String> {
    let _ =
        crate::update_install::parameters(request.application.parent().ok_or("request_invalid")?)?;
    if request.installer.parent() != Some(root)
        || request
            .installer
            .extension()
            .and_then(|value| value.to_str())
            != Some("exe")
        || request.size == 0
        || !request.application.is_absolute()
        || request
            .application
            .file_name()
            .and_then(|name| name.to_str())
            != Some("verification-desktop.exe")
        || semver::Version::parse(&request.version).is_err()
        || request.size > crate::update_release::MAX_INSTALLER
    {
        return Err("request_invalid".into());
    }
    let mut file = fs::File::open(&request.installer).map_err(|_| "installer_missing")?;
    if file.metadata().map_err(|_| "installer_missing")?.len() != request.size {
        return Err("integrity_failed".into());
    }
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|_| "integrity_failed")?;
        if count == 0 {
            break;
        }
        hash.update(&buffer[..count]);
    }
    if format!("{:x}", hash.finalize()) != request.sha256 {
        return Err("integrity_failed".into());
    }
    Ok(())
}

fn apply(root: &Path, request: &Request) -> Result<(), String> {
    receipt(root, request, "checking", None);
    verify(request, root)?;
    receipt(root, request, "waiting_for_app_exit", None);
    wait_for_parent(request.parent_pid)?;
    let directory = request.application.parent().ok_or("request_invalid")?;
    let mut command = Command::new(&request.installer);
    command
        .args(["/UPDATE", "/S"])
        .current_dir(std::env::temp_dir());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.raw_arg(format!("/D={}", directory.display()));
        command.creation_flags(0x08000000);
    }
    receipt(root, request, "installing", None);
    let mut installer = command.spawn().map_err(|error| {
        receipt(
            root,
            request,
            "installer_start_failed",
            error.raw_os_error(),
        );
        "installer_start_failed"
    })?;
    let started = Instant::now();
    loop {
        if let Some(status) = installer.try_wait().map_err(|_| "installer_wait_failed")? {
            receipt(root, request, "installer_exited", status.code());
            if !status.success() {
                return Err("installer_failed".into());
            }
            break;
        }
        if started.elapsed() > Duration::from_secs(600) {
            let _ = installer.kill();
            let _ = installer.wait();
            return Err("installer_timeout".into());
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    let mut restart = Command::new(&request.application);
    restart.current_dir(directory);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        restart.creation_flags(0x08000000);
    }
    receipt(root, request, "restart_started", None);
    restart.spawn().map_err(|error| {
        receipt(root, request, "restart_failed", error.raw_os_error());
        "restart_failed"
    })?;
    Ok(())
}

pub fn dispatch() -> Option<i32> {
    let args: Vec<_> = std::env::args_os().collect();
    if args
        .get(1)
        .is_none_or(|value| value != "--verification-update-worker")
    {
        return None;
    }
    let result = (|| {
        let path = PathBuf::from(args.get(2).ok_or("request_invalid")?);
        if args.len() != 3 || !path.is_absolute() {
            return Err("request_invalid".into());
        }
        let root = path.parent().ok_or("request_invalid")?;
        if fs::metadata(&path).map_err(|_| "request_invalid")?.len() > 8192 {
            return Err("request_invalid".into());
        }
        let request: Request =
            serde_json::from_slice(&fs::read(&path).map_err(|_| "request_invalid")?)
                .map_err(|_| "request_invalid")?;
        if let Err(error) = apply(root, &request) {
            let exit_code = fs::read(root.join("last-install.json"))
                .ok()
                .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
                .and_then(|value| value["exit_code"].as_i64())
                .and_then(|value| i32::try_from(value).ok());
            receipt(root, &request, &error, exit_code);
            return Err(error);
        }
        Ok::<(), String>(())
    })();
    Some(if result.is_ok() { 0 } else { 1 })
}

pub fn report(app: &tauri::AppHandle) {
    use tauri::Manager;
    let Ok(root) = app.path().app_cache_dir() else {
        return;
    };
    let path = root.join("updates/last-install.json");
    if !fs::metadata(&path)
        .map(|value| value.len() <= 8192)
        .unwrap_or(false)
    {
        return;
    }
    let Ok(bytes) = fs::read(&path) else {
        return;
    };
    let Ok(mut value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return;
    };
    if value["status"] == "restart_started" {
        value["status"] = serde_json::json!(if value["version"] == env!("CARGO_PKG_VERSION") {
            "completed"
        } else {
            "version_mismatch"
        });
        let _ = fs::write(&path, value.to_string());
    }
    crate::diagnostics::record(app, "update.last_result", value);
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_tampering_and_preserves_safe_stage_records() {
        let root = tempfile::tempdir().unwrap();
        let installer = root.path().join("update.exe");
        fs::write(&installer, b"fixture").unwrap();
        let request = Request {
            installer: installer.clone(),
            application: root.path().join("verification-desktop.exe"),
            parent_pid: 0,
            version: "0.4.2".into(),
            size: 7,
            sha256: format!("{:x}", Sha256::digest(b"fixture")),
        };
        assert!(verify(&request, root.path()).is_ok());
        fs::write(&installer, b"changed").unwrap();
        assert_eq!(
            verify(&request, root.path()).unwrap_err(),
            "integrity_failed"
        );
        receipt(root.path(), &request, "installer_failed", Some(193));
        let text = fs::read_to_string(root.path().join("last-install.json")).unwrap();
        assert!(text.contains("193"));
        assert!(!text.contains("installer.exe"));
        assert!(!text.contains(&root.path().to_string_lossy().to_string()));
    }
}
