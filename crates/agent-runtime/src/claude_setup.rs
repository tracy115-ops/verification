use serde::Serialize;
use std::{io::Read, path::PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSetup {
    pub config_directory: String,
    pub settings_file: Option<String>,
    pub environment_auth: bool,
    pub settings_auth: bool,
    pub login_file_present: bool,
    pub key_helper_present: bool,
    pub endpoint_present: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSettingsCandidate {
    pub path: String,
    pub model: Option<String>,
    pub authentication_fields: bool,
    pub backup: bool,
}

/// Read only bounded settings metadata; choosing a file remains an explicit user action.
pub fn discover_claude_settings(
    directory: Option<PathBuf>,
) -> Result<Vec<ClaudeSettingsCandidate>, &'static str> {
    let setup = inspect_claude_setup(directory, None)?;
    let directory = PathBuf::from(setup.config_directory);
    let Ok(entries) = std::fs::read_dir(&directory) else {
        return Ok(vec![]);
    };
    let mut paths: Vec<_> = entries
        .flatten()
        .take(64)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with("settings.")
                        && (name.ends_with(".json") || name.ends_with(".json.bak"))
                })
        })
        .collect();
    paths.sort();
    let mut candidates = Vec::new();
    for path in paths.into_iter().take(12) {
        let hints = crate::read_claude_model_file(path.clone())?;
        if matches!(hints.status, "invalid" | "unavailable") {
            continue;
        }
        let metadata = inspect(directory.clone(), false, false, Some(path.clone()))?;
        candidates.push(ClaudeSettingsCandidate {
            backup: path.extension().is_some_and(|ext| ext == "bak"),
            path: path.to_string_lossy().into_owned(),
            model: hints.candidates.into_iter().next().map(|item| item.model),
            authentication_fields: metadata.settings_auth || metadata.key_helper_present,
        });
    }
    Ok(candidates)
}

fn inspect(
    directory: PathBuf,
    environment_auth: bool,
    environment_endpoint: bool,
    settings_file: Option<PathBuf>,
) -> Result<ClaudeSetup, &'static str> {
    if !directory.is_absolute() || directory.as_os_str().len() > 4096 {
        return Err("cli_config_invalid");
    }
    let path = settings_file
        .clone()
        .unwrap_or_else(|| directory.join("settings.json"));
    if !path.is_absolute() || path.as_os_str().len() > 4096 {
        return Err("cli_config_invalid");
    }
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
        settings_file: settings_file.map(|file| file.to_string_lossy().into_owned()),
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

pub fn inspect_claude_setup(
    directory: Option<PathBuf>,
    settings_file: Option<PathBuf>,
) -> Result<ClaudeSetup, &'static str> {
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
        settings_file,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn discovers_settings_without_returning_credentials_or_selecting_a_backup() {
        let directory =
            std::env::temp_dir().join(format!("claude-sources-check-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        std::fs::write(directory.join("settings.json"), "{}").unwrap();
        std::fs::write(directory.join("settings.json.bak"), r#"{"model":"fixture-model","env":{"ANTHROPIC_AUTH_TOKEN":"PRIVATE_VALUE","ANTHROPIC_BASE_URL":"https://private.invalid"}}"#).unwrap();
        std::fs::write(
            directory.join("settings.invalid.json"),
            "invalid PRIVATE_VALUE",
        )
        .unwrap();
        std::fs::write(directory.join("unrelated.json"), "{}").unwrap();
        let result = discover_claude_settings(Some(directory.clone())).unwrap();
        assert_eq!(result.len(), 2);
        let backup = result.iter().find(|item| item.backup).unwrap();
        assert!(backup.authentication_fields);
        assert_eq!(backup.model.as_deref(), Some("fixture-model"));
        let serialized = serde_json::to_string(&result).unwrap();
        assert!(!serialized.contains("PRIVATE_VALUE"));
        assert!(!serialized.contains("private.invalid"));
        assert_eq!(
            std::fs::read_to_string(directory.join("settings.json")).unwrap(),
            "{}"
        );
        std::fs::remove_dir_all(directory).unwrap();
    }
    #[test]
    fn distinguishes_desktop_environment_from_file_auth_without_returning_values() {
        let directory =
            std::env::temp_dir().join(format!("claude-auth-check-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        assert!(
            !inspect(directory.clone(), false, false, None)
                .unwrap()
                .environment_auth
        );
        assert!(
            inspect(directory.clone(), true, true, None)
                .unwrap()
                .environment_auth
        );
        std::fs::write(directory.join("settings.json"), r#"{"env":{"ANTHROPIC_AUTH_TOKEN":"SECRET_VALUE","ANTHROPIC_BASE_URL":"https://private.invalid"}}"#).unwrap();
        let result = inspect(directory.clone(), false, false, None).unwrap();
        assert!(result.settings_auth);
        assert!(result.endpoint_present);
        let text = serde_json::to_string(&result).unwrap();
        assert!(!text.contains("SECRET_VALUE"));
        assert!(!text.contains("private.invalid"));
        let custom = directory.join("custom settings.json.bak");
        std::fs::rename(directory.join("settings.json"), &custom).unwrap();
        assert!(
            !inspect(directory.clone(), false, false, None)
                .unwrap()
                .settings_auth
        );
        let explicit = inspect(directory.clone(), false, false, Some(custom.clone())).unwrap();
        assert!(explicit.settings_auth);
        assert_eq!(
            explicit.settings_file,
            Some(custom.to_string_lossy().into_owned())
        );
        assert!(
            !serde_json::to_string(&explicit)
                .unwrap()
                .contains("SECRET_VALUE")
        );
        std::fs::remove_dir_all(directory).unwrap();
    }
}
