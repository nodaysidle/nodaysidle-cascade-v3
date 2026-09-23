use nodaysidle_cascade_v3_lib::jev::{
    build_jev_body, classify_jev_http_failure, execute_jev_outbound, parse_jev_response,
    prepare_jev_request, validate_jev_request, JevCommandRequest, JevFailure, JEV_CONNECT_TIMEOUT,
    JEV_DECISIONS_URL, JEV_MAX_BODY_BYTES, JEV_MAX_RESPONSE_BYTES, JEV_MODEL, JEV_TOTAL_TIMEOUT,
};
use serde_json::{json, Value};
use std::{
    io::{ErrorKind, Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    sync::mpsc,
    thread,
    time::{Duration, Instant},
};
use tokio::sync::oneshot;

const KEY_SENTINEL: &str = "ts-key-SENTINEL-MUST-NOT-LEAK";

fn test_client(timeout: Duration) -> reqwest::Client {
    reqwest::Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_millis(500))
        .timeout(timeout)
        .build()
        .expect("build test client")
}

/// Accepts connections while holding them open without responding, mirroring
/// the delayed-server pattern used by the provider boundary tests.
fn delayed_server(hold_for: Duration) -> (String, mpsc::Receiver<()>, thread::JoinHandle<usize>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind delayed server");
    listener
        .set_nonblocking(true)
        .expect("make delayed server nonblocking");
    let address = format!("http://{}/decisions", listener.local_addr().unwrap());
    let (accepted_sender, accepted_receiver) = mpsc::channel();
    let server = thread::spawn(move || {
        let deadline = Instant::now() + hold_for;
        let mut connections = Vec::new();
        while Instant::now() < deadline {
            match listener.accept() {
                Ok((stream, _)) => {
                    connections.push(stream);
                    accepted_sender.send(()).ok();
                }
                Err(error) if error.kind() == ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(2));
                }
                Err(error) => panic!("delayed server failed: {error}"),
            }
        }
        connections.len()
    });
    (address, accepted_receiver, server)
}

/// Serves one canned HTTP response per accepted connection and reports how
/// many connections were accepted so tests can prove single-send behavior.
fn responding_server(status: u16, body: Vec<u8>) -> (String, thread::JoinHandle<usize>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind responding server");
    listener
        .set_nonblocking(true)
        .expect("make responding server nonblocking");
    let address = format!("http://{}/decisions", listener.local_addr().unwrap());
    let server = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_millis(700);
        let mut connections = 0usize;
        let mut idle_since: Option<Instant> = None;
        while Instant::now() < deadline {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    connections += 1;
                    idle_since = None;
                    respond(&mut stream, status, &body);
                }
                Err(error) if error.kind() == ErrorKind::WouldBlock => {
                    if idle_since.get_or_insert_with(Instant::now).elapsed()
                        > Duration::from_millis(250)
                    {
                        break;
                    }
                    thread::sleep(Duration::from_millis(2));
                }
                Err(error) => panic!("responding server failed: {error}"),
            }
        }
        connections
    });
    (address, server)
}

