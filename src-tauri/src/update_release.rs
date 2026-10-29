use reqwest::{Url, redirect::Policy};
use semver::Version;
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub const REPOSITORY: &str = "tracy115-ops/verification";
pub const MAX_INSTALLER: u64 = 256 * 1024 * 1024;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Release {
    pub version: String,
    pub notes: String,
    pub published_at: String,
    pub release_url: String,
    pub size: u64,
    #[serde(skip)]
    pub download_url: String,
    #[serde(skip)]
    pub sha256: String,
}
#[derive(Deserialize)]
struct Asset {
    name: String,
    size: u64,
    browser_download_url: String,
    digest: Option<String>,
    state: String,
}
#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    html_url: String,
    published_at: Option<String>,
    body: Option<String>,
    assets: Vec<Asset>,
}

pub fn builder() -> reqwest::ClientBuilder {
    reqwest::Client::builder()
        .user_agent(concat!(
            "verification-workbench/",
            env!("CARGO_PKG_VERSION")
        ))
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(45))
        .redirect(Policy::custom(|attempt| {
            let url = attempt.url();
            if attempt.previous().len() >= 5 || !allowed_host(url) {
                attempt.error("update_redirect_rejected")
            } else {
                attempt.follow()
            }
        }))
}
#[cfg(test)]
pub fn client() -> Result<reqwest::Client, String> {
    builder()
        .build()
        .map_err(|_| "update_network_failed".into())
}
pub(crate) fn allowed_host(url: &Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && matches!(
            url.host_str(),
            Some(
                "github.com"
                    | "api.github.com"
                    | "release-assets.githubusercontent.com"
                    | "objects.githubusercontent.com"
                    | "github-releases.githubusercontent.com"
            )
        )
}
pub fn network_error(error: reqwest::Error) -> String {
    if error.is_timeout() {
        "update_timeout"
    } else {
        "update_network_failed"
    }
    .into()
}
pub fn decode(bytes: &[u8], current: &str) -> Result<Option<Release>, String> {
    let value: GithubRelease =
        serde_json::from_slice(bytes).map_err(|_| "update_invalid_release")?;
    let version = value
        .tag_name
        .strip_prefix('v')
        .and_then(|v| Version::parse(v).ok())
        .ok_or("update_invalid_release")?;
    let local = Version::parse(current).map_err(|_| "update_invalid_release")?;
    if value.draft
        || value.prerelease
        || !version.pre.is_empty()
        || !version.build.is_empty()
        || value.assets.len() > 100
    {
        return Err("update_invalid_release".into());
    }
    if version <= local {
        return Ok(None);
    }
    let expected_page = format!(
        "https://github.com/{REPOSITORY}/releases/tag/{}",
        value.tag_name
    );
    if value.html_url != expected_page {
        return Err("update_invalid_release".into());
    }
    let prefix = format!("Verification-Workbench-{version}-build.");
    let assets: Vec<_> = value
        .assets
        .iter()
        .filter(|a| a.name.starts_with(&prefix) && a.name.ends_with("-windows-x64-setup.exe"))
        .collect();
    if assets.len() != 1 {
        return Err("update_invalid_release".into());
    }
    let asset = assets[0];
    let digest = asset
        .digest
        .as_ref()
        .and_then(|v| v.strip_prefix("sha256:"))
        .ok_or("update_invalid_release")?;
    if asset.state != "uploaded"
        || asset.size == 0
        || asset.size > MAX_INSTALLER
        || digest.len() != 64
        || !digest.bytes().all(|c| c.is_ascii_hexdigit())
        || !asset
            .name
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || b"._-".contains(&c))
    {
        return Err("update_invalid_release".into());
    }
    let expected_download = format!(
        "https://github.com/{REPOSITORY}/releases/download/{}/{}",
        value.tag_name, asset.name
    );
    if asset.browser_download_url != expected_download {
        return Err("update_invalid_release".into());
    }
    let notes = value.body.unwrap_or_default();
    if notes.len() > 65536 {
        return Err("update_invalid_release".into());
    }
    Ok(Some(Release {
        version: version.to_string(),
        notes,
        published_at: value.published_at.unwrap_or_default(),
        release_url: expected_page,
        size: asset.size,
        download_url: expected_download,
        sha256: digest.to_ascii_lowercase(),
    }))
}
#[cfg(test)]
pub async fn latest(current: &str) -> Result<Option<Release>, String> {
    latest_with_config(current, &super::update_network::NetworkConfig::default()).await
}
pub async fn latest_with_config(
    current: &str,
    config: &super::update_network::NetworkConfig,
) -> Result<Option<Release>, String> {
    let mut response = super::update_network::fetch(
        &format!("https://api.github.com/repos/{REPOSITORY}/releases/latest"),
        Duration::from_secs(45),
        config,
    )
    .await?;
    if response.status().as_u16() == 403 || response.status().as_u16() == 429 {
        return Err("update_rate_limited".into());
    }
    if !response.status().is_success() {
        return Err("update_network_failed".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(network_error)? {
        if bytes.len() + chunk.len() > 1024 * 1024 {
            return Err("update_invalid_release".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    decode(&bytes, current)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn release_validation_rejects_downgrades_external_assets_and_bad_hashes() {
        let mut value = json!({"tag_name":"v0.2.1", "draft":false, "prerelease":false,"html_url":"https://github.com/tracy115-ops/verification/releases/tag/v0.2.1", "body":"notes", "published_at":"2026-10-29T00:00:00Z", "assets":[{"name":"Verification-Workbench-0.2.1-build.1.1-abc-windows-x64-setup.exe", "size":3, "state":"uploaded", "digest":format!("sha256:{}", "a".repeat(64)), "browser_download_url":"https://github.com/tracy115-ops/verification/releases/download/v0.2.1/Verification-Workbench-0.2.1-build.1.1-abc-windows-x64-setup.exe"}]});
        assert!(
            decode(&serde_json::to_vec(&value).unwrap(), "0.2.0")
                .unwrap()
                .is_some()
        );
        assert!(
            decode(&serde_json::to_vec(&value).unwrap(), "0.2.1")
                .unwrap()
                .is_none()
        );
        let original = value["assets"][0]["browser_download_url"].clone();
        value["assets"][0]["browser_download_url"] = json!("http://evil.invalid/setup.exe");
        assert!(decode(&serde_json::to_vec(&value).unwrap(), "0.2.0").is_err());
        value["assets"][0]["browser_download_url"] = original;
        value["assets"][0]["digest"] = json!("sha256:bad");
        assert!(decode(&serde_json::to_vec(&value).unwrap(), "0.2.0").is_err());
        assert!(!allowed_host(&Url::parse("http://github.com/a").unwrap()));
        assert!(!allowed_host(
            &Url::parse("https://github.com.evil.invalid/a").unwrap()
        ));
    }
}
