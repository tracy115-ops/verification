use crate::*;
use std::{
    fs,
    io::{Read, Write},
    net::TcpListener,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

pub struct Fixture {
    pub root: PathBuf,
    pub payload: ExecutionPayload,
    stop: Arc<AtomicBool>,
    worker: Option<thread::JoinHandle<()>>,
}
impl Fixture {
    pub fn new() -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("verification-python-{nonce}"));
        fs::create_dir_all(&root).expect("owned fixture");
        let listener = TcpListener::bind("127.0.0.1:0").expect("listen");
        let target = format!("http://{}", listener.local_addr().expect("address"));
        listener.set_nonblocking(true).expect("nonblocking");
        let stop = Arc::new(AtomicBool::new(false));
        let signal = stop.clone();
        let worker = thread::spawn(move || {
            while !signal.load(Ordering::Relaxed) {
                if let Ok((mut stream, _)) = listener.accept() {
                    // Windows accepts inherit the listener's nonblocking mode.
                    stream.set_nonblocking(false).expect("blocking client");
                    stream
                        .set_read_timeout(Some(Duration::from_secs(10)))
                        .expect("client timeout");
                    read_request(&mut stream);
                    let body = r#"{"ready":true}"#;
                    let response = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    );
                    let _ = stream.write_all(response.as_bytes());
                } else {
                    thread::sleep(Duration::from_millis(2));
                }
            }
        });
        Self { root, payload: ExecutionPayload {
            session_id: "11111111-1111-4111-8111-111111111111".into(), run_id: "22222222-2222-4222-8222-222222222222".into(), execution_id: "33333333-3333-4333-8333-333333333333".into(),
            profile: FrameworkProfile { id: "fixture".into(), name: "Python fixture".into(), adapter: "python-unittest-v1".into(), python_command: "python".into(), framework_source: DEFAULT_FRAMEWORK.into(), instructions: String::new(), target_url: target, timeout_seconds: 5 },
            implementation: ImplementationBundle { script: "from framework import BlackBoxCase\nclass Tests(BlackBoxCase):\n    def test_probe(self):\n        response = self.client.call('GET', '/probe', headers={'Authorization':'fixture-secret'})\n        self.assertEqual(response.status, 200)\n".into(), tests: vec![TestMapping { test_name: "test_probe".into(), case_ids: vec!["TC-1".into()] }], questions: vec![] },
        }, stop, worker: Some(worker) }
    }
    pub async fn plan(&self) -> ExecutionPlan {
        let (_sender, receiver) = tokio::sync::oneshot::channel();
        preflight(&self.root, self.payload.clone(), receiver, |_| true)
            .await
            .expect("preflight")
    }
    pub async fn run(&self, plan: &ExecutionPlan) -> Result<EvidenceBundle, String> {
        let (_sender, receiver) = tokio::sync::oneshot::channel();
        execute(
            &self.root,
            plan.payload.clone(),
            &plan.digest,
            receiver,
            |_| true,
        )
        .await
    }
}
fn read_request(stream: &mut std::net::TcpStream) {
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 4096];
    while bytes.len() < 65536 {
        let Ok(count) = stream.read(&mut chunk) else {
            return;
        };
        if count == 0 {
            return;
        }
        bytes.extend_from_slice(&chunk[..count]);
        if let Some(end) = bytes.windows(4).position(|part| part == b"\r\n\r\n") {
            let header = String::from_utf8_lossy(&bytes[..end]);
            let size = header
                .lines()
                .find_map(|line| {
                    line.to_ascii_lowercase()
                        .strip_prefix("content-length:")
                        .and_then(|value| value.trim().parse::<usize>().ok())
                })
                .unwrap_or(0);
            if bytes.len() >= end + 4 + size {
                return;
            }
        }
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(worker) = self.worker.take() {
            worker.join().expect("fixture server stopped");
        }
        let root = self.root.canonicalize().expect("canonical owned fixture");
        let temp = std::env::temp_dir()
            .canonicalize()
            .expect("canonical temp root");
        assert_eq!(root.parent(), Some(temp.as_path()));
        assert!(
            root.file_name()
                .expect("name")
                .to_string_lossy()
                .starts_with("verification-python-")
        );
        fs::remove_dir_all(root).expect("remove owned fixture only");
    }
}