fn respond(stream: &mut TcpStream, status: u16, body: &[u8]) {
    stream
        .set_read_timeout(Some(Duration::from_millis(500)))
        .ok();
    let mut scratch = [0u8; 8192];
    let _ = stream.read(&mut scratch);
    let head = format!(
        "HTTP/1.1 {status} STATUS\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
    let _ = stream.shutdown(Shutdown::Write);
    loop {
        match stream.read(&mut scratch) {
            Ok(0) | Err(_) => break,
            Ok(_) => continue,
        }
    }
}

#[test]
fn pins_the_fixed_endpoint_model_timeouts_and_caps() {
    assert_eq!(JEV_DECISIONS_URL, "https://api.typesafe.ai/v1/systemone");
    assert_eq!(JEV_MODEL, "jev-latest");
    assert_eq!(JEV_CONNECT_TIMEOUT, Duration::from_secs(5));
    assert_eq!(JEV_TOTAL_TIMEOUT, Duration::from_secs(15));
    assert_eq!(JEV_MAX_BODY_BYTES, 256 * 1024);
    assert_eq!(JEV_MAX_RESPONSE_BYTES, 256 * 1024);
}

#[test]
fn builds_the_fixed_decision_request_without_credentials_in_the_body() {
    let client = test_client(Duration::from_secs(1));
    let state = json!({"phase": "signal", "signal": "listener"});
    let questions = json!([{"id": "q-1", "kind": "noul"}]);

    let request = prepare_jev_request(&client, KEY_SENTINEL, &state, &questions)
        .expect("valid request")
        .build()
        .expect("buildable request");

    assert_eq!(request.method(), reqwest::Method::POST);
    assert_eq!(request.url().as_str(), JEV_DECISIONS_URL);
    assert_eq!(
        request
            .headers()
            .get(reqwest::header::AUTHORIZATION)
            .expect("authorization header")
            .to_str()
            .expect("ascii header"),
        format!("Bearer {KEY_SENTINEL}")
    );
    assert_eq!(
        request
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .expect("content type header"),
        "application/json"
    );

    let body = request
        .body()
        .and_then(|body| body.as_bytes())
        .expect("byte body");
    let body_json: Value = serde_json::from_slice(body).expect("json body");
    assert_eq!(
        body_json,
        json!({"model": JEV_MODEL, "state": state, "questions": questions})
    );
    let body_text = String::from_utf8(body.to_vec()).expect("utf8 body");
    assert!(!body_text.contains("SENTINEL"));
    assert!(!body_text.contains("api_key"));
    assert!(!body_text.contains("authorization"));
}

#[test]
fn sends_every_key_to_the_typesafe_endpoint() {
    let client = test_client(Duration::from_secs(1));
    let state = json!({"phase": "signal", "signal": "listener"});
    let questions = json!([{"id": "q-1", "kind": "noul"}]);
    let api_key = "sk-or-v1-SENTINEL-KEY";

    let request = prepare_jev_request(&client, api_key, &state, &questions)
        .expect("valid request")
        .build()
        .expect("buildable request");

    assert_eq!(request.method(), reqwest::Method::POST);
    assert_eq!(request.url().as_str(), JEV_DECISIONS_URL);
    assert!(request.headers().get("HTTP-Referer").is_none());
    assert!(request.headers().get("X-Title").is_none());

    let body = request
        .body()
        .and_then(|body| body.as_bytes())
        .expect("byte body");
    let body_json: Value = serde_json::from_slice(body).expect("json body");
    assert_eq!(
        body_json,
        json!({"model": JEV_MODEL, "state": state, "questions": questions})
    );
}

#[test]
fn request_deserialization_accepts_only_the_grounded_fields() {
    let request: JevCommandRequest = serde_json::from_value(json!({
        "requestId": "8cb38fb7-3acd-42a4-8b7f-92105667b43f",
        "apiKey": "memory-only-key",
        "state": {"a": [1, 2, 3]},
        "questions": [{"id": "q-1"}]
    }))
    .expect("grounded request");
    assert_eq!(request.request_id, "8cb38fb7-3acd-42a4-8b7f-92105667b43f");
    assert_eq!(request.api_key, "memory-only-key");
    assert_eq!(request.state, json!({"a": [1, 2, 3]}));
    assert_eq!(request.questions, json!([{"id": "q-1"}]));

    for invalid in [
        json!({"requestId": "r", "apiKey": "k", "state": {}, "questions": [], "model": "user/model"}),
        json!({"requestId": "r", "apiKey": "k", "state": {}, "questions": [], "apiUrl": "https://evil.example/decisions"}),
        json!({"requestId": "r", "apiKey": "k", "state": {}}),
        json!({"requestId": "r", "apiKey": "k", "questions": []}),
    ] {
        assert!(
            serde_json::from_value::<JevCommandRequest>(invalid).is_err(),
            "accepted a request outside the grounded fields"
        );
    }
}

#[test]
fn rejects_request_ids_and_keys_outside_the_header_safe_rule() {
    let key = "sk-or-test-key";
    assert!(validate_jev_request("8cb38fb7-3acd-42a4-8b7f-92105667b43f", key).is_ok());
    assert!(validate_jev_request(&"a".repeat(128), key).is_ok());
    assert!(validate_jev_request("id", &"k".repeat(4_096)).is_ok());

    let long_id = "a".repeat(129);
    for invalid_id in ["", "request 1", "request/1", "request\n1", long_id.as_str()] {
        let failure =
            validate_jev_request(invalid_id, key).expect_err("request id must fail closed");
        assert_eq!(failure.kind, "invalid-request");
        assert_eq!(failure.classification, "invalid-request");
    }

    let long_key = "k".repeat(4_097);
    for invalid_key in [
        "",
        long_key.as_str(),
        "key\n",
        "key\r",
        "key\t",
        "key\u{0}",
        "key\u{7f}",
    ] {
        let failure =
            validate_jev_request("valid-id", invalid_key).expect_err("key must fail closed");
        assert_eq!(failure.kind, "invalid-request");
        assert_eq!(failure.classification, "invalid-request");
    }
}

#[test]
fn allows_exactly_256_kib_bodies_and_rejects_one_byte_more() {
    let base =
        serde_json::to_vec(&json!({"model": JEV_MODEL, "state": {"blob": ""}, "questions": {}}))
            .expect("baseline serialization")
            .len();
    let fill = JEV_MAX_BODY_BYTES - base;

    let state = json!({"blob": "x".repeat(fill)});
    let body = build_jev_body(&state, &json!({})).expect("exact limit accepted");
    assert_eq!(body.len(), JEV_MAX_BODY_BYTES);
    let parsed: Value = serde_json::from_slice(&body).expect("json body");
    assert_eq!(parsed["model"], JEV_MODEL);
    assert_eq!(parsed["state"], state);
    assert_eq!(parsed["questions"], json!({}));

    let oversize = json!({"blob": "x".repeat(fill + 1)});
    let failure = build_jev_body(&oversize, &json!({})).expect_err("one byte over must fail");
    assert_eq!(failure.kind, "invalid-request");
    assert_eq!(failure.classification, "invalid-request");

    let client = test_client(Duration::from_secs(1));
    assert!(
        prepare_jev_request(&client, KEY_SENTINEL, &oversize, &json!({})).is_err(),
        "oversize body must not produce a request"
    );
}

#[test]
fn accepts_supported_noul_and_choice_answers_with_bounded_values() {
    let body = json!({
        "model": JEV_MODEL,
        "answers": {
            "phase-3-signal": {"type": "noul", "noul": 0.0},
            "another-question-id": {"type": "noul", "noul": 1},
            "phase-7-choice": {
                "type": "choice",
                "choice": "ship-it",
                "probabilities": {"ship-it": 0.7, "hold": 0.3},
                "confidence": 0.7
            }
        },
        "usage": {"prompt_tokens": 12, "completion_tokens": 4}
    });

    let value = parse_jev_response(&body.to_string()).expect("supported response");
    assert_eq!(value, body);

    // Question IDs never narrow the boundary and an empty answers object is a
    // shape-valid response: exact phase schemas are owned by TypeScript.
    let empty = json!({"model": JEV_MODEL, "answers": {}});
    assert_eq!(parse_jev_response(&empty.to_string()).unwrap(), empty);
}

#[test]
fn rejects_score_unknown_and_unbounded_answers_without_leaking_content() {
    let cases = [
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "score", "score": 0.5}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "unknown", "value": 0.5}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"noul": 0.5}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "noul"}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "noul", "noul": -0.01}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "noul", "noul": 1.01}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "noul", "noul": "0.5"}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "noul", "noul": true}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "probabilities": {"a": 1.0}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"b": 1.0}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": 1.5}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": -0.1}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": "0.5"}, "confidence": 1.0}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": 0.5}}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": 0.5}, "confidence": 1.5}}}),
        json!({"model": JEV_MODEL, "answers": {"q": {"type": "choice", "choice": "a", "probabilities": {"a": 0.5}, "confidence": -0.5}}}),
        json!({"model": JEV_MODEL, "answers": {"q": "not-an-object"}}),
    ];
    for case in cases {
        let failure = parse_jev_response(&case.to_string()).expect_err("must fail closed");
        assert_eq!(failure.kind, "invalid-response", "accepted {case}");
        assert_eq!(failure.classification, "invalid-provider-response");
    }

    let long_number = format!(
        "{{\"model\":\"{JEV_MODEL}\",\"answers\":{{\"q\":{{\"type\":\"noul\",\"noul\":1e999}}}}}}"
    );
    for raw in [
        "{".to_string(),
        "RAW_JSON_SENTINEL".to_string(),
        json!({"answers": {}}).to_string(),
        json!({"model": 7, "answers": {}}).to_string(),
        json!({"model": "", "answers": {}}).to_string(),
        json!({"model": JEV_MODEL}).to_string(),
        json!({"model": JEV_MODEL, "answers": []}).to_string(),
        json!([]).to_string(),
        long_number,
    ] {
        let failure = parse_jev_response(&raw).expect_err("must fail closed");
        assert_eq!(failure.kind, "invalid-response", "accepted {raw}");
        assert_eq!(failure.classification, "invalid-provider-response");
        assert!(!serde_json::to_string(&failure).unwrap().contains("RAW"));
    }
}

