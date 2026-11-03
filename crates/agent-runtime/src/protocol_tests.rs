use crate::{
    protocol::ProtocolState,
    turn_types::{AgentEvent, DriverId, TurnRequest},
};

#[test]
fn codeagent_assistant_shapes_are_observed_without_exposing_thinking_or_tool_arguments() {
    let mut state = ProtocolState::default();
    let events = state.consume(DriverId::Codeagent, br#"{"type":"assistant","error":"private-error","message":{"stop_reason":"tool_use","content":[{"type":"thinking","thinking":"private-thought"},{"type":"tool_use","name":"private-tool","input":{"secret":"private-value"}},{"type":"private-block","text":"private-text"}]}}"#);
    assert!(events.is_empty());
    assert!(state.text.is_empty());
    assert!(!state.terminal);
    assert_eq!(state.assistant.records, 1);
    assert_eq!(state.assistant.content_shape, "array");
    assert_eq!(state.assistant.thinking_blocks, 1);
    assert_eq!(state.assistant.tool_blocks, 1);
    assert_eq!(state.assistant.other_blocks, 1);
    assert_eq!(state.assistant.stop_reason, "tool_use");
    assert!(state.assistant.error_present);
    assert!(
        !serde_json::to_string(&state.assistant)
            .unwrap()
            .contains("private")
    );
    state.consume(
        DriverId::Codeagent,
        br#"{"type":"assistant","message":{"stop_reason":"private-reason","content":null}}"#,
    );
    assert_eq!(state.assistant.records, 2);
    assert_eq!(state.assistant.thinking_blocks, 0);
    assert_eq!(state.assistant.content_shape, "absent");
    assert_eq!(state.assistant.stop_reason, "other");
}

#[test]
fn codeagent_public_string_content_is_read_but_assistant_is_never_a_terminal_event() {
    let mut state = ProtocolState::default();
    let events = state.consume(
        DriverId::Codeagent,
        br#"{"type":"assistant","message":{"stop_reason":"end_turn","content":"public answer"}}"#,
    );
    assert!(matches!(&events[0], AgentEvent::Text { text } if text == "public answer"));
    assert_eq!(state.final_text.as_deref(), Some("public answer"));
    assert_eq!(state.assistant.content_shape, "string");
    assert!(!state.terminal);
    state.consume(
        DriverId::Codeagent,
        br#"{"type":"result","is_error":false,"result":"public answer"}"#,
    );
    assert!(state.terminal && !state.failed);
    assert_eq!(state.text, "public answer");
}

#[test]
fn codeagent_standard_assistant_text_is_not_lost_among_private_blocks() {
    let mut state = ProtocolState::default();
    let events = state.consume(DriverId::Codeagent, br#"{"type":"assistant","message":{"content":[{"type":"thinking","thinking":"private-thought"},{"type":"text","text":"public answer"}],"stop_reason":"max_tokens"}}"#);
    assert_eq!(state.text, "public answer");
    assert!(matches!(&events[0], AgentEvent::Text { text } if text == "public answer"));
    assert_eq!(state.assistant.text_blocks, 1);
    assert_eq!(state.assistant.thinking_blocks, 1);
    assert_eq!(state.assistant.stop_reason, "max_tokens");
    assert!(!state.terminal);
}

#[test]
fn initialization_trace_is_bounded_and_never_contains_untrusted_event_names() {
    let mut state = ProtocolState::default();
    for _ in 0..5 {
        state.consume(
            DriverId::Codeagent,
            br#"{"type":"system","subtype":"init","model":"private-model"}"#,
        );
    }
    assert_eq!(state.initialization_records, 5);
    assert!(state.initialization_only());
    assert_eq!(state.event_trace(), "system.init:system.init:system.init");
    state.consume(DriverId::Codeagent, br#"{"type":"private-secret-event"}"#);
    assert!(!state.initialization_only());
    assert_eq!(state.event_trace(), "system.init:system.init:unknown");
    assert!(!state.event_trace().contains("private"));
}

#[test]
fn public_reply_budget_is_bounded_independently_of_protocol_overhead() {
    let mut state = ProtocolState::default();
    let chunk = "x".repeat(65536);
    let line = serde_json::to_vec(&serde_json::json!({"type":"stream_event","event":{"delta":{"type":"text_delta","text":chunk}}})).unwrap();
    for _ in 0..32 {
        state.consume(DriverId::Claude, &line);
    }
    assert!(!state.failed);
    assert_eq!(state.text.len(), 2 * 1024 * 1024);
    let events = state.consume(DriverId::Claude, &line);
    assert!(events.is_empty());
    assert!(state.failed);
    assert_eq!(state.error_code, Some("output_limit"));
    assert_eq!(state.text.len(), 2 * 1024 * 1024);
}

#[test]
fn codex_requires_a_terminal_event_and_never_emits_reasoning() {
    let mut state = ProtocolState::default();
    assert!(
        state
            .consume(
                DriverId::Codex,
                br#"{"type":"item.completed","item":{"type":"reasoning","text":"private"}}"#
            )
            .is_empty()
    );
    assert!(!state.terminal);
    let events = state.consume(
        DriverId::Codex,
        br#"{"type":"item.completed","item":{"type":"agent_message","text":"hello"}}"#,
    );
    assert!(matches!(&events[0], AgentEvent::Text { text } if text == "hello"));
    state.consume(DriverId::Codex, br#"{"type":"turn.completed"}"#);
    assert!(state.terminal && !state.failed);
}

#[test]
fn claude_stream_and_final_result_are_not_duplicated() {
    let mut state = ProtocolState::default();
    state.consume(
        DriverId::Claude,
        br#"{"type":"stream_event","event":{"delta":{"type":"text_delta","text":"hello"}}}"#,
    );
    let events = state.consume(
        DriverId::Claude,
        br#"{"type":"result","result":"hello","is_error":false}"#,
    );
    assert!(events.is_empty());
    assert_eq!(state.text, "hello");
    assert_eq!(state.final_text.as_deref(), Some("hello"));
    assert!(state.terminal);
}

#[test]
fn claude_zero_exit_error_result_still_fails() {
    let mut state = ProtocolState::default();
    state.consume(
        DriverId::Claude,
        br#"{"type":"result","result":"authentication failed","is_error":true}"#,
    );
    assert!(state.failed && state.terminal);
}

#[test]
fn codeagent_error_records_are_classified_without_exposing_native_messages() {
    let mut state = ProtocolState::default();
    let events = state.consume(DriverId::Codeagent, br#"{"type":"error","error":{"message":"authentication failed at https://private.invalid secret"}}"#);
    assert!(events.is_empty());
    assert!(state.failed && state.terminal);
    assert_eq!(state.error_code, Some("cli_auth_failed"));
    assert_eq!(state.last_event, "error");
    assert!(state.text.is_empty());
    let mut unknown = ProtocolState::default();
    unknown.consume(
        DriverId::Codeagent,
        br#"{"type":"private-token-value","payload":"secret"}"#,
    );
    assert_eq!(unknown.last_event, "unknown");
    assert_eq!(unknown.unknown_records, 1);
}

#[test]
fn pi_agent_end_is_not_session_settled() {
    let mut state = ProtocolState::default();
    state.consume(DriverId::Pi, br#"{"type":"agent_end","willRetry":true}"#);
    assert!(!state.terminal);
    state.consume(DriverId::Pi, br#"{"type":"message_update","assistantMessageEvent":{"type":"text_delta","delta":"hello"}}"#);
    state.consume(DriverId::Pi, br#"{"type":"agent_settled","aborted":false}"#);
    assert_eq!(state.text, "hello");
    assert!(state.terminal && !state.failed);
}

#[test]
fn invalid_protocol_lines_fail_instead_of_becoming_agent_text() {
    let mut state = ProtocolState::default();
    assert!(state.consume(DriverId::Codex, b"not json").is_empty());
    assert!(state.failed);
    assert_eq!(state.error_code, Some("cli_protocol_invalid"));
}

#[test]
fn codex_native_failures_expose_only_stable_error_codes() {
    let mut state = ProtocolState::default();
    state.consume(DriverId::Codex, br#"{"type":"turn.failed","error":{"message":"request timed out at https://private.invalid"}}"#);
    assert_eq!(state.error_code, Some("cli_network_failed"));
    assert!(state.failed && state.terminal);
    assert!(state.text.is_empty());
}

#[test]
fn codex_reconnect_notice_can_recover_but_other_errors_remain_fatal() {
    let mut state = ProtocolState::default();
    state.consume(
        DriverId::Codex,
        br#"{"type":"error","message":"Reconnecting... 2/5 (stream disconnected)"}"#,
    );
    assert!(!state.failed && !state.terminal);
    state.consume(
        DriverId::Codex,
        br#"{"type":"item.completed","item":{"type":"agent_message","text":"ok"}}"#,
    );
    state.consume(DriverId::Codex, br#"{"type":"turn.completed"}"#);
    assert!(state.terminal && !state.failed);
    state.consume(
        DriverId::Codex,
        br#"{"type":"error","message":"unrecoverable error"}"#,
    );
    assert!(state.failed);
}

#[test]
fn requests_reject_path_traversal_ids_and_unbounded_deadlines() {
    let mut request = TurnRequest {
        turn_id: "12345678-1234-1234-1234-123456789abc".into(),
        session_id: "12345678-1234-1234-1234-123456789abc".into(),
        driver: DriverId::Codex,
        prompt: "hello".into(),
        model: "fixture-model".into(),
        timeout_seconds: 60,
    };
    assert!(request.validate().is_ok());
    request.session_id = "../../other".into();
    assert!(request.validate().is_err());
    request.session_id = request.turn_id.clone();
    request.timeout_seconds = 1800;
    assert!(request.validate().is_ok());
    request.timeout_seconds = 86401;
    assert!(request.validate().is_err());
}
