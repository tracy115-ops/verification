use super::supervise;
use crate::{DriverId, TurnRequest};
use std::{path::Path, process::Stdio, time::Duration};
use tokio::{process::Command, sync::oneshot};

fn request() -> TurnRequest {
    TurnRequest {
        turn_id: "12345678-1234-1234-1234-123456789abc".into(),
        session_id: "12345678-1234-1234-1234-123456789abc".into(),
        driver: DriverId::Codex,
        prompt: "hello 中文 $(never execute)".into(),
        model: "fixture-model".into(),
        timeout_seconds: 5,
    }
}

fn fixture(mode: &str, pid_file: Option<&Path>) -> tokio::process::Child {
    let mut command = Command::new("node");
    command
        .arg(Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/cli-fixture.mjs"))
        .arg(mode);
    if let Some(file) = pid_file {
        command.arg(file);
    }
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    #[cfg(windows)]
    command.creation_flags(0x08000000);
    #[cfg(unix)]
    command.process_group(0);
    command.spawn().expect("Node.js fixture runtime")
}

#[tokio::test]
async fn streams_fragmented_json_and_preserves_prompt_as_data() {
    let (_sender, receiver) = oneshot::channel();
    let result = supervise(fixture("normal", None), &request(), receiver, |_| true).await;
    assert_eq!(result.status, "completed");
    assert_eq!(result.text, "fixture: hello 中文 $(never execute)");
    assert_eq!(result.native_session_id.as_deref(), Some("fixture-session"));
}

#[tokio::test]
async fn nonzero_exit_overrides_a_success_protocol_record() {
    let (_sender, receiver) = oneshot::channel();
    let result = supervise(fixture("bad-exit", None), &request(), receiver, |_| true).await;
    assert_eq!(result.status, "failed");
    assert_eq!(result.error_code.as_deref(), Some("cli_exit_failed"));
}

#[tokio::test]
async fn output_limit_and_timeout_stop_the_managed_process() {
    let (_sender, receiver) = oneshot::channel();
    let result = supervise(fixture("oversized", None), &request(), receiver, |_| true).await;
    assert_eq!(result.error_code.as_deref(), Some("output_limit"));
    let mut request = request();
    request.timeout_seconds = 1;
    let (_sender, receiver) = oneshot::channel();
    let result = supervise(fixture("wait", None), &request, receiver, |_| true).await;
    assert_eq!(result.status, "timed_out");
}

#[tokio::test]
async fn cancel_and_disconnected_consumer_stop_without_success() {
    let (sender, receiver) = oneshot::channel();
    let _ = sender.send(());
    let result = supervise(fixture("wait", None), &request(), receiver, |_| true).await;
    assert_eq!(result.status, "cancelled");
    let (_sender, receiver) = oneshot::channel();
    let result = supervise(fixture("wait", None), &request(), receiver, |_| false).await;
    assert_eq!(result.error_code.as_deref(), Some("client_disconnected"));
}

#[cfg(windows)]
#[tokio::test]
async fn cancellation_closes_the_windows_job_and_its_grandchild() {
    use windows_sys::Win32::{
        Foundation::CloseHandle,
        System::Threading::{GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION},
    };
    let path = std::env::temp_dir().join(format!("verification-pid-{}.txt", std::process::id()));
    let (sender, receiver) = oneshot::channel();
    let watcher_path = path.clone();
    let watcher = tokio::spawn(async move {
        for _ in 0..100 {
            if watcher_path.exists() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(30)).await;
        }
        let _ = sender.send(());
    });
    let result = supervise(fixture("tree", Some(&path)), &request(), receiver, |_| true).await;
    watcher.await.expect("watcher");
    assert_eq!(result.status, "cancelled");
    let pid: u32 = std::fs::read_to_string(&path)
        .expect("pid file")
        .parse()
        .expect("pid");
    let mut alive = true;
    for _ in 0..100 {
        alive = unsafe {
            let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if process.is_null() {
                false
            } else {
                let mut code = 0;
                let running = GetExitCodeProcess(process, &mut code) != 0 && code == 259;
                CloseHandle(process);
                running
            }
        };
        if !alive {
            break;
        }
        tokio::time::sleep(Duration::from_millis(20)).await;
    }
    std::fs::remove_file(&path).expect("remove owned PID fixture");
    assert!(!alive, "grandchild must not survive cancellation");
}
