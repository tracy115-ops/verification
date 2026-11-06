use serde::Deserialize;
use std::{io::Read, path::PathBuf};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Request {
    operation: String,
    config_directory: Option<PathBuf>,
    settings_file: Option<PathBuf>,
    driver: Option<agent_runtime::DriverId>,
}

/// Read-only native configuration audit; never starts a model call.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = String::new();
    std::io::stdin().take(16385).read_to_string(&mut input)?;
    if input.len() > 16384 {
        return Err("request_too_large".into());
    }
    let request: Request = serde_json::from_str(&input)?;
    let result = match request.operation.as_str() {
        "discover_claude_settings" => serde_json::to_value(
            agent_runtime::discover_claude_settings(request.config_directory)?,
        )?,
        "inspect_claude_setup" => serde_json::to_value(agent_runtime::inspect_claude_setup(
            request.config_directory,
            request.settings_file,
        )?)?,
        "read_cli_model_hints" => {
            let driver = request.driver.ok_or("invalid_request")?;
            let hints = if let Some(file) = request.settings_file {
                if !matches!(driver, agent_runtime::DriverId::Claude) {
                    return Err("cli_config_invalid".into());
                }
                agent_runtime::read_claude_model_file(file)?
            } else {
                agent_runtime::read_model_hints(driver, request.config_directory)?
            };
            serde_json::to_value(hints)?
        }
        _ => return Err("invalid_request".into()),
    };
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}
