use rusqlite::{Connection, OpenFlags, OptionalExtension, TransactionBehavior, params};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{collections::HashSet, fs, path::Path, time::Duration};

const LIMIT: usize = 8_000_000;
const MAX_REVISION: i64 = 9_007_199_254_740_990;
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub schema_version: u32,
    pub revision: i64,
    pub payload: Option<String>,
}
fn hash(text: &str) -> String {
    format!("{:x}", Sha256::digest(text.as_bytes()))
}
fn error(e: rusqlite::Error) -> String {
    match e.sqlite_error_code() {
        Some(rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase) => {
            "store_corrupt"
        }
        _ => "store_unavailable",
    }
    .into()
}
fn rows(payload: &str) -> Result<Vec<(String, String)>, String> {
    if payload.len() > LIMIT {
        return Err("store_limit".into());
    }
    let sessions: Vec<&serde_json::value::RawValue> =
        serde_json::from_str(payload).map_err(|_| "store_invalid")?;
    if sessions.len() > 50 {
        return Err("store_limit".into());
    }
    let mut ids = HashSet::new();
    let mut result = Vec::new();
    for raw in sessions {
        let session: serde_json::Value =
            serde_json::from_str(raw.get()).map_err(|_| "store_invalid")?;
        let id = session
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or("store_invalid")?;
        if id.is_empty()
            || id.len() > 200
            || !ids.insert(id.to_owned())
            || !session.get("title").is_some_and(|v| v.is_string())
            || !session.get("messages").is_some_and(|v| v.is_array())
        {
            return Err("store_invalid".into());
        }
        let runs = session
            .get("runs")
            .and_then(|v| v.as_array())
            .ok_or("store_invalid")?;
        if runs.len() > 50
            || runs
                .iter()
                .any(|r| r.get("sessionId").and_then(|v| v.as_str()) != Some(id))
        {
            return Err("store_invalid".into());
        }
        // Existing review digests depend on JSON object order. Never reserialize user artifacts.
        result.push((id.into(), raw.get().to_owned()));
    }
    Ok(result)
}
fn open(path: &Path, write: bool) -> Result<Connection, String> {
    if write {
        fs::create_dir_all(path.parent().ok_or("store_unavailable")?)
            .map_err(|_| "store_unavailable")?;
    }
    if path
        .metadata()
        .map(|m| m.len() > 64 * 1024 * 1024)
        .unwrap_or(false)
    {
        return Err("store_limit".into());
    }
    let flags = if write {
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE
    } else {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    };
    let conn = Connection::open_with_flags(path, flags).map_err(error)?;
    conn.busy_timeout(Duration::from_secs(2)).map_err(error)?;
    let check: String = conn
        .query_row("PRAGMA quick_check", [], |r| r.get(0))
        .map_err(error)?;
    if check != "ok" {
        return Err("store_corrupt".into());
    }
    version(&conn)?;
    if write {
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;")
            .map_err(error)?;
    }
    Ok(conn)
}
fn version(conn: &Connection) -> Result<bool, String> {
    let v: u32 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(error)?;
    let count: u32 = conn
        .query_row(
            "SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
            [],
            |r| r.get(0),
        )
        .map_err(error)?;
    if v == 0 && count == 0 {
        return Ok(false);
    }
    if v != 1 {
        return Err("store_version".into());
    }
    Ok(true)
}
fn snapshot(conn: &Connection) -> Result<Snapshot, String> {
    if !version(conn)? {
        return Ok(Snapshot {
            schema_version: 1,
            revision: 0,
            payload: None,
        });
    }
    let meta: Option<(i64, u32, String)> = conn
        .query_row(
            "SELECT revision, count, sha256 FROM metadata WHERE id=1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()
        .map_err(error)?;
    let (revision, count, expected) = meta.ok_or("store_corrupt")?;
    if !(1..=MAX_REVISION).contains(&revision) {
        return Err("store_corrupt".into());
    }
    let mut stmt = conn
        .prepare("SELECT id, position, payload, sha256 FROM sessions ORDER BY position")
        .map_err(error)?;
    let values = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, u32>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })
        .map_err(error)?;
    let mut data = Vec::new();
    let mut bytes = 0;
    for item in values {
        let (id, position, payload, digest) = item.map_err(error)?;
        bytes += payload.len();
        if bytes > LIMIT || position as usize != data.len() || hash(&payload) != digest {
            return Err("store_corrupt".into());
        }
        let parsed: serde_json::Value =
            serde_json::from_str(&payload).map_err(|_| "store_corrupt")?;
        if parsed.get("id").and_then(|v| v.as_str()) != Some(&id) {
            return Err("store_corrupt".into());
        }
        data.push(payload);
    }
    let payload = format!("[{}]", data.join(","));
    if data.len() != count as usize || hash(&payload) != expected || rows(&payload).is_err() {
        return Err("store_corrupt".into());
    }
    Ok(Snapshot {
        schema_version: 1,
        revision,
        payload: Some(payload),
    })
}
pub fn read(path: &Path) -> Result<Snapshot, String> {
    if !path.try_exists().map_err(|_| "store_unavailable")? {
        return Ok(Snapshot {
            schema_version: 1,
            revision: 0,
            payload: None,
        });
    }
    let mut conn = open(path, false)?;
    let tx = conn.transaction().map_err(error)?;
    snapshot(&tx)
}
pub fn save(path: &Path, payload: &str, expected_revision: i64) -> Result<i64, String> {
    if !(0..MAX_REVISION).contains(&expected_revision) {
        return Err("store_invalid".into());
    }
    let data = rows(payload)?;
    let mut conn = open(path, true)?;
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(error)?;
    let current = snapshot(&tx)?;
    if current.revision != expected_revision {
        return Err("store_conflict".into());
    }
    if current.revision == 0 {
        tx.execute_batch("CREATE TABLE metadata(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, count INTEGER NOT NULL, sha256 TEXT NOT NULL); CREATE TABLE sessions(id TEXT PRIMARY KEY, position INTEGER UNIQUE NOT NULL, payload TEXT NOT NULL, sha256 TEXT NOT NULL); PRAGMA user_version=1;").map_err(error)?;
    }
    tx.execute("DELETE FROM sessions", []).map_err(error)?;
    for (position, (id, text)) in data.iter().enumerate() {
        tx.execute(
            "INSERT INTO sessions(id,position,payload,sha256) VALUES(?1,?2,?3,?4)",
            params![id, position as i64, text, hash(text)],
        )
        .map_err(error)?;
    }
    let canonical = format!(
        "[{}]",
        data.iter()
            .map(|(_, text)| text.as_str())
            .collect::<Vec<_>>()
            .join(",")
    );
    let revision = expected_revision + 1;
    tx.execute(
        "INSERT OR REPLACE INTO metadata(id,revision,count,sha256) VALUES(1,?1,?2,?3)",
        params![revision, data.len() as i64, hash(&canonical)],
    )
    .map_err(error)?;
    tx.commit().map_err(error)?;
    Ok(revision)
}

#[cfg(test)]
mod tests;
