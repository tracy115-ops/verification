use super::update_network::Route;
use std::{
    sync::{Arc, LazyLock},
    time::Duration,
};
use windows_sys::Win32::{
    Foundation::{GetLastError, GlobalFree},
    Networking::WinHttp::*,
};

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}
unsafe fn text(pointer: *mut u16) -> Option<String> {
    if pointer.is_null() {
        return None;
    }
    let mut size = 0;
    while size < 32768 && unsafe { *pointer.add(size) } != 0 {
        size += 1;
    }
    if size == 32768 {
        return None;
    }
    Some(String::from_utf16_lossy(unsafe {
        std::slice::from_raw_parts(pointer, size)
    }))
}
unsafe fn free(pointer: *mut u16) {
    if !pointer.is_null() {
        unsafe {
            GlobalFree(pointer.cast());
        }
    }
}

fn policy() -> Result<Option<(Route, &'static str)>, String> {
    for root in [
        windows_registry::CURRENT_USER,
        windows_registry::LOCAL_MACHINE,
    ] {
        for path in [
            "Software\\Policies\\Microsoft\\Edge",
            "Software\\Policies\\Google\\Chrome",
        ] {
            let Ok(key) = root.open(path) else {
                continue;
            };
            let settings = key
                .get_string("ProxySettings")
                .ok()
                .and_then(|v| serde_json::from_str::<serde_json::Value>(&v).ok());
            let get = |name: &str| {
                settings
                    .as_ref()
                    .and_then(|v| v[name].as_str().map(str::to_string))
                    .or_else(|| key.get_string(name).ok())
            };
            match get("ProxyMode").as_deref() {
                Some("pac_script") => {
                    return Ok(Some((
                        Route::Pac(get("ProxyPacUrl").ok_or("update_proxy_invalid")?),
                        "browser_pac",
                    )));
                }
                Some("auto_detect") => return Ok(Some((Route::Detect, "browser_auto"))),
                Some("fixed_servers") => {
                    return Ok(Some((
                        with_bypass(
                            parse_proxy(
                                &get("ProxyServer").ok_or("update_proxy_invalid")?,
                                "https",
                            )?,
                            get("ProxyBypassList").as_deref().unwrap_or(""),
                        ),
                        "browser_proxy",
                    )));
                }
                Some("direct") => return Ok(Some((Route::Direct, "browser_direct"))),
                _ => {}
            }
        }
    }
    Ok(None)
}
pub fn selection() -> Result<(Route, &'static str), String> {
    if let Some(value) = policy()? {
        return Ok(value);
    }
    let mut config = WINHTTP_CURRENT_USER_IE_PROXY_CONFIG::default();
    if unsafe { WinHttpGetIEProxyConfigForCurrentUser(&mut config) } == 0 {
        return Err("update_proxy_failed".into());
    }
    let pac = unsafe { text(config.lpszAutoConfigUrl) };
    let proxy = unsafe { text(config.lpszProxy) };
    unsafe {
        free(config.lpszAutoConfigUrl);
        free(config.lpszProxy);
        free(config.lpszProxyBypass);
    }
    if let Some(pac) = pac.filter(|v| !v.is_empty()) {
        return Ok((Route::Pac(pac), "system_pac"));
    }
    if proxy.is_some_and(|v| !v.is_empty()) {
        return Ok((Route::Auto, "system_proxy"));
    }
    if config.fAutoDetect != 0 {
        return Ok((Route::Detect, "system_auto"));
    }
    Ok((Route::Auto, "direct"))
}
fn parse_proxy(value: &str, scheme: &str) -> Result<Route, String> {
    let selected = if value.contains('=') {
        value
            .split(';')
            .filter_map(|v| v.trim().split_once('='))
            .find(|(key, _)| *key == scheme)
            .map(|(_, v)| v)
            .ok_or("update_proxy_invalid")?
    } else {
        value
    };
    let mut routes = Vec::new();
    for item in selected
        .split(';')
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .take(8)
    {
        if item.eq_ignore_ascii_case("DIRECT") {
            routes.push(Route::Direct);
            continue;
        }
        let address = if let Some(value) = item
            .strip_prefix("PROXY ")
            .or_else(|| item.strip_prefix("HTTP "))
        {
            format!("http://{value}")
        } else if let Some(value) = item.strip_prefix("HTTPS ") {
            format!("https://{value}")
        } else if let Some(value) = item.strip_prefix("SOCKS5 ") {
            format!("socks5h://{value}")
        } else if item.contains("://") {
            item.to_string()
        } else {
            format!("http://{item}")
        };
        let url = reqwest::Url::parse(&address).map_err(|_| "update_proxy_invalid")?;
        if !matches!(url.scheme(), "http" | "https" | "socks5" | "socks5h")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.query().is_some()
            || url.fragment().is_some()
            || url.path() != "/"
        {
            return Err("update_proxy_invalid".into());
        }
        routes.push(Route::Proxy(address, None));
    }
    if routes.is_empty() {
        return Err("update_proxy_invalid".into());
    }
    if routes.len() == 1 {
        Ok(routes.remove(0))
    } else {
        Ok(Route::Fallback(routes))
    }
}
struct Session(*mut std::ffi::c_void);
impl Drop for Session {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                WinHttpCloseHandle(self.0);
            }
        }
    }
}
fn with_bypass(route: Route, bypass: &str) -> Route {
    match route {
        Route::Proxy(value, _) => Route::Proxy(value, Some(bypass.replace(';', ","))),
        Route::Fallback(values) => Route::Fallback(
            values
                .into_iter()
                .map(|value| with_bypass(value, bypass))
                .collect(),
        ),
        other => other,
    }
}
fn resolve_sync(script: Option<String>, url: String) -> Result<Route, String> {
    let agent = wide("Verification Workbench updater");
    let session = Session(unsafe {
        WinHttpOpen(
            agent.as_ptr(),
            WINHTTP_ACCESS_TYPE_NO_PROXY,
            std::ptr::null(),
            std::ptr::null(),
            0,
        )
    });
    if session.0.is_null() {
        return Err("update_proxy_failed".into());
    }
    unsafe {
        WinHttpSetTimeouts(session.0, 5000, 5000, 5000, 5000);
    }
    let script = script
        .map(|value| {
            let url = reqwest::Url::parse(&value).map_err(|_| "update_proxy_invalid")?;
            if value.len() > 2048
                || !matches!(url.scheme(), "http" | "https")
                || !url.username().is_empty()
                || url.password().is_some()
            {
                return Err("update_proxy_invalid");
            }
            Ok(wide(&value))
        })
        .transpose()?;
    let mut options = WINHTTP_AUTOPROXY_OPTIONS {
        dwFlags: if script.is_some() {
            WINHTTP_AUTOPROXY_CONFIG_URL
        } else {
            WINHTTP_AUTOPROXY_AUTO_DETECT
        },
        dwAutoDetectFlags: WINHTTP_AUTO_DETECT_TYPE_DHCP | WINHTTP_AUTO_DETECT_TYPE_DNS_A,
        lpszAutoConfigUrl: script
            .as_ref()
            .map(|v| v.as_ptr())
            .unwrap_or(std::ptr::null()),
        fAutoLogonIfChallenged: 0,
        ..Default::default()
    };
    let url = wide(&url);
    let mut info = WINHTTP_PROXY_INFO::default();
    if unsafe { WinHttpGetProxyForUrl(session.0, url.as_ptr(), &mut options, &mut info) } == 0 {
        let error = unsafe { GetLastError() };
        unsafe {
            free(info.lpszProxy);
            free(info.lpszProxyBypass);
        }
        if script.is_none() && error == ERROR_WINHTTP_AUTODETECTION_FAILED {
            return Ok(Route::Direct);
        }
        return Err(if error == ERROR_WINHTTP_LOGIN_FAILURE {
            "update_proxy_auth_required"
        } else {
            "update_proxy_failed"
        }
        .into());
    }
    let proxy = unsafe { text(info.lpszProxy) };
    unsafe {
        free(info.lpszProxy);
        free(info.lpszProxyBypass);
    }
    if info.dwAccessType == WINHTTP_ACCESS_TYPE_NO_PROXY {
        return Ok(Route::Direct);
    }
    parse_proxy(&proxy.ok_or("update_proxy_failed")?, "https")
}
pub async fn resolve(script: Option<String>, url: String) -> Result<Route, String> {
    static CALLS: LazyLock<Arc<tokio::sync::Semaphore>> =
        LazyLock::new(|| Arc::new(tokio::sync::Semaphore::new(2)));
    let permit = CALLS
        .clone()
        .try_acquire_owned()
        .map_err(|_| "update_proxy_busy")?;
    tokio::time::timeout(
        Duration::from_secs(12),
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            resolve_sync(script, url)
        }),
    )
    .await
    .map_err(|_| "update_proxy_failed")?
    .map_err(|_| "update_proxy_failed")?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    #[ignore = "explicit Windows PAC service integration check"]
    async fn evaluates_a_local_pac_for_each_destination() {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + Duration::from_secs(20);
            while std::time::Instant::now() < deadline {
                if let Ok((mut socket, _)) = listener.accept() {
                    socket
                        .set_read_timeout(Some(Duration::from_secs(2)))
                        .unwrap();
                    socket
                        .set_write_timeout(Some(Duration::from_secs(2)))
                        .unwrap();
                    let mut request = [0; 4096];
                    let _ = socket.read(&mut request);
                    let body = "function FindProxyForURL(url, host) { if (host == 'api.github.com') return 'PROXY 127.0.0.1:17891'; return 'DIRECT'; }";
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/x-ns-proxy-autoconfig\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = socket.write_all(response.as_bytes());
                } else {
                    std::thread::sleep(Duration::from_millis(20));
                }
            }
        });
        let script = Some(format!("http://{address}/proxy.pac"));
        let api = resolve(
            script.clone(),
            "https://api.github.com/repos/example".into(),
        )
        .await;
        let asset = resolve(
            script,
            "https://release-assets.githubusercontent.com/example".into(),
        )
        .await;
        server.join().unwrap();
        assert!(
            matches!(api, Ok(Route::Proxy(..))),
            "API must use the PAC proxy"
        );
        assert!(
            matches!(asset, Ok(Route::Direct)),
            "asset must use PAC DIRECT"
        );
    }
    #[test]
    fn pac_output_supports_explicit_failover_without_implicit_direct_access() {
        assert!(matches!(
            parse_proxy("PROXY 127.0.0.1:7890; DIRECT", "https").unwrap(),
            Route::Fallback(_)
        ));
        assert!(matches!(
            parse_proxy("https=localhost:8888;http=localhost:8889", "https").unwrap(),
            Route::Proxy(..)
        ));
        assert!(parse_proxy("http://user:secret@localhost:7890", "https").is_err());
        assert!(parse_proxy("", "https").is_err());
    }
}
