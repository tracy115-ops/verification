use crate::personal_shadow;
use serde::Deserialize;
use std::path::Path;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct InstallBackup {
    pub id: i64,
    pub sha256: String,
}

pub fn verify(path: &Path, receipt: Option<&InstallBackup>) -> Result<(), String> {
    let receipt = receipt.ok_or("update_backup_required")?;
    if receipt.id < 1 || receipt.sha256.len() != 64 {
        return Err("update_backup_stale".into());
    }
    let status = personal_shadow::status(path)?;
    let latest = status.snapshots.first().ok_or("update_backup_required")?;
    if latest.id != receipt.id || latest.sha256 != receipt.sha256 {
        return Err("update_backup_stale".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn payload() -> String {
        json!({"formatVersion":1,"createdAt":"2026-11-08T00:00:00Z","storage":{
            "verification-workbench.conversations.v1":null,
            "verification-workbench.document.v1":null,
            "verification-workbench.frameworks.v1":null
        },"transcripts":[]})
        .to_string()
    }
    #[test]
    fn only_the_latest_verified_copy_can_authorize_installation() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("shadow.sqlite3");
        assert_eq!(verify(&path, None).unwrap_err(), "update_backup_required");
        assert!(!path.exists());
        let first = personal_shadow::save(&path, &payload())
            .unwrap()
            .snapshots
            .remove(0);
        let receipt = InstallBackup {
            id: first.id,
            sha256: first.sha256,
        };
        verify(&path, Some(&receipt)).unwrap();
        assert_eq!(
            verify(
                &path,
                Some(&InstallBackup {
                    id: first.id,
                    sha256: "a".repeat(64)
                })
            )
            .unwrap_err(),
            "update_backup_stale"
        );
        personal_shadow::save(&path, &payload()).unwrap();
        assert_eq!(
            verify(&path, Some(&receipt)).unwrap_err(),
            "update_backup_stale"
        );
        std::fs::write(&path, "corrupt database").unwrap();
        assert!(verify(&path, Some(&receipt)).is_err());
    }
}
