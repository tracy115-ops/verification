use reqwest::{Response, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NetworkConfig {
    pub mode: Mode,
    pub address: String,
}
#[derive(Clone, Copy, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    #[default]
    System,
    Manual,
    Pac,
}
#[derive(Serialize)]
pub struct NetworkInfo {
    config: NetworkConfig,
    source: &'static str,
}
#[derive(Clone)]
pub enum Route {
    Auto,
    Direct,
    Proxy(String, Option<String>),
    Pac(String),
    Detect,
    Fallback(Vec<Route>),
}
fn validate(config: &NetworkConfig) -> Result<(), String> {
    if config.mode == Mode::System {
        return if config.address.is_empty() {
            Ok(())
        } else {
            Err("update_proxy_invalid".into())
        };
    }
    let url = Url::parse(&config.address).map_err(|_| "update_proxy_invalid")?;
    let valid_scheme = if config.mode == Mode::Pac {
        matches!(url.scheme(), "http" | "https")
    } else {
        matches!(url.scheme(), "http" | "https" | "socks5" | "socks5h")
    };
    if config.address.len() > 2048
        || !valid_scheme
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || (config.mode == Mode::Manual && (url.path() != "/" || url.query().is_some()))
    {
        return Err("update_proxy_invalid".into());
    }
    Ok(())
}
fn path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|_| "update_proxy_invalid")?
        .join("update-network.json"))
}
pub fn load(app: &AppHandle) -> Result<NetworkConfig, String> {
    let file = path(app)?;
    if !file.exists() {
        return Ok(NetworkConfig::default());
    }
    if std::fs::metadata(&file)
        .map_err(|_| "update_proxy_invalid")?
        .len()
        > 4096
    {
        return Err("update_proxy_invalid".into());
    }
    let value: NetworkConfig =
        serde_json::from_slice(&std::fs::read(file).map_err(|_| "update_proxy_invalid")?)
            .map_err(|_| "update_proxy_invalid")?;
    validate(&value)?;
    Ok(value)
}
fn environment_proxy() -> bool {
    [
        "HTTPS_PROXY",
        "HTTP_PROXY",
        "ALL_PROXY",
        "https_proxy",
        "http_proxy",
        "all_proxy",
    ]
    .iter()
    .any(|key| std::env::var_os(key).is_some_and(|v| !v.is_empty()))
}
pub fn selection(config: &NetworkConfig) -> Result<(Route, &'static str), String> {
    validate(config)?;
    if config.mode == Mode::Manual {
        return Ok((Route::Proxy(config.address.clone(), None), "manual"));
    }
    if config.mode == Mode::Pac {
        return Ok((Route::Pac(config.address.clone()), "pac"));
    }
    if environment_proxy() {
        return Ok((Route::Auto, "environment"));
    }
    #[cfg(windows)]
    {
        super::windows_proxy::selection()
    }
    #[cfg(not(windows))]
    Ok((Route::Auto, "system"))
}
#[tauri::command]
pub fn update_network_settings(app: AppHandle) -> Result<NetworkInfo, String> {
    let config = load(&app)?;
    let (_, source) = selection(&config)?;
    Ok(NetworkInfo { config, source })
}
#[tauri::command]
pub async fn save_update_network(
    app: AppHandle,
    state: State<'_, super::updater::UpdateRuntime>,
    config: NetworkConfig,
) -> Result<NetworkInfo, String> {
    let _guard = state.network_change()?;
    validate(&config)?;
    let file = path(&app)?;
    std::fs::create_dir_all(file.parent().ok_or("update_proxy_invalid")?)
        .map_err(|_| "update_proxy_invalid")?;
    std::fs::write(
        &file,
        serde_json::to_vec(&config).map_err(|_| "update_proxy_invalid")?,
    )
    .map_err(|_| "update_proxy_invalid")?;
    let (_, source) = selection(&config)?;
    Ok(NetworkInfo { config, source })
}
pub async fn fetch(
    address: &str,
    timeout: Duration,
    config: &NetworkConfig,
) -> Result<Response, String> {
    tokio::time::timeout(timeout, fetch_inner(address, timeout, config))
        .await
        .map_err(|_| "update_timeout".to_string())?
}
async fn fetch_inner(
    address: &str,
    timeout: Duration,
    config: &NetworkConfig,
) -> Result<Response, String> {
    let deadline = tokio::time::Instant::now() + timeout;
    let (route, _) = selection(config)?;
    let mut url = Url::parse(address).map_err(|_| "update_network_failed")?;
    for _ in 0..5 {
        if !super::update_release::allowed_host(&url) {
            return Err("update_invalid_release".into());
        }
        let selected = match &route {
            #[cfg(windows)]
            Route::Pac(script) => {
                super::windows_proxy::resolve(Some(script.clone()), url.to_string()).await?
            }
            #[cfg(windows)]
            Route::Detect => super::windows_proxy::resolve(None, url.to_string()).await?,
            Route::Proxy(value, bypass) => Route::Proxy(value.clone(), bypass.clone()),
            Route::Direct => Route::Direct,
            Route::Auto => Route::Auto,
            Route::Fallback(values) => Route::Fallback(values.clone()),
            #[cfg(not(windows))]
            _ => return Err("update_proxy_failed".into()),
        };
        let choices = if let Route::Fallback(values) = selected {
            values
        } else {
            vec![selected]
        };
        let mut response = None;
        let mut failure = "update_network_failed".to_string();
        for choice in choices {
            let mut builder =
                super::update_release::builder().redirect(reqwest::redirect::Policy::none());
            match choice {
                Route::Direct => builder = builder.no_proxy(),
                Route::Proxy(value, bypass) => {
                    builder = builder.no_proxy().proxy(
                        reqwest::Proxy::all(value)
                            .map_err(|_| "update_proxy_invalid")?
                            .no_proxy(bypass.as_deref().and_then(reqwest::NoProxy::from_string)),
                    )
                }
                _ => {}
            }
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                return Err("update_timeout".into());
            }
            match builder
                .build()
                .map_err(|_| "update_network_failed")?
                .get(url.clone())
                .timeout(remaining)
                .send()
                .await
            {
                Ok(value) => {
                    response = Some(value);
                    break;
                }
                Err(error) => failure = super::update_release::network_error(error),
            }
        }
        let response = response.ok_or(failure)?;
        if response.status().as_u16() == 407 {
            return Err("update_proxy_auth_required".into());
        }
        if response.status().is_redirection() {
            let location = response
                .headers()
                .get(reqwest::header::LOCATION)
                .and_then(|v| v.to_str().ok())
                .ok_or("update_invalid_release")?;
            url = url.join(location).map_err(|_| "update_invalid_release")?;
            continue;
        }
        return Ok(response);
    }
    Err("update_invalid_release".into())
}
