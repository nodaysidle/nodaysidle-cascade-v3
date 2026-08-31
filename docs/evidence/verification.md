# NODAYSIDLE Cascade V3 tolerant semantic intake verification

Captured locally across `2026-08-29` and `2026-08-30` without reading an API key or making a live provider request.

## Confirmed root cause and architecture

The former provider boundary required a broad mechanics-heavy blueprint, rejected harmless model wording semantically, and then made a second request that asked DeepSeek to rewrite the full blueprint. That repair could drift or fail, leaving the strict export gate with no Markdown.

The implemented boundary is now:

`idea + locked preset -> one compact meaning-only response -> strict schema parse -> local normalization -> preset compiler -> five deterministic Markdown renders -> mechanical audit -> agent-readiness audit -> exact-five export`

DeepSeek supplies product meaning only. Local code owns IDs, stack, APIs, architecture, paths, owners, contracts, tasks, commands, persistence, permissions, credentials, recovery, packaging, signing, launch behavior, rendering, and export readiness. Provider output is not claimed to be byte-deterministic; compilation after an accepted normalized blueprint is.

## TDD evidence

Before production changes, this focused regression failed:

```text
npm test -- tests/tolerant-semantic-intake.test.ts
expected requests to have a length of 1, received 2
```

After the refactor, the focused regression and full suite pass. Permanent tests cover messy schema-valid provider output, harmless mechanics and technology prose, secret blocking, invalid and schema-invalid JSON, incomplete completion rejection before parsing, one request per Generate action, absence of provider repair, preset authority, all five presets, the 5-by-5 leakage matrix, byte determinism, five-document feature traceability, preview/export equality, locked export on hard failures, retained form state and Retry, safe diagnostics, the complete Voice idea, and varied realistic fixtures.

A production-source scan for `semantic repair`, repair request symbols, repair counters, and initial/repair request kinds returned no matches. The pipeline contains one provider invocation and no retry or second-request branch.

## Automated gates

- `npm run typecheck`: passed.
- `npm test`: 6 files and 61 tests passed.
- `npm run build`: passed; production output is fixture-free.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 19 tests passed: 4 library, 4 export-boundary, and 11 provider-boundary tests.
- `npm test -- tests/compiler.test.ts -t "passes all 25 source-idea by selected-preset cells"`: passed.
- `npm run tauri:build`: passed.

No dependency manifest, JavaScript lockfile, Rust manifest, Rust lockfile, or Tauri configuration changed.

## Installed fixture acceptance

The smoke-only build ran twice through the authorized `/Applications/NODAYSIDLE Cascade V3.app` location and emitted `CASCADE_V3_FIXTURE_SMOKE_OK` both times. The fixture-free production build then replaced it. For every preset the production DOM/export path reported `Gate Clean`, inspected all five preview tabs, exported exactly the five canonical non-empty files, and matched each preview byte hash to its export hash.

| Preset | Realistic idea | Model fixture | Result |
| --- | --- | --- | --- |
| `native-macos-swiftui-desktop` | Harbor Sort | `deepseek-v4-pro` | exact-five and hash equality passed |
| `native-macos-swiftui-menubar` | NODAYSIDLE Voice | `deepseek-v4-flash` | exact-five and hash equality passed |
| `tauri2-rust-typescript-desktop` | Threadmark | `deepseek-v4-pro` | exact-five and hash equality passed |
| `astro-web` | Copper Kite | `deepseek-v4-flash` | exact-five and hash equality passed |
| `android-kotlin-compose` | Steady Day | `deepseek-v4-pro` | exact-five and hash equality passed |

The complete 25-cell source-idea by selected-preset leakage matrix passed. Every cell compiled using only its selected preset contract.

## NODAYSIDLE Voice deterministic packet

Two independent offline compilations from the same normalized Voice fixture produced byte-identical files:

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `PRD.md` | 343 | `cc48908b0932cc36007632508c1e2967df45ab82082170fdb9e70cc8c67b086b` |
| `ARD.md` | 243 | `6ba0c385b880d89eb2e5567590d55bf3aac4ecf560955d81d4340462ac1591dd` |
| `TRD.md` | 779 | `186e9dd33771fef01a6f7472e934d9b7fe506be7496f14cad11fe43435549072` |
| `TASKS.md` | 466 | `4669e292aa2641788ffa2e7d1be78787965ff7b18fab9c11e44d63c7f2bf4809` |
| `AGENTS.md` | 233 | `496608d8a8bf688a7397fba5020d482fb7f214c62670e665742ff79f5b60ec1f` |

Manual inspection confirmed executable downstream contracts for global hotkeys, push-to-talk and toggle capture, microphone handling, Deepgram and OpenRouter integration boundaries, Keychain credentials, Accessibility and Input Monitoring, safe pasteboard use, temporary audio deletion, transcription history, recovery behavior, source and test ownership, build, signing, installation, launch, and `DONE`/`PARTIAL`/`BLOCKED` reporting. Each document traces all 11 Voice feature IDs, all 11 requirement IDs, and all 44 contract IDs.

## Production package and installation

