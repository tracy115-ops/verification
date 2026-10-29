use crate::discovery::{DRIVERS, resolve_driver};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "verification batch {} {}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root).expect("exclusive batch fixture");
        Self(root)
    }
}

#[tokio::test]
async fn headless_codeagent_skips_the_project_trust_prompt_and_finishes_a_real_batch_turn() {
    let fixture = Fixture::new();
    let node = crate::search_paths::driver_search_paths()
        .iter()
        .map(|p| p.join("node.exe"))
        .find(|p| p.is_file())
        .unwrap();
    fs::write(fixture.0.join("cli.cjs"),r#"
const a=process.argv.slice(2);
if(a.includes('--help')) console.log('--print --output-format stream-json --verbose --tools --strict-mcp-config --mcp-config --dangerously-skip-permissions');
else if(!a.includes('--skip-safe-check')) { console.error('Quick safety check: only use --print in a directory you trust. Hint: --skip-safe-check'); process.exit(21); }
else { let text=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',v=>text+=v); process.stdin.on('end',()=>console.log(JSON.stringify({type:'result',is_error:false,result:text,session_id:'fixture-session'}))); }
"#).unwrap();
    fs::write(
        fixture.0.join("codeagent.bat"),
        format!(
            "@echo off\r\n\"{}\" \"%~dp0cli.cjs\" %*\r\n",
            node.display()
        ),
    )
    .unwrap();
    let blocked = Command::new(fixture.0.join("codeagent.bat"))
        .arg("--print")
        .output()
        .unwrap();
    assert!(!blocked.status.success());
    assert_eq!(
        crate::failure::classify(&String::from_utf8_lossy(&blocked.stderr)),
        Some("cli_trust_required")
    );
    let request = crate::TurnRequest {
        turn_id: "12345678-1234-1234-1234-123456789abc".into(),
        session_id: "12345678-1234-1234-1234-123456789abc".into(),
        driver: crate::DriverId::Codeagent,
        prompt: "你好，测试非交互调用".into(),
        model: String::new(),
        timeout_seconds: 5,
    };
    let (_sender, receiver) = tokio::sync::oneshot::channel();
    let outcome = crate::conversation::run_turn_in_paths(
        request,
        &fixture.0.canonicalize().unwrap(),
        receiver,
        |_| true,
        std::slice::from_ref(&fixture.0),
    )
    .await;
    assert_eq!(outcome.status, "completed");
    assert_eq!(outcome.text, "你好，测试非交互调用");
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let root = self.0.canonicalize().expect("owned fixture");
        assert_eq!(
            root.parent(),
            Some(std::env::temp_dir().canonicalize().unwrap().as_path())
        );
        assert!(
            root.file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("verification batch ")
        );
        fs::remove_dir_all(root).expect("remove owned fixture");
    }
}

#[tokio::test]
async fn custom_codeagent_cmd_is_detected_without_assuming_an_npm_layout() {
    let fixture = Fixture::new();
    fs::write(
        fixture.0.join("codeagent.cmd"),
        "@echo off\r\necho 1.2605.05.02 (codeAgentCLI)\r\n",
    )
    .unwrap();
    let detected = crate::probe::probe(&DRIVERS[0], std::slice::from_ref(&fixture.0)).await;
    assert_eq!(detected.status, "found");
    assert!(detected.executable.unwrap().ends_with("codeagent.cmd"));
    assert_eq!(
        detected.version.as_deref(),
        Some("1.2605.05.02 (codeAgentCLI)")
    );
}

#[tokio::test]
async fn codeagent_bat_in_a_spaced_path_preserves_version_flags_json_and_stdin() {
    let fixture = Fixture::new();
    let node = crate::search_paths::driver_search_paths()
        .iter()
        .map(|base| base.join("node.exe"))
        .find(|file| file.is_file())
        .expect("Node fixture runtime");
    let script = fixture.0.join("fixture.cjs");
    fs::write(&script, r#"
const args = process.argv.slice(2);
if (args.includes('--version')) console.log('1.2605.05.02 (codeAgentCLI)');
else if (args.includes('--help')) console.log('--print --output-format stream-json --verbose --tools --strict-mcp-config --mcp-config --dangerously-skip-permissions --skip-safe-check');
else { let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', s => input += s); process.stdin.on('end', () => console.log(JSON.stringify({args, input, cwd: process.cwd()}))); }
"#).unwrap();
    fs::write(
        fixture.0.join("codeagent.bat"),
        format!(
            "@echo off\r\n\"{}\" \"%~dp0fixture.cjs\" %*\r\n",
            node.display()
        ),
    )
    .unwrap();
    let launch = resolve_driver(&DRIVERS[0], std::slice::from_ref(&fixture.0))
        .expect("resolve installed .bat");
    let version = Command::new(&launch.program)
        .args(&launch.args)
        .arg("--version")
        .output()
        .unwrap();
    assert!(version.status.success());
    assert_eq!(
        String::from_utf8_lossy(&version.stdout).trim(),
        "1.2605.05.02 (codeAgentCLI)"
    );
    let detected = crate::probe::probe(&DRIVERS[0], std::slice::from_ref(&fixture.0)).await;
    assert_eq!(detected.status, "found");
    assert_eq!(
        detected.version.as_deref(),
        Some("1.2605.05.02 (codeAgentCLI)")
    );
    assert!(detected.executable.unwrap().ends_with("codeagent.bat"));
    assert!(detected.reason.is_none());
    let args = crate::codeagent::checked_arguments(&launch)
        .await
        .expect("batch help capability check");
    let mut child = Command::new(&launch.program)
        .current_dir(fixture.0.canonicalize().unwrap())
        .args(&launch.args)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let prompt = "中文 & echo should-not-run | %PATH% !name! $(test)\nsecond line";
    child
        .stdin
        .take()
        .unwrap()
        .write_all(prompt.as_bytes())
        .unwrap();
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let echoed: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(echoed["args"], serde_json::json!(args));
    assert_eq!(echoed["input"], prompt);
    assert_eq!(
        PathBuf::from(echoed["cwd"].as_str().unwrap())
            .canonicalize()
            .unwrap(),
        fixture.0.canonicalize().unwrap()
    );
}
