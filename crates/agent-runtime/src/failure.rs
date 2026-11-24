/// Classify spawn failures without exposing native paths or OS messages.
pub fn spawn_error(error: &std::io::Error) -> &'static str {
    #[cfg(windows)]
    if matches!(error.raw_os_error(), Some(193 | 216)) {
        return "cli_executable_incompatible";
    }
    #[cfg(unix)]
    if error.raw_os_error() == Some(8) {
        return "cli_executable_incompatible";
    }
    match error.kind() {
        std::io::ErrorKind::NotFound => "cli_launch_not_found",
        std::io::ErrorKind::PermissionDenied => "cli_launch_denied",
        _ => "cli_failed",
    }
}

/// Only return stable classifications. Native messages may contain credentials or URLs.
pub fn classify(message: &str) -> Option<&'static str> {
    let text = message.to_ascii_lowercase();
    if text.contains("quick safety check")
        || (text.contains("hint:") && text.contains("--skip-safe-check"))
        || text.contains("only use --print in a directory you trust")
    {
        Some("cli_trust_required")
    } else if text.contains("unknown option")
        || text.contains("unrecognized option")
        || text.contains("unexpected argument")
    {
        Some("cli_option_unsupported")
    } else if text.contains("mcp")
        && (text.contains("invalid") || text.contains("parse") || text.contains("json error"))
    {
        Some("cli_mcp_invalid")
    } else if text.contains("model") && text.contains("ambiguous across providers") {
        Some("cli_model_ambiguous")
    } else if [
        "401 unauthorized",
        "authentication failed",
        "invalid api key",
        "please log in",
        "not logged in",
        "please run /login",
        "token expired",
    ]
    .iter()
    .any(|pattern| text.contains(pattern))
    {
        Some("cli_auth_failed")
    } else if ["429", "rate limit", "usage limit", "quota exceeded"]
        .iter()
        .any(|pattern| text.contains(pattern))
    {
        Some("cli_rate_limited")
    } else if [
        "model not found",
        "model is not supported",
        "does not exist or you do not have access",
    ]
    .iter()
    .any(|pattern| text.contains(pattern))
    {
        Some("cli_model_unavailable")
    } else if [
        "request timed out",
        "error sending request",
        "connection refused",
        "connection reset",
        "dns error",
        "stream disconnected",
    ]
    .iter()
    .any(|pattern| text.contains(pattern))
    {
        Some("cli_network_failed")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::classify;

    #[test]
    fn spawn_failures_expose_stable_codes_without_native_details() {
        use std::io::{Error, ErrorKind};
        assert_eq!(
            super::spawn_error(&Error::new(ErrorKind::NotFound, "private path")),
            "cli_launch_not_found"
        );
        assert_eq!(
            super::spawn_error(&Error::new(ErrorKind::PermissionDenied, "private policy")),
            "cli_launch_denied"
        );
        assert_eq!(
            super::spawn_error(&Error::other("private details")),
            "cli_failed"
        );
        #[cfg(windows)]
        for code in [193, 216] {
            assert_eq!(
                super::spawn_error(&Error::from_raw_os_error(code)),
                "cli_executable_incompatible"
            );
        }
        #[cfg(unix)]
        assert_eq!(
            super::spawn_error(&Error::from_raw_os_error(8)),
            "cli_executable_incompatible"
        );
    }

    #[test]
    fn native_errors_are_classified_without_exposing_the_message() {
        assert_eq!(
            classify("HTTP 429 quota exceeded at private endpoint"),
            Some("cli_rate_limited")
        );
        assert_eq!(
            classify("401 Unauthorized: secret"),
            Some("cli_auth_failed")
        );
        assert_eq!(
            classify("error sending request for url https://private.invalid"),
            Some("cli_network_failed")
        );
        assert_eq!(classify("model not found"), Some("cli_model_unavailable"));
        assert_eq!(
            classify(
                "Error: Model \"fixture\" is ambiguous across providers: private-provider/fixture. No matching provider is authenticated. Use --provider or provider/model."
            ),
            Some("cli_model_ambiguous")
        );
        assert_eq!(classify("unknown native failure"), None);
    }

    #[test]
    fn interactive_login_prompts_are_auth_failures() {
        for message in [
            "Not logged in · Please run /login",
            "Not logged in. Please run /login to authenticate the model provider",
            "Please run /login",
        ] {
            assert_eq!(classify(message), Some("cli_auth_failed"));
        }
    }
}
