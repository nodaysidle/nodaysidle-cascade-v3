use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{collections::HashMap, sync::Mutex};
use tokio::sync::oneshot;
use url::Url;

const MODELS: [&str; 2] = ["deepseek-v4-pro", "deepseek-v4-flash"];
const PROVIDER_CODES: [&str; 10] = [
    "invalid_request_error",
    "authentication_error",
    "permission_denied",
    "not_found_error",
    "rate_limit_exceeded",
    "insufficient_balance",
    "server_error",
    "server_overloaded",
    "content_filter",
    "model_not_found",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProviderCommandRequest {
    pub request_id: String,
    pub api_url: String,
    pub api_key: String,
    pub model: String,
    pub max_output_tokens: u32,
    pub reasoning_effort: String,
    pub schema: Value,
    pub instructions: String,
    pub input: String,
}

#[derive(Debug, Clone)]
pub struct ProviderRequestBody {
    pub model: String,
    pub max_output_tokens: u32,
    pub reasoning_effort: String,
    pub schema: Value,
    pub instructions: String,
    pub input: String,
}

const ALLOWLISTED_OUTPUT_TYPES: [&str; 6] = [
    "message",
    "reasoning",
    "function_call",
    "function_call_output",
    "web_search_call",
    "file_search_call",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderFailure {
    pub kind: String,
    pub classification: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub incomplete_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrapper_output_types: Option<Vec<String>>,
}

impl ProviderFailure {
    fn new(kind: &str, classification: &str) -> Self {
        Self {
            kind: kind.into(),
            classification: classification.into(),
            http_status: None,
            provider_code: None,
            incomplete_reason: None,
            wrapper_output_types: None,
        }
    }

    fn invalid_wrapper_with_types(output_types: &[String]) -> Self {
        let mut failure = Self::invalid_wrapper();
        failure.wrapper_output_types = Some(output_types.to_vec());
        failure
    }

    pub fn invalid_wrapper() -> Self {
        Self::new("invalid-wrapper", "invalid-provider-wrapper")
    }

    pub fn invalid_request() -> Self {
        Self::new("invalid-request", "invalid-request")
    }

    pub fn cancelled() -> Self {
        Self::new("cancelled", "cancelled")
    }

    pub fn timeout() -> Self {
        Self::new("timeout", "request-timeout")
    }

    pub fn transport() -> Self {
        Self::new("transport", "request-failed")
    }

    pub fn connect() -> Self {
        Self::new("transport", "connect")
    }
}

pub fn build_responses_body(request: &ProviderRequestBody) -> Result<Value, ProviderFailure> {
    if !MODELS.contains(&request.model.as_str())
        || request.max_output_tokens != 16_384
        || request.reasoning_effort != "none"
        || request.instructions.trim().is_empty()
        || request.input.trim().is_empty()
        || !request.schema.is_object()
    {
        return Err(ProviderFailure::invalid_request());
    }

    Ok(json!({
        "model": request.model,
        "instructions": request.instructions,
        "input": request.input,
        "max_output_tokens": request.max_output_tokens,
        "reasoning": { "effort": request.reasoning_effort },
        "temperature": 0.0,
        "top_p": 1.0,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "semantic_blueprint",
                "strict": true,
                "schema": request.schema
            }
        },
        "stream": false,
        "store": false
    }))
}

pub fn validate_provider_url(value: &str) -> Result<Url, ProviderFailure> {
    let url = Url::parse(value).map_err(|_| ProviderFailure::invalid_request())?;
    let valid_path = url.path().trim_end_matches('/') == "/responses";
    if url.scheme() != "https"
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !valid_path
    {
        return Err(ProviderFailure::invalid_request());
    }
    Ok(url)
}

