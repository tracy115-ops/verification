use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

pub struct DriverSpec {
    pub id: &'static str,
    pub entries: &'static [&'static str],
}

pub const DRIVERS: [DriverSpec; 4] = [
    DriverSpec {
        id: "codeagent",
        entries: &[],
    },
    DriverSpec {
        id: "codex",
        entries: &["node_modules/@openai/codex/bin/codex.js"],
    },
    DriverSpec {
        id: "claude",
        entries: &[
            "node_modules/@anthropic-ai/claude-code/bin/claude.exe",
            "node_modules/@anthropic-ai/claude-code/cli.js",
        ],
    },
    DriverSpec {
        id: "pi",
        entries: &[
            "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js",
            "node_modules/@mariozechner/pi-coding-agent/dist/cli.js",
        ],
    },
];

#[derive(Debug)]
pub struct LaunchSpec {
    pub program: PathBuf,
    pub args: Vec<OsString>,
}

fn find_node(paths: &[PathBuf]) -> Option<PathBuf> {
    let name = if cfg!(windows) { "node.exe" } else { "node" };
    paths
        .iter()
        .map(|base| base.join(name))
        .find(|path| path.is_file())
}

pub fn resolve_driver(spec: &DriverSpec, paths: &[PathBuf]) -> Option<LaunchSpec> {
    if spec.id == "codeagent"
        && let Some(file) = std::env::var_os("CODEAGENT_CLI_PATH").map(PathBuf::from)
        && let Some(launch) = explicit_launch(&file, paths)
    {
        return Some(launch);
    }
    for base in paths {
        let native_name = if cfg!(windows) {
            format!("{}.exe", spec.id)
        } else {
            spec.id.to_string()
        };
        let native = base.join(native_name);
        if native.is_file() {
            return Some(LaunchSpec {
                program: native,
                args: vec![],
            });
        }
        if spec.id == "codeagent"
            && let Some(launch) = npm_shim(&base.join("codeagent.cmd"), paths)
        {
            return Some(launch);
        }
        for entry in spec.entries {
            let candidate = base.join(Path::new(entry));
            if !candidate.is_file() {
                continue;
            }
            if candidate
                .extension()
                .is_some_and(|extension| extension == "js")
            {
                let node = find_node(paths)?;
                return Some(LaunchSpec {
                    program: node,
                    args: vec![candidate.into_os_string()],
                });
            }
            return Some(LaunchSpec {
                program: candidate,
                args: vec![],
            });
        }
    }
    None
}

fn explicit_launch(file: &Path, paths: &[PathBuf]) -> Option<LaunchSpec> {
    if !file.is_file() {
        return None;
    }
    match file.extension().and_then(|value| value.to_str()) {
        Some("js" | "mjs") => Some(LaunchSpec {
            program: find_node(paths)?,
            args: vec![file.as_os_str().into()],
        }),
        Some("exe") => Some(LaunchSpec {
            program: file.into(),
            args: vec![],
        }),
        Some("cmd") => npm_shim(file, paths),
        _ if cfg!(unix) => Some(LaunchSpec {
            program: file.into(),
            args: vec![],
        }),
        _ => None,
    }
}

fn npm_shim(file: &Path, paths: &[PathBuf]) -> Option<LaunchSpec> {
    let metadata = std::fs::metadata(file).ok()?;
    if metadata.len() > 32768 {
        return None;
    }
    let text = std::fs::read_to_string(file).ok()?;
    let base = file.parent()?.canonicalize().ok()?;
    let mut candidates = Vec::new();
    for part in text.split('"') {
        let relative = part
            .strip_prefix("%dp0%\\")
            .or_else(|| part.strip_prefix("%~dp0\\"));
        let Some(relative) = relative else {
            continue;
        };
        if !relative.starts_with("node_modules\\")
            || !(relative.ends_with(".js") || relative.ends_with(".mjs"))
        {
            continue;
        }
        let candidate = base.join(relative.replace('\\', "/")).canonicalize().ok()?;
        if !candidate.starts_with(base.join("node_modules")) {
            return None;
        }
        if candidate.is_file() && !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }
    if candidates.len() != 1 {
        return None;
    }
    Some(LaunchSpec {
        program: find_node(paths)?,
        args: vec![candidates.pop()?.into_os_string()],
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        time::{SystemTime, UNIX_EPOCH},
    };

    #[test]
    fn missing_installation_does_not_fall_back_to_a_shell() {
        assert!(resolve_driver(&DRIVERS[0], &[]).is_none());
    }

    #[test]
    fn npm_entry_with_spaces_is_passed_as_one_argument() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base = std::env::temp_dir().join(format!("verification CLI test {nonce}"));
        let entry = base.join(DRIVERS[1].entries[0]);
        fs::create_dir_all(entry.parent().expect("entry parent")).expect("create fixture");
        fs::write(&entry, "").expect("write entry");
        let node = base.join(if cfg!(windows) { "node.exe" } else { "node" });
        fs::write(&node, "").expect("write node fixture");
        let result = resolve_driver(&DRIVERS[1], std::slice::from_ref(&base)).expect("resolve");
        assert_eq!(result.program, node);
        assert_eq!(result.args, vec![entry.into_os_string()]);
        let resolved = base.canonicalize().expect("resolve owned fixture");
        let temp_root = std::env::temp_dir()
            .canonicalize()
            .expect("resolve temp root");
        assert!(resolved.starts_with(&temp_root));
        assert_eq!(resolved.parent(), Some(temp_root.as_path()));
        fs::remove_dir_all(&resolved).expect("remove owned fixture");
    }

    #[test]
    fn codeagent_npm_shim_resolves_the_script_without_running_a_shell() {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let base = std::env::temp_dir().join(format!("verification-codeagent-{nonce}"));
        let entry = base.join("node_modules/internal-codeagent/cli.js");
        fs::create_dir_all(entry.parent().expect("parent")).expect("create");
        fs::write(&entry, "").expect("entry");
        let node = base.join(if cfg!(windows) { "node.exe" } else { "node" });
        fs::write(&node, "").expect("node");
        let shim = base.join("codeagent.cmd");
        fs::write(
            &shim,
            "@echo off\n\"%dp0%\\node_modules\\internal-codeagent\\cli.js\" %*\n",
        )
        .expect("shim");
        let launch = npm_shim(&shim, std::slice::from_ref(&base)).expect("resolve shim");
        assert_eq!(launch.program, node);
        assert_eq!(
            launch.args,
            vec![
                entry
                    .canonicalize()
                    .expect("canonical entry")
                    .into_os_string()
            ]
        );
        let resolved = base.canonicalize().expect("owned fixture");
        let temp_root = std::env::temp_dir().canonicalize().expect("temp root");
        assert_eq!(resolved.parent(), Some(temp_root.as_path()));
        fs::remove_dir_all(resolved).expect("remove owned fixture");
    }
}