- App: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3/src-tauri/target/release/bundle/macos/NODAYSIDLE Cascade V3.app`
- DMG: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3/src-tauri/target/release/bundle/dmg/NODAYSIDLE Cascade V3_3.0.0_aarch64.dmg`
- DMG SHA-256: `752e648ae93f732a83d7e55d5096691848e3b1d44dd84f43ef9404cef513b661`
- DMG validation: `hdiutil verify` passed; the mounted app had the expected identity, architecture, and strict signature.
- Installed app: `/Applications/NODAYSIDLE Cascade V3.app`
- Identity: `com.nodaysidle.cascade.v3`, version `3.0.0`, executable `nodaysidle-cascade-v3`, thin ARM64, `icon.icns` present.
- Signature: ad-hoc with hardened runtime; `codesign --verify --deep --strict` passed.
- Packaged and installed relative-path aggregate: `75382595e3ca18537a254e635133c06dffd28c24421062e402f8612085c5bfeb`.
- Installed absolute aggregate: `c5b448740042e7c503bcbb70e32d3f27b9617e4392a76882e0ec25d9bbea1833`.
- Launch: LaunchServices opened the installed path and the installed executable remained running.

Scans of `dist`, the packaged app, the DMG-contained app, and the installed app found no smoke command, smoke marker, fixture key, or fixture product name.

## Rollback and protected-path evidence

Verified rollback root:

`/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260829T215751Z-tolerant-semantic-intake`

- Pre-change source: `source/`, 43 files, aggregate `6d11edc9df974553f7eca1c2447869f28a20117b0d03e35b6d8bb82936c3644b`.
- Previous installed V3 app: `installed-app/NODAYSIDLE Cascade V3.app`, 4 files, aggregate `11f48b025d44b9c513092148606148c21a6a342b1e5b1a0705a8d4c785b922ba`.

Before and after values match for every protected target:

| Protected target | Before and after evidence |
| --- | --- |
| `/Applications/NODAYSIDLE.app` | `45bd366257c76508eccfc4fe3af24a25ed077dd93101972d4b3cd40fba59b6ce` |
| `/Applications/NODAYSIDLE ARCHITECH V2.app` | `f809840bd35950ff97d991c941c02353fe2042aaa5ca29d844ca84dcf0e31c67` |
| `/Applications/NODAYSIDLE Cascade.app` | `5b815001e34d69170ed58495313656760075a133fd8a689ecfc1c80f03422b8a` |
| `/Volumes/omarchyuser/nodaysidle-voice-v3` | `77ffabe1c03101f89d63152c204dc7677fde3de53930930ee622811231272794` |
| `/Volumes/omarchyuser/COMPILER/prd-compiler-v2-lab` | HEAD `ff76e807077c2a5d2fa5d235bc37fed085cab386`; status aggregate `ce4b227f9b72e9db9dcc63fcbf2918d2d3d312a83c39008d38646f368504256f`; binary-diff aggregate `56b1c98e385c5a0932f1db474d5bbfbf0c55357deedc4da08f13977fb3fedc36` |

The older project baseline separately records a pre-existing broad V2 tree aggregate mismatch caused by ignored Finder `.DS_Store` metadata. This task did not write that protected checkout; its current-task HEAD, complete status, and binary diff evidence are unchanged.

## Completion status

`DONE`: the offline tolerant-semantic-intake compiler, exact-five gate, deterministic fixture acceptance, production package, and verified V3 installation passed.

`PARTIAL`: a fresh live DeepSeek generation was intentionally not performed. No key was accessed. The user must perform one Generate action with a memory-only key to establish live-provider evidence.

## Voice V5 dependency-contract repair — 2026-08-30

The confirmed defect was local graph construction: feature owners were emitted before the shared owners they used, task dependencies were a serial list rather than contract-derived edges, native persistence and provider contracts were generic, paste recovery was underspecified, and native packaging had two competing implementation files. The compact semantic schema and one-request provider boundary were unchanged.

The local compiler now topologically orders the Swift package and app state, credential vault, DataStore, permissions, lifecycle, provider integrations, and PasteCoordinator before dependent feature phases; rejects phase and task cycles; audits the direct contract-owner dependencies; and retains create-before-modify enforcement. OpenRouter is compiled into independent transcription and refinement contracts using one Keychain account. The native Voice storage, paste, and packaging decisions are concrete and rendered through all five traceability indexes.

Permanent regression evidence:

- `npm run typecheck`: passed.
- `npm test`: 7 files and 69 tests passed.
- `npm test -- tests/voice-v5-acceptance.test.ts`: all 6 full-Voice acceptance groups passed.
- The 25-cell source-idea by selected-preset leakage matrix passed.
- `npm run build`: passed.
- Rust formatting, warning-denied Clippy, and all 19 Rust tests passed.
- `npm run tauri:build`: passed with no fixture feature or fixture marker in the production app.
- `hdiutil verify` passed for the production DMG; SHA-256 is `7061701915fc8c7dfdba1a822500ed4701d7ab4b3522544023dccf56f05c800a`.

Fresh exact-five acceptance packet:

