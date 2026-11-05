use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn discover_cli_instances() -> Result<Vec<agent_runtime::CliInstance>, String> {
    tauri::async_runtime::spawn_blocking(agent_runtime::discover_cli_instances)
        .await
        .map_err(|_| "discoveryFailed".into())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CliPathKind {
    Executable,
    Configuration,
}

#[tauri::command]
pub async fn pick_cli_path(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    kind: CliPathKind,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let picker = app.dialog().file().set_parent(&window);
        let selected = match kind {
            CliPathKind::Executable => {
                #[cfg(windows)]
                let picker = picker.add_filter("CLI", &["exe", "cmd", "bat", "js", "mjs", "cjs"]);
                picker.blocking_pick_file()
            }
            CliPathKind::Configuration => picker.blocking_pick_folder(),
        };
        selected
            .map(|file| {
                file.into_path()
                    .map(|path| path.to_string_lossy().into_owned())
                    .map_err(|_| "cli_path_invalid".to_string())
            })
            .transpose()
    })
    .await
    .map_err(|_| "cliPickerFailed".to_string())?
}
