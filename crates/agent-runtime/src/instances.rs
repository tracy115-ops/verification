use crate::discovery::DRIVERS;
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliInstance {
    pub driver: String,
    pub executable_path: String,
}

fn add(found: &mut Vec<CliInstance>, driver: &str, path: PathBuf) {
    if !path.is_absolute() || !path.is_file() || found.len() >= 100 {
        return;
    }
    let text = path.to_string_lossy().into_owned();
    if found.iter().any(|item| {
        if cfg!(windows) {
            item.executable_path.eq_ignore_ascii_case(&text)
        } else {
            item.executable_path == text
        }
    }) {
        return;
    }
    found.push(CliInstance {
        driver: driver.into(),
        executable_path: text,
    });
}

pub(crate) fn instances_in_paths(paths: &[PathBuf]) -> Vec<CliInstance> {
    let mut found = Vec::new();
    for driver in &DRIVERS {
        for base in paths {
            for suffix in if cfg!(windows) {
                &[".exe", ".cmd", ".bat"][..]
            } else {
                &[""][..]
            } {
                add(
                    &mut found,
                    driver.id,
                    base.join(format!("{}{suffix}", driver.id)),
                );
            }
            // Keep an npm shim as the selectable entry; it can establish instance settings.
            if !found.iter().any(|item| {
                item.driver == driver.id && Path::new(&item.executable_path).parent() == Some(base)
            }) {
                for entry in driver.entries {
                    add(&mut found, driver.id, base.join(entry));
                }
            }
        }
    }
    found
}

pub fn discover_cli_instances() -> Vec<CliInstance> {
    let mut paths = crate::search_paths::driver_search_paths();
    #[cfg(windows)]
    for variable in ["ProgramFiles", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(variable) {
            paths.push(PathBuf::from(base).join("CodeAgentCLI"));
        }
    }
    let mut found = instances_in_paths(&paths);
    if let Some(path) = crate::search_paths::configured_codeagent_path() {
        add(&mut found, "codeagent", path);
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn returns_multiple_installations_without_executing_or_losing_wrappers() {
        let root =
            std::env::temp_dir().join(format!("verification instances {}", std::process::id()));
        let first = root.join("one");
        let second = root.join("two");
        std::fs::create_dir_all(&first).unwrap();
        std::fs::create_dir_all(&second).unwrap();
        let name = if cfg!(windows) {
            "claude.cmd"
        } else {
            "claude"
        };
        for base in [&first, &second] {
            std::fs::write(base.join(name), "must never execute").unwrap();
        }
        let items = instances_in_paths(&[first.clone(), second.clone(), first]);
        assert_eq!(items.len(), 2);
        assert!(items.iter().all(|item| item.driver == "claude"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
