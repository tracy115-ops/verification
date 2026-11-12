use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn read_conversation_store(
    app: AppHandle,
) -> Result<crate::conversation_store::Snapshot, String> {
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "store_unavailable")?
        .join("personal-conversations-v1.sqlite3");
    tauri::async_runtime::spawn_blocking(move || crate::conversation_store::read(&path))
        .await
        .map_err(|_| "store_unavailable")?
}

#[tauri::command]
pub async fn write_conversation_store(
    app: AppHandle,
    payload: String,
    expected_revision: i64,
) -> Result<i64, String> {
    let update = app.state::<crate::updater::UpdateRuntime>();
    let _activity = update.task()?;
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "store_unavailable")?
        .join("personal-conversations-v1.sqlite3");
    let result = tauri::async_runtime::spawn_blocking(move || {
        crate::conversation_store::save(&path, &payload, expected_revision)
    })
    .await
    .map_err(|_| "store_unavailable")?;
    crate::diagnostics::record(
        &app,
        "data.conversations_saved",
        serde_json::json!({"status": if result.is_ok() {"saved"} else {"failed"}}),
    );
    result
}
