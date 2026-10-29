use execution_runtime::{EvidenceBundle, ExecutionEvent, ExecutionPayload, ExecutionPlan};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{AppHandle, Manager, State, ipc::Channel};
use tokio::sync::oneshot;

#[derive(Default)]
pub struct ExecutionRuntime {
    active: Mutex<HashMap<String, Option<oneshot::Sender<()>>>>,
}
impl ExecutionRuntime {
    fn reserve(&self, id: &str) -> Result<oneshot::Receiver<()>, String> {
        if !execution_runtime::valid_uuid(id) {
            return Err("execution_invalid".into());
        }
        let (sender, receiver) = oneshot::channel();
        let mut active = self.active.lock().map_err(|_| "runtime_failed")?;
        if !active.is_empty() {
            return Err("execution_busy".into());
        }
        active.insert(id.into(), Some(sender));
        Ok(receiver)
    }
    fn finish(&self, id: &str) {
        if let Ok(mut active) = self.active.lock() {
            active.remove(id);
        }
    }
}
fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|_| "workspace_failed")?
        .join("python-executions"))
}

#[tauri::command]
pub async fn preflight_python(
    app: AppHandle,
    state: State<'_, ExecutionRuntime>,
    payload: ExecutionPayload,
    on_event: Channel<ExecutionEvent>,
) -> Result<ExecutionPlan, String> {
    let updates = app.state::<crate::updater::UpdateRuntime>();
    let _activity = updates.task()?;
    let root = root(&app)?;
    let id = payload.execution_id.clone();
    let cancel = state.reserve(&id)?;
    let result =
        execution_runtime::preflight(&root, payload, cancel, |event| on_event.send(event).is_ok())
            .await;
    state.finish(&id);
    result
}
#[tauri::command]
pub async fn execute_python(
    app: AppHandle,
    state: State<'_, ExecutionRuntime>,
    payload: ExecutionPayload,
    approved_digest: String,
    on_event: Channel<ExecutionEvent>,
) -> Result<EvidenceBundle, String> {
    let updates = app.state::<crate::updater::UpdateRuntime>();
    let _activity = updates.task()?;
    let root = root(&app)?;
    let id = payload.execution_id.clone();
    let cancel = state.reserve(&id)?;
    let result = execution_runtime::execute(&root, payload, &approved_digest, cancel, |event| {
        on_event.send(event).is_ok()
    })
    .await;
    state.finish(&id);
    result
}
#[tauri::command]
pub async fn cancel_python(
    state: State<'_, ExecutionRuntime>,
    execution_id: String,
) -> Result<(), String> {
    let sender = state
        .active
        .lock()
        .map_err(|_| "runtime_failed")?
        .get_mut(&execution_id)
        .and_then(Option::take);
    if let Some(sender) = sender {
        let _ = sender.send(());
    }
    for _ in 0..200 {
        if !state
            .active
            .lock()
            .map_err(|_| "runtime_failed")?
            .contains_key(&execution_id)
        {
            return Ok(());
        }
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    }
    Err("cancel_not_confirmed".into())
}
