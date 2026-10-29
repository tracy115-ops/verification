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
    } else if [
        "401 unauthorized",
        "authentication failed",
        "invalid api key",
        "please log in",
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
        assert_eq!(classify("unknown native failure"), None);
    }
}
