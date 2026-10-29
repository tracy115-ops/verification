use super::*;
use std::{
    io::{Read, Write},
    net::TcpListener,
};

fn response(body: &'static [u8]) -> (String, std::thread::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let url = format!("http://{}", listener.local_addr().unwrap());
    let worker = std::thread::spawn(move || {
        listener.set_nonblocking(true).unwrap();
        let start = std::time::Instant::now();
        let mut stream = loop {
            if let Ok((stream, _)) = listener.accept() {
                break stream;
            }
            assert!(start.elapsed() < Duration::from_secs(6));
            std::thread::sleep(Duration::from_millis(5));
        };
        stream.set_nonblocking(false).unwrap();
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .unwrap();
        let mut headers = Vec::new();
        let mut byte = [0];
        while headers.len() < 8192 && !headers.ends_with(b"\r\n\r\n") {
            if stream.read(&mut byte).unwrap_or(0) == 0 {
                break;
            }
            headers.extend_from_slice(&byte);
        }
        stream
            .write_all(
                format!(
                    "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                )
                .as_bytes(),
            )
            .unwrap();
        stream.write_all(body).unwrap();
    });
    (url, worker)
}
fn release(url: String, bytes: &[u8]) -> Release {
    Release {
        version: "0.2.1".into(),
        notes: String::new(),
        published_at: String::new(),
        release_url: String::new(),
        size: bytes.len() as u64,
        download_url: url,
        sha256: format!("{:x}", Sha256::digest(bytes)),
    }
}
async fn fixture_download(
    release: &Release,
    path: &std::path::Path,
    channel: &Channel<Progress>,
    client: &reqwest::Client,
) -> Result<(), String> {
    let response = client
        .get(&release.download_url)
        .send()
        .await
        .map_err(update_release::network_error)?;
    download_body(release, path, channel, response).await
}

#[tokio::test]
async fn downloads_verify_bytes_and_block_tampering_and_broken_consumers() {
    let directory = tempfile::tempdir().unwrap();
    let (url, worker) = response(b"MZ-fixture");
    let release = release(url, b"MZ-fixture");
    let path = directory.path().join("fixture.part");
    let channel = Channel::new(|_| Ok(()));
    let client = reqwest::Client::builder()
        .no_proxy()
        .timeout(Duration::from_secs(3))
        .build()
        .unwrap();
    fixture_download(&release, &path, &channel, &client)
        .await
        .unwrap();
    worker.join().unwrap();
    verify(&path, &release).await.unwrap();
    tokio::fs::write(&path, b"MZ-tampered").await.unwrap();
    assert_eq!(
        verify(&path, &release).await.unwrap_err(),
        "update_integrity_failed"
    );
    let (url, worker) = response(b"MZ-fixture");
    let mut wrong = release.clone();
    wrong.download_url = url;
    wrong.sha256 = "a".repeat(64);
    let mismatch = directory.path().join("mismatch.part");
    assert_eq!(
        fixture_download(&wrong, &mismatch, &channel, &client)
            .await
            .unwrap_err(),
        "update_integrity_failed"
    );
    worker.join().unwrap();
    let (url, worker) = response(b"MZ-fixture");
    let mut closed = release.clone();
    closed.download_url = url;
    let channel = Channel::new(|_| Err(std::io::Error::other("closed fixture").into()));
    assert_eq!(
        fixture_download(
            &closed,
            &directory.path().join("closed.part"),
            &channel,
            &client
        )
        .await
        .unwrap_err(),
        "update_cancelled"
    );
    worker.join().unwrap();
}
#[tokio::test]
async fn installation_gate_rejects_active_work_and_blocks_new_tasks() {
    let runtime = UpdateRuntime::default();
    let active = runtime.task().unwrap();
    assert!(runtime.activity.try_write().is_err());
    drop(active);
    let install = runtime.activity.try_write().unwrap();
    assert!(runtime.task().is_err());
    drop(install);
    runtime.installing.store(true, Ordering::SeqCst);
    assert!(runtime.task().is_err());
}
#[test]
fn native_client_uses_environment_proxy_without_global_environment_mutation() {
    let (url, worker) = response(b"proxy-fixture");
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "updater::tests::proxy_child",
            "--ignored",
            "--nocapture",
        ])
        .env("HTTP_PROXY", &url)
        .env("HTTPS_PROXY", &url)
        .env("http_proxy", &url)
        .env("https_proxy", &url)
        .env("NO_PROXY", "")
        .env("no_proxy", "")
        .env("UPDATE_PROXY_FIXTURE", "1")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    worker.join().unwrap();
}
#[test]
#[ignore = "subprocess helper for an isolated environment-proxy test"]
fn proxy_child() {
    if std::env::var_os("UPDATE_PROXY_FIXTURE").is_none() {
        return;
    }
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();
    runtime.block_on(async {
        let response = update_release::client()
            .unwrap()
            .get("http://updates.invalid/probe")
            .timeout(Duration::from_secs(3))
            .send()
            .await
            .unwrap();
        assert_eq!(response.text().await.unwrap(), "proxy-fixture");
    });
}
#[tokio::test]
#[ignore = "explicit live HTTPS verification; not part of ordinary tests"]
async fn live_github_check_and_download_with_system_proxy() {
    let latest = update_release::latest("0.0.0").await.unwrap().unwrap();
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("update.part");
    download(
        &latest,
        &path,
        &Channel::new(|_| Ok(())),
        &crate::update_network::NetworkConfig::default(),
    )
    .await
    .unwrap();
    verify(&path, &latest).await.unwrap();
    println!(
        "Live update download verified: {} ({} bytes)",
        latest.version, latest.size
    );
}
