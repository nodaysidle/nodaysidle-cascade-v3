use nodaysidle_cascade_v3_lib::provider::{
    build_responses_body, classify_http_failure, extract_completed_text, validate_provider_url,
    CancellationRegistry, ProviderFailure, ProviderRequestBody,
};
use serde_json::json;

fn request(model: &str) -> ProviderRequestBody {
    ProviderRequestBody {
        model: model.to_string(),
        max_output_tokens: 16_384,
        reasoning_effort: "none".to_string(),
        schema: json!({"type":"object","properties":{"projectName":{"type":"string"}},"required":["projectName"],"additionalProperties":false}),
        instructions: "Return semantic meaning only.".to_string(),
        input: "Build the requested blueprint.".to_string(),
    }
}

#[test]
fn builds_official_strict_responses_body_without_credentials() {
    for model in ["deepseek-v4-pro", "deepseek-v4-flash"] {
        let body = build_responses_body(&request(model)).expect("valid model");

        assert_eq!(body["model"], model);
        assert_eq!(body["max_output_tokens"], 16_384);
        assert_eq!(body["reasoning"], json!({"effort":"none"}));
        assert_eq!(body["temperature"], json!(0.0));
        assert_eq!(body["top_p"], json!(1.0));
        assert_eq!(body["text"]["format"]["type"], "json_schema");
        assert_eq!(body["text"]["format"]["name"], "semantic_blueprint");
        assert_eq!(body["text"]["format"]["schema"], request(model).schema);
        assert_eq!(body["stream"], false);
        assert_eq!(body["store"], false);
        let encoded = body.to_string();
        assert!(!encoded.contains("api_key"));
        assert!(!encoded.contains("authorization"));
    }
}

#[test]
fn accepts_only_none_reasoning_effort() {
    assert!(build_responses_body(&request("deepseek-v4-pro")).is_ok());
    for effort in ["low", "medium", "high", "max", "unknown"] {
        let mut invalid = request("deepseek-v4-pro");
        invalid.reasoning_effort = effort.to_string();
        assert_eq!(
            build_responses_body(&invalid).unwrap_err().classification,
            "invalid-request",
            "accepted {effort}"
        );
    }
}

#[test]
fn accepts_only_the_semantic_blueprint_output_ceiling() {
    assert!(build_responses_body(&request("deepseek-v4-pro")).is_ok());
    for ceiling in [0, 1, 16_383, 16_385, 65_536, u32::MAX] {
        let mut invalid = request("deepseek-v4-pro");
        invalid.max_output_tokens = ceiling;
        assert_eq!(
            build_responses_body(&invalid).unwrap_err().classification,
            "invalid-request",
            "accepted {ceiling}"
        );
    }
}

#[test]
fn accepts_only_the_two_selected_models_without_fallback() {
    assert_eq!(
        build_responses_body(&request("deepseek-v4-pro")).unwrap()["model"],
        "deepseek-v4-pro"
    );
    assert_eq!(
        build_responses_body(&request("deepseek-v4-flash")).unwrap()["model"],
        "deepseek-v4-flash"
    );
    assert_eq!(
        build_responses_body(&request("deepseek-v4-flash-vision-exp"))
            .unwrap_err()
            .classification,
        "invalid-request"
    );
}

#[test]
fn validates_https_responses_urls_without_embedded_data() {
    assert!(validate_provider_url("https://api.deepseek.com/responses").is_ok());
    assert!(validate_provider_url("https://gateway.example.net/responses/").is_ok());
    for invalid in [
        "http://api.deepseek.com/responses",
        "https://user:pass@api.deepseek.com/responses",
        "https://api.deepseek.com/responses?key=secret",
        "https://api.deepseek.com/responses#fragment",
        "https://api.deepseek.com/chat/completions",
        "not a url",
    ] {
        assert!(
            validate_provider_url(invalid).is_err(),
            "accepted {invalid}"
        );
    }
}

#[test]
fn extracts_one_completed_assistant_output() {
    let body = json!({
        "status": "completed",
        "error": null,
        "incomplete_details": null,
        "output": [
            {"type":"message","id":"m1","status":"completed","role":"assistant","content":[{"type":"output_text","text":"{\"projectName\":\"Harbor Sort\"}"}]}
        ]
    });

    assert_eq!(
        extract_completed_text(&body.to_string()).unwrap(),
        "{\"projectName\":\"Harbor Sort\"}"
    );
}

#[test]
fn skips_reasoning_items_and_extracts_the_completed_assistant_output() {
    let body = json!({
        "status": "completed",
        "error": null,
        "incomplete_details": null,
        "output": [
            {"type":"reasoning","status":"completed"},
            {"type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"{\"projectName\":\"Harbor Sort\"}"}]}
        ]
    });

    assert_eq!(
        extract_completed_text(&body.to_string()).unwrap(),
        "{\"projectName\":\"Harbor Sort\"}"
    );
}

