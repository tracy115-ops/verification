use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum DriverId {
    Codeagent,
    Codex,
    Claude,
    Pi,
}

impl DriverId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Codeagent => "codeagent",
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::Pi => "pi",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TurnRequest {
    pub turn_id: String,
    pub session_id: String,
    pub driver: DriverId,
    pub prompt: String,
    pub model: String,
    pub timeout_seconds: u64,
}

impl TurnRequest {
    pub fn validate(&self) -> Result<(), &'static str> {
        if matches!(self.driver, DriverId::Codeagent) && !self.model.is_empty() {
            return Err("invalid_request");
        }
        fn valid_id(value: &str) -> bool {
            value.len() == 36
                && value.bytes().enumerate().all(|(index, byte)| {
                    if [8, 13, 18, 23].contains(&index) {
                        byte == b'-'
                    } else {
                        byte.is_ascii_hexdigit()
                    }
                })
        }
        if !valid_id(&self.turn_id) || !valid_id(&self.session_id) {
            return Err("invalid_request");
        }
        if self.prompt.trim().is_empty() || self.prompt.len() > 131_072 {
            return Err("prompt_too_large");
        }
        if !(1..=86400).contains(&self.timeout_seconds) {
            return Err("invalid_request");
        }
        if !matches!(self.driver, DriverId::Codeagent) && self.model.trim().is_empty() {
            return Err("model_required");
        }
        if self.model.len() > 200
            || self.model.starts_with('-')
            || self.model.chars().any(char::is_control)
        {
            return Err("invalid_request");
        }
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AgentEvent {
    Text {
        text: String,
    },
    Activity {
        name: String,
    },
    Session {
        id: String,
    },
    Heartbeat,
    Diagnostic {
        protocol_records: usize,
        unknown_records: usize,
        last_event: &'static str,
        public_text_bytes: usize,
        elapsed_ms: u64,
        stdout_bytes: usize,
        last_output_age_ms: Option<u64>,
        exit_code: Option<i32>,
        reason: Option<String>,
        stderr_bytes: usize,
        terminal: bool,
        input_written: bool,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TurnOutcome {
    pub status: String,
    pub text: String,
    pub error_code: Option<String>,
    pub native_session_id: Option<String>,
}

impl TurnOutcome {
    pub fn failed(code: &str) -> Self {
        Self {
            status: "failed".into(),
            text: String::new(),
            error_code: Some(code.into()),
            native_session_id: None,
        }
    }
}
