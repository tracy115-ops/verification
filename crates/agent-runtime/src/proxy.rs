use tokio::process::Command;

#[cfg(any(windows, test))]
fn proxy_url(authority: &str) -> Option<String> {
    let authority = authority
        .trim()
        .strip_prefix("http://")
        .unwrap_or(authority.trim());
    let (host, port) = authority.rsplit_once(':')?;
    if host.is_empty()
        || port.parse::<u16>().ok()? == 0
        || !host
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b".-:[]".contains(&byte))
    {
        return None;
    }
    Some(format!("http://{authority}"))
}

#[cfg(any(windows, test))]
fn parse_proxy(value: &str) -> Option<(String, String)> {
    if !value.contains('=') {
        let proxy = proxy_url(value)?;
        return Some((proxy.clone(), proxy));
    }
    let entries: Vec<_> = value
        .split(';')
        .filter_map(|item| item.trim().split_once('='))
        .collect();
    let http = entries
        .iter()
        .find(|(scheme, _)| *scheme == "http")
        .and_then(|(_, value)| proxy_url(value));
    let https = entries
        .iter()
        .find(|(scheme, _)| *scheme == "https")
        .and_then(|(_, value)| proxy_url(value));
    Some((http.clone().or_else(|| https.clone())?, https.or(http)?))
}

#[cfg(windows)]
fn system_proxy() -> Option<(String, String)> {
    use windows_sys::Win32::System::Registry::{
        HKEY_CURRENT_USER, RRF_RT_REG_DWORD, RRF_RT_REG_SZ, RegGetValueW,
    };
    let wide = |value: &str| value.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
    let key = wide("Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings");
    let enabled_name = wide("ProxyEnable");
    let server_name = wide("ProxyServer");
    let mut enabled = 0u32;
    let mut size = 4u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            key.as_ptr(),
            enabled_name.as_ptr(),
            RRF_RT_REG_DWORD,
            std::ptr::null_mut(),
            (&mut enabled as *mut u32).cast(),
            &mut size,
        )
    };
    if result != 0 || enabled != 1 {
        return None;
    }
    let mut buffer = [0u16; 2048];
    size = (buffer.len() * 2) as u32;
    let result = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            key.as_ptr(),
            server_name.as_ptr(),
            RRF_RT_REG_SZ,
            std::ptr::null_mut(),
            buffer.as_mut_ptr().cast(),
            &mut size,
        )
    };
    if result != 0 {
        return None;
    }
    let end = buffer.iter().position(|value| *value == 0)?;
    parse_proxy(&String::from_utf16(&buffer[..end]).ok()?)
}

/// Native CLIs inherit explicit environment configuration first. Windows desktop
/// launches otherwise use the current user's enabled static system proxy.
pub fn configure(command: &mut Command) {
    #[cfg(windows)]
    {
        if [
            "HTTP_PROXY",
            "HTTPS_PROXY",
            "ALL_PROXY",
            "http_proxy",
            "https_proxy",
            "all_proxy",
        ]
        .iter()
        .any(|key| std::env::var_os(key).is_some())
        {
            return;
        }
        if let Some((http, https)) = system_proxy() {
            command.env("HTTP_PROXY", http).env("HTTPS_PROXY", https);
            if std::env::var_os("NO_PROXY").is_none() && std::env::var_os("no_proxy").is_none() {
                command.env("NO_PROXY", "localhost,127.0.0.1,::1");
            }
        }
    }
    #[cfg(not(windows))]
    let _ = command;
}

#[cfg(test)]
mod tests {
    use super::parse_proxy;

    #[test]
    fn accepts_static_and_protocol_specific_system_proxy_values() {
        assert_eq!(
            parse_proxy("127.0.0.1:10808"),
            Some((
                "http://127.0.0.1:10808".into(),
                "http://127.0.0.1:10808".into()
            ))
        );
        assert_eq!(
            parse_proxy("http=proxy.local:8080;https=proxy.local:8081;socks=localhost:1080"),
            Some((
                "http://proxy.local:8080".into(),
                "http://proxy.local:8081".into()
            ))
        );
        for invalid in [
            "socks=localhost:1080",
            "host:0",
            "user:secret@host:8080",
            "host:8080/path",
            "bad host:8080",
        ] {
            assert!(parse_proxy(invalid).is_none());
        }
    }
}
