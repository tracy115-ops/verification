use crate::DriverId;
use serde::Serialize;
use std::{
    fs::File,
    io::Read,
    path::{Path, PathBuf},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHint {
    pub model: String,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelHints {
    pub status: &'static str,
    pub candidates: Vec<ModelHint>,
}

pub fn read_claude_model_file(path: PathBuf) -> Result<ModelHints, &'static str> {
    if !path.is_absolute() || path.as_os_str().len() > 4096 {
        return Err("cli_config_invalid");
    }
    Ok(read_settings(&path, DriverId::Claude, vec![]))
}

fn add(candidates: &mut Vec<ModelHint>, model: Option<&str>, source: &str) {
    if let Some(model) = model.filter(|value| {
        !value.trim().is_empty()
            && value.len() <= 200
            && !value.starts_with('-')
            && !value.chars().any(char::is_control)
    }) {
        candidates.push(ModelHint {
            model: model.into(),
            source: source.into(),
        });
    }
}

fn read_settings(path: &Path, driver: DriverId, mut candidates: Vec<ModelHint>) -> ModelHints {
    let read = || -> Result<String, ()> {
        let metadata = std::fs::metadata(path).map_err(|_| ())?;
        if !metadata.is_file() || metadata.len() > 262_144 {
            return Err(());
        }
        let file = File::open(path).map_err(|_| ())?;
        let mut bytes = Vec::new();
        file.take(262_145).read_to_end(&mut bytes).map_err(|_| ())?;
        if bytes.len() > 262_144 {
            return Err(());
        }
        String::from_utf8(bytes).map_err(|_| ())
    };
    let Ok(text) = read() else {
        return ModelHints {
            status: if candidates.is_empty() {
                "unavailable"
            } else {
                "found"
            },
            candidates,
        };
    };
    let source = path.to_string_lossy();
    let parsed = match driver {
        DriverId::Codex => toml::from_str::<toml::Table>(&text).ok().map(|value| {
            add(
                &mut candidates,
                value.get("model").and_then(|value| value.as_str()),
                &source,
            );
        }),
        DriverId::Claude => serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .map(|value| {
                add(
                    &mut candidates,
                    value.get("model").and_then(|value| value.as_str()),
                    &source,
                );
                add(
                    &mut candidates,
                    value
                        .pointer("/env/ANTHROPIC_MODEL")
                        .and_then(|value| value.as_str()),
                    &source,
                );
            }),
        _ => None,
    };
    ModelHints {
        status: if parsed.is_none() {
            "invalid"
        } else if candidates.is_empty() {
            "empty"
        } else {
            "found"
        },
        candidates,
    }
}

pub fn read_model_hints(
    driver: DriverId,
    directory: Option<PathBuf>,
) -> Result<ModelHints, &'static str> {
    if matches!(driver, DriverId::Codeagent | DriverId::Pi) {
        return Ok(ModelHints {
            status: "unsupported",
            candidates: vec![],
        });
    }
    if directory.is_some() && !matches!(driver, DriverId::Claude) {
        return Err("cli_config_invalid");
    }
    let home =
        std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from);
    let (directory, name) = match driver {
        DriverId::Claude => (
            directory
                .or_else(|| std::env::var_os("CLAUDE_CONFIG_DIR").map(PathBuf::from))
                .or_else(|| home.map(|path| path.join(".claude"))),
            "settings.json",
        ),
        _ => (
            std::env::var_os("CODEX_HOME")
                .map(PathBuf::from)
                .or_else(|| home.map(|path| path.join(".codex"))),
            "config.toml",
        ),
    };
    let mut candidates = Vec::new();
    if matches!(driver, DriverId::Claude) {
        add(
            &mut candidates,
            std::env::var("ANTHROPIC_MODEL").ok().as_deref(),
            "ANTHROPIC_MODEL",
        );
    }
    let Some(directory) = directory else {
        return Ok(ModelHints {
            status: if candidates.is_empty() {
                "unavailable"
            } else {
                "found"
            },
            candidates,
        });
    };
    if !directory.is_absolute() || directory.as_os_str().len() > 4096 {
        return Err("cli_config_invalid");
    }
    Ok(read_settings(&directory.join(name), driver, candidates))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reads_only_model_fields_and_never_returns_secrets_or_parse_errors() {
        let dir = std::env::temp_dir().join(format!("model-hints-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("settings.json");
        std::fs::write(
            &path,
            r#"{"model":"fixture-model","env":{"ANTHROPIC_AUTH_TOKEN":"secret"}}"#,
        )
        .unwrap();
        let hints = read_settings(&path, DriverId::Claude, vec![]);
        assert_eq!(hints.candidates[0].model, "fixture-model");
        assert!(!serde_json::to_string(&hints).unwrap().contains("secret"));
        let explicit = read_claude_model_file(path.clone()).unwrap();
        assert_eq!(explicit.candidates[0].model, "fixture-model");
        assert!(read_claude_model_file(PathBuf::from("relative.json")).is_err());
        std::fs::write(&path, "not json secret").unwrap();
        let hints = read_settings(&path, DriverId::Claude, vec![]);
        assert_eq!(hints.status, "invalid");
        assert!(hints.candidates.is_empty());
        std::fs::write(
            &path,
            "model = 'fixture-model'\n[providers.internal]\napi_key = 'secret'",
        )
        .unwrap();
        let hints = read_settings(&path, DriverId::Codex, vec![]);
        assert_eq!(hints.candidates[0].model, "fixture-model");
        assert!(!serde_json::to_string(&hints).unwrap().contains("secret"));
        std::fs::write(&path, vec![b'x'; 262_145]).unwrap();
        let hints = read_settings(&path, DriverId::Claude, vec![]);
        assert!(hints.candidates.is_empty());
        assert!(read_model_hints(DriverId::Claude, Some(PathBuf::from("relative"))).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
