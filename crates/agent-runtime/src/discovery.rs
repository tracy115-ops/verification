use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

pub struct DriverSpec {
    pub id: &'static str,
    pub entries: &'static [&'static str],
}

pub const DRIVERS: [DriverSpec; 3] = [
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
        let entry = base.join(DRIVERS[0].entries[0]);
        fs::create_dir_all(entry.parent().expect("entry parent")).expect("create fixture");
        fs::write(&entry, "").expect("write entry");
        let node = base.join(if cfg!(windows) { "node.exe" } else { "node" });
        fs::write(&node, "").expect("write node fixture");
        let result = resolve_driver(&DRIVERS[0], std::slice::from_ref(&base)).expect("resolve");
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
}
