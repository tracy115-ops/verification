mod assistant_observation;
mod codeagent;
mod conversation;
mod discovery;
mod failure;
mod instances;
mod model_hints;
mod probe;
mod protocol;
mod proxy;
mod search_paths;
mod turn_types;

pub use assistant_observation::AssistantObservation;
pub use conversation::run_turn;
pub use instances::{CliInstance, discover_cli_instances};
pub use model_hints::{ModelHints, read_model_hints};
pub use probe::{AgentProbe, probe_installed_agents};
pub use turn_types::{AgentEvent, DriverId, TurnOutcome, TurnRequest};

#[cfg(test)]
mod protocol_tests;

#[cfg(all(test, windows))]
mod windows_batch_tests;
