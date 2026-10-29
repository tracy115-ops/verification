#[tauri::command]
async fn probe_agents() -> Vec<agent_runtime::AgentProbe> {
    agent_runtime::probe_installed_agents().await
}

pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .manage(conversations::ConversationRuntime::default())
        .manage(executions::ExecutionRuntime::default())
        .manage(collaboration::CollaborationRuntime::default())
        .invoke_handler(tauri::generate_handler![
            probe_agents,
            conversations::send_cli_turn,
            conversations::cancel_cli_turn,
            executions::preflight_python,
            executions::execute_python,
            executions::cancel_python,
            collaboration::start_collaboration,
            collaboration::stop_collaboration,
            collaboration::collaboration_status,
            lan_discovery::discover_collaboration,
            lan_discovery::open_collaboration,
            team_client::team_request
        ])
        .run(tauri::generate_context!())
}
mod collaboration;
mod conversations;
mod executions;
mod lan_discovery;
mod team_client;
