use tauri_plugin_dialog::DialogExt;

#[tauri::command]
pub async fn inspect_claude_setup(
    config_directory: Option<std::path::PathBuf>,
) -> Result<agent_runtime::ClaudeSetup, String> {
    tauri::async_runtime::spawn_blocking(move || {
        agent_runtime::inspect_claude_setup(config_directory).map_err(str::to_string)
    })
    .await
    .map_err(|_| "cliSetupInspectFailed".to_string())?
}

#[tauri::command]
pub async fn read_cli_model_hints(
    driver: agent_runtime::DriverId,
    config_directory: Option<std::path::PathBuf>,
) -> Result<agent_runtime::ModelHints, String> {
    tauri::async_runtime::spawn_blocking(move || {
        agent_runtime::read_model_hints(driver, config_directory).map_err(str::to_string)
    })
    .await
    .map_err(|_| "cliModelReadFailed".to_string())?
}

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
