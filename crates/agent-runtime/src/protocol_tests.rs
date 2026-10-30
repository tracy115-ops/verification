use crate::{
    protocol::ProtocolState,
    turn_types::{AgentEvent, DriverId, TurnRequest},
};

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