`/Volumes/omarchyuser/nodaysidle-voice-v5-acceptance-20260830T000258Z/nodaysidle-voice`

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `PRD.md` | 404 | `efa0d90bfba53dfdf85d982ee2a3bf202de27388ac424e37bf3f2266fd1c809b` |
| `ARD.md` | 271 | `aa6cade7b407b2684166accb3c733ebbfaa9849ebcac479d91dfcd17335b3226` |
| `TRD.md` | 995 | `e5bc15d2257ccf3c3424121fecaa665f50ba091f60ac454506a97d23f563efb8` |
| `TASKS.md` | 519 | `f0d52b07ff5d4ebb35b05040f6e99a226efcbfb652164b4055125ec1656ca9ab` |
| `AGENTS.md` | 253 | `e3d8b3da0167a4bad5959ff067b905d3bb5241e77df4beccc78c5806a0bae505` |

Two independent offline exports compared byte-identical for all five files. Manual inspection covered all five documents and confirmed phases 01–09 precede feature work, exact OpenRouter request and response contracts, one Keychain account, UserDefaults and SQLite separation, schemas and migrations, temporary and saved recording ownership, all paste branches, one `package_app.sh` authority, runnable validation, and per-feature downstream traceability.

The prior installed V3 app is verified at `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T000605Z-voice-v5-installed/installed-app/NODAYSIDLE Cascade V3.app` with relative-file aggregate `d4b85ac01273560ff2c4df2cf73696788ca2b95571ecdcf53f0c04539f5d4eda`. The installed production app matches the built bundle at relative-file aggregate `07ff96b3377eaae613016bc1b6d3ea14e180742b42a2e43de4783dce0a808d18`, has identity `com.nodaysidle.cascade.v3`, thin ARM64 executable, `icon.icns`, and a strict-valid signature. LaunchServices started PID `27642` from the exact installed path.

`PARTIAL`: official unauthenticated OpenRouter documentation and model identifiers were verified, but no live authenticated OpenRouter request was made because no credential was requested or accessed. All offline compiler, packet, package, installation, launch, rollback, and protected-path gates are complete.

## V3 four-defect compiler repair — 2026-08-30

The four failures were reproduced from the immutable packet at `/Volumes/omarchyuser/nodaysidle-voice-v5/nodaysidle-voice/nodaysidle-voice` before implementation. The first focused run failed all five grouped regressions: infrastructure acceptance leaked a future hotkey outcome, `CON-DATA-API-CREDENTIALS` was DataStore-owned, `CON-PASTE-WORKFLOW` was absent, the Deepgram endpoint was absent, and the native credential audit incorrectly contaminated a non-native preset. Later focused red runs also exposed broad task metadata scope and two temporary-audio deletion contradictions.

Root causes and repairs:

- Task lowering used broad feature associations when emitting owner and task scope. Tasks now receive only directly owned features, requirements, and contracts; packaging remains the sole final aggregate task. Permanent graph audits reject task scope, acceptance, and focused-test claims owned by a future phase.
- Generic persistence lowering treated credentials like ordinary local data. `CredentialVault` now exclusively owns API credential data in macOS Keychain service `com.nodaysidle.voice.credentials`; provider accounts are deterministic; DataStore is forbidden from owning, serializing, migrating, or persisting secrets. User settings use UserDefaults, while history, modes, and vocabulary use SQLite in Application Support. Graph and five-document audits reject ownership and placement conflicts.
- The semantic paste feature retained generic provider wording. Native macOS lowering now emits one 15-step AppKit, ApplicationServices, NSPasteboard, and CGEvent insertion contract with small injectable adapters and every specified failure branch and focused test. Export audits require the complete workflow.
- Deepgram lowering emitted a generic integration boundary. Native Voice compilation now emits the verified Nova-3 streaming wire contract, typed Codable messages over `URLSessionWebSocketTask`, explicit failure/cancellation semantics, no automatic retry, and one consistent temporary-audio recovery/deletion boundary. Raw semantic retention constraints are normalized through that same boundary.

Authoritative production and regression files changed: `src/compiler.ts`, `src/audit.ts`, `src/renderers.ts`, `src/smoke.ts`, `tests/fixtures/voice-v3-export.ts`, `tests/voice-v3-remaining-defects.test.ts`, and `tests/voice-v5-acceptance.test.ts`. No provider schema, architecture, dependency manifest, lockfile, Rust source, or Tauri configuration changed.

### Official Deepgram documentation verified

Verified on `2026-08-30`; the generated contract uses only documented fields and explicitly records that the streaming socket has no documented usage object:

- Streaming endpoint and event schema: <https://developers.deepgram.com/reference/speech-to-text/listen-streaming>
- Nova model identifiers: <https://developers.deepgram.com/docs/models-languages-overview/>
- Raw audio encoding requirements: <https://developers.deepgram.com/docs/encoding>
- KeepAlive behavior: <https://developers.deepgram.com/docs/audio-keep-alive>
- Finalize message: <https://developers.deepgram.com/docs/finalize>
- Interim and final results: <https://developers.deepgram.com/docs/interim-results>
- Endpointing: <https://developers.deepgram.com/docs/endpointing>
- SpeechStarted events: <https://developers.deepgram.com/docs/speech-started>
- UtteranceEnd events: <https://developers.deepgram.com/docs/utterance-end>
- WebSocket data and network errors: <https://developers.deepgram.com/docs/stt-troubleshooting-websocket-data-and-net-errors>
- Rate-limit behavior: <https://developers.deepgram.com/reference/api-rate-limits>

