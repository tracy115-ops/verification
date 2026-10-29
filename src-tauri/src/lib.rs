#[tauri::command]
async fn probe_agents(app: tauri::AppHandle) -> Vec<agent_runtime::AgentProbe> {
    let probes = agent_runtime::probe_installed_agents().await;
    for probe in &probes {
        diagnostics::record(
            &app,
            "cli.probed",
            serde_json::json!({"driver":probe.driver,"status":probe.status}),
        );
    }
    probes
}

pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .manage(conversations::ConversationRuntime::default())
        .manage(executions::ExecutionRuntime::default())
        .manage(collaboration::CollaborationRuntime::default())
        .manage(updater::UpdateRuntime::default())
        .setup(|app| {
            diagnostics::record(
                app.handle(),
                "app.started",
                serde_json::json!({"version":env!("CARGO_PKG_VERSION")}),
            );
            Ok(())
        })
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
            team_client::team_request,
            diagnostics::read_logs,
            diagnostics::clear_logs,
            updater::update_status,
            updater::check_update,
            updater::download_update,
            updater::cancel_update,
            updater::install_update,
            updater::clear_update_cache,
            update_network::update_network_settings,
            update_network::save_update_network
        ])
        .run(tauri::generate_context!())
}
mod collaboration;
mod conversations;
mod diagnostics;
mod executions;
mod lan_discovery;
mod team_client;
mod update_network;
mod update_release;
mod updater;
#[cfg(windows)]
mod windows_proxy;
