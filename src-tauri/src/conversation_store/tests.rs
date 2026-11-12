use super::*;
use std::process::{Command, Stdio};
use std::time::Instant;

fn payload(title: &str) -> String {
    serde_json::json!([{"id":"session-a","title":title,"messages":[],"runs":[]}]).to_string()
}
#[test]
fn commits_reopens_and_rejects_stale_writers_without_losing_data() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("conversations.sqlite3");
    assert_eq!(read(&path).unwrap().revision, 0);
    assert!(!path.exists());
    assert_eq!(save(&path, &payload("中文 Spec"), 0).unwrap(), 1);
    let first = read(&path).unwrap();
    assert_eq!(first.revision, 1);
    assert!(first.payload.unwrap().contains("中文 Spec"));
    assert_eq!(save(&path, &payload("new"), 1).unwrap(), 2);
    assert_eq!(
        save(&path, &payload("stale"), 1).unwrap_err(),
        "store_conflict"
    );
    assert!(read(&path).unwrap().payload.unwrap().contains("new"));
    assert_eq!(save(&path, "[]", 2).unwrap(), 3);
    assert_eq!(read(&path).unwrap().payload.as_deref(), Some("[]"));
}
#[test]
fn preserves_raw_field_order_and_nested_bytes_used_by_review_digests() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    let raw = r#"[{"id":"s", "title":"raw", "messages":[], "runs":[], "artifact":{"z":2,"a":1,"number":1.00}}]"#;
    save(&path, raw, 0).unwrap();
    assert_eq!(read(&path).unwrap().payload.as_deref(), Some(raw));
}
#[test]
fn transaction_failure_preserves_previous_sessions_and_revision() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    save(&path, &payload("keep"), 0).unwrap();
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_insert BEFORE INSERT ON sessions BEGIN SELECT RAISE(ABORT, 'injected'); END;").unwrap();
    assert_eq!(
        save(&path, &payload("replace"), 1).unwrap_err(),
        "store_unavailable"
    );
    let result = read(&path).unwrap();
    assert_eq!(result.revision, 1);
    assert!(result.payload.unwrap().contains("keep"));
}
#[test]
fn simultaneous_instances_cannot_both_commit_the_same_base_revision() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    save(&path, &payload("original"), 0).unwrap();
    let barrier = std::sync::Arc::new(std::sync::Barrier::new(2));
    let handles: Vec<_> = ["one", "two"]
        .into_iter()
        .map(|title| {
            let path = path.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                save(&path, &payload(title), 1)
            })
        })
        .collect();
    let results: Vec<_> = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|r| r.as_ref().err().is_some_and(|e| e == "store_conflict"))
            .count(),
        1
    );
    assert_eq!(read(&path).unwrap().revision, 2);
}
#[test]
fn rejects_invalid_ownership_and_corruption_including_deleted_rows() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    assert_eq!(save(&path, "{}", 0).unwrap_err(), "store_invalid");
    assert!(!path.exists());
    let wrong = r#"[{"id":"s","title":"x","messages":[],"runs":[{"sessionId":"other"}]}]"#;
    assert_eq!(save(&path, wrong, 0).unwrap_err(), "store_invalid");
    save(&path, &payload("keep"), 0).unwrap();
    let conn = Connection::open(&path).unwrap();
    conn.execute("DELETE FROM sessions", []).unwrap();
    assert_eq!(read(&path).unwrap_err(), "store_corrupt");
    assert_eq!(save(&path, "[]", 1).unwrap_err(), "store_corrupt");
}
#[test]
fn rejects_unknown_schemas_and_does_not_reinitialize_a_corrupt_database() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    save(&path, &payload("keep"), 0).unwrap();
    let conn = Connection::open(&path).unwrap();
    conn.execute_batch("PRAGMA user_version=99").unwrap();
    assert_eq!(read(&path).unwrap_err(), "store_version");
    assert_eq!(save(&path, "[]", 1).unwrap_err(), "store_version");
    drop(conn);
    let corrupt = root.path().join("corrupt");
    fs::write(&corrupt, "not a sqlite file").unwrap();
    assert_eq!(save(&corrupt, "[]", 0).unwrap_err(), "store_corrupt");
    assert_eq!(fs::read_to_string(corrupt).unwrap(), "not a sqlite file");
}
#[test]
fn killed_writer_leaves_the_last_committed_revision_readable() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("db");
    save(&path, &payload("committed"), 0).unwrap();
    let mut child = Command::new(std::env::current_exe().unwrap())
        .args([
            "--ignored",
            "--exact",
            "conversation_store::tests::crash_writer_child",
        ])
        .env("VERIFICATION_STORE_CRASH_TEST_ROOT", root.path())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let signal = root.path().join("started");
    let start = Instant::now();
    while !signal.exists() && start.elapsed() < Duration::from_secs(10) {
        std::thread::sleep(Duration::from_millis(20));
    }
    let started = signal.exists();
    let _ = child.kill();
    child.wait().unwrap();
    assert!(started, "child did not start its uncommitted transaction");
    let result = read(&path).unwrap();
    assert_eq!(result.revision, 1);
    assert!(result.payload.unwrap().contains("committed"));
}
#[test]
#[ignore = "subprocess helper for a real process-kill recovery test"]
fn crash_writer_child() {
    let Some(root) = std::env::var_os("VERIFICATION_STORE_CRASH_TEST_ROOT") else {
        return;
    };
    let root = std::path::PathBuf::from(root);
    let conn = Connection::open(root.join("db")).unwrap();
    conn.execute_batch("BEGIN IMMEDIATE; DELETE FROM sessions; UPDATE metadata SET revision=999;")
        .unwrap();
    fs::write(root.join("started"), "ready").unwrap();
    std::thread::sleep(Duration::from_secs(30));
}