### Final validation

- `npm test -- --run tests/voice-v3-remaining-defects.test.ts`: 5 passed.
- `npm run typecheck`: passed.
- `npm test`: 8 files and 74 tests passed, including all five presets, the complete 25-cell leakage matrix, exact-five export, deterministic bytes, full Voice acceptance, reference resolution, phase ownership, and negative audit mutations.
- `npm run build`: passed.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`: passed.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`: passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 19 passed: 4 library, 4 export-boundary, and 11 provider-boundary tests.
- Two final `npm run tauri:build:smoke` runs emitted `CASCADE_V3_FIXTURE_SMOKE_OK`; all five presets inspected every preview tab, exported exactly five files, and reported preview/export byte equality. All five export directories compared byte-identical between runs.
- `npm run tauri:build`: passed with a fixture-free app and DMG. Fixture marker, fixture command, fixture key, and fixture product scans returned no matches in `dist`, the built app, or the installed app.
- `hdiutil verify` passed. DMG SHA-256: `696d9862093b11f8e4770a92f4a70a04a088be617b32f14bef4b8ff7c6564460`.

Definitive Voice packet:

`/Volumes/omarchyuser/nodaysidle-voice-v3-final-acceptance-20260830T104446Z/nodaysidle-voice`

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `PRD.md` | 414 | `2562c72d95da4634e1e01ee7264a4178ebecc111f66036780a491532f7151ead` |
| `ARD.md` | 270 | `1c308c33d59645857b31af1fcd100a59bb19c18a2f5fcafffbb41ab3fdd1240f` |
| `TRD.md` | 1012 | `9788ad094519833d292632c1584c6a772471d72b0a52e2a11982792b3cac2f66` |
| `TASKS.md` | 518 | `42eee6e04341586119a8fead495f4b24447fcec3efb04e3330fb9d31dc1750eb` |
| `AGENTS.md` | 252 | `cf74442f8591d456570acea93743262ff29a9f67d69ddf0f6313a82754fc3b35` |

Manual inspection of all five files confirmed focused executable task gates, one credential authority, one placement for each persisted data type, the full paste algorithm and focused branch list in TRD/TASKS/AGENTS, the complete Deepgram wire contract, unchanged exact OpenRouter models and mechanics, dependency-first phases, and packaging-only aggregate acceptance. No generic paste phrase, conflicting temporary-audio deletion phrase, credential persistence contract, unresolved reference, or Voice-specific contract in another preset was found.

### Installation, rollback, and protected paths

- Installed app: `/Applications/NODAYSIDLE Cascade V3.app`; bundle ID `com.nodaysidle.cascade.v3`; version `3.0.0`; executable `nodaysidle-cascade-v3`; thin ARM64; `icon.icns` present.
- Signature: ad-hoc with hardened runtime; `codesign --verify --deep --strict` passed. Built and installed relative-file aggregate: `0fa3bfa2956dced821c308c1aed0db340ce086c46d48ec6d005c604d4d88e2f1`.
- LaunchServices registered and launched the installed bundle; PID `32036` resolved to `/Applications/NODAYSIDLE Cascade V3.app/Contents/MacOS/nodaysidle-cascade-v3`.
- Pre-change source rollback: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T101130Z-four-v3-defects`; 51 files, 4,966,289 bytes, verified aggregate `a31fe3e8aff5c36c75ed0cae5379945f573cb080bd15e1b4579410143e7a3ce0`.
- Previous installed V3 rollback: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T104830Z-four-v3-defects-installed/installed-app/NODAYSIDLE Cascade V3.app`; 4 files, 21,791,205 bytes, verified aggregate `07ff96b3377eaae613016bc1b6d3ea14e180742b42a2e43de4783dce0a808d18`.
- Protected before/after aggregates match: `/Applications/NODAYSIDLE.app` = `42120927fb797c524cb818d7294af22f34d18d82f3be6b9a48386b171ea5cce8`; `/Applications/NODAYSIDLE ARCHITECH V2.app` = `79d61d76223de465398a1927b1813fc2d42292ca745af323b23ed33873f408e3`; `/Applications/NODAYSIDLE Cascade.app` = `bca7556c7dcb1c7361ebf412819c8efa95a76d055c784fb937120558e8e69374`; immutable failure packet = `7817e92c28cc4389c8bde18a2dd3460e409efa9b29e5f1b00be225a5d368ef84`.

`PARTIAL`: all compiler, audit, export, deterministic acceptance, package, installation, signature, launch, rollback, and protected-path gates are complete. Live authenticated provider verification was not performed; no API credential was requested, searched for, accessed, printed, stored, or fabricated.

## V3 live-versus-imported transcription repair — 2026-08-30

