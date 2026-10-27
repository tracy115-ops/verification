use crate::turn_types::{AgentEvent, DriverId};
use serde_json::Value;

#[derive(Default)]
pub struct ProtocolState {
    pub text: String,
    pub final_text: Option<String>,
    pub terminal: bool,
    pub failed: bool,
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
    pub fn consume(&mut self, driver: DriverId, line: &[u8]) -> Vec<AgentEvent> {
        let Ok(value) = serde_json::from_slice::<Value>(line) else {
            self.failed = true;
            return vec![];
        };
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
            }
            _ => {}
        }
    }

    fn claude(&mut self, value: &Value, events: &mut Vec<AgentEvent>) {
        match value["type"].as_str().unwrap_or_default() {
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
