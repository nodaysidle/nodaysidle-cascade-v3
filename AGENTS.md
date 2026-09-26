# NODAYSIDLE Cascade V3

A macOS Tauri 2 app that compiles one software idea plus one locked stack preset into exactly
five Markdown files (PRD, ARD, TRD, TASKS, AGENTS) that a coding agent can build from.
One DeepSeek request supplies product meaning, with at most one repair request when its content
fails a deterministic check; TypeSafe Jev gates intake and integrity;
everything else (IDs, graph, file paths, phases, Markdown bytes) is local deterministic code.

This repository is the compiler. It is not any app the compiler has produced.
Open work, decided questions, and the packet and built-app audit procedures are in `ROADMAP.md`.

## The five presets

The only stack-specific knowledge lives in `src/presets.ts` (plus `src/astroWeb.ts` for Astro):

- `native-macos-swiftui-desktop`: native macOS desktop app
- `native-macos-swiftui-menubar`: Swift menu-bar macOS app
- `tauri2-rust-typescript-desktop`: Tauri 2 with Rust
- `astro-web`: Astro website
- `android-kotlin-compose`: Android APK

## Where things live

- `src/schema.ts`: provider JSON schema, prompt text, intake checks
- `src/pipeline.ts`: generate flow (Jev intake, DeepSeek, Jev integrity, normalize, compile)
- `src/compiler.ts`: normalization, project graph, contracts, placement
- `src/renderers.ts`: Markdown bytes · `src/audit.ts`: gates that block export · `src/jev.ts`: Jev decisions
- `src-tauri/src/provider.rs`, `jev.rs`: HTTPS boundaries · `export.rs`: atomic export

## How the compiler links things

- Each feature declares `usesPlatformNeeds`, `usesData`, and `usesServices`. Permission, data,
  persistence, and integration contracts link only to the features that declare them. File access
  is not a feature platform need: the filesystem permission links exactly to features that use a
  `document` data object (a file or folder the user chooses), so there is one place to state it.
- The blueprint's `ideaCoverage` maps every numbered sentence of the user's idea (split
  deterministically by `splitIdeaSentences`) to the features, product statement, non-goal, or
  constraint that covers it. Intake rejects a missing or featureless sentence and any feature no
  sentence asks for (`auditIdeaCoverage`).
- Each data object declares `storage` (settings, records, document, app-files, secret, temporary, session);
  the preset maps that kind to a concrete store. It also declares `writeMode` (direct,
  atomic-replace), which sets the atomic-write rule and temporary-file placement. A temporary
  atomic-replace object is the in-progress copy of atomic saves and links to every feature that
  uses a stored atomic-replace object (`featureDataUses` in `src/schema.ts`).
- Each feature declares `failureRecovery` (retry, fallback, exit) and `surface` (main, item-page,
  about-page, not-found-page); Astro routes come from `surface`, and the content collection is
  named after the declared public data object.
- Unknown references, and data objects or services no feature uses, are rejected. Links, placement,
  recovery, and routes are never inferred from wording. Don't add regexes that guess them from
  feature prose; add a declared field instead. The remaining regexes clean text (stack-name
  stripping, placeholder and secret detection), audit rendered output, or switch the Astro palette
  from its dark-first Void Black (#0B0F14) default when a light palette is explicitly requested
  (`src/renderers.ts`).

## Rules for work here

- Fix the compiler, not its outputs. Packets under `/Volumes/omarchyuser/projekti/*` are
  disposable test outputs: reproduce a packet defect as a synthetic fixture in `tests/`, fix the
  compiler, and don't hand-edit the packet unless asked.
- Keep the compiler generic. Don't add vendor, domain, or product logic that exists only because
  one test idea needed it. Tests exist to check that packets are agent-ready; they are not the product.
  Prefer adding a case to `tests/idea-preset-matrix.test.ts` over a new per-idea test file.
- Every packet's packaging task owns `CON-RUNTIME-WIRING` (per-preset `wiringRules` in
  `src/presets.ts`): the shipped app must call the real owners, test doubles stay in test files, and
  a hands-on launch check runs before completion. Per-owner unit tests alone let a build pass with
  a hollow app.
- Keep these product requirements: exactly five exported files; preview bytes equal export bytes;
  API keys memory-only, never logged, persisted, or exported; no provider retry except one repair
  request that sends the failed checks and the previous response (secrets redacted) when the
  content fails validation, integrity, normalization, or the export gate (`src/pipeline.ts`).
- DeepSeek models: `deepseek-flash` (default) and `deepseek-v4-pro`. `deepseek-v4-flash` is a
  retired alias kept only for compatibility.

## Checks (all must pass before reporting code work done)

```sh
npm run typecheck && npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

A change to the provider schema or `buildBlueprintInstructions` also needs one live probe
(`npm run probe:live`, default `deepseek-flash`). It is a paid request with the user's key, so ask
the user to run it; see README "Live provider probe".

## Build, install, release

- `npm run install:app` builds the app, replaces `/Applications/NODAYSIDLE Cascade V3.app`, and
  verifies the signature. It deletes the installed app, so run it only when asked. Add `-- --clean`
  to remove build output afterwards.
- `scripts/bump-version.sh X.Y.Z` updates every version field; it doesn't commit or tag.
- Release steps: `scripts/README-hybrid-release.md`.
- If local commits are unpushed and `origin/main` moved, rebase onto it before pushing.