The exact immutable packet at `/Volumes/omarchyuser/nodaysidle-voice-v5/nodaysidle-voice/nodaysidle-voice/nodaysidle-voice` reproduced the defect: live and imported audio both retained selected-provider wording, while the OpenRouter contract left `reject or explicitly split` unresolved. The first focused run failed the three new regression groups. The repair derives one strict local routing contract only when semantic input contains live streaming transcription, imported-audio transcription, a streaming service, and a batch/file-capable service.

- Deepgram WebSocket streaming is now exclusive to live microphone PCM and its integration contract cannot reference the imported-file feature.
- Imported files use the batch/file-capable provider, OpenRouter in the acceptance fixture. Local preflight accepts only `wav`, `mp3`, `flac`, `m4a`, `ogg`, `webm`, and `aac`; rejects files over the locally locked 60-second or 25,000,000-byte ceiling before bytes are read or a provider request is created; releases inspection resources; and forbids splitting, chunking, transcoding, or stitching.
- Schema, normalization, preset graph lowering, all five renderers, provider-wire audits, rendered-Markdown audits, task acceptance, and downstream-agent prohibitions now share the decision. The rendered audit fails closed on unresolved implementation alternatives.
- OpenRouter documentation checked on `2026-08-30`: <https://openrouter.ai/docs/guides/overview/multimodal/stt> and <https://openrouter.ai/blog/tutorials/transcription-on-openrouter/>. The approximately 60-second provider boundary is documented as an upstream processing timeout, so the compiler labels 60 seconds as a conservative local duration policy rather than a provider hard-duration claim; the documented upload ceiling is 25 MB.

Authoritative production and regression files changed: `src/schema.ts`, `src/compiler.ts`, `src/renderers.ts`, `src/audit.ts`, and `tests/voice-v3-remaining-defects.test.ts`. No preset fixture, dependency manifest, lockfile, Rust source, Tauri configuration, or generated evidence packet changed.

### Final validation

- Focused regression: initial run failed 3 groups as expected; final `npm test -- --run tests/voice-v3-remaining-defects.test.ts` passed 8 tests.
- `npm run typecheck`, `npm run build`, Rust format check, warning-denied Clippy, and both final production `npm run tauri:build` runs passed.
- `npm test`: 8 files and 77 tests passed, including the complete 25-cell preset-isolation matrix, exact-five export, rendered audit mutations, and determinism.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 19 passed: 4 library, 4 export-boundary, and 11 provider-boundary tests.
- Two installed fixture-only smoke runs emitted `CASCADE_V3_FIXTURE_SMOKE_OK`. Every preset inspected all five preview tabs, exported exactly the canonical five files, matched preview/export bytes, and compared byte-identical between runs.
- The final production app and DMG were rebuilt without smoke flags. Fixture marker, command, key, and fixture-product scans returned no matches in `dist`, the built bundle, or the installed bundle. `hdiutil verify` passed; DMG SHA-256 is `4ae9e1616b3102c225023bab194ba7bef23bb9ced8ad29b49c0b0f36ede7f323`.

Definitive Voice packet:

`/Volumes/omarchyuser/cascade-v3-transcription-routing-acceptance-20260830T114018Z/run-1/nodaysidle-voice`

| File | Lines | SHA-256 |
| --- | ---: | --- |
| `PRD.md` | 423 | `54e199ac58336621b1738c0a5ae48423cac6a8f581954afcf254ba96e7b1edce` |
| `ARD.md` | 279 | `dc7fa2c0e12d6656c77d839286eba89f6b36addf3e60133af79a46b6c815e8e1` |
| `TRD.md` | 1030 | `7e8cd78f5b6b7d8863a1a6ecf47395986eac4449297b8c7d2c85f177a450fa6b` |
| `TASKS.md` | 527 | `bbf3f1954dd5eaf9109f648710ba6bfe260662b376b41512bede12c08a30d95e` |
| `AGENTS.md` | 261 | `52feb6c3c98a59d5156e3e64f5d59b793cac4b9505417e6bba32129109a4386a` |

Actual Markdown scans found both routes, the local preflight and cleanup contract, and the no-rewrite prohibition in all five documents. No unresolved long-file alternative or selected-provider routing phrase remained. `TASKS.md` names `Sources/NodaysidleVoice/Features/FileTranscriptionFeature.swift`, `Tests/NodaysidleVoiceTests/FileTranscriptionFeatureTests.swift`, failure and cleanup behavior, acceptance criteria, and `swift test --filter FileTranscriptionFeatureTests`; `AGENTS.md` explicitly prohibits the Deepgram imported-file route and invented chunking.

### Installation, rollback, and protected paths

