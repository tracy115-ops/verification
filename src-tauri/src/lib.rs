#[tauri::command]
async fn probe_agents() -> Vec<agent_runtime::AgentProbe> {
    agent_runtime::probe_installed_agents().await
}

pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![probe_agents])
        .run(tauri::generate_context!())
}
