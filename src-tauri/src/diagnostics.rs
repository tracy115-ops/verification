use serde::Serialize;
use serde_json::{Value, json};
use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

pub const FILE_LIMIT: u64 = 2 * 1024 * 1024;
static WRITES: Mutex<()> = Mutex::new(());
const NAMES: [&str; 2] = ["workbench.log", "workbench.1.log"];

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_log_dir()
        .map_err(|_| "logs_unavailable".into())
}

fn append(directory: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if bytes.len() > 4096 {
        return Err(std::io::Error::other("record_limit"));
    }
    fs::create_dir_all(directory)?;
    let current = directory.join(NAMES[0]);
    if fs::metadata(&current).map(|m| m.len()).unwrap_or(0) + bytes.len() as u64 > FILE_LIMIT {
        let previous = directory.join(NAMES[1]);
        if previous.exists() {
            fs::remove_file(&previous)?;
        }
        fs::rename(&current, previous)?;
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(current)?
        .write_all(bytes)
}

pub fn record(app: &AppHandle, event: &str, fields: Value) {
    let Ok(_guard) = WRITES.lock() else {
        return;
    };
    let Ok(directory) = root(app) else {
        return;
    };
    let allowed = [
        "driver",
        "status",
        "code",
        "exit_code",
        "reason",
        "stderr_bytes",
        "terminal",
        "input_written",
        "turnId",
        "version",
    ];
    let details: serde_json::Map<String, Value> = fields
        .as_object()
        .into_iter()
        .flat_map(|m| m.iter())
        .filter(|(key, _)| allowed.contains(&key.as_str()))
        .map(|(key, value)| {
            let safe = match value {
                Value::String(s)
                    if s.len() <= 80
                        && s.bytes()
                            .all(|c| c.is_ascii_alphanumeric() || b"_-.:".contains(&c)) =>
                {
                    value.clone()
                }
                Value::Bool(_) | Value::Number(_) | Value::Null => value.clone(),
                _ => json!("redacted"),
            };
            (key.clone(), safe)
        })
        .collect();
    let row = json!({"atMs": SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis(), "event":event, "details":details});
    if let Ok(mut bytes) = serde_json::to_vec(&row) {
        bytes.push(b'\n');
        let _ = append(&directory, &bytes);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFile {
    name: &'static str,
    bytes: u64,
    text: String,
}

#[tauri::command]
pub fn read_logs(app: AppHandle) -> Result<Vec<LogFile>, String> {
    let _guard = WRITES.lock().map_err(|_| "logs_unavailable")?;
    let directory = root(&app)?;
    let mut result = Vec::new();
    for name in NAMES {
        let file = directory.join(name);
        if !file.exists() {
            continue;
        }
        let mut bytes = Vec::new();
        fs::File::open(file)
            .map_err(|_| "logs_unavailable")?
            .take(FILE_LIMIT)
            .read_to_end(&mut bytes)
            .map_err(|_| "logs_unavailable")?;
        result.push(LogFile {
            name,
            bytes: bytes.len() as u64,
            text: String::from_utf8_lossy(&bytes).into_owned(),
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn clear_logs(app: AppHandle) -> Result<(), String> {
    {
        let _guard = WRITES.lock().map_err(|_| "logs_unavailable")?;
        let directory = root(&app)?;
        for name in NAMES {
            let file = directory.join(name);
            if file.exists() {
                fs::remove_file(file).map_err(|_| "logs_unavailable")?;
            }
        }
    }
    record(&app, "logs.cleared", json!({}));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rotation_keeps_two_files_bounded_at_two_mib() {
        let path = std::env::temp_dir().join(format!(
            "verification-log-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&path).unwrap();
        for _ in 0..1600 {
            append(&path, &[b'x'; 4096]).unwrap();
        }
        assert_eq!(fs::read_dir(&path).unwrap().count(), 2);
        for name in NAMES {
            assert!(fs::metadata(path.join(name)).unwrap().len() <= FILE_LIMIT);
            fs::remove_file(path.join(name)).unwrap();
        }
        fs::remove_dir(path).unwrap();
    }
}
