use std::{ffi::OsString, path::PathBuf};

pub fn driver_search_paths() -> Vec<PathBuf> {
    let mut values = Vec::new();
    if let Some(value) = std::env::var_os("PATH") {
        values.push(value);
    }
    #[cfg(windows)]
    for value in windows_environment("Path") {
        values.push(value);
    }
    let paths = merge_paths(values);
    #[cfg(windows)]
    let paths = {
        let mut paths = paths;
        for (variable, suffix) in [
            ("APPDATA", "npm"),
            ("LOCALAPPDATA", "Microsoft/WinGet/Links"),
            ("USERPROFILE", ".local/bin"),
            ("USERPROFILE", ".bun/bin"),
            ("ProgramFiles", "nodejs"),
        ] {
            if let Some(base) = std::env::var_os(variable) {
                push_path(&mut paths, PathBuf::from(base).join(suffix));
            }
        }
        paths
    };
    paths
}

pub fn configured_codeagent_path() -> Option<PathBuf> {
    if let Some(value) = std::env::var_os("CODEAGENT_CLI_PATH") {
        return Some(value.into());
    }
    #[cfg(windows)]
    return windows_environment("CODEAGENT_CLI_PATH")
        .into_iter()
        .next()
        .map(PathBuf::from);
    #[cfg(not(windows))]
    None
}

fn merge_paths(values: impl IntoIterator<Item = OsString>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for value in values {
        for path in std::env::split_paths(&value) {
            push_path(&mut paths, path);
        }
    }
    paths
}

fn push_path(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if path.is_absolute() && !paths.contains(&path) {
        paths.push(path);
    }
}

pub fn configure_command(command: &mut tokio::process::Command, paths: &[PathBuf]) {
    if let Ok(value) = std::env::join_paths(paths) {
        command.env("PATH", value);
    }
}

#[cfg(windows)]
fn windows_environment(name: &str) -> Vec<OsString> {
    use std::os::windows::ffi::OsStringExt;
    use windows_sys::Win32::System::Registry::{
        HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, RRF_RT_REG_SZ, RegGetValueW,
    };
    let wide = |value: &str| value.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let name = wide(name);
    let mut values = Vec::new();
    for (root, key) in [
        (HKEY_CURRENT_USER, "Environment"),
        (
            HKEY_LOCAL_MACHINE,
            "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
        ),
    ] {
        let key = wide(key);
        let mut buffer = vec![0u16; 32768];
        let mut size = (buffer.len() * 2) as u32;
        let result = unsafe {
            RegGetValueW(
                root,
                key.as_ptr(),
                name.as_ptr(),
                // REG_EXPAND_SZ is expanded and converted to REG_SZ by the API.
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buffer.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if result == 0 && size >= 2 && size as usize <= buffer.len() * 2 {
            let end = buffer
                .iter()
                .position(|value| *value == 0)
                .unwrap_or(buffer.len());
            values.push(OsString::from_wide(&buffer[..end]));
        }
    }
    values
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(windows)]
    #[test]
    fn reads_current_windows_path_without_modifying_the_registry() {
        assert!(!windows_environment("Path").is_empty());
    }

    #[test]
    fn merges_updated_paths_without_reordering_existing_commands() {
        let first = std::env::temp_dir().join("verification-path-first");
        let second = std::env::temp_dir().join("verification-path-second");
        let third = std::env::temp_dir().join("verification-path-third");
        let original = std::env::join_paths([&first, &second]).unwrap();
        let updated = std::env::join_paths([&second, &third]).unwrap();
        assert_eq!(merge_paths([original, updated]), vec![first, second, third]);
        assert!(merge_paths([OsString::new(), OsString::from("relative")]).is_empty());
    }
}
