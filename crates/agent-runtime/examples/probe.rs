#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let probes = agent_runtime::probe_installed_agents().await;
    println!("{}", serde_json::to_string_pretty(&probes)?);
    Ok(())
}
