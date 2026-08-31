# NODAYSIDLE Cascade V3 Architecture Specification

## Product boundary

NODAYSIDLE Cascade V3 is a standalone macOS Tauri 2 application at `/Applications/NODAYSIDLE Cascade V3.app`, bundle ID `com.nodaysidle.cascade.v3`. It accepts one software idea, one locked technology preset, one selected DeepSeek model, and one memory-only key, then produces exactly `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, and `AGENTS.md`.

It has no accounts, telemetry, analytics, database, remote backend, settings persistence, automatic model fallback, provider retry, provider repair, or compatibility path to an older compiler.

## Authority boundaries

1. `SemanticBlueprintSchema` in `src/schema.ts` is the one compact provider schema. The inferred TypeScript type, strict JSON Schema, parser, prompt, fixtures, and tests all consume it.
2. `normalizeBlueprint` in `src/compiler.ts` deterministically removes provider mechanics and preset suggestions, normalizes semantic meaning, and derives the local semantic model.
3. `PRESETS` in `src/presets.ts` is the only authority for the five stacks, runtime APIs, layouts, ownership mappings, storage, integrations, permissions, credentials, lifecycle, accessibility, recovery, validation, packaging, installation or deployment, signing, artifacts, and completion evidence.
4. `compileProjectGraph` is the only authority for identifiers, requirements, contracts, files, phases, and tasks. Renderers do not invent relationships.
5. `renderPacket` produces immutable Markdown strings. Preview, copy, hashes, audit, and export retain those exact bytes; export never rerenders.

## Runtime flow

```text
idea + locked preset + model + URL + memory-only key
  -> one Rust DeepSeek Responses request
  -> completed-response classification
  -> strict JSON parse and compact schema validation
  -> hard semantic blocker audit
  -> deterministic local normalization
  -> deterministic preset compiler
  -> mechanical graph audit
  -> agent-readiness graph audit
  -> deterministic five-document rendering
  -> rendered-byte audit and SHA-256 hashes
  -> preview
  -> Rust hash revalidation and atomic exact-five export
```

There is exactly one provider request for each Generate action. Incomplete, truncated, filtered, failed, in-progress, malformed, cancelled, or unknown responses are rejected before semantic parsing or compilation. Schema-valid usable meaning proceeds directly to local normalization; no provider call rewrites a blueprint.

Provider output is not claimed to be byte-deterministic. Only repeated local compilation from the same accepted normalized blueprint and preset is required to be byte-identical.

## Provider boundary

- Endpoint default: `https://api.deepseek.com/responses`.
- Selectable models: `deepseek-v4-pro` and `deepseek-v4-flash`; no fallback.
- Fixed request: `reasoning.effort: "none"`, `temperature: 0.0`, `top_p: 1.0`, `max_output_tokens: 16384`, `stream: false`, `store: false`, and strict `text.format.type: "json_schema"`.
- Rust accepts text only from one completed assistant message in a top-level completed response with no error or incomplete detail.
- Model-aware total timeout, bounded body reads, cancellation, and a single outbound send are enforced locally.
- Safe failures contain only an allowlisted class, HTTP status, provider code, or incomplete reason. Raw bodies, messages, prompts, schemas, JSON, credentials, and arbitrary thrown values do not cross the error boundary.
- The key is used only for the Authorization header, zeroized after request construction, never logged or persisted, preserved in the form after failure, and cleared after Gate Clean.
- URLs must be HTTPS `/responses` endpoints without user info, query, or fragment.

## Compact semantic intake

The provider fields are exactly:

- `productName`
- `summary`
- `targetUsers`
- `goals`
- `nonGoals`
- `features`
- `dataObjects`
- `externalServices`
- `platformNeeds`
- `qualityRequirements`
- `productConstraints`

A feature supplies only name, outcome, trigger, behavior, failure outcome, and acceptance signals. Data objects supply name, purpose, sensitivity, and retention intent. External services supply name, purpose, data sent, and whether a credential is required. Platform needs use the closed local enum. Features are capped at 12 and secondary lists at 8.

The provider cannot add fields for IDs, files, tests, commands, APIs, packages, modules, owners, phases, architecture, credential mechanics, build/signing instructions, Markdown, or final documents.

Hard blockers are transport/completion failure, invalid JSON, schema-invalid JSON, unusable core product meaning, no meaningful feature, secret material, or meaning that cannot be normalized safely. Harmless headings, generic identities, embedded IDs, paths, commands, framework suggestions, duplicate items, casing, punctuation, empty optional arrays, and legitimate `placeholder` prose are discarded or normalized locally.

## Preset compiler

The immutable preset IDs are:

- `native-macos-swiftui-desktop`
- `native-macos-swiftui-menubar`
- `tauri2-rust-typescript-desktop`
- `astro-web`
- `android-kotlin-compose`

