use agent_runtime::AgentEvent;
use serde_json::{Value, json};

/// Only counters cross into the UI. Raw diagnostics remain in the bounded log.
pub fn frontend_event(event: &AgentEvent) -> Option<Value> {
    match event {
        AgentEvent::Progress {
            elapsed_ms,
            input_written,
            last_output_age_ms,
            protocol_records,
            public_text_bytes,
            ..
        }
        | AgentEvent::Diagnostic {
            elapsed_ms,
            input_written,
            last_output_age_ms,
            protocol_records,
            public_text_bytes,
            ..
        } => Some(json!({
            "type": "progress",
            "progress": {
                "elapsedMs": elapsed_ms,
                "inputWritten": input_written,
                "lastOutputAgeMs": last_output_age_ms,
                "protocolRecords": protocol_records,
                "publicTextBytes": public_text_bytes
            }
        })),
        AgentEvent::LaunchDiagnostic { .. } => None,
        _ => serde_json::to_value(event).ok(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn final_diagnostics_expose_only_counters_and_public_events_keep_their_shape() {
        let event = AgentEvent::Diagnostic {
            elapsed_ms: 600_013,
            input_written: true,
            last_output_age_ms: Some(595_393),
            protocol_records: 5,
            public_text_bytes: 0,
            initialization_records: 5,
            event_trace: "private-internal-detail".into(),
            unknown_records: 0,
            last_event: "system.init",
            stdout_bytes: 5356,
            stderr_bytes: 0,
            terminal: false,
            exit_code: None,
            reason: Some("private-error-detail".into()),
        };
        let value = frontend_event(&event).unwrap();
        assert_eq!(value["type"], "progress");
        assert_eq!(value["progress"].as_object().unwrap().len(), 5);
        assert_eq!(value["progress"]["elapsedMs"], 600_013);
        assert!(!value.to_string().contains("private"));
        assert_eq!(
            frontend_event(&AgentEvent::Text {
                text: "hello".into()
            })
            .unwrap(),
            json!({"type":"text", "text":"hello"})
        );
        assert!(
            frontend_event(&AgentEvent::LaunchDiagnostic {
                partial_messages: true,
                session_persistence_disabled: true,
                proxy_mode: "private-proxy"
            })
            .is_none()
        );
    }
}
