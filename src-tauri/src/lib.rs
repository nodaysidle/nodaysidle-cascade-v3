pub mod export;
pub mod provider;

use export::{write_packet_atomic, ExportFailure, ExportFile};
use provider::{
    build_responses_body, classify_http_failure, extract_completed_text, validate_provider_url,
    CancellationRegistry, ProviderCommandRequest, ProviderFailure, ProviderRequestBody,
};
use std::{path::PathBuf, time::Duration};
use tauri::{Manager, State};
use zeroize::Zeroizing;

const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;
const PROVIDER_CONNECT_TIMEOUT: Duration = Duration::from_secs(20);

fn provider_request_timeout(model: &str) -> Result<Duration, ProviderFailure> {
    match model {
        "deepseek-v4-pro" => Ok(Duration::from_secs(600)),
        "deepseek-v4-flash" => Ok(Duration::from_secs(300)),
        _ => Err(ProviderFailure::invalid_request()),
    }
}

#[tauri::command]
async fn deepseek_complete(
    request: ProviderCommandRequest,
    cancellations: State<'_, CancellationRegistry>,
) -> Result<String, ProviderFailure> {
    let api_key = Zeroizing::new(request.api_key);
    if !valid_request_id(&request.request_id)
        || api_key.is_empty()
        || api_key.len() > 4_096
        || api_key.bytes().any(|byte| byte.is_ascii_control())
    {
        return Err(ProviderFailure::invalid_request());
    }

    let url = validate_provider_url(&request.api_url)?;
    let provider_request = ProviderRequestBody {
        model: request.model,
        max_output_tokens: request.max_output_tokens,
        reasoning_effort: request.reasoning_effort,
        schema: request.schema,
        instructions: request.instructions,
        input: request.input,
    };
    let body = build_responses_body(&provider_request)?;
    let request_timeout = provider_request_timeout(&provider_request.model)?;
    let cancellation = cancellations.register(&request.request_id)?;
    let client = reqwest::Client::builder()
        .connect_timeout(PROVIDER_CONNECT_TIMEOUT)
        .timeout(request_timeout)
        .build()
        .map_err(|_| ProviderFailure::transport())?;

    let outbound = client.post(url).bearer_auth(api_key.as_str()).json(&body);
    drop(api_key);

    let result = execute_outbound(outbound, cancellation).await;
    cancellations.remove(&request.request_id);
    result
}

async fn execute_outbound(
    outbound: reqwest::RequestBuilder,
    cancellation: tokio::sync::oneshot::Receiver<()>,
) -> Result<String, ProviderFailure> {
    let operation = async {
        let response = outbound.send().await.map_err(classify_transport_error)?;
        let status = response.status().as_u16();
        let response_body = read_limited_body(response).await?;
        if !(200..300).contains(&status) {
            return Err(classify_http_failure(status, &response_body));
        }
        extract_completed_text(&response_body)
    };

    tokio::select! {
        biased;
        _ = cancellation => Err(ProviderFailure::cancelled()),
        result = operation => result,
    }
}

fn valid_request_id(request_id: &str) -> bool {
    !request_id.is_empty()
        && request_id.len() <= 128
        && request_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn classify_transport_error(error: reqwest::Error) -> ProviderFailure {
    if error.is_timeout() {
        ProviderFailure::timeout()
    } else if error.is_connect() {
        ProviderFailure::connect()
    } else {
        ProviderFailure::transport()
    }
}

async fn read_limited_body(mut response: reqwest::Response) -> Result<String, ProviderFailure> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(classify_transport_error)? {
        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(ProviderFailure::invalid_wrapper());
        }
        bytes.extend_from_slice(&chunk);
    }
    String::from_utf8(bytes).map_err(|_| ProviderFailure::invalid_wrapper())
}

#[tauri::command]
fn cancel_generation(request_id: String, cancellations: State<'_, CancellationRegistry>) -> bool {
    cancellations.cancel(&request_id)
}

#[tauri::command]
async fn export_packet(
    parent: String,
    slug: String,
    files: Vec<ExportFile>,
) -> Result<String, ExportFailure> {
    let destination = tauri::async_runtime::spawn_blocking(move || {
        write_packet_atomic(&PathBuf::from(parent), &slug, &files)
    })
    .await
    .map_err(|_| ExportFailure::write_failure())??;
    Ok(destination.to_string_lossy().into_owned())
}