- Installed app: `/Applications/NODAYSIDLE Cascade V3.app`; bundle ID `com.nodaysidle.cascade.v3`; version `3.0.0`; executable `nodaysidle-cascade-v3`; thin ARM64; `icon.icns` present; strict ad-hoc hardened-runtime signature valid.
- Built and installed relative-file aggregate: `574a43000f949a386db099db8ffd2f5d5333e9b262cf3218f415950abfdc3920`. LaunchServices started PID `61426` from the exact installed executable path.
- Pre-change source rollback: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T112736Z-transcription-routing/source`; 49 files, 4,718,308 bytes, verified aggregate `ae428818d6b9627d6c62ae304638d4d3cc7058208be2d5752584ec59e102b71e`.
- Previous installed V3 rollback: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T114018Z-transcription-routing-installed/installed-app/NODAYSIDLE Cascade V3.app`; recursive comparison, four regular files, bundle identity, and strict signature all passed before replacement.
- Protected applications match the recorded aggregate method: `/Applications/NODAYSIDLE.app` = `45bd366257c76508eccfc4fe3af24a25ed077dd93101972d4b3cd40fba59b6ce`; `/Applications/NODAYSIDLE ARCHITECH V2.app` = `f809840bd35950ff97d991c941c02353fe2042aaa5ca29d844ca84dcf0e31c67`; `/Applications/NODAYSIDLE Cascade.app` = `5b815001e34d69170ed58495313656760075a133fd8a689ecfc1c80f03422b8a`. All five immutable evidence-packet file hashes match their pre-change values.

`PARTIAL`: the compiler repair, permanent regression, full 5x5 isolation proof, deterministic exact-five exports, rendered audit, packaging, installation, signature, launch, rollback, and protected-path gates are complete. Live authenticated provider verification was not performed; no API credential was requested, inspected, printed, stored, searched for, or fabricated.

## V3 structured provider and temporary-audio consistency repair — 2026-08-30

The accepted semantic blueprint reproduced the three live screenshot failures together before implementation: `contract.provider-wire` at `Deepgram Nova streaming`, plus `contract.persistence` in `PRD.md` and `TASKS.md`. Three independent authorities had drifted. Deepgram graph identity was derived from provider-controlled service prose while the audit looked up one hard-coded contract ID; generic temporary-audio deletion prose escaped the existing cloud-request-only normalization; and the rendered persistence audit associated unrelated phrases anywhere on one Markdown line, including semicolon-joined task criteria.

Normalization now owns one structured `DEEPGRAM_LIVE_MICROPHONE_CONTRACT` and one structured `TEMPORARY_AUDIO_LIFECYCLE`. The canonical Deepgram name and ID, graph contracts, persistence and lifecycle contracts, and all five rendered documents derive from those values. The graph audit compares the canonical structured values with the graph contract produced by the same compiler factory. The rendered audit remains fail-closed but evaluates sentence-level verb and condition relationships, so genuine deletion-before-retry and retention-after-success contradictions fail without coupling unrelated statements. No renderer, export gate, generated Markdown, provider schema, dependency, lockfile, Rust source, or Tauri configuration was weakened or manually edited.

### Regression and deterministic packet evidence

- The first focused run of `normalizes the combined live provider-wire and temporary-audio gate failure into one consistent packet` failed with exactly the three live issues.
- The final focused regression passed and permanently asserts the strict export gate, exact five files, preview/export UTF-8 byte equality, all Deepgram wire and temporary-audio statements in all five documents, an incomplete structured Deepgram mutation, deletion before a retry choice, and retention after accepted success.
- `npm test`: 8 files and 78 tests passed, including every preset, the complete 25-cell leakage matrix, deterministic bytes, exact-five export, dependency ordering, and agent-readiness audits.
- The actual Markdown in every file below was manually inspected. Exact statement scans found every required Deepgram and lifecycle marker in all five files; scans found no legacy cloud-request deletion, ambiguous completion deletion, retention after success, deletion before recovery choice, or selected-provider routing prose.

Two independent exports from the same accepted normalized Voice blueprint are byte-identical:

- `/Volumes/omarchyuser/cascade-v3-contract-consistency-acceptance-20260830T162331Z/run-1`
- `/Volumes/omarchyuser/cascade-v3-contract-consistency-acceptance-20260830T162331Z/run-2`
- Canonical relative-file tree hash for each packet: `5d0292ff474810526ce00209668bbd9ee9c2a29c3bea69726735bddd1789e59a`.
- Ordered filename-and-content-hash packet manifest: `cc606e23a86c6107c07912614aada313d842d0438e42a41ae8c3d87b0e1cf71e`.

| File | SHA-256 in both packets |
| --- | --- |
| `PRD.md` | `541d69539e2b2cbf866bf0b076b4365380f5e994440df63acdcaeba58c0703b7` |
| `ARD.md` | `2b8ad03f40391fea2d43b9115c003b9b9fda8fbc12f38a18531042585c516089` |
| `TRD.md` | `cc89ab0d30ea4e75fec6b5788006d14e421041debbd542324b8227f218dd3697` |
| `TASKS.md` | `2b6954ee0096b08a00d57aeb4bc0402b552fefa8eaffbe8025356ecd1c62f629` |
| `AGENTS.md` | `970abc2fa79942c26d57cafaccf137ed387985eb9630ace8546f7ee873bbf389` |

### Final validation and installation

