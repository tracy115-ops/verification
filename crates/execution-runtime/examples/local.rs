use execution_runtime::{ExecutionPayload, execute, preflight};
use serde::Deserialize;
use std::{io::Read, path::PathBuf};
use tokio::sync::oneshot;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    operation: String,
    payload: ExecutionPayload,
    approved_digest: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut text = String::new();
    std::io::stdin().take(500001).read_to_string(&mut text)?;
    if text.len() > 500000 {
        return Err("request_limit".into());
    }
    let request: Request = serde_json::from_str(&text)?;
    let root = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("workspace_required")?;
    let (_sender, receiver) = oneshot::channel();
    let value = match request.operation.as_str() {
        "preflight" => {
            serde_json::to_value(preflight(&root, request.payload, receiver, |_| true).await)
        }
        "execute" => serde_json::to_value(
            execute(
                &root,
                request.payload,
                request
                    .approved_digest
                    .as_deref()
                    .ok_or("approval_required")?,
                receiver,
                |_| true,
            )
            .await,
        ),
        _ => return Err("unknown_operation".into()),
    }?;
    println!("{value}");
    Ok(())
}
