# Tolerant Semantic Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline; do not dispatch subagents, create branches, commit, push, alter Git configuration, access credentials, or make a live provider request.

**Goal:** Replace provider-owned semantic repair with one compact meaning-only request followed by deterministic local normalization, preset compilation, rendering, readiness auditing, and exact-five export.

**Architecture:** `SemanticBlueprintSchema` accepts only compact product meaning. `normalizeBlueprint` removes provider mechanics and preset suggestions, deduplicates meaning, and derives the existing compiler's complete local semantic model; `compileNormalizedPacket` then owns every ID, file, contract, phase, command, document byte, and gate decision. Rust keeps one fail-closed Responses API request and the existing atomic hash-checked export.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest 4, Tauri 2, Rust 2021, native DOM/CSS, reqwest.

**Spec:** `docs/superpowers/specs/2026-08-29-cascade-v3-design.md` (the approved tolerant-intake architecture supersedes its former repair step)

## Global Constraints

- Provider request count is exactly one per Generate action; there is no repair request type or replacement-blueprint prompt.
- Provider fields are exactly `productName`, `summary`, `targetUsers`, `goals`, `nonGoals`, `features`, `dataObjects`, `externalServices`, `platformNeeds`, `qualityRequirements`, and `productConstraints`.
- Feature count is at most 12; every secondary list is at most 8; platform needs use only the approved closed enum.
- The preset is authoritative for technologies, APIs, paths, ownership, commands, persistence, permissions, credentials, lifecycle, packaging, signing, and launch.
- Hard failures expose only a semantic path, local rule ID, and fixed safe message; visible issues are capped at three.
- Output remains exactly `PRD.md`, `ARD.md`, `TRD.md`, `TASKS.md`, and `AGENTS.md`; preview and export retain the same immutable bytes.
- Final Markdown gates remain strict; secret material, incomplete provider output, invalid JSON, schema-invalid JSON, broken traceability, stack leakage, ownership conflict, unresolved content, and missing downstream contracts stay blocked.
- No new dependency or lockfile change is permitted.

---

### Task 1: Compact provider schema and one-call pipeline

**Files:**
- Modify: `tests/schema.test.ts`
- Modify: `tests/pipeline-ui.test.ts`
- Modify after RED: `src/schema.ts`
- Modify after RED: `src/pipeline.ts`

**Interfaces:**
- Produces: compact `SemanticBlueprint`, `parseBlueprintJson`, `auditSemanticIntake`, one `ProviderRequest`, and safe `SemanticIssue` failures.
- Consumes: the existing DeepSeek provider function and selected `PresetId`.

- [x] **Step 1: Write failing compact-boundary regressions**

```ts
expect(Object.keys(providerJsonSchema.properties ?? {})).toEqual([
  "productName", "summary", "targetUsers", "goals", "nonGoals", "features",
  "dataObjects", "externalServices", "platformNeeds", "qualityRequirements", "productConstraints",
])
expect(requests).toHaveLength(1)
expect(result.status).toBe("gate-clean")
```

- [x] **Step 2: Run the focused RED command**

Run: `npm test -- tests/schema.test.ts tests/pipeline-ui.test.ts`

Expected: FAIL because the broad schema and repair request still exist.

- [x] **Step 3: Implement the compact schema and delete repair orchestration**

Replace the broad schema, reduce the output ceiling, remove `ProviderRequestKind`, `repairRequest`, repair counters/statuses/stages, and return safe validation issues without a second provider call.

- [x] **Step 4: Run focused tests to GREEN**

Run: `npm test -- tests/schema.test.ts tests/pipeline-ui.test.ts`

Expected: PASS with one provider request for success and every hard failure.

### Task 2: Deterministic local normalization and preset compilation

**Files:**
- Modify: `tests/fixtures/blueprints.ts`
- Modify: `tests/fixtures/voice.ts`
- Modify: `tests/compiler.test.ts`
- Modify after RED: `src/compiler.ts`
- Modify after RED: `src/presets.ts`
- Modify as required by the local model: `src/renderers.ts`
- Modify as required by the gate: `src/audit.ts`

**Interfaces:**
- Produces: `NormalizedBlueprint`, `normalizeBlueprint(source, presetId)`, `compileProjectGraph(normalized, presetId)`, and `compileNormalizedPacket(normalized, presetId)`.
- Consumes: schema-valid compact meaning plus one locked preset.

- [x] **Step 1: Add adversarial messy-provider and varied-realistic fixtures**

The fixture must include generic identities, provider IDs, paths, commands, Markdown headings, conflicting framework words, duplicate/case/punctuation variants, empty optional arrays, and legitimate use of `placeholder`, while retaining usable product meaning.

- [x] **Step 2: Add failing normalization, preset-override, determinism, Voice, exact-five, traceability, preview/export, and 5x5 regressions**

```ts
const normalized = normalizeBlueprint(messyBlueprint, selectedPreset)
const first = await compileNormalizedPacket(normalized, selectedPreset)
const second = await compileNormalizedPacket(normalized, selectedPreset)
expect(second.documents).toEqual(first.documents)
expect(first.exportable).toBe(true)
```

- [x] **Step 3: Run the focused compiler test and confirm RED**

Run: `npm test -- tests/compiler.test.ts`

Expected: FAIL because broad provider mechanics are still required and harmless mechanics are rejected instead of normalized.

- [x] **Step 4: Implement the minimum local lowering**

Deterministically sanitize mechanics and technology suggestions, deduplicate semantic values, derive journeys, permissions, persistence, lifecycle, privacy, recovery, owners, paths, tests, contracts, phases, commands, packaging, signing, and evidence from the compact blueprint and preset.