#[test]
fn serializes_closed_failures_with_allowlisted_fields_only() {
    assert_eq!(
        serde_json::to_value(JevFailure::invalid_request()).unwrap(),
        json!({"kind": "invalid-request", "classification": "invalid-request"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::cancelled()).unwrap(),
        json!({"kind": "cancelled", "classification": "cancelled"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::timeout()).unwrap(),
        json!({"kind": "timeout", "classification": "request-timeout"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::transport()).unwrap(),
        json!({"kind": "transport", "classification": "request-failed"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::connect()).unwrap(),
        json!({"kind": "transport", "classification": "connect"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::invalid_response()).unwrap(),
        json!({"kind": "invalid-response", "classification": "invalid-provider-response"})
    );
    assert_eq!(
        serde_json::to_value(JevFailure::oversize_response()).unwrap(),
        json!({"kind": "invalid-response", "classification": "response-too-large"})
    );
    assert_eq!(
        serde_json::to_value(classify_jev_http_failure(503)).unwrap(),
        json!({"kind": "http", "classification": "http-error", "status": 503})
    );
}

#[tokio::test]
async fn returns_validated_answers_and_closed_failures_from_the_wire() {
    let valid = json!({
        "model": JEV_MODEL,
        "answers": {"q-1": {"type": "noul", "noul": 0.5}}
    });
    let (address, server) = responding_server(200, valid.to_string().into_bytes());
    let (_cancel_sender, cancellation) = oneshot::channel();
    let value = execute_jev_outbound(
        test_client(Duration::from_secs(2)).post(address),
        cancellation,
    )
    .await
    .expect("valid wire response");
    assert_eq!(value, valid);
    assert_eq!(server.join().unwrap(), 1, "one send only");

    let (address, server) = responding_server(200, b"RAW_MALFORMED_SENTINEL{".to_vec());
    let (_cancel_sender, cancellation) = oneshot::channel();
    let failure = execute_jev_outbound(
        test_client(Duration::from_secs(2)).post(address),
        cancellation,
    )
    .await
    .expect_err("malformed body must fail closed");
    assert_eq!(failure.kind, "invalid-response");
    assert_eq!(failure.classification, "invalid-provider-response");
    assert!(!serde_json::to_string(&failure).unwrap().contains("RAW"));
    assert_eq!(server.join().unwrap(), 1, "one send only");

    let (address, server) = responding_server(200, b"[]".repeat(200_000));
    let (_cancel_sender, cancellation) = oneshot::channel();
    let failure = execute_jev_outbound(
        test_client(Duration::from_secs(2)).post(address),
        cancellation,
    )
    .await
    .expect_err("oversize body must fail closed");
    assert_eq!(failure.kind, "invalid-response");
    assert_eq!(failure.classification, "response-too-large");
    assert_eq!(server.join().unwrap(), 1, "one send only");
}

#[tokio::test]
async fn surfaces_only_the_status_for_http_failures() {
    let (address, server) = responding_server(418, b"RAW_HTTP_BODY_SENTINEL".to_vec());
    let (_cancel_sender, cancellation) = oneshot::channel();
    let failure = execute_jev_outbound(
        test_client(Duration::from_secs(2)).post(address),
        cancellation,
    )
    .await
    .expect_err("http failure must fail closed");
    assert_eq!(failure.kind, "http");
    assert_eq!(failure.classification, "http-error");
    assert_eq!(failure.status, Some(418));
    let serialized = serde_json::to_string(&failure).unwrap();
    assert!(!serialized.contains("RAW"));
    assert_eq!(server.join().unwrap(), 1, "one send only");
}

#[tokio::test]
async fn times_out_after_one_send_without_retry() {
    let (address, _accepted, server) = delayed_server(Duration::from_millis(200));
    let (_cancel_sender, cancellation) = oneshot::channel();

    let failure = execute_jev_outbound(
        test_client(Duration::from_millis(30)).post(address),
        cancellation,
    )
    .await
    .expect_err("delayed request must time out");

    assert_eq!(failure.kind, "timeout");
    assert_eq!(failure.classification, "request-timeout");
    assert_eq!(server.join().unwrap(), 1, "timed-out request retried");
}

#[tokio::test]
async fn cancellation_wins_while_the_jev_request_is_in_flight() {
    let (address, accepted, _server) = delayed_server(Duration::from_secs(1));
    let (cancel_sender, cancellation) = oneshot::channel();
    let request = tokio::spawn(execute_jev_outbound(
        test_client(Duration::from_secs(2)).post(address),
        cancellation,
    ));
    tokio::task::spawn_blocking(move || accepted.recv_timeout(Duration::from_millis(500)))
        .await
        .unwrap()
        .expect("request reached delayed server");

    let cancelled_at = Instant::now();
    cancel_sender.send(()).unwrap();
    let failure = request.await.unwrap().expect_err("cancellation must win");

    assert_eq!(failure.kind, "cancelled");
    assert_eq!(failure.classification, "cancelled");
    assert!(cancelled_at.elapsed() < Duration::from_millis(500));
}
