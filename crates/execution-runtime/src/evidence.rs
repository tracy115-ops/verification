use crate::{types::*, validation::sha256};
use std::{collections::BTreeSet, path::Path};

async fn bounded_read(file: &Path, optional: bool) -> Result<Vec<u8>, String> {
    let metadata = match tokio::fs::symlink_metadata(file).await {
        Ok(value) => value,
        Err(error) if optional && error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(Vec::new());
        }
        Err(_) => return Err("evidence_invalid".into()),
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 1_048_576 {
        return Err("execution_output_limit".into());
    }
    let value = tokio::fs::read(file)
        .await
        .map_err(|_| "evidence_invalid")?;
    if value.len() > 1_048_576 {
        return Err("execution_output_limit".into());
    }
    Ok(value)
}
fn redact(value: &mut serde_json::Value, workspace: &str) {
    match value {
        serde_json::Value::Object(map) => {
            for (key, item) in map.iter_mut() {
                let key = key.to_ascii_lowercase();
                if [
                    "authorization",
                    "cookie",
                    "set-cookie",
                    "password",
                    "token",
                    "apikey",
                    "api_key",
                    "x-api-key",
                    "secret",
                ]
                .iter()
                .any(|part| key.contains(part))
                {
                    *item = "[redacted]".into();
                } else {
                    redact(item, workspace);
                }
            }
        }
        serde_json::Value::Array(items) => {
            for item in items {
                redact(item, workspace);
            }
        }
        serde_json::Value::String(text) => {
            *text = text.replace(workspace, "<workspace>");
        }
        _ => {}
    }
}

pub async fn collect(
    folder: &Path,
    payload: &ExecutionPayload,
    digest: String,
) -> Result<EvidenceBundle, String> {
    let raw_results = bounded_read(&folder.join("result.json"), false).await?;
    let raw_requests = bounded_read(&folder.join("evidence.jsonl"), true).await?;
    let mut value: serde_json::Value =
        serde_json::from_slice(&raw_results).map_err(|_| "evidence_invalid")?;
    let workspace = folder.to_string_lossy();
    redact(&mut value, &workspace);
    let mut results: Vec<TestResult> =
        serde_json::from_value(value).map_err(|_| "evidence_invalid")?;
    let actual: BTreeSet<_> = results.iter().map(|item| item.test_name.as_str()).collect();
    let expected: BTreeSet<_> = payload
        .implementation
        .tests
        .iter()
        .map(|item| item.test_name.as_str())
        .collect();
    if actual != expected
        || results.len() != expected.len()
        || results.iter().any(|item| {
            !["passed", "failed", "error", "skipped"].contains(&item.status.as_str())
                || item.details.len() > 200
                || item.details.iter().any(|text| text.len() > 48000)
        })
    {
        return Err("evidence_invalid".into());
    }
    let mut requests = Vec::new();
    for line in raw_requests
        .split(|byte| *byte == b'\n')
        .filter(|line| !line.iter().all(u8::is_ascii_whitespace))
    {
        if requests.len() >= 500 || line.len() > 65536 {
            return Err("execution_output_limit".into());
        }
        let mut value = serde_json::from_slice(line).map_err(|_| "evidence_invalid")?;
        let entry: &serde_json::Value = &value;
        if !entry["test"].is_string()
            || !entry["request"]["method"].is_string()
            || !entry["request"]["path"].is_string()
            || !entry["response"]["status"]
                .as_u64()
                .is_some_and(|status| (100..600).contains(&status))
        {
            return Err("evidence_invalid".into());
        }
        redact(&mut value, &workspace);
        requests.push(value);
    }
    for result in &mut results {
        let attributed = requests.iter().any(|entry| {
            entry["test"]
                .as_str()
                .is_some_and(|name| name.rsplit('.').next() == Some(result.test_name.as_str()))
                && entry["request"]["path"] != "/__fixture/reset"
        });
        if !attributed && result.status != "skipped" {
            result.status = "error".into();
            result.details.push("missing_request_evidence".into());
        }
    }
    Ok(EvidenceBundle {
        execution_id: payload.execution_id.clone(),
        plan_digest: digest,
        results,
        requests,
        raw_evidence_sha256: sha256(&raw_requests),
        result_sha256: sha256(&raw_results),
        workspace_id: format!("{}-execute", payload.execution_id),
    })
}
