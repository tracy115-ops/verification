use crate::turn_types::{AgentEvent, DriverId};
use serde_json::Value;

#[derive(Default)]
pub struct ProtocolState {
    pub records: usize,
    pub initialization_records: usize,
    recent_events: std::collections::VecDeque<&'static str>,
    pub last_event: &'static str,
    pub unknown_records: usize,
    pub text: String,
    pub final_text: Option<String>,
    pub terminal: bool,
    pub failed: bool,
    pub error_code: Option<&'static str>,
    pub session_id: Option<String>,
}

fn text_blocks(value: &Value) -> String {
    value
        .as_array()
        .map(|blocks| {
            blocks
                .iter()
                .filter_map(|block| {
                    (block["type"] == "text")
                        .then(|| block["text"].as_str())
                        .flatten()
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default()
}

impl ProtocolState {
    pub fn event_trace(&self) -> String {
        self.recent_events
            .iter()
            .copied()
            .collect::<Vec<_>>()
            .join(":")
    }

    pub fn initialization_only(&self) -> bool {
        self.records > 0 && self.records == self.initialization_records
    }

    pub fn consume(&mut self, driver: DriverId, line: &[u8]) -> Vec<AgentEvent> {
        let Ok(value) = serde_json::from_slice::<Value>(line) else {
            self.failed = true;
            self.error_code = if matches!(driver, DriverId::Codeagent) {
                crate::failure::classify(&String::from_utf8_lossy(line))
                    .or(self.error_code)
                    .or(Some("cli_protocol_invalid"))
            } else {
                Some("cli_protocol_invalid")
            };
            return vec![];
        };
        self.records += 1;
        self.last_event = match value["type"].as_str().unwrap_or_default() {
            "system" => match value["subtype"].as_str().unwrap_or_default() {
                "init" => "system.init",
                "api_retry" => "system.api_retry",
                "hook_started" => "system.hook_started",
                "hook_progress" => "system.hook_progress",
                "hook_response" => "system.hook_response",
                _ => "system",
            },
            "stream_event" => "stream_event",
            "assistant" => "assistant",
            "result" => "result",
            "error" => "error",
            "thread.started" => "thread.started",
            "item.started" => "item.started",
            "item.completed" => "item.completed",
            "turn.completed" => "turn.completed",
            "turn.failed" => "turn.failed",
            "session" => "session",
            "message_update" => "message_update",
            "message_end" => "message_end",
            "tool_execution_start" => "tool_execution_start",
            "agent_settled" => "agent_settled",
            _ => {
                self.unknown_records += 1;
                "unknown"
            }
        };
        if self.last_event == "system.init" {
            self.initialization_records += 1;
        }
        if self.recent_events.len() == 3 {
            self.recent_events.pop_front();
        }
        self.recent_events.push_back(self.last_event);
        let mut events = Vec::new();
        match driver {
            DriverId::Codeagent => self.claude(&value, &mut events),
            DriverId::Codex => self.codex(&value, &mut events),
            DriverId::Claude => self.claude(&value, &mut events),
            DriverId::Pi => self.pi(&value, &mut events),
        }
        events
    }

    fn append(&mut self, text: &str, events: &mut Vec<AgentEvent>) {
        if text.is_empty() {
            return;
        }
        self.text.push_str(text);
        events.push(AgentEvent::Text { text: text.into() });
    }

    fn session(&mut self, id: Option<&str>, events: &mut Vec<AgentEvent>) {
        if let Some(id) = id {
            self.session_id = Some(id.into());
            events.push(AgentEvent::Session { id: id.into() });
        }
    }

    fn codex(&mut self, value: &Value, events: &mut Vec<AgentEvent>) {
        match value["type"].as_str().unwrap_or_default() {
            "thread.started" => self.session(value["thread_id"].as_str(), events),
            "item.completed" if value["item"]["type"] == "agent_message" => {
                let text = value["item"]["text"].as_str().unwrap_or_default();
                self.append(text, events);
                self.final_text = Some(text.into());
            }
            "item.started" if value["item"]["type"] != "reasoning" => {
                events.push(AgentEvent::Activity {
                    name: value["item"]["type"].as_str().unwrap_or("activity").into(),
                })
            }
            "turn.completed" => self.terminal = true,
            "error"
                if value["message"]
                    .as_str()
                    .is_some_and(|message| message.starts_with("Reconnecting... ")) =>
            {
                // Observed in CLI 0.164.0 before a successful HTTPS fallback.
                events.push(AgentEvent::Activity {
                    name: "reconnecting".into(),
                });
            }
            "turn.failed" | "error" => {
                self.failed = true;
                self.terminal = true;
                self.error_code = Some(
                    crate::failure::classify(
                        value["error"]["message"]
                            .as_str()
                            .or_else(|| value["message"].as_str())
                            .unwrap_or_default(),
                    )
                    .unwrap_or("cli_failed"),
                );
            }
            _ => {}
        }
    }

    fn claude(&mut self, value: &Value, events: &mut Vec<AgentEvent>) {
        match value["type"].as_str().unwrap_or_default() {
            "error" => {
                self.failed = true;
                self.terminal = true;
                self.error_code = Some(
                    crate::failure::classify(
                        value["error"]["message"]
                            .as_str()
                            .or_else(|| value["message"].as_str())
                            .or_else(|| value["error"].as_str())
                            .unwrap_or_default(),
                    )
                    .unwrap_or("cli_failed"),
                );
            }
            "system" => self.session(value["session_id"].as_str(), events),
            "stream_event" => {
                if value["event"]["delta"]["type"] == "text_delta" {
                    self.append(
                        value["event"]["delta"]["text"].as_str().unwrap_or_default(),
                        events,
                    );
                }
            }
            "assistant" => {
                let text = text_blocks(&value["message"]["content"]);
                if self.text.is_empty() {
                    self.append(&text, events);
                }
                if !text.is_empty() {
                    self.final_text = Some(text);
                }
            }
            "result" => {
                self.terminal = true;
                self.failed |= value["is_error"] == true;
                if value["is_error"] == true {
                    self.error_code = Some(
                        crate::failure::classify(&format!(
                            "{} {}",
                            value["result"].as_str().unwrap_or_default(),
                            value["errors"]
                        ))
                        .unwrap_or("cli_failed"),
                    );
                    return;
                }
                if let Some(text) = value["result"].as_str() {
                    if self.text.is_empty() {
                        self.append(text, events);
                    }
                    self.final_text = Some(text.into());
                }
            }
            _ => {}
        }
    }

    fn pi(&mut self, value: &Value, events: &mut Vec<AgentEvent>) {
        match value["type"].as_str().unwrap_or_default() {
            "session" => self.session(value["id"].as_str(), events),
            "message_update" if value["assistantMessageEvent"]["type"] == "text_delta" => {
                self.append(
                    value["assistantMessageEvent"]["delta"]
                        .as_str()
                        .unwrap_or_default(),
                    events,
                );
            }
            "message_end" if value["message"]["role"] == "assistant" => {
                let text = text_blocks(&value["message"]["content"]);
                if self.text.is_empty() {
                    self.append(&text, events);
                }
                if !text.is_empty() {
                    self.final_text = Some(text);
                }
                self.failed |= matches!(
                    value["message"]["stopReason"].as_str(),
                    Some("error" | "aborted")
                );
            }
            "tool_execution_start" => events.push(AgentEvent::Activity {
                name: "tool_execution".into(),
            }),
            "agent_settled" => {
                self.terminal = true;
                self.failed |= value["aborted"] == true;
            }
            _ => {}
        }
    }
}
