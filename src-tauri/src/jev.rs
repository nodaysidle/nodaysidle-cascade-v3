use crate::provider::CancellationRegistry;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::State;
use tokio::sync::oneshot;
use zeroize::Zeroizing;

pub const JEV_DECISIONS_URL: &str = "https://api.typesafe.ai/v1/systemone";
pub const JEV_MODEL: &str = "jev-latest";
pub const JEV_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
pub const JEV_TOTAL_TIMEOUT: Duration = Duration::from_secs(15);
pub const JEV_MAX_BODY_BYTES: usize = 256 * 1024;
pub const JEV_MAX_RESPONSE_BYTES: usize = 256 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct JevCommandRequest {
    pub request_id: String,
    pub api_key: String,
    pub state: Value,
    pub questions: Value,
}

#[derive(Debug, Clone, Serialize)]
pub struct JevFailure {
    pub kind: String,
    pub classification: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<u16>,
}

impl JevFailure {
    fn new(kind: &str, classification: &str) -> Self {
        Self {
            kind: kind.into(),
            classification: classification.into(),
            status: None,
        }
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

    pub fn invalid_response() -> Self {
        Self::new("invalid-response", "invalid-provider-response")
    }

    pub fn oversize_response() -> Self {
        Self::new("invalid-response", "response-too-large")
    }

    pub fn http(status: u16) -> Self {
        let mut failure = Self::new("http", "http-error");
        failure.status = Some(status);
        failure
    }
}

pub fn classify_jev_http_failure(status: u16) -> JevFailure {
    JevFailure::http(status)
}

pub fn validate_jev_request(request_id: &str, api_key: &str) -> Result<(), JevFailure> {
    if !crate::valid_request_id(request_id)
        || api_key.is_empty()
        || api_key.len() > 4_096
        || api_key.bytes().any(|byte| byte.is_ascii_control())
    {
        return Err(JevFailure::invalid_request());
    }
    Ok(())
}

pub fn build_jev_body(state: &Value, questions: &Value) -> Result<Vec<u8>, JevFailure> {
    build_jev_body_with_model(JEV_MODEL, state, questions)
}

pub fn build_jev_body_with_model(
    model: &str,
    state: &Value,
    questions: &Value,
) -> Result<Vec<u8>, JevFailure> {
    let payload = json!({
        "model": model,
        "state": state,
        "questions": questions,
    });
    let encoded = serde_json::to_vec(&payload).map_err(|_| JevFailure::invalid_request())?;
    if encoded.len() > JEV_MAX_BODY_BYTES {
        return Err(JevFailure::invalid_request());
    }
    Ok(encoded)
}

pub fn prepare_jev_request(
    client: &reqwest::Client,
    api_key: &str,
    state: &Value,
    questions: &Value,
) -> Result<reqwest::RequestBuilder, JevFailure> {
    let body = build_jev_body_with_model(JEV_MODEL, state, questions)?;
    Ok(client
        .post(JEV_DECISIONS_URL)
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body))
}

pub async fn execute_jev_outbound(
    outbound: reqwest::RequestBuilder,
    cancellation: oneshot::Receiver<()>,
) -> Result<Value, JevFailure> {
    let operation = async {
        let response = outbound
            .send()
            .await
            .map_err(classify_jev_transport_error)?;
        let status = response.status().as_u16();
        if !(200..300).contains(&status) {
            return Err(JevFailure::http(status));
        }
        let response_body = read_limited_jev_body(response).await?;
        parse_jev_response(&response_body)
    };

    tokio::select! {
        biased;
        _ = cancellation => Err(JevFailure::cancelled()),
        result = operation => result,
    }
}

fn classify_jev_transport_error(error: reqwest::Error) -> JevFailure {
    if error.is_timeout() {
        JevFailure::timeout()
    } else if error.is_connect() {
        JevFailure::connect()
    } else {
        JevFailure::transport()
    }
}

async fn read_limited_jev_body(mut response: reqwest::Response) -> Result<String, JevFailure> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(classify_jev_transport_error)?
    {
        if bytes.len().saturating_add(chunk.len()) > JEV_MAX_RESPONSE_BYTES {
            return Err(JevFailure::oversize_response());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| JevFailure::invalid_response())
}

pub fn parse_jev_response(body: &str) -> Result<Value, JevFailure> {
    let value: Value = serde_json::from_str(body).map_err(|_| JevFailure::invalid_response())?;
    if !value.is_object() {
        return Err(JevFailure::invalid_response());
    }
    let model = value
        .get("model")
        .and_then(Value::as_str)
        .filter(|model| !model.is_empty());
    if model.is_none() {
        return Err(JevFailure::invalid_response());
    }
    let answers = value
        .get("answers")
        .and_then(Value::as_object)
        .ok_or_else(JevFailure::invalid_response)?;
    for answer in answers.values() {
        validate_jev_answer(answer)?;
    }
    Ok(value)
}

fn validate_jev_answer(answer: &Value) -> Result<(), JevFailure> {
    let object = answer
        .as_object()
        .ok_or_else(JevFailure::invalid_response)?;
    match object.get("type").and_then(Value::as_str) {
        Some("noul") => {
            let noul = object
                .get("noul")
                .and_then(Value::as_f64)
                .ok_or_else(JevFailure::invalid_response)?;
            if !noul.is_finite() || !(0.0..=1.0).contains(&noul) {
                return Err(JevFailure::invalid_response());
            }
        }
        Some("choice") => {
            let choice = object
                .get("choice")
                .and_then(Value::as_str)
                .ok_or_else(JevFailure::invalid_response)?;
            let probabilities = object
                .get("probabilities")
                .and_then(Value::as_object)
                .ok_or_else(JevFailure::invalid_response)?;
            let confidence = object
                .get("confidence")
                .and_then(Value::as_f64)
                .ok_or_else(JevFailure::invalid_response)?;
            if probabilities.is_empty() || !probabilities.contains_key(choice) {
                return Err(JevFailure::invalid_response());
            }
            if !confidence.is_finite() || !(0.0..=1.0).contains(&confidence) {
                return Err(JevFailure::invalid_response());
            }
            for probability in probabilities.values() {
                let probability = probability
                    .as_f64()
                    .ok_or_else(JevFailure::invalid_response)?;
                if !probability.is_finite() || !(0.0..=1.0).contains(&probability) {
                    return Err(JevFailure::invalid_response());
                }
            }
        }
        _ => return Err(JevFailure::invalid_response()),
    }
    Ok(())
}

#[tauri::command]
pub async fn jev_decide(
    request: JevCommandRequest,
    cancellations: State<'_, CancellationRegistry>,
) -> Result<Value, JevFailure> {
    let api_key = Zeroizing::new(request.api_key);
    validate_jev_request(&request.request_id, api_key.as_str())?;
    let client = reqwest::Client::builder()
        .connect_timeout(JEV_CONNECT_TIMEOUT)
        .timeout(JEV_TOTAL_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .https_only(true)
        .build()
        .map_err(|_| JevFailure::transport())?;
    let outbound = prepare_jev_request(
        &client,
        api_key.as_str(),
        &request.state,
        &request.questions,
    )?;
    drop(api_key);

    let cancellation = cancellations
        .register(&request.request_id)
        .map_err(|_| JevFailure::invalid_request())?;
    let result = execute_jev_outbound(outbound, cancellation).await;
    cancellations.remove(&request.request_id);
    result
}