pub fn extract_completed_text(body: &str) -> Result<String, ProviderFailure> {
    let value: Value =
        serde_json::from_str(body).map_err(|_| ProviderFailure::invalid_wrapper())?;
    match value.get("status").and_then(Value::as_str) {
        Some("incomplete") => {
            let mut failure = ProviderFailure::new("incomplete", "incomplete-response");
            failure.incomplete_reason = value
                .pointer("/incomplete_details/reason")
                .and_then(Value::as_str)
                .filter(|reason| matches!(*reason, "max_output_tokens" | "content_filter"))
                .map(str::to_owned);
            return Err(failure);
        }
        Some("failed") => {
            let mut failure = ProviderFailure::new("failed-response", "provider-failed");
            failure.provider_code =
                allowlisted_code(value.pointer("/error/code").and_then(Value::as_str));
            return Err(failure);
        }
        Some("completed") => {}
        _ => return Err(ProviderFailure::invalid_wrapper()),
    }

    if value.get("error").is_some_and(|error| !error.is_null())
        || value
            .get("incomplete_details")
            .is_some_and(|details| !details.is_null())
    {
        return Err(ProviderFailure::invalid_wrapper());
    }

    let output = value
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(ProviderFailure::invalid_wrapper)?;
    let output_types = collect_output_types(output);
    let mut result = None;

    for item in output {
        match item.get("type").and_then(Value::as_str) {
            Some("message") => {
                if result.is_some()
                    || item.get("status").and_then(Value::as_str) != Some("completed")
                    || item.get("role").and_then(Value::as_str) != Some("assistant")
                {
                    return Err(ProviderFailure::invalid_wrapper_with_types(&output_types));
                }
                let content = item
                    .get("content")
                    .and_then(Value::as_array)
                    .filter(|content| content.len() == 1)
                    .ok_or_else(|| ProviderFailure::invalid_wrapper_with_types(&output_types))?;
                let entry = &content[0];
                if entry.get("type").and_then(Value::as_str) != Some("output_text") {
                    return Err(ProviderFailure::invalid_wrapper_with_types(&output_types));
                }
                let text = entry
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|text| !text.trim().is_empty())
                    .ok_or_else(|| ProviderFailure::invalid_wrapper_with_types(&output_types))?;
                result = Some(text.to_owned());
            }
            Some(output_type) if ALLOWLISTED_OUTPUT_TYPES.contains(&output_type) => continue,
            Some(_) | None => return Err(ProviderFailure::invalid_wrapper_with_types(&output_types)),
        }
    }

    result.ok_or_else(|| ProviderFailure::invalid_wrapper_with_types(&output_types))
}

fn collect_output_types(output: &[Value]) -> Vec<String> {
    output
        .iter()
        .filter_map(|item| item.get("type").and_then(Value::as_str))
        .filter(|output_type| ALLOWLISTED_OUTPUT_TYPES.contains(output_type))
        .map(str::to_owned)
        .collect()
}

pub fn classify_http_failure(status: u16, body: &str) -> ProviderFailure {
    let mut failure = ProviderFailure::new("http", "http-error");
    failure.http_status = Some(status);
    failure.provider_code = serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|value| allowlisted_code(value.pointer("/error/code").and_then(Value::as_str)));
    failure
}

fn allowlisted_code(code: Option<&str>) -> Option<String> {
    code.filter(|code| PROVIDER_CODES.contains(code))
        .map(str::to_owned)
}

#[derive(Default)]
pub struct CancellationRegistry {
    requests: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl CancellationRegistry {
    pub fn register(&self, request_id: &str) -> Result<oneshot::Receiver<()>, ProviderFailure> {
        if request_id.trim().is_empty() {
            return Err(ProviderFailure::invalid_request());
        }
        let mut requests = self
            .requests
            .lock()
            .map_err(|_| ProviderFailure::invalid_request())?;
        if requests.contains_key(request_id) {
            return Err(ProviderFailure::invalid_request());
        }
        let (sender, receiver) = oneshot::channel();
        requests.insert(request_id.to_owned(), sender);
        Ok(receiver)
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        self.requests
            .lock()
            .ok()
            .and_then(|mut requests| requests.remove(request_id))
            .is_some_and(|sender| sender.send(()).is_ok())
    }

    pub fn remove(&self, request_id: &str) {
        if let Ok(mut requests) = self.requests.lock() {
            requests.remove(request_id);
        }
    }
}
