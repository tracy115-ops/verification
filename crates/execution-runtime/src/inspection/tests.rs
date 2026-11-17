use super::*;
use crate::test_support::fixture_root;
use std::time::{SystemTime, UNIX_EPOCH};

fn request(source: &str) -> crate::inspection::FrameworkInspectionRequest {
    FrameworkInspectionRequest {
        id: "aaaabbbb-1111-4222-8333-ccccddddeeee".into(),
        python_command: "python".into(),
        source: source.into(),
    }
}
async fn inspect(source: &str) -> FrameworkInspection {
    let root = fixture_root(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
    );
    let req = request(source);
    let (_sender, cancel) = oneshot::channel();
    let result = inspect_framework(&root, req, cancel, |_| true)
        .await
        .unwrap();
    assert_eq!(
        std::fs::read_dir(&root).unwrap().count(),
        0,
        "temporary source must be removed"
    );
    std::fs::remove_dir(&root).unwrap();
    result
}
#[tokio::test]
async fn parses_without_importing_framework_and_preserves_line_hints() {
    let source = "import unittest\nraise RuntimeError('must never execute')\nclass BlackBoxCase(unittest.TestCase):\n    def setUp(self):\n        raise RuntimeError('must never run')\n# BLACKBOX_EVIDENCE_FILE in a comment is not a capability\n";
    let result = inspect(source).await;
    assert_eq!(result.checks.len(), 4);
    assert!(result.checks.iter().all(|c| c.status == "ok"));
    assert_eq!(result.source_sha256, validation::sha256(source.as_bytes()));
    assert_eq!(result.hints[0].code, "setup_declared");
    assert_eq!(result.hints.len(), 1);
}
#[tokio::test]
async fn distinguishes_missing_dynamic_and_unverified_entry_points() {
    for (source, status, reason) in [
        (
            "import unittest\nclass Other(unittest.TestCase): pass\n",
            "error",
            "entry_missing",
        ),
        (
            "from sdk import Base as BlackBoxCase\n",
            "unknown",
            "entry_dynamic",
        ),
        (
            "class BlackBoxCase(CustomBase): pass\n",
            "unknown",
            "entry_unverified_base",
        ),
    ] {
        let report = inspect(source).await;
        assert_eq!(report.checks[3].status, status);
        assert_eq!(report.checks[3].reason, reason);
    }
}
#[tokio::test]
async fn reports_syntax_and_limits_without_executing_source() {
    let result = inspect("class BlackBoxCase(\n").await;
    assert_eq!(result.checks[1].reason, "syntax_error");
    assert_eq!(result.checks[1].line, Some(1));
    let source = format!("def too_long():\n{}", "    pass\n".repeat(201));
    let result = inspect(&source).await;
    assert_eq!(result.checks[2].reason, "script_function_limit");
}
#[tokio::test]
async fn rejects_invalid_inputs_and_cleans_cancelled_or_disconnected_checks() {
    let root = fixture_root(
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos(),
    );
    let mut req = request("import unittest\nclass BlackBoxCase(unittest.TestCase): pass");
    req.python_command = "cmd.exe".into();
    let (_sender, cancel) = oneshot::channel();
    assert_eq!(
        inspect_framework(&root, req.clone(), cancel, |_| true)
            .await
            .unwrap_err(),
        "python_invalid"
    );
    req.python_command = "python".into();
    let (sender, cancel) = oneshot::channel();
    sender.send(()).unwrap();
    assert_eq!(
        inspect_framework(&root, req.clone(), cancel, |_| true)
            .await
            .unwrap_err(),
        "execution_cancelled"
    );
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 0);
    let (_sender, cancel) = oneshot::channel();
    assert_eq!(
        inspect_framework(&root, req, cancel, |_| false)
            .await
            .unwrap_err(),
        "execution_disconnected"
    );
    assert_eq!(std::fs::read_dir(&root).unwrap().count(), 0);
    std::fs::remove_dir(&root).unwrap();
}