#[cfg(feature = "fixture-smoke")]
#[tauri::command]
fn record_fixture_smoke(
    app: tauri::AppHandle,
    parent: String,
    passed: bool,
    receipt: String,
) -> Result<String, ExportFailure> {
    use std::{fs::OpenOptions, io::Write};

    let expected_marker = if passed {
        "CASCADE_V3_FIXTURE_SMOKE_OK"
    } else {
        "CASCADE_V3_FIXTURE_SMOKE_FAIL"
    };
    let value: serde_json::Value =
        serde_json::from_str(&receipt).map_err(|_| ExportFailure::write_failure())?;
    if receipt.len() > 1_048_576
        || value.get("marker").and_then(serde_json::Value::as_str) != Some(expected_marker)
    {
        return Err(ExportFailure::write_failure());
    }
    let parent = PathBuf::from(parent)
        .canonicalize()
        .map_err(|_| ExportFailure::invalid_destination())?;
    if !parent.is_dir() {
        return Err(ExportFailure::invalid_destination());
    }
    let path = parent.join("cascade-v3-smoke-receipt.json");
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|_| ExportFailure::write_failure())?;
    file.write_all(receipt.as_bytes())
        .map_err(|_| ExportFailure::write_failure())?;
    file.sync_all()
        .map_err(|_| ExportFailure::write_failure())?;
    app.exit(if passed { 0 } else { 2 });
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(CancellationRegistry::default());
    #[cfg(feature = "fixture-smoke")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        deepseek_complete,
        cancel_generation,
        export_packet,
        record_fixture_smoke
    ]);
    #[cfg(not(feature = "fixture-smoke"))]
    let builder = builder.invoke_handler(tauri::generate_handler![
        deepseek_complete,
        cancel_generation,
        export_packet
    ]);
    builder
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_focus()?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("NODAYSIDLE Cascade V3 failed to start");
}

#[cfg(test)]
mod tests {
    use super::{
        execute_outbound, provider_request_timeout, valid_request_id, PROVIDER_CONNECT_TIMEOUT,
    };
    use std::{
        io::ErrorKind,
        net::TcpListener,
        sync::mpsc,
        thread,
        time::{Duration, Instant},
    };
    use tokio::sync::oneshot;

    fn delayed_server(
        hold_for: Duration,
    ) -> (String, mpsc::Receiver<()>, thread::JoinHandle<usize>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind delayed server");
        listener
            .set_nonblocking(true)
            .expect("make delayed server nonblocking");
        let address = format!("http://{}/responses", listener.local_addr().unwrap());
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

    #[test]
    fn request_ids_are_bounded_and_header_safe() {
        assert!(valid_request_id("8cb38fb7-3acd-42a4-8b7f-92105667b43f"));
        for invalid in ["", "request 1", "request/1", "request\n1"] {
            assert!(!valid_request_id(invalid));
        }
        assert!(!valid_request_id(&"a".repeat(129)));
    }

    #[test]
    fn validated_models_select_their_total_timeout_and_keep_connect_timeout() {
        assert_eq!(PROVIDER_CONNECT_TIMEOUT, Duration::from_secs(20));
        assert_eq!(
            provider_request_timeout("deepseek-v4-pro").unwrap(),
            Duration::from_secs(600)
        );
        assert_eq!(
            provider_request_timeout("deepseek-v4-flash").unwrap(),
            Duration::from_secs(300)
        );
        assert_eq!(
            provider_request_timeout("deepseek-v4-unknown")
                .unwrap_err()
                .classification,
            "invalid-request"
        );
    }

    #[tokio::test]
    async fn total_timeout_is_safe_and_sends_once_without_retry() {
        let (address, _accepted, server) = delayed_server(Duration::from_millis(200));
        let client = reqwest::Client::builder()
            .no_proxy()
            .connect_timeout(Duration::from_millis(100))
            .timeout(Duration::from_millis(30))
            .build()
            .unwrap();
        let (_cancel_sender, cancellation) = oneshot::channel();

        let failure = execute_outbound(client.get(address), cancellation)
            .await
            .expect_err("delayed request must time out");

        assert_eq!(failure.kind, "timeout");
        assert_eq!(failure.classification, "request-timeout");
        assert_eq!(
            serde_json::to_value(&failure).unwrap(),
            serde_json::json!({"kind":"timeout","classification":"request-timeout"})
        );
        assert_eq!(server.join().unwrap(), 1, "timed-out request retried");
    }

    #[tokio::test]
    async fn cancellation_wins_while_the_request_is_in_flight() {
        let (address, accepted, _server) = delayed_server(Duration::from_secs(1));
        let client = reqwest::Client::builder()
            .no_proxy()
            .connect_timeout(Duration::from_millis(100))
            .timeout(Duration::from_secs(2))
            .build()
            .unwrap();
        let (cancel_sender, cancellation) = oneshot::channel();
        let request = tokio::spawn(execute_outbound(client.get(address), cancellation));
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
}
