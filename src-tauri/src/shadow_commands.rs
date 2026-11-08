use crate::personal_shadow::{self, Status};
use tauri::{AppHandle, Manager};

async fn operate(app: AppHandle, payload: Option<String>) -> Result<Status, String> {
    let update = app.state::<crate::updater::UpdateRuntime>();
    let _activity = update.task()?;
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "shadow_unavailable")?
        .join("personal-shadow-v1.sqlite3");
    let result = tauri::async_runtime::spawn_blocking(move || match payload {
        Some(text) => personal_shadow::save(&path, &text),
        None => personal_shadow::status(&path),
    })
    .await
    .map_err(|_| "shadow_unavailable")?;
    crate::diagnostics::record(
        &app,
        "data.shadow_checked",
        serde_json::json!({"status": if result.is_ok() {"verified"} else {"failed"}}),
    );
    result
}

#[tauri::command]
pub async fn personal_shadow_status(app: AppHandle) -> Result<Status, String> {
    operate(app, None).await
}

#[tauri::command]
pub async fn save_personal_shadow(app: AppHandle, payload: String) -> Result<Status, String> {
    operate(app, Some(payload)).await
}

#[tauri::command]
pub async fn export_personal_shadow(app: AppHandle, snapshot_id: i64) -> Result<String, String> {
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "shadow_unavailable")?
        .join("personal-shadow-v1.sqlite3");
    tauri::async_runtime::spawn_blocking(move || personal_shadow::export(&path, snapshot_id))
        .await
        .map_err(|_| "shadow_unavailable")?
}
