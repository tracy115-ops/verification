use std::path::Path;

fn parameters(directory: &Path) -> Result<String, String> {
    let directory = directory.to_str().ok_or("update_install_failed")?;
    if directory.contains(['\0', '\r', '\n', '"']) || !Path::new(directory).is_absolute() {
        return Err("update_install_failed".into());
    }
    // NSIS /D must be last, without quotes, even when the directory contains spaces.
    // /S avoids the language selector which can still appear with passive /P.
    Ok(format!("/UPDATE /S /R /D={directory}"))
}

#[cfg(windows)]
pub fn launch(installer: &Path, directory: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    let file: Vec<u16> = installer.as_os_str().encode_wide().chain(Some(0)).collect();
    let arguments: Vec<u16> = parameters(directory)?
        .encode_utf16()
        .chain(Some(0))
        .collect();
    let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    // Follow the Windows launch mechanism used by Tauri's official updater.
    // Only leave the app after Windows accepts the installer launch.
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file.as_ptr(),
            arguments.as_ptr(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        )
    };
    if result as isize <= 32 {
        Err("update_install_failed".into())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
pub fn launch(_installer: &Path, directory: &Path) -> Result<(), String> {
    let _ = parameters(directory)?;
    Err("update_install_release_only".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn silent_restart_parameters_keep_the_full_install_directory_last() {
        let root = std::env::temp_dir().join("Verification 工作台 with spaces");
        let value = parameters(&root).unwrap();
        assert_eq!(value, format!("/UPDATE /S /R /D={}", root.display()));
        assert!(!value.contains("/P"));
        assert!(parameters(Path::new("relative")).is_err());
        assert!(parameters(&std::env::temp_dir().join("bad\npath")).is_err());
    }
}
