use agent_runtime::{TurnRequest, run_turn};
use std::{io::Read, path::PathBuf};
use tokio::sync::oneshot;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut text = String::new();
    std::io::stdin().take(262145).read_to_string(&mut text)?;
    if text.len() > 262144 {
        return Err("request_too_large".into());
    }
    let request: TurnRequest = serde_json::from_str(&text)?;
    let workspace = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("workspace_required")?;
    let (_sender, receiver) = oneshot::channel();
    let outcome = run_turn(request, &workspace, receiver, |event| {
        println!("{}", serde_json::json!({ "event": event }));
        true
    })
    .await;
    println!("{}", serde_json::json!({ "outcome": outcome }));
    Ok(())
}
