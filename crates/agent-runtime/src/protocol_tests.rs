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
}

#[test]
fn requests_reject_path_traversal_ids_and_unbounded_deadlines() {
    let mut request = TurnRequest {
        turn_id: "12345678-1234-1234-1234-123456789abc".into(),
        session_id: "12345678-1234-1234-1234-123456789abc".into(),
        driver: DriverId::Codex,
        prompt: "hello".into(),
        model: String::new(),
        timeout_seconds: 60,
    };
    assert!(request.validate().is_ok());
    request.session_id = "../../other".into();
    assert!(request.validate().is_err());
    request.session_id = request.turn_id.clone();
    request.timeout_seconds = 601;
    assert!(request.validate().is_err());
}
