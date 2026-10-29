use crate::test_support::Fixture;
use crate::*;
use tokio::sync::oneshot;

#[test]
fn fixture_waits_for_delayed_request_headers_and_body() {
    use std::io::{Read, Write};
    use std::net::TcpStream;
    use std::time::Duration;
    let fixture = Fixture::new();
    let address = fixture
        .payload
        .profile
        .target_url
        .strip_prefix("http://")
        .unwrap();
    let mut socket = TcpStream::connect(address).expect("fixture connection");
    socket
        .set_read_timeout(Some(Duration::from_millis(50)))
        .unwrap();
    let mut byte = [0u8; 1];
    let pending = socket
        .read(&mut byte)
        .expect_err("must wait for request headers");
    assert!(matches!(
        pending.kind(),
        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
    ));
    socket
        .write_all(b"POST /probe HTTP/1.1\r\nHost: localhost\r\nContent-Length: 2\r\n\r\n")
        .unwrap();
    let pending = socket
        .read(&mut byte)
        .expect_err("must wait for request body");
    assert!(matches!(
        pending.kind(),
        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
    ));
    socket.write_all(b"{}").unwrap();
    socket
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    let mut response = String::new();
    socket.read_to_string(&mut response).unwrap();
    assert!(response.starts_with("HTTP/1.1 200 OK"));
}

#[tokio::test]
async fn preflight_parses_without_importing_framework_then_execution_collects_redacted_evidence() {
    let mut fixture = Fixture::new();
    fixture
        .payload
        .profile
        .framework_source
        .push_str("\nopen('imported.marker', 'w').write('imported')\n");
    let plan = fixture.plan().await;
    let before = fixture.root.join(format!(
        "{}-preflight/imported.marker",
        plan.payload.execution_id
    ));
    assert!(
        !before.exists(),
        "preflight must not execute framework imports"
    );
    let evidence = fixture.run(&plan).await.expect("execution");
    assert_eq!(evidence.results.len(), 1);
    assert_eq!(
        evidence.results[0].status, "passed",
        "{:?}",
        evidence.results[0].details
    );
    assert_eq!(evidence.requests.len(), 2);
    assert_eq!(evidence.raw_evidence_sha256.len(), 64);
    assert_eq!(
        evidence.requests[1]["request"]["headers"]["Authorization"],
        "[redacted]"
    );
    assert!(
        fixture
            .root
            .join(format!(
                "{}-execute/imported.marker",
                plan.payload.execution_id
            ))
            .exists()
    );
    assert_eq!(
        fixture.run(&plan).await.expect_err("single use"),
        "execution_already_started"
    );
}

#[tokio::test]
async fn changed_payload_and_missing_preflight_cannot_execute() {
    let fixture = Fixture::new();
    let plan = fixture.plan().await;
    let mut payload = plan.payload.clone();
    payload.profile.target_url.push_str("/changed");
    let (_sender, receiver) = oneshot::channel();
    assert_eq!(
        execute(&fixture.root, payload, &plan.digest, receiver, |_| true)
            .await
            .expect_err("stale"),
        "execution_approval_stale"
    );
    let mut payload = plan.payload;
    payload.execution_id = "44444444-4444-4444-8444-444444444444".into();
    let digest = payload_digest(&payload).expect("digest");
    let (_sender, receiver) = oneshot::channel();
    assert_eq!(
        execute(&fixture.root, payload, &digest, receiver, |_| true)
            .await
            .expect_err("preflight required"),
        "execution_preflight_missing"
    );
}

#[tokio::test]
async fn invalid_python_shape_fails_preflight_and_never_runs_framework() {
    let mut fixture = Fixture::new();
    fixture.payload.implementation.script = "import os\n".into();
    let (_sender, receiver) = oneshot::channel();
    assert_eq!(
        preflight(&fixture.root, fixture.payload.clone(), receiver, |_| true)
            .await
            .expect_err("AST"),
        "python_validation_failed"
    );
}

