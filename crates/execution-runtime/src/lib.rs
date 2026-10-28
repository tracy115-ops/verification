mod evidence;
mod process;
#[cfg(test)]
mod test_support;
#[cfg(test)]
mod tests;
mod types;
mod validation;
use std::path::{Path, PathBuf};
use tokio::sync::oneshot;
pub use types::*;
pub use validation::{payload_digest, sha256, valid_uuid};

pub const DEFAULT_FRAMEWORK: &str = include_str!("../python/http_framework.py");
const RUNNER: &str = include_str!("../python/runner.py");
const VALIDATOR: &str = include_str!("../python/validation.py");

async fn workspace(
    root: &Path,
    payload: &ExecutionPayload,
    phase: &str,
) -> Result<PathBuf, String> {
    validation::validate(payload)?;
    tokio::fs::create_dir_all(root)
        .await
        .map_err(|_| "workspace_failed")?;
    let root = tokio::fs::canonicalize(root)
        .await
        .map_err(|_| "workspace_failed")?;
    let folder = root.join(format!("{}-{}", payload.execution_id, phase));
    // A phase is single-use. Never reuse evidence or retry against an old working directory.
    tokio::fs::create_dir(&folder)
        .await
        .map_err(|_| "execution_already_started")?;
    let folder = tokio::fs::canonicalize(folder)
        .await
        .map_err(|_| "workspace_failed")?;
    if folder.parent() != Some(root.as_path()) {
        return Err("workspace_failed".into());
    }
    for (file, content) in [
        ("runner.py", RUNNER),
        ("validation.py", VALIDATOR),
        ("framework.py", &payload.profile.framework_source),
        ("test_generated.py", &payload.implementation.script),
    ] {
        tokio::fs::write(folder.join(file), content)
            .await
            .map_err(|_| "workspace_failed")?;
    }
    let mapping =
        serde_json::to_vec(&payload.implementation.tests).map_err(|_| "execution_invalid")?;
    tokio::fs::write(folder.join("mapping.json"), mapping)
        .await
        .map_err(|_| "workspace_failed")?;
    Ok(folder)
}

pub async fn preflight(
    root: &Path,
    payload: ExecutionPayload,
    cancel: oneshot::Receiver<()>,
    sink: impl Fn(ExecutionEvent) -> bool,
) -> Result<ExecutionPlan, String> {
    let folder = workspace(root, &payload, "preflight").await?;
    process::python(
        &payload.profile.python_command,
        &folder,
        "validate",
        &payload.profile.target_url,
        15,
        cancel,
        &sink,
    )
    .await?;
    let text = tokio::fs::read(folder.join("preflight.json"))
        .await
        .map_err(|_| "python_validation_failed")?;
    if text.len() > 65536 {
        return Err("execution_output_limit".into());
    }
    let info: serde_json::Value =
        serde_json::from_slice(&text).map_err(|_| "python_validation_failed")?;
    let test_names: Vec<String> = serde_json::from_value(info["testNames"].clone())
        .map_err(|_| "python_validation_failed")?;
    let declared: std::collections::BTreeSet<_> = payload
        .implementation
        .tests
        .iter()
        .map(|item| item.test_name.clone())
        .collect();
    if test_names
        .iter()
        .cloned()
        .collect::<std::collections::BTreeSet<_>>()
        != declared
        || test_names.len() != declared.len()
    {
        return Err("implementation_mapping_invalid".into());
    }
    let plan = ExecutionPlan {
        digest: payload_digest(&payload)?,
        script_sha256: sha256(payload.implementation.script.as_bytes()),
        framework_sha256: sha256(payload.profile.framework_source.as_bytes()),
        python_version: info["pythonVersion"]
            .as_str()
            .ok_or("python_validation_failed")?
            .into(),
        test_names,
        payload,
    };
    tokio::fs::write(
        folder.join("plan.json"),
        serde_json::to_vec(&plan).map_err(|_| "execution_invalid")?,
    )
    .await
    .map_err(|_| "workspace_failed")?;
    Ok(plan)
}

pub async fn execute(
    root: &Path,
    payload: ExecutionPayload,
    approved_digest: &str,
    cancel: oneshot::Receiver<()>,
    sink: impl Fn(ExecutionEvent) -> bool,
) -> Result<EvidenceBundle, String> {
    validation::validate(&payload)?;
    let digest = payload_digest(&payload)?;
    if digest != approved_digest {
        return Err("execution_approval_stale".into());
    }
    let plan_file = root.join(format!("{}-preflight/plan.json", payload.execution_id));
    let metadata = tokio::fs::symlink_metadata(&plan_file)
        .await
        .map_err(|_| "execution_preflight_missing")?;
    if !metadata.is_file() || metadata.len() > 500000 {
        return Err("execution_preflight_missing".into());
    }
    let prior: ExecutionPlan = serde_json::from_slice(
        &tokio::fs::read(plan_file)
            .await
            .map_err(|_| "execution_preflight_missing")?,
    )
    .map_err(|_| "execution_preflight_missing")?;
    if prior.digest != digest || payload_digest(&prior.payload)? != digest {
        return Err("execution_approval_stale".into());
    }
    let folder = workspace(root, &payload, "execute").await?;
    process::python(
        &payload.profile.python_command,
        &folder,
        "execute",
        &payload.profile.target_url,
        payload.profile.timeout_seconds,
        cancel,
        &sink,
    )
    .await?;
    evidence::collect(&folder, &payload, digest).await
}
