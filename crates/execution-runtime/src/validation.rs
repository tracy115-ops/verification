use crate::types::*;
use sha2::{Digest, Sha256};
use std::{collections::HashSet, path::Path};

pub fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn payload_digest(payload: &ExecutionPayload) -> Result<String, String> {
    // Value objects serialize with ordered keys, independently of frontend object insertion order.
    let value = serde_json::to_value(payload).map_err(|_| "execution_invalid")?;
    Ok(sha256(
        &serde_json::to_vec(&value).map_err(|_| "execution_invalid")?,
    ))
}
pub fn valid_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(i, byte)| {
            if [8, 13, 18, 23].contains(&i) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}
pub fn validate(payload: &ExecutionPayload) -> Result<(), String> {
    let profile = &payload.profile;
    if ![&payload.session_id, &payload.run_id, &payload.execution_id]
        .iter()
        .all(|id| valid_uuid(id))
    {
        return Err("execution_invalid".into());
    }
    if profile.adapter != "python-unittest-v1"
        || profile.id.is_empty()
        || profile.name.trim().is_empty()
        || profile.name.len() > 200
        || profile.instructions.len() > 12000
        || !(1..=300).contains(&profile.timeout_seconds)
    {
        return Err("execution_invalid".into());
    }
    let name = Path::new(&profile.python_command)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !["python", "python3", "python.exe", "python3.exe"].contains(&name.as_str())
        || profile.python_command.chars().any(char::is_control)
    {
        return Err("python_invalid".into());
    }
    let url = url::Url::parse(&profile.target_url).map_err(|_| "target_invalid")?;
    if !["http", "https"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || profile.target_url.len() > 2000
    {
        return Err("target_invalid".into());
    }
    let bundle = &payload.implementation;
    if profile.framework_source.trim().is_empty()
        || profile.framework_source.len() > 60000
        || bundle.script.trim().is_empty()
        || bundle.script.len() > 100000
        || bundle.tests.is_empty()
        || bundle.tests.len() > 200
        || !bundle.questions.is_empty()
    {
        return Err("implementation_invalid".into());
    }
    let mut names = HashSet::new();
    for item in &bundle.tests {
        if !item.test_name.starts_with("test_")
            || item.test_name.len() > 160
            || !item
                .test_name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
            || !names.insert(&item.test_name)
            || item.case_ids.is_empty()
            || item.case_ids.len() > 200
            || item
                .case_ids
                .iter()
                .any(|id| id.is_empty() || id.len() > 80)
        {
            return Err("implementation_invalid".into());
        }
    }
    Ok(())
}
