use serde::Serialize;
use std::{io::Read, path::PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSetup {
    pub config_directory: String,
    pub environment_auth: bool,
    pub settings_auth: bool,
    pub login_file_present: bool,
    pub key_helper_present: bool,
    pub endpoint_present: bool,
}

fn inspect(
    directory: PathBuf,
    environment_auth: bool,
    environment_endpoint: bool,
) -> Result<ClaudeSetup, &'static str> {
    if !directory.is_absolute() || directory.as_os_str().len() > 4096 {
        return Err("cli_config_invalid");
    }
    let path = directory.join("settings.json");
    let read = || -> Option<serde_json::Value> {
        let metadata = std::fs::metadata(&path).ok()?;
        if !metadata.is_file() || metadata.len() > 262_144 {
            return None;
        }
        let mut bytes = Vec::new();
        std::fs::File::open(&path)
            .ok()?
            .take(262_145)
            .read_to_end(&mut bytes)
            .ok()?;
        if bytes.len() > 262_144 {
            return None;
        }
        serde_json::from_slice(&bytes).ok()
    };
    let settings = read().unwrap_or_default();
    let present = |pointer| {
        settings
            .pointer(pointer)
            .and_then(|value| value.as_str())
            .is_some_and(|value| !value.trim().is_empty())
    };
    Ok(ClaudeSetup {
        environment_auth,
        settings_auth: present("/env/ANTHROPIC_API_KEY")
            || present("/env/ANTHROPIC_AUTH_TOKEN")
            || present("/env/CLAUDE_CODE_OAUTH_TOKEN"),
        login_file_present: directory.join(".credentials.json").is_file(),
        key_helper_present: present("/apiKeyHelper"),
        endpoint_present: environment_endpoint || present("/env/ANTHROPIC_BASE_URL"),
        config_directory: directory.to_string_lossy().into_owned(),
    })
}

pub fn inspect_claude_setup(directory: Option<PathBuf>) -> Result<ClaudeSetup, &'static str> {
    let directory = directory
        .or_else(|| std::env::var_os("CLAUDE_CONFIG_DIR").map(PathBuf::from))
        .or_else(|| {
            std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" })
                .map(|home| PathBuf::from(home).join(".claude"))
        })
        .ok_or("cli_config_invalid")?;
    let present = |name| std::env::var_os(name).is_some_and(|value| !value.is_empty());
    inspect(
        directory,
        [
            "ANTHROPIC_API_KEY",
            "ANTHROPIC_AUTH_TOKEN",
            "CLAUDE_CODE_OAUTH_TOKEN",
        ]
        .into_iter()
        .any(present),
        present("ANTHROPIC_BASE_URL"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn distinguishes_desktop_environment_from_file_auth_without_returning_values() {
        let directory =
            std::env::temp_dir().join(format!("claude-auth-check-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        assert!(
            !inspect(directory.clone(), false, false)
                .unwrap()
                .environment_auth
        );
        assert!(
            inspect(directory.clone(), true, true)
                .unwrap()
                .environment_auth
        );
        std::fs::write(directory.join("settings.json"), r#"{"env":{"ANTHROPIC_AUTH_TOKEN":"SECRET_VALUE","ANTHROPIC_BASE_URL":"https://private.invalid"}}"#).unwrap();
        let result = inspect(directory.clone(), false, false).unwrap();
        assert!(result.settings_auth);
        assert!(result.endpoint_present);
        let text = serde_json::to_string(&result).unwrap();
        assert!(!text.contains("SECRET_VALUE"));
        assert!(!text.contains("private.invalid"));
        std::fs::remove_dir_all(directory).unwrap();
    }
}
