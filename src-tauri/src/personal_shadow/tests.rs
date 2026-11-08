use super::*;
use serde_json::json;

fn payload(label: &str) -> String {
    json!({"formatVersion":1,"createdAt":"2026-11-08T00:00:00.000Z","storage":{
        KEYS[0]: format!("[{{\"id\":\"{label}\"}}]"), KEYS[1]:null, KEYS[2]:null
    },"transcripts":[]})
    .to_string()
}

#[test]
fn roundtrips_exact_bytes_after_reopen_and_keeps_two_snapshots() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    assert!(status(&path).unwrap().snapshots.is_empty());
    assert!(!path.exists());
    for label in ["one", "two", "三"] {
        save(&path, &payload(label)).unwrap();
    }
    let result = status(&path).unwrap();
    assert_eq!(result.snapshots.len(), 2);
    assert_eq!(result.snapshots[0].sha256, fingerprint(&payload("三")));
    assert_eq!(result.snapshots[0].bytes, payload("三").len());
    assert_eq!(result.snapshots[0].sessions, 1);
    let conn = connect(&path, false).unwrap();
    let stored: String = conn
        .query_row(
            "SELECT payload FROM snapshots ORDER BY id DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(stored, payload("三"));
    assert_eq!(export(&path, result.snapshots[0].id).unwrap(), stored);
    assert_eq!(export(&path, 1).unwrap_err(), "shadow_missing");
}

#[test]
fn failed_transaction_preserves_both_previously_committed_snapshots() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    save(&path, &payload("one")).unwrap();
    let before = save(&path, &payload("two")).unwrap();
    connect(&path, true).unwrap().execute_batch("CREATE TRIGGER injected_write_failure BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT, 'injected'); END;").unwrap();
    assert_eq!(
        save(&path, &payload("three")).unwrap_err(),
        "shadow_unavailable"
    );
    let after = status(&path).unwrap();
    assert_eq!(
        serde_json::to_value(before).unwrap(),
        serde_json::to_value(after).unwrap()
    );
}

#[test]
fn detects_tampering_and_refuses_to_replace_the_corrupt_copy() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    save(&path, &payload("one")).unwrap();
    connect(&path, true)
        .unwrap()
        .execute("UPDATE snapshots SET sha256='bad'", [])
        .unwrap();
    assert_eq!(status(&path).unwrap_err(), "shadow_corrupt");
    assert_eq!(export(&path, 1).unwrap_err(), "shadow_corrupt");
    assert_eq!(save(&path, &payload("two")).unwrap_err(), "shadow_corrupt");
    let count: i64 = connect(&path, false)
        .unwrap()
        .query_row("SELECT count(*) FROM snapshots", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn rejects_future_schemas_and_corrupt_files_without_reinitializing() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    Connection::open(&path)
        .unwrap()
        .pragma_update(None, "user_version", 2)
        .unwrap();
    let before = fs::read(&path).unwrap();
    assert_eq!(save(&path, &payload("one")).unwrap_err(), "shadow_version");
    assert_eq!(fs::read(&path).unwrap(), before);
    let broken = root.path().join("broken.sqlite3");
    fs::write(&broken, "not SQLite").unwrap();
    assert!(status(&broken).is_err());
    assert!(save(&broken, &payload("one")).is_err());
    assert_eq!(fs::read_to_string(&broken).unwrap(), "not SQLite");
}

#[test]
fn rejects_invalid_envelopes_extra_storage_and_oversize_before_writing() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    let mut v: serde_json::Value = serde_json::from_str(&payload("one")).unwrap();
    v["storage"]["team.token"] = json!("forbidden");
    for invalid in [
        "{}".to_string(),
        "not json".to_string(),
        v.to_string(),
        "x".repeat(LIMIT + 1),
    ] {
        assert!(save(&path, &invalid).is_err());
        assert!(!path.exists());
    }
}

#[test]
fn a_busy_database_is_not_reported_as_corrupt_and_recovers_after_unlock() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("shadow.sqlite3");
    let before = save(&path, &payload("one")).unwrap();
    let conn = connect(&path, true).unwrap();
    conn.execute_batch("BEGIN EXCLUSIVE").unwrap();
    assert_eq!(status(&path).unwrap_err(), "shadow_unavailable");
    conn.execute_batch("ROLLBACK").unwrap();
    assert_eq!(
        serde_json::to_value(status(&path).unwrap()).unwrap(),
        serde_json::to_value(before).unwrap()
    );
}
