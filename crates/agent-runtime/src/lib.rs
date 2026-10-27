mod codeagent;
mod conversation;
mod discovery;
mod probe;
mod process_guard;
mod protocol;
mod turn_types;

pub use conversation::run_turn;
pub use probe::{AgentProbe, probe_installed_agents};
pub use turn_types::{AgentEvent, DriverId, TurnOutcome, TurnRequest};

#[cfg(test)]
mod protocol_tests;
