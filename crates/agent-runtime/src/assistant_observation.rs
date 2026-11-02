use serde::Serialize;
use serde_json::Value;

/// Shape of the most recent assistant message, never its text or tool arguments.
#[derive(Clone, Debug, Default, Serialize)]
pub struct AssistantObservation {
    pub records: usize,
    pub content_shape: &'static str,
    pub text_blocks: usize,
    pub thinking_blocks: usize,
    pub tool_blocks: usize,
    pub other_blocks: usize,
    pub stop_reason: &'static str,
    pub error_present: bool,
}

impl AssistantObservation {
    pub fn observe(&mut self, value: &Value) {
        *self = Self {
            records: self.records.saturating_add(1),
            error_present: !value["error"].is_null() && value["error"] != false,
            stop_reason: match value["message"]["stop_reason"].as_str() {
                None => "absent",
                Some("end_turn") => "end_turn",
                Some("max_tokens") => "max_tokens",
                Some("tool_use") => "tool_use",
                Some("stop_sequence") => "stop_sequence",
                Some("pause_turn") => "pause_turn",
                Some("refusal") => "refusal",
                _ => "other",
            },
            ..Self::default()
        };
        let content = &value["message"]["content"];
        self.content_shape = match content {
            Value::Array(blocks) => {
                for block in blocks {
                    match block["type"].as_str() {
                        Some("text") => self.text_blocks += 1,
                        Some("thinking" | "redacted_thinking") => self.thinking_blocks += 1,
                        Some("tool_use" | "server_tool_use") => self.tool_blocks += 1,
                        _ => self.other_blocks += 1,
                    }
                }
                "array"
            }
            Value::String(_) => {
                self.text_blocks = 1;
                "string"
            }
            Value::Null => "absent",
            _ => "other",
        };
    }
}