- `npm run typecheck`, `npm run build`, Rust format checking, warning-denied Clippy, and `npm run tauri:build` passed.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 19 tests passed: 4 library, 4 export-boundary, and 11 provider-boundary tests.
- `hdiutil verify` passed; production DMG SHA-256 is `fda2f037869988d39ec345f7da7a0e3e2c0efbf4f7e9326ed8aca7493c609c50`.
- The built and installed application trees are byte-identical at canonical relative-file aggregate `d4714bf51eb015f3764e19ee9ca0ec5cb9e4048f7887c302a6d1b805a9a1d250`. The installed app has bundle ID `com.nodaysidle.cascade.v3`, version `3.0.0`, a thin ARM64 executable, `icon.icns`, a strict-valid ad-hoc hardened-runtime signature, and no fixture/smoke identities or commands. LaunchServices registered the exact `/Applications` path and PID `93729` ran `/Applications/NODAYSIDLE Cascade V3.app/Contents/MacOS/nodaysidle-cascade-v3`.
- Verified rollback root: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T160217Z-contract-consistency`. The source snapshot contains 53 files, 5,053,820 bytes, aggregate `524f820f21c49efe4177adb4b0e826b319646f173a8e24c2d5d31c12b427b440`; the previous installed app contains 4 files, 21,791,205 bytes, aggregate `97752bfdd9ecf63bd9331364f7aeb9f22d2be371cd2c4f774fcbff452853aa23`.
- Before and after protected hashes match for `/Applications/NODAYSIDLE.app` (`cb49d8e904e1a67f0d2051b5da81551155fd9bc0ee86ea2a5128169bf09b4cea`), `/Applications/NODAYSIDLE ARCHITECH V2.app` (`bc39d1652e2a5fbf58c87c7ea5c0efc36833d462e54044a6b339ed10ab638f77`), `/Applications/NODAYSIDLE Cascade.app` (`6b44a16495f28ecdaab754903076aeda4201a303e5b3a46e4954103df5aa1955`), and all four pre-existing Voice/routing evidence roots.

`PARTIAL`: all offline compiler, regression, rendering, export, deterministic packet, packaging, installation, signature, launch, rollback, and protected-path work is complete. Live authenticated provider verification was not performed; no credential was requested, inspected, printed, stored, searched for, or fabricated.

## V3 authoritative acceptance-owner graph repair — 2026-08-30

The authenticated provider completed and reached rendering, but the old compiler copied semantic acceptance text into multiple feature tasks and copied it again through interface-contract task criteria. Owner dependencies came from prose-token similarity with an all-features fallback, and ready owners retained provider input order. This allowed the global-hotkey and insertion tasks to claim each other's behavior until `graph.acceptance-ownership` blocked export.

The compiler now lowers one authoritative pre-render graph. Each feature has one implementation owner; direct criteria have stable `ACC-*` nodes owned by that feature owner; exact cross-feature criteria become one final integration criterion owned by `OWN-PACKAGING`; tasks carry acceptance IDs and only direct feature scope. Resource-bound contracts and explicit capabilities derive cross-owner edges, ready nodes use stable owner-ID topological ordering, and missing owners, cycles, invalid acceptance ownership, or create-before-modify failures throw one actionable `GraphConstructionError` before any renderer runs. All five renderers and both graph and rendered audits consume that graph.

### Red and green regression

- Initial `npm test -- tests/graph-construction.test.ts` failed all 11 cases. The first regression emitted the three visible violations together: two global-hotkey claims against `FEAT-INSERTION-BEHAVIOR` before its owner and the reciprocal insertion claim against `FEAT-GLOBAL-HOTKEY-DICTATION`.
- Final focused run passed 11/11. It covers reversed provider feature order, shared acceptance text, two consumers of one dependency, one feature capability edge, duplicate references, missing owners, direct and transitive cycles, create-before-modify, task-owned acceptance, backward dependencies, final-gate-only shared acceptance, and identical graph IDs through all five documents.
- The finalized full suite passed 90 tests across 9 files, including all five presets, the complete 25-cell leakage matrix, Voice fixtures, determinism, exact-five export, contract consistency, agent readiness, and negative gates. TypeScript checking, Vite production build, Rust formatting, warning-denied Clippy, and all 19 Rust tests passed.

### Deterministic installed acceptance packets

Two installed fixture-only runs traversed preview and export for all five presets, inspected every tab, exported exactly five files, and reported preview/export byte equality. The two observed Voice graphs are byte-identical:

- `/Volumes/omarchyuser/cascade-v3-acceptance-owner-graph-20260830T173822Z/run-1/nodaysidle-voice`
- `/Volumes/omarchyuser/cascade-v3-acceptance-owner-graph-20260830T173822Z/run-2/nodaysidle-voice`
- Ordered filename-and-content-hash manifest for each: `8a41b93f409660d72be08340630a9987dc99ad623eef63075e38abc61492f186`.

| File | SHA-256 in both packets |
| --- | --- |
| `PRD.md` | `e37176d45af4dd80e6d7262b3d9bf2b39337c97222f48832038abd667f53a39d` |
| `ARD.md` | `5d6086b55892567b8fcee8725eb3bad162fc2007bb8debc6117bcc7aaf66c9ac` |
| `TRD.md` | `50959863b7f4d4aa8342e6a35821a10de047ceac31cb0ff6fa729995e36f97f4` |
| `TASKS.md` | `21c9390e668461ca4056c7f10c0aaba52079bc4f8c41ffcc2853955ecd512e5e` |
| `AGENTS.md` | `2d4ff9c2ed06f4aa5d90dc7b0f45ff31b7180a5963a1aac86a2625e9394937b6` |

Manual TASKS/AGENTS inspection confirmed `TASK-11-PASTE-COORDINATOR` owns only `FEAT-INSERTION-BEHAVIOR` and its six direct criteria; `TASK-14-GLOBAL-HOTKEY-DICTATION` depends on task 11 and owns only the hotkey feature and its direct criterion; and `TASK-21-PACKAGING` has no feature or requirement claim and is the only task owning `ACC-INTEGRATION-01-FDDDEA1D`.

### Package, install, rollback, and protected paths

- Final production `npm run tauri:build` and `hdiutil verify` passed. DMG SHA-256: `2bd479090d2be0dcda9d4039e7a0692327d38a192f4f1ab1c7d3ed6d62edc785`.
- Built and installed app trees compare byte-identical at the baseline aggregate `b1b8d300aeb34c0a25fa49be1d63594da5a27b18ee5e66879f996fc232773e01`. The installed bundle is `com.nodaysidle.cascade.v3`, version `3.0.0`, a thin ARM64 executable with `icon.icns`, a strict-valid ad-hoc signature, and no fixture/smoke markers. LaunchServices ran PID `41011` from `/Applications/NODAYSIDLE Cascade V3.app/Contents/MacOS/nodaysidle-cascade-v3`.
- Verified rollback root: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3-rollbacks/20260830T170525Z-acceptance-owner-graph`. Its source snapshot has 53 files, 5,073,556 bytes, aggregate `36e65a0bf2daeec36873e83c9800633ba9d114d103d178d01b811ccd93c7544a`; its prior installed app has 4 files, 21,807,621 bytes, aggregate `d992db9110491755b2dc908ff5ad48fa7f4ff0e524d28add698c1e2c7488c93d` and a strict-valid signature.
- Protected applications remain byte-identical to their recorded baselines: `/Applications/NODAYSIDLE.app` = `bc7c64e00525789cbdcff317fe9783ed11f15852eba9d5ad4ff2f3a6959c70e7`; `/Applications/NODAYSIDLE ARCHITECH V2.app` = `e2a5d6fdf589a6d3fbbe4f0308b7365ce27301392c9e14f30f7680da30879664`; `/Applications/NODAYSIDLE Cascade.app` = `f3e3d1f11c618238bdf1dd180125681a62e5fa0d4b7f0eaef520759df3583add`. Every pre-existing Voice/routing packet and both screenshot files also match the corrected baseline receipt.