#[test]
fn rejects_incomplete_failed_in_progress_and_malformed_wrappers_without_content() {
    let cases = [
        (json!({"status":"incomplete","error":null,"incomplete_details":{"reason":"max_output_tokens"},"output":[]}).to_string(), "incomplete"),
        (json!({"status":"incomplete","error":null,"incomplete_details":{"reason":"content_filter"},"output":[]}).to_string(), "incomplete"),
        (json!({"status":"failed","error":{"code":"server_error","message":"RAW_MESSAGE_SENTINEL"},"incomplete_details":null,"output":[]}).to_string(), "failed-response"),
        (json!({"status":"in_progress","error":null,"incomplete_details":null,"output":[]}).to_string(), "invalid-wrapper"),
        (json!({"status":"completed","error":null,"incomplete_details":null,"output":[]}).to_string(), "invalid-wrapper"),
        (json!({"status":"completed","error":null,"incomplete_details":null,"output":[{"type":"message","status":"in_progress","role":"assistant","content":[{"type":"output_text","text":"RAW_CONTENT_SENTINEL"}]}]}).to_string(), "invalid-wrapper"),
        (json!({"status":"completed","error":null,"incomplete_details":null,"output":[{"type":"message","status":"completed","role":"user","content":[{"type":"output_text","text":"RAW_CONTENT_SENTINEL"}]}]}).to_string(), "invalid-wrapper"),
        (json!({"status":"completed","error":null,"incomplete_details":null,"output":[{"type":"message","status":"completed","role":"assistant","content":[]}]}).to_string(), "invalid-wrapper"),
        (json!({"status":"completed","error":null,"incomplete_details":null,"output":[{"type":"unknown_tool","status":"completed"}]}).to_string(), "invalid-wrapper"),
        ("{\"status\":\"completed\",\"output\":[".to_string(), "invalid-wrapper"),
    ];

    for (body, expected_kind) in cases {
        let failure = extract_completed_text(&body).expect_err("wrapper must fail closed");
        assert_eq!(failure.kind, expected_kind);
        let serialized = serde_json::to_string(&failure).unwrap();
        assert!(!serialized.contains("RAW_"));
        assert!(!serialized.contains("body"));
    }
}

#[test]
fn preserves_max_output_tokens_as_an_allowlisted_incomplete_reason() {
    let body = json!({
        "status": "incomplete",
        "error": null,
        "incomplete_details": {"reason": "max_output_tokens"},
        "output": [{"type":"message","status":"in_progress","content":[{"type":"output_text","text":"RAW_CONTENT_SENTINEL"}]}]
    });

    let failure = extract_completed_text(&body.to_string()).expect_err("incomplete must fail");
    assert_eq!(failure.kind, "incomplete");
    assert_eq!(failure.classification, "incomplete-response");
    assert_eq!(
        failure.incomplete_reason.as_deref(),
        Some("max_output_tokens")
    );
    assert!(!serde_json::to_string(&failure).unwrap().contains("RAW_"));
}

#[test]
fn allowlists_http_and_provider_failure_diagnostics() {
    let auth = classify_http_failure(
        401,
        r#"{"error":{"code":"authentication_error","message":"RAW_AUTH_SENTINEL"}}"#,
    );
    assert_eq!(auth.http_status, Some(401));
    assert_eq!(auth.provider_code.as_deref(), Some("authentication_error"));

    let arbitrary = classify_http_failure(
        500,
        r#"{"error":{"code":"RAW_CODE_SENTINEL","message":"RAW_BODY_SENTINEL"}}"#,
    );
    assert_eq!(arbitrary.http_status, Some(500));
    assert_eq!(arbitrary.provider_code, None);
    let serialized = serde_json::to_string(&arbitrary).unwrap();
    assert!(!serialized.contains("RAW_"));
}

#[tokio::test]
async fn cancellation_registry_allows_one_request_and_no_duplicate_or_unknown_cancel() {
    let registry = CancellationRegistry::default();
    let receiver = registry.register("request-1").expect("first registration");
    assert!(registry.register("request-1").is_err());
    assert!(!registry.cancel("missing"));
    assert!(registry.cancel("request-1"));
    receiver.await.expect("cancellation signal");
    assert!(!registry.cancel("request-1"));
}

#[test]
fn provider_failure_serialization_has_no_raw_diagnostic_fields() {
    let failure = ProviderFailure::invalid_wrapper();
    let value = serde_json::to_value(failure).unwrap();
    assert_eq!(
        value,
        json!({"kind":"invalid-wrapper","classification":"invalid-provider-wrapper"})
    );
}

#[test]
fn invalid_wrapper_includes_allowlisted_output_types_without_content() {
    let body = json!({
        "status": "completed",
        "error": null,
        "incomplete_details": null,
        "output": [
            {"type":"reasoning","status":"completed"},
            {"type":"message","status":"completed","role":"assistant","content":[]}
        ]
    });

    let failure = extract_completed_text(&body.to_string()).expect_err("empty assistant content must fail");
    assert_eq!(failure.kind, "invalid-wrapper");
    assert_eq!(
        failure.wrapper_output_types.as_deref(),
        Some(["reasoning".to_string(), "message".to_string()].as_slice())
    );
    let serialized = serde_json::to_string(&failure).unwrap();
    assert!(!serialized.contains("RAW_"));
}