#[tokio::test]
async fn assertion_failures_remain_evidence_while_setup_failures_are_errors() {
    let mut fixture = Fixture::new();
    fixture.payload.implementation.script = fixture
        .payload
        .implementation
        .script
        .replace("response.status, 200", "response.status, 201");
    let plan = fixture.plan().await;
    let evidence = fixture.run(&plan).await.expect("evidence");
    assert_eq!(
        evidence.results[0].status, "failed",
        "{:?}",
        evidence.results[0].details
    );
    let mut broken = Fixture::new();
    broken.payload.profile.framework_source =
        "raise RuntimeError('framework unavailable')\n".into();
    let plan = broken.plan().await;
    let evidence = broken
        .run(&plan)
        .await
        .expect("harness errors are evidence");
    assert_eq!(evidence.results[0].status, "error");
}

#[tokio::test]
async fn constant_assertions_without_request_evidence_cannot_report_passes_or_bugs() {
    for assertion in ["True", "False"] {
        let mut fixture = Fixture::new();
        fixture.payload.implementation.script = format!(
            "from framework import BlackBoxCase\nclass Tests(BlackBoxCase):\n    def test_probe(self):\n        self.assertTrue({assertion})\n"
        );
        let plan = fixture.plan().await;
        let evidence = fixture.run(&plan).await.expect("evidence");
        assert_eq!(evidence.results[0].status, "error");
        assert!(
            evidence.results[0]
                .details
                .iter()
                .any(|item| item == "missing_request_evidence")
        );
    }
}

#[tokio::test]
async fn cancelled_and_timed_out_frameworks_stop_managed_processes() {
    for cancelled in [true, false] {
        let mut fixture = Fixture::new();
        fixture.payload.profile.timeout_seconds = 1;
        fixture
            .payload
            .profile
            .framework_source
            .push_str("\nimport time\ntime.sleep(60)\n");
        let plan = fixture.plan().await;
        let (sender, receiver) = oneshot::channel();
        let stopper = tokio::spawn(async move {
            if cancelled {
                tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                let _ = sender.send(());
            } else {
                tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                drop(sender);
            }
        });
        let result = execute(&fixture.root, plan.payload, &plan.digest, receiver, |_| {
            true
        })
        .await
        .expect_err("must stop");
        assert_eq!(
            result,
            if cancelled {
                "execution_cancelled"
            } else {
                "execution_timeout"
            }
        );
        stopper.abort();
    }
}

#[tokio::test]
async fn excessive_output_and_disconnected_consumers_are_stopped() {
    let mut fixture = Fixture::new();
    fixture
        .payload
        .profile
        .framework_source
        .push_str("\nprint('x' * 400000)\n");
    let plan = fixture.plan().await;
    assert_eq!(
        fixture.run(&plan).await.expect_err("output cap"),
        "execution_output_limit"
    );
    let fixture = Fixture::new();
    let plan = fixture.plan().await;
    let (_sender, receiver) = oneshot::channel();
    assert_eq!(
        execute(&fixture.root, plan.payload, &plan.digest, receiver, |_| {
            false
        })
        .await
        .expect_err("disconnect"),
        "execution_disconnected"
    );
}

#[test]
fn payloads_reject_traversal_shells_and_embedded_credentials() {
    let mut fixture = Fixture::new();
    fixture.payload.execution_id = "../../elsewhere".into();
    assert!(crate::validation::validate(&fixture.payload).is_err());
    fixture.payload.execution_id = "33333333-3333-4333-8333-333333333333".into();
    fixture.payload.profile.python_command = "cmd.exe".into();
    assert!(crate::validation::validate(&fixture.payload).is_err());
    fixture.payload.profile.python_command = "python".into();
    fixture.payload.profile.target_url = "https://user:secret@example.invalid".into();
    assert!(crate::validation::validate(&fixture.payload).is_err());
}