- [x] **Step 5: Run the focused compiler suite to GREEN**

Run: `npm test -- tests/compiler.test.ts`

Expected: PASS, including all five presets and all 25 leakage cells.

### Task 3: Failure-safe UI and visible pipeline

**Files:**
- Modify: `tests/pipeline-ui.test.ts`
- Modify: `src/state.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Produces the visible stages `Provider`, `Blueprint validation`, `Local normalization`, `Preset compiler`, `Mechanical audit`, `Agent-readiness audit`, `Rendering`, and `Export gate`.
- Preserves form fields and Retry while keeping export locked on every hard failure.

- [x] **Step 1: Add failing state and safe-diagnostic assertions**

```ts
expect(statusActionLabel(failedState)).toBe("Retry")
expect(failedState.form).toEqual(formBefore)
expect(failedState.issues.slice(0, 3)).toEqual(expectedSafeIssues)
expect(canExport(failedState)).toBe(false)
```

- [x] **Step 2: Run the focused pipeline/UI test and confirm RED**

Run: `npm test -- tests/pipeline-ui.test.ts`

Expected: FAIL because repair UI state and provider-class details still exist.

- [x] **Step 3: Implement the state and DOM changes**

Remove repair copy and busy states, label local normalization, show only capped safe issue triplets on failure, retain a non-success placeholder preview, and enable export only for Gate Clean.

- [x] **Step 4: Run the focused pipeline/UI test to GREEN**

Run: `npm test -- tests/pipeline-ui.test.ts`

Expected: PASS.

### Task 4: One-request Rust provider contract

**Files:**
- Modify: `src-tauri/tests/provider_boundary.rs`
- Modify after RED: `src-tauri/src/provider.rs`
- Modify after RED: `src-tauri/src/lib.rs`
- Modify: `tests/bridge.test.ts`

**Interfaces:**
- Keeps `deepseek_complete`, model-aware timeout, cancellation, strict completion classification, memory-only authorization, and response redaction.
- Removes the request-kind repair surface and sends `store: false` with the compact output ceiling.

- [x] **Step 1: Add failing Rust and IPC assertions**

```rust
assert_eq!(body["store"], false);
assert_eq!(body["max_output_tokens"], 16_384);
```

- [x] **Step 2: Run focused Rust tests and confirm RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test provider_boundary`

Expected: FAIL because the old ceiling and missing `store` flag remain.

- [x] **Step 3: Implement the minimal request-boundary change**

Accept only the compact ceiling, add `store: false`, remove request kind validation, and retain all current fail-closed completion, timeout, cancellation, no-retry, and redaction behavior.

- [x] **Step 4: Run focused Rust and bridge tests to GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml --test provider_boundary`

Run: `npm test -- tests/bridge.test.ts`

Expected: PASS.

### Task 5: Full verification, offline acceptance, packaging, and guarded installation

**Files:**
- Modify: `src/smoke.ts`
- Modify: `docs/superpowers/specs/2026-08-29-cascade-v3-design.md`
- Modify: `docs/evidence/verification.md`
- Replace only: `/Applications/NODAYSIDLE Cascade V3.app`

**Interfaces:**
- Produces offline exact-five acceptance receipts, Voice line counts/hashes, fixture-free app and DMG, installed identity/signature/launch evidence, and protected before/after hashes.

- [x] **Step 1: Run all static, unit, and production checks**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`

Run: `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

- [x] **Step 2: Run deterministic fixture acceptance**

Build the smoke-only app, run all five presets through the production DOM/export path, inspect all tabs, require Gate Clean, exact-five non-empty files, preview/export hash equality, and a passing 5x5 leakage matrix. Generate Voice twice from the same normalized fixture and compare bytes.

- [x] **Step 3: Manually inspect all five Voice documents**

Require explicit hotkeys, push-to-talk/toggle capture, Deepgram/OpenRouter, Keychain, Accessibility/Input Monitoring, clipboard-safe paste, temporary audio, history, recovery, owners/files/tests, build/sign/install/launch, and downstream DONE/PARTIAL/BLOCKED rules.

- [x] **Step 4: Rebuild production and prove fixture absence**

Run: `npm run tauri:build`

Scan `dist`, the app resources, executable, and DMG-contained app for smoke markers, fixture names, and smoke-only commands.

- [x] **Step 5: Replace only the V3 app and verify it**

Stage and ad-hoc sign the production V3 bundle, strictly verify it, replace `/Applications/NODAYSIDLE Cascade V3.app`, confirm bundle ID `com.nodaysidle.cascade.v3`, version, ARM64 executable, icon/resources, signature, and LaunchServices launch.

- [x] **Step 6: Recompute protected evidence and review all changed files**

Require the three protected app hashes, V2 HEAD/status/diff/source hash, and Voice aggregate to match the recorded pre-change values. Confirm the source rollback and previous installed-app rollback remain verified, and report the live DeepSeek run separately as `PARTIAL`.

## Plan Self-Review

- Spec coverage: every provider, schema, normalization, compiler, document, gate, UI, regression, smoke, package, install, rollback, and protected-path requirement has an execution task.
- Placeholder scan: no deferred code, unresolved choice, or omitted implementation branch remains.
- Type consistency: compact `SemanticBlueprint` lowers once into `NormalizedBlueprint`, then graph, immutable packet bytes, UI preview, and Rust exact-five export.
- Scope: no dependency, lockfile, protected app, protected source, live provider, repository, branch, commit, push, account, or backend work is included.
