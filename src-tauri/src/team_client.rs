use reqwest::{Client, Method, Url, redirect::Policy};
use serde::Serialize;
use serde_json::Value;
use std::{net::Ipv4Addr, time::Duration};
use tokio::sync::Semaphore;

static REQUESTS: Semaphore = Semaphore::const_new(8);
const MAX_BYTES: usize = 2_097_152;

#[derive(Serialize)]
pub struct TeamResponse {
    status: u16,
    body: Value,
}

fn server_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value).map_err(|_| "team_address_invalid")?;
    let host = url.host_str().ok_or("team_address_invalid")?;
    let ip = if host == "localhost" {
        Ipv4Addr::LOCALHOST
    } else {
        host.parse::<Ipv4Addr>()
            .map_err(|_| "team_address_invalid")?
    };
    if value.len() > 100
        || url.scheme() != "http"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || url.path() != "/"
        || url.port().unwrap_or(80) < 1024
        || ip.octets()[0] == 0
        || ip.octets()[0] >= 224
        || ip.is_broadcast()
    {
        return Err("team_address_invalid".into());
    }
    Ok(url)
}

fn valid_route(path: &str, method: &str) -> bool {
    let pieces: Vec<_> = path.strip_prefix('/').unwrap_or("").split('/').collect();
    if !["GET", "POST"].contains(&method) {
        return false;
    }
    match pieces.as_slice() {
        ["me"] => method == "GET",
        ["members"] | ["projects"] => true,
        ["scripts", "inspect"] => method == "POST",
        ["projects", id, rest @ ..] => {
            let id_valid = id.starts_with("P_")
                && id.len() <= 80
                && id
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-');
            id_valid
                && match rest {
                    [] | ["history"] => method == "GET",
                    ["commands"] | ["scripts"] => method == "POST",
                    ["revisions", number] => {
                        method == "GET" && number.parse::<u32>().is_ok_and(|n| n > 0)
                    }
                    _ => false,
                }
        }
        _ => false,
    }
}

#[tauri::command]
pub async fn team_request(
    server: String,
    token: String,
    path: String,
    method: String,
    body: Option<Value>,
) -> Result<TeamResponse, String> {
    let mut url = server_url(&server)?;
    if !valid_route(&path, &method)
        || !(32..=256).contains(&token.len())
        || !token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        || (method == "GET" && body.is_some())
    {
        return Err("team_invalid".into());
    }
    let payload = body
        .map(|value| serde_json::to_vec(&value))
        .transpose()
        .map_err(|_| "team_invalid")?;
    if payload
        .as_ref()
        .is_some_and(|value| value.len() > 1_048_576)
    {
        return Err("team_too_large".into());
    }
    let _permit = REQUESTS.try_acquire().map_err(|_| "team_client_busy")?;
    url.set_path(&format!("/api/team{path}"));
    let client = Client::builder()
        .redirect(Policy::none())
        .no_proxy()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|_| "team_unavailable")?;
    let mut request = client
        .request(
            Method::from_bytes(method.as_bytes()).map_err(|_| "team_invalid")?,
            url,
        )
        .bearer_auth(token);
    if let Some(payload) = payload {
        request = request
            .header("Content-Type", "application/json")
            .body(payload);
    }
    let mut response = request.send().await.map_err(|_| "team_unavailable")?;
    if response.status().is_redirection() {
        return Err("team_redirect_rejected".into());
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_BYTES as u64)
    {
        return Err("team_too_large".into());
    }
    let status = response.status().as_u16();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "team_unavailable")? {
        if bytes.len() + chunk.len() > MAX_BYTES {
            return Err("team_too_large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = serde_json::from_slice(&bytes).map_err(|_| "team_invalid_response")?;
    Ok(TeamResponse { status, body })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};

    fn response(result: &'static str) -> (String, std::thread::JoinHandle<String>) {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let task = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut buffer = [0; 4096];
            let read = socket.read(&mut buffer).unwrap();
            socket.write_all(result.as_bytes()).unwrap();
            String::from_utf8_lossy(&buffer[..read]).into_owned()
        });
        (address, task)
    }

    #[test]
    fn native_http_preserves_authentication_and_server_status_without_an_origin_header() {
        let (address, task) = response(
            "HTTP/1.1 401 Unauthorized\r\nContent-Length: 28\r\nConnection: close\r\n\r\n{\"code\":\"team_unauthorized\"}",
        );
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime
            .block_on(team_request(
                address,
                "a".repeat(32),
                "/me".into(),
                "GET".into(),
                None,
            ))
            .unwrap();
        assert_eq!(result.status, 401);
        assert_eq!(result.body["code"], "team_unauthorized");
        let request = task.join().unwrap().to_lowercase();
        assert!(request.contains(&format!("authorization: bearer {}", "a".repeat(32))));
        assert!(!request.contains("\r\norigin:"));
    }

    #[test]
    fn redirects_and_oversized_responses_are_rejected() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        for (reply, code) in [
            (
                "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.1:9\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                "team_redirect_rejected",
            ),
            (
                "HTTP/1.1 200 OK\r\nContent-Length: 9999999\r\nConnection: close\r\n\r\n",
                "team_too_large",
            ),
            (
                "HTTP/1.1 200 OK\r\nContent-Length: 3\r\nConnection: close\r\n\r\nbad",
                "team_invalid_response",
            ),
        ] {
            let (address, task) = response(reply);
            let result = runtime.block_on(team_request(
                address,
                "a".repeat(32),
                "/me".into(),
                "GET".into(),
                None,
            ));
            assert_eq!(result.err().as_deref(), Some(code));
            task.join().unwrap();
        }
    }
    #[test]
    fn endpoints_are_limited_to_lan_origins_and_explicit_team_routes() {
        assert!(server_url("http://192.168.1.20:4317").is_ok());
        assert!(server_url("http://localhost:4317").is_ok());
        assert!(server_url("http://198.51.100.10:4317").is_ok());
        for value in [
            "https://192.168.1.20:4317",
            "http://224.0.0.1:4317",
            "http://user@127.0.0.1:4317",
            "http://127.0.0.1:4317/path",
            "http://127.0.0.1:80",
            "http://0.0.0.0:4317",
        ] {
            assert!(server_url(value).is_err(), "{value}");
        }
        assert!(valid_route("/projects/P_test/commands", "POST"));
        assert!(valid_route("/projects/P_test/history", "GET"));
        for path in [
            "/projects/P_test/../../me",
            "//evil.test",
            "/projects/P_test?secret",
            "/arbitrary",
            "/projects/P_test/commands?query=1",
        ] {
            assert!(!valid_route(path, "POST"), "{path}");
        }
        assert!(!valid_route("/projects/P_test", "DELETE"));
    }
}
