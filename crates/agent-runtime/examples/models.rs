fn main() -> Result<(), Box<dyn std::error::Error>> {
    let hints = agent_runtime::read_model_hints(agent_runtime::DriverId::Codex, None)?;
    println!("{}", serde_json::to_string_pretty(&hints)?);
    Ok(())
}
