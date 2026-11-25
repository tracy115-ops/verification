use crate::{FrameworkProfile, sha256};
use std::{collections::HashSet, path::Path};

fn valid_component(name: &str) -> bool {
    !matches!(name, "con" | "prn" | "aux" | "nul")
        && !(name.len() == 4
            && (name.starts_with("com") || name.starts_with("lpt"))
            && name.as_bytes()[3].is_ascii_digit())
        && name
            .as_bytes()
            .first()
            .is_some_and(|c| c.is_ascii_lowercase() || *c == b'_')
        && name
            .bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'_')
}

pub(crate) fn validate_modules(profile: &FrameworkProfile) -> Result<(), String> {
    let Some(modules) = &profile.framework_modules else {
        return Ok(());
    };
    if !(1..=24).contains(&modules.len()) {
        return Err("execution_invalid".into());
    }
    let mut paths = HashSet::new();
    let mut total = profile.framework_source.len();
    for file in modules {
        if file.path.len() > 160
            || !file
                .path
                .strip_prefix("sdk/")
                .and_then(|path| path.strip_suffix(".py"))
                .is_some_and(|path| path.split('/').all(valid_component))
            || !paths.insert(file.path.as_str())
            || file.source.len() > 60000
        {
            return Err("execution_invalid".into());
        }
        total += file.source.len();
    }
    if total > 128000 {
        return Err("execution_invalid".into());
    }
    Ok(())
}

pub(crate) fn framework_digest(profile: &FrameworkProfile) -> Result<String, String> {
    let Some(modules) = &profile.framework_modules else {
        return Ok(sha256(profile.framework_source.as_bytes()));
    };
    let mut files: Vec<_> = modules
        .iter()
        .map(|file| (file.path.as_str(), file.source.as_str()))
        .collect();
    files.sort_unstable_by_key(|(path, _)| *path);
    files.insert(0, ("framework.py", profile.framework_source.as_str()));
    let bytes = serde_json::to_vec(&files).map_err(|_| "execution_invalid")?;
    Ok(sha256(&bytes))
}

pub(crate) async fn write_modules(folder: &Path, profile: &FrameworkProfile) -> Result<(), String> {
    for file in profile.framework_modules.iter().flatten() {
        let path = folder.join(&file.path);
        tokio::fs::create_dir_all(path.parent().ok_or("workspace_failed")?)
            .await
            .map_err(|_| "workspace_failed")?;
        tokio::fs::write(&path, &file.source)
            .await
            .map_err(|_| "workspace_failed")?;
    }
    Ok(())
}
