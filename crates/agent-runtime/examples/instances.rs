fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!(
        "{}",
        serde_json::to_string_pretty(&agent_runtime::discover_cli_instances())?
    );
    Ok(())
}
