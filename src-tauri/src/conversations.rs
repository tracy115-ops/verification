use agent_runtime::{AgentEvent, TurnOutcome, TurnRequest};
use std::{collections::HashMap, sync::Mutex};
use tauri::{AppHandle, Manager, State, ipc::Channel};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct ConversationRuntime {
    active: Mutex<HashMap<String, Option<oneshot::Sender<()>>>>,
}

#[tauri::command]
pub async fn send_cli_turn(
    app: AppHandle,
    state: State<'_, ConversationRuntime>,
    request: TurnRequest,
    on_event: Channel<AgentEvent>,
) -> Result<TurnOutcome, String> {
    let updates = app.state::<crate::updater::UpdateRuntime>();
    let _activity = updates.task()?;
    request.validate().map_err(str::to_string)?;
    let root = app
        .path()
        .app_data_dir()
        .map_err(|_| "workspace_failed")?
        .join("cli-conversations");
    tokio::fs::create_dir_all(&root)
        .await
        .map_err(|_| "workspace_failed")?;
    let root = tokio::fs::canonicalize(&root)
        .await
        .map_err(|_| "workspace_failed")?;
    let workspace = root.join(&request.session_id);
    tokio::fs::create_dir_all(&workspace)
        .await
        .map_err(|_| "workspace_failed")?;
    let workspace = tokio::fs::canonicalize(&workspace)
        .await
        .map_err(|_| "workspace_failed")?;
    if workspace.parent() != Some(root.as_path()) {
        return Err("workspace_failed".into());
    }
    let (sender, receiver) = oneshot::channel();
    {
        let mut active = state.active.lock().map_err(|_| "runtime_failed")?;
        if !active.is_empty() {
            return Err("cli_busy".into());
        }
        active.insert(request.turn_id.clone(), Some(sender));
    }
    let turn_id = request.turn_id.clone();
    let driver = request.driver.as_str();
    crate::diagnostics::record(
        &app,
        "cli.started",
        serde_json::json!({"driver":request.driver.as_str(), "turnId":turn_id, "timeoutSeconds":request.timeout_seconds, "promptBytes":request.prompt.len()}),
    );
    let outcome = agent_runtime::run_turn(request, &workspace, receiver, |event| {
        if let AgentEvent::Diagnostic { .. } = &event {
            let mut details = serde_json::to_value(&event).unwrap_or_default();
            details["turnId"] = serde_json::json!(turn_id);
            details["driver"] = serde_json::json!(driver);
            crate::diagnostics::record(&app, "cli.diagnostic", details);
            return true;
        }
        on_event.send(event).is_ok()
    })
    .await;
    crate::diagnostics::record(
        &app,
        "cli.finished",
        serde_json::json!({"turnId":turn_id, "status":outcome.status, "code":outcome.error_code}),
    );
    state
        .active
        .lock()
        .map_err(|_| "runtime_failed")?
        .remove(&turn_id);
    Ok(outcome)
}

#[tauri::command]
pub async fn cancel_cli_turn(
    state: State<'_, ConversationRuntime>,
    turn_id: String,
) -> Result<(), String> {
    let sender = state
        .active
        .lock()
        .map_err(|_| "runtime_failed")?
        .get_mut(&turn_id)
        .and_then(Option::take);
    if let Some(sender) = sender {
        let _ = sender.send(());
    }
    for _ in 0..200 {
        if !state
            .active
            .lock()
            .map_err(|_| "runtime_failed")?
            .contains_key(&turn_id)
        {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    }
    Err("cancel_not_confirmed".into())
}