`PARTIAL`: compiler graph construction, permanent regressions, all five rendered documents, deterministic exact-five export, packaging, installation, signature, launch, rollback, and protected-path verification are complete. Live authenticated provider verification was not performed.

## V3 live provider bridge repair and authenticated probe — 2026-08-31

The live-path defects addressed in this repair were:

- Dev workflow port mismatch: Vite served on 5173 while Tauri loaded 1420.
- Duplicated JSON Schema in provider instructions, increasing token pressure on every request.
- Over-strict Responses wrapper parsing that rejected completed responses containing skipped reasoning items.
- Hidden diagnostics: only three issues shown in UI; Rust `invalid-request` remapped to unknown in TypeScript.
- Cancel ignored after provider return during local compilation.

Repairs:

- [`vite.config.ts`](../../vite.config.ts) now binds port `1420` to match [`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json).
- [`src/schema.ts`](../../src/schema.ts) no longer inlines the full JSON Schema in instructions; the request `text.format.schema` remains authoritative.
- [`src-tauri/src/provider.rs`](../../src-tauri/src/provider.rs) skips allowlisted non-message output items such as `reasoning` while still requiring exactly one completed assistant `output_text`.
- [`src/pipeline.ts`](../../src/pipeline.ts) maps `invalid-request`, preserves allowlisted `wrapperOutputTypes` on invalid-wrapper failures, and honours cancellation during local compilation.
- [`src/state.ts`](../../src/state.ts) exposes every issue in Technical details instead of capping at three.
- [`tests/live-provider-probe.test.ts`](../../tests/live-provider-probe.test.ts) and `npm run probe:live` provide an authenticated end-to-end probe.

### Live authenticated probe

Captured on `2026-08-31` with one memory-only DeepSeek key against `https://api.deepseek.com/responses`:

| Field | Value |
| --- | --- |
| Command | `DEEPSEEK_API_KEY=… npm run probe:live` |
| Model | `deepseek-v4-pro` |
| Preset | `native-macos-swiftui-desktop` |
| Idea | Harbor Sort — local download organizer with preview, undo, search, and restart recovery |
| Provider requests | 1 |
| Elapsed | ~24.6 s |
| Pipeline status | `gate-clean` |
| Exportable | `true` |
| Five documents | generated locally after one accepted semantic blueprint |

Regression evidence after the repair:

- `npm run typecheck`: passed.
- `npm test`: 104 passed, 1 live probe passed when `DEEPSEEK_API_KEY` is set.
- `cargo test --manifest-path src-tauri/Cargo.toml`: passed after provider-boundary type fix.

`DONE`: offline compiler gates, provider-boundary repair, and one authenticated live Generate reaching Gate Clean are complete.