Each preset supplies isolated allowed and forbidden technologies, runtime architecture and APIs, source and test layouts, persistence and temporary storage, external integration and credential boundaries, permission APIs and denied behavior, lifecycle, accessibility, recovery, root-level validation commands, packaging, installation or deployment, signing, artifact paths, and completion evidence. Astro remains static unless a server-held credential requires server rendering. No selected preset reads mechanics from another preset.

## Deterministic project graph

Normalization preserves semantic order while deduplicating punctuation- and case-equivalent values. The graph deterministically derives product identity and slug; stable `FEAT-*`, `ACC-*`, `REQ-*`, `CON-*`, `OWN-*`, `PHASE-*`, and `TASK-*` IDs; one implementation owner per feature; one owner per direct acceptance criterion; explicit capability and resource dependencies; implementation and focused-test files; interfaces; data, integration, lifecycle, persistence, credential, permission, recovery, security, and packaging contracts; dependency-safe phases; create-before-modify ownership; validation commands; and complete downstream prompts. Ready owner nodes use stable ID ordering as the topological tie-break.

Every feature has a stable requirement, direct acceptance nodes, interface contract, recovery contract, owner, focused test, task, and cross-document trace. Exact acceptance text shared by multiple features is lowered once to the final integration and packaging gate. Tasks claim only their direct features and owned acceptance IDs; another owner can appear only as an earlier dependency. Cross-owner dependencies come from normalized capabilities and resource-bound contracts, never prose-token similarity or an all-features fallback. Missing owners, unresolved references, cycles, and create-before-modify violations fail once before Markdown rendering.

## Five-document contract

- `PRD.md` owns scope, users, goals, non-goals, journeys, feature and requirement outcomes, privacy, failure behavior, acceptance, and success criteria.
- `ARD.md` owns preset architecture, runtime and integration boundaries, modules, ownership, data flow, lifecycle, persistence, permissions, accessibility, recovery, packaging, and installation.
- `TRD.md` owns identity, concrete APIs, layouts, all contracts, tests, commands, security, packaging, signing, installation, and completion evidence.
- `TASKS.md` owns ordered phases, requirement/feature/contract links, create-before-modify files, focused tests, acceptance criteria, complete task prompts, and validation commands.
- `AGENTS.md` owns reading and authority order, stack lock, forbidden substitutions, workflow, lifecycle, accessibility, recovery, installation, validation gates, stop conditions, and honest `DONE`, `PARTIAL`, or `BLOCKED` reporting.

Every feature, requirement, and contract ID appears in all five documents.

## Audits and export

The local gate validates the actual rendered bytes for canonical filenames and order, non-empty content, repeat-render equality, normalized Markdown, unresolved or template content, generic identities, secret shapes, ID/reference integrity, feature/requirement/contract traceability, owner and file conflicts, create-before-modify ordering, focused tests, executable root-relative commands, preset and stack isolation, lifecycle, persistence, permissions, credentials, recovery, accessibility, integration boundaries, packaging, installation, signing, and downstream readiness.

The packet is frozen after rendering. Web Crypto calculates preview hashes. Rust recalculates all five hashes, rejects missing, extra, reordered, empty, or changed files, writes through a sibling staging directory, and atomically renames only a complete packet. Export failure leaves no partial packet.

## Interface and accessibility

The existing two-column control-room UI remains. The visible stages are Provider, Blueprint validation, Local normalization, Preset compiler, Mechanical audit, Agent-readiness audit, Rendering, and Export gate. Gate Clean enables export. Failure retains form state and Retry, locks export, keeps a non-success placeholder preview, and displays at most three safe path/rule/fixed-message issues.

Native labels and controls, ARIA tab semantics, keyboard navigation, live regions, visible focus, scalable text, high contrast, and reduced motion remain required. Provider JSON is never rendered.

## Test and release boundary

Vitest covers the compact schema, tolerant normalization, hard blockers, one-call pipeline, deterministic graph and bytes, exact-five output, stable requirements, all five presets, ten varied realistic fixtures, Voice readiness, preview/export identity, recoverable UI state, and the complete 5x5 leakage matrix. Rust tests cover request construction, strict completion classification, redaction, URL validation, timeout, cancellation, one-send/no-retry behavior, exact-five hashes, atomic export, collision handling, and cleanup.

A smoke-only Vite branch and Cargo feature inject offline fixtures into a temporary build. The installed smoke build uses only `/Applications/NODAYSIDLE Cascade V3.app`, drives every preset and tab through the real DOM and Rust export, and writes a receipt outside the bundle. Production is then rebuilt without the smoke branch/feature, scanned for fixture markers, strictly signed, installed, identity-checked, and launched through LaunchServices.
