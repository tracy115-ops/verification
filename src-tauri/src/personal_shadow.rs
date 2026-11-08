use rusqlite::{Connection, OpenFlags, TransactionBehavior, params};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, path::Path, time::Duration};

const LIMIT: usize = 20 * 1024 * 1024;
fn storage_error(error: rusqlite::Error) -> String {
    if matches!(
        error.sqlite_error_code(),
        Some(rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase)
    ) {
        "shadow_corrupt".into()
    } else {
        "shadow_unavailable".into()
    }
}
const KEYS: [&str; 3] = [
    "verification-workbench.conversations.v1",
    "verification-workbench.document.v1",
    "verification-workbench.frameworks.v1",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub id: i64,
    pub created_at: String,
    pub sha256: String,
    pub bytes: usize,
    pub sessions: usize,
    pub transcripts: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub schema_version: u32,
    pub snapshots: Vec<Snapshot>,
}

fn fingerprint(payload: &str) -> String {
    format!("{:x}", Sha256::digest(payload.as_bytes()))
}

// Full business-schema validation is performed by the existing TS backup boundary.
// This native boundary independently restricts size, envelope and permitted storage keys.
fn inspect(payload: &str) -> Result<Snapshot, String> {
    if payload.len() > LIMIT {
        return Err("data_backup_limit".into());
    }
    let v: serde_json::Value = serde_json::from_str(payload).map_err(|_| "data_backup_invalid")?;
    let invalid = || "data_backup_invalid".to_string();
    let root = v.as_object().ok_or_else(invalid)?;
    if root.len() != 4 || v["formatVersion"] != 1 {
        return Err(invalid());
    }
    let created_at = v["createdAt"]
        .as_str()
        .filter(|s| s.len() <= 40 && !s.is_empty())
        .ok_or_else(invalid)?;
    let storage = v["storage"].as_object().ok_or_else(invalid)?;
    if storage.len() != KEYS.len() || !KEYS.iter().all(|k| storage.contains_key(*k)) {
        return Err(invalid());
    }
    for key in KEYS {
        if !storage[key].is_null() {
            let text = storage[key]
                .as_str()
                .filter(|s| s.len() <= 8_000_000)
                .ok_or_else(invalid)?;
            serde_json::from_str::<serde_json::Value>(text).map_err(|_| invalid())?;
        }
    }
    let sessions = match storage[KEYS[0]].as_str() {
        Some(text) => serde_json::from_str::<Vec<serde_json::Value>>(text)
            .map_err(|_| invalid())?
            .len(),
        None => 0,
    };
    let transcripts = v["transcripts"]
        .as_array()
        .filter(|a| a.len() <= 2000)
        .ok_or_else(invalid)?
        .len();
    Ok(Snapshot {
        id: 0,
        created_at: created_at.into(),
        sha256: fingerprint(payload),
        bytes: payload.len(),
        sessions,
        transcripts,
    })
}

fn connect(path: &Path, write: bool) -> Result<Connection, String> {
    if fs::metadata(path).is_ok_and(|m| m.len() > 128 * 1024 * 1024) {
        return Err("shadow_limit".into());
    }
    let flags = if write {
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE
    } else {
        OpenFlags::SQLITE_OPEN_READ_ONLY
    };
    let conn = Connection::open_with_flags(path, flags).map_err(|_| "shadow_unavailable")?;
    conn.busy_timeout(Duration::from_secs(3))
        .map_err(|_| "shadow_unavailable")?;
    let version: u32 = conn
        .pragma_query_value(None, "user_version", |r| r.get(0))
        .map_err(storage_error)?;
    if version > 1 {
        return Err("shadow_version".into());
    }
    if version == 0 && write {
        // Only initialize an empty file; never adopt an unrelated SQLite database.
        let tables: u32 = conn
            .query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0))
            .map_err(storage_error)?;
        if tables != 0 {
            return Err("shadow_version".into());
        }
        conn.execute_batch("BEGIN IMMEDIATE; CREATE TABLE snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL, sha256 TEXT NOT NULL); PRAGMA user_version=1; COMMIT;").map_err(|_| "shadow_unavailable")?;
    } else if version != 1 {
        return Err("shadow_version".into());
    }
    if write {
        conn.pragma_update(None, "synchronous", "FULL")
            .map_err(|_| "shadow_unavailable")?;
    }
    Ok(conn)
}

fn checked(conn: &Connection) -> Result<Status, String> {
    let integrity: String = conn
        .pragma_query_value(None, "quick_check", |r| r.get(0))
        .map_err(storage_error)?;
    if integrity != "ok" {
        return Err("shadow_corrupt".into());
    }
    let mut query = conn
        .prepare("SELECT id,payload,sha256 FROM snapshots ORDER BY id DESC")
        .map_err(storage_error)?;
    let rows = query
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })
        .map_err(storage_error)?;
    let mut snapshots = Vec::new();
    for row in rows {
        if snapshots.len() >= 2 {
            return Err("shadow_corrupt".into());
        }
        let (id, payload, sha) = row.map_err(storage_error)?;
        let mut snapshot = inspect(&payload).map_err(|_| "shadow_corrupt")?;
        if snapshot.sha256 != sha {
            return Err("shadow_corrupt".into());
        }
        snapshot.id = id;
        snapshots.push(snapshot);
    }
    Ok(Status {
        schema_version: 1,
        snapshots,
    })
}

pub fn status(path: &Path) -> Result<Status, String> {
    if !path.try_exists().map_err(|_| "shadow_unavailable")? {
        return Ok(Status {
            schema_version: 1,
            snapshots: vec![],
        });
    }
    checked(&connect(path, false)?)
}

pub fn save(path: &Path, payload: &str) -> Result<Status, String> {
    let snapshot = inspect(payload)?;
    fs::create_dir_all(path.parent().ok_or("shadow_unavailable")?)
        .map_err(|_| "shadow_unavailable")?;
    let mut conn = connect(path, true)?;
    let tx = conn
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|_| "shadow_unavailable")?;
    checked(&tx)?;
    tx.execute(
        "INSERT INTO snapshots(payload,sha256) VALUES (?1,?2)",
        params![payload, snapshot.sha256],
    )
    .map_err(|_| "shadow_unavailable")?;
    tx.execute(
        "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY id DESC LIMIT 2)",
        [],
    )
    .map_err(|_| "shadow_unavailable")?;
    let result = checked(&tx)?;
    tx.commit().map_err(|_| "shadow_unavailable")?;
    Ok(result)
}

pub fn export(path: &Path, id: i64) -> Result<String, String> {
    if id < 1 {
        return Err("shadow_invalid".into());
    }
    let mut conn = connect(path, false)?;
    let tx = conn.transaction().map_err(|_| "shadow_unavailable")?;
    checked(&tx)?;
    tx.query_row("SELECT payload FROM snapshots WHERE id=?1", [id], |r| {
        r.get(0)
    })
    .map_err(|error| match error {
        rusqlite::Error::QueryReturnedNoRows => "shadow_missing".into(),
        other => storage_error(other),
    })
}

#[cfg(test)]
mod tests;
