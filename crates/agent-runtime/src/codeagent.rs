use crate::discovery::LaunchSpec;
use process_runtime::ProcessGuard;
use std::{process::Stdio, time::Duration};
use tokio::{io::AsyncReadExt, process::Command, time::timeout};

pub(crate) struct McpConfig(std::path::PathBuf);
impl Drop for McpConfig {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

pub(crate) fn prepare_mcp_config(
    args: &mut [String],
    workspace: &std::path::Path,
    turn_id: &str,
) -> std::io::Result<Option<McpConfig>> {
    use std::io::Write;
    let Some(index) = args.iter().position(|arg| arg == "--mcp-config") else {
        return Ok(None);
    };
    let name = format!(".verification-mcp-{turn_id}.json");
    let path = workspace.join(&name);
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)?;
    let guard = McpConfig(path);
    file.write_all(b"{\"mcpServers\":{}}")?;
    file.flush()?;
    drop(file);
    args[index + 1] = name;
    Ok(Some(guard))
}

pub fn compatible_arguments(help: &str) -> Option<Vec<String>> {
    let required = [
        "--print",
        "--output-format",
        "stream-json",
        "--verbose",
        "--tools",
        "--strict-mcp-config",
        "--mcp-config",
        "--dangerously-skip-permissions",
    ];
    if !required.iter().all(|flag| help.contains(flag)) {
        return None;
    }
    let mut args: Vec<String> = vec![
        "--print",
        "--output-format",
        "stream-json",
        "--verbose",
        "--tools",
        "",
        "--strict-mcp-config",
        "--mcp-config",
        "{\"mcpServers\":{}}",
        "--dangerously-skip-permissions",
        "--skip-safe-check",
    ]
    .into_iter()
    .map(str::to_string)
    .collect();
    for flag in ["--include-partial-messages", "--no-session-persistence"] {
        if help.contains(flag) {
            args.push(flag.into());
        }
    }
    Some(args)
}

pub async fn checked_arguments(launch: &LaunchSpec) -> Option<Vec<String>> {
    let mut command = Command::new(&launch.program);
    crate::search_paths::configure_command(
        &mut command,
        &crate::search_paths::driver_search_paths(),
    );
    command
        .args(&launch.args)
        .arg("--help")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command.spawn().ok()?;
    let _guard = ProcessGuard::attach(&child).ok()?;
    let mut stdout = child.stdout.take()?.take(65537);
    let mut stderr = child.stderr.take()?.take(65537);
    let (mut out, mut err) = (Vec::new(), Vec::new());
    let result = timeout(Duration::from_secs(5), async {
        tokio::join!(
            child.wait(),
            stdout.read_to_end(&mut out),
            stderr.read_to_end(&mut err)
        )
    })
    .await;
    match result {
        Ok((Ok(status), Ok(_), Ok(_)))
            if status.success() && out.len() <= 65536 && err.len() <= 65536 =>
        {
            let help = format!(
                "{}\n{}",
                String::from_utf8_lossy(&out),
                String::from_utf8_lossy(&err)
            );
            compatible_arguments(&help)
        }
        _ => {
            let _ = child.kill().await;
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mcp_file_is_owned_valid_and_never_overwrites_an_existing_file() {
        let root = std::env::temp_dir().join(format!(
            "verification-mcp-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir(&root).unwrap();
        let mut args = vec!["--mcp-config".into(), "inline".into()];
        let guard = prepare_mcp_config(&mut args, &root, "owned").unwrap();
        let path = root.join(&args[1]);
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&std::fs::read(&path).unwrap()).unwrap(),
            serde_json::json!({"mcpServers": {}})
        );
        assert!(prepare_mcp_config(&mut args, &root, "owned").is_err());
        drop(guard);
        assert!(!path.exists());
        std::fs::remove_dir(root).unwrap();
    }
    #[test]
    fn interactive_launch_alone_does_not_certify_a_structured_driver() {
        assert!(compatible_arguments("codeagent --dangerously-skip-permissions").is_none());
        let help = "--print --output-format stream-json --verbose --tools --strict-mcp-config --mcp-config --dangerously-skip-permissions --skip-safe-check";
        let args = compatible_arguments(help).expect("compatible flags");
        assert!(!args.iter().any(|arg| arg == "--model"));
        assert!(args.iter().any(|arg| arg == "--skip-safe-check"));
        assert!(args.windows(2).any(|args| args == ["--tools", ""]));
        assert!(compatible_arguments(&help.replace("--strict-mcp-config", "")).is_none());
    }
}
