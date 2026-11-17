use crate::{ExecutionEvent, process, validation};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::sync::oneshot;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrameworkInspectionRequest {
    pub id: String,
    pub python_command: String,
    pub source: String,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrameworkCheck {
    pub code: String,
    pub status: String,
    pub reason: String,
    pub line: Option<u32>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrameworkHint {
    pub code: String,
    pub line: u32,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FrameworkInspection {
    pub version: u32,
    pub python_version: String,
    pub checks: Vec<FrameworkCheck>,
    pub hints: Vec<FrameworkHint>,
    #[serde(default)]
    pub source_sha256: String,
}
pub async fn inspect_framework(
    root: &Path,
    request: FrameworkInspectionRequest,
    mut cancel: oneshot::Receiver<()>,
    sink: impl Fn(ExecutionEvent) -> bool,
) -> Result<FrameworkInspection, String> {
    if !validation::valid_uuid(&request.id)
        || request.source.is_empty()
        || request.source.len() > 60000
    {
        return Err("framework_inspection_invalid".into());
    }
    validation::validate_python_command(&request.python_command)?;
    if matches!(
        cancel.try_recv(),
        Ok(()) | Err(oneshot::error::TryRecvError::Closed)
    ) {
        return Err("execution_cancelled".into());
    }
    tokio::fs::create_dir_all(root)
        .await
        .map_err(|_| "workspace_failed")?;
    let root = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| "workspace_failed")?;
    let folder = root.join(format!("inspect-{}", request.id));
    tokio::fs::create_dir(&folder)
        .await
        .map_err(|_| "execution_already_started")?;
    let folder = tokio::fs::canonicalize(folder)
        .await
        .map_err(|_| "workspace_failed")?;
    if folder.parent() != Some(root.as_path()) {
        return Err("workspace_failed".into());
    }
    let result = inspect_inner(&folder, &request, cancel, sink).await;
    // Only remove this operation's freshly created, canonical child directory.
    if tokio::fs::canonicalize(&folder).await.ok().as_ref() != Some(&folder) {
        return Err("framework_inspection_cleanup_failed".into());
    }
    tokio::fs::remove_dir_all(&folder)
        .await
        .map_err(|_| "framework_inspection_cleanup_failed")?;
    result
}
async fn inspect_inner(
    folder: &Path,
    request: &FrameworkInspectionRequest,
    cancel: oneshot::Receiver<()>,
    sink: impl Fn(ExecutionEvent) -> bool,
) -> Result<FrameworkInspection, String> {
    if !sink(ExecutionEvent::Heartbeat) {
        return Err("execution_disconnected".into());
    }
    for (name, text) in [
        ("runner.py", include_str!("../python/inspect_framework.py")),
        ("validation.py", include_str!("../python/validation.py")),
        ("framework.py", request.source.as_str()),
    ] {
        tokio::fs::write(folder.join(name), text)
            .await
            .map_err(|_| "workspace_failed")?;
    }
    process::python(
        &request.python_command,
        folder,
        "inspect",
        "",
        10,
        cancel,
        &sink,
    )
    .await?;
    let text = tokio::fs::read(folder.join("preflight.json"))
        .await
        .map_err(|_| "framework_inspection_invalid")?;
    if text.len() > 32768 {
        return Err("framework_inspection_invalid".into());
    }
    let mut report: FrameworkInspection =
        serde_json::from_slice(&text).map_err(|_| "framework_inspection_invalid")?;
    report.source_sha256 = validation::sha256(request.source.as_bytes());
    Ok(report)
}

#[cfg(test)]
mod tests;
