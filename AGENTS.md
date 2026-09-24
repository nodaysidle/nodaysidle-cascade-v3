# NODAYSIDLE Cascade V3

A macOS Tauri 2 app that compiles one software idea plus one locked stack preset into exactly
five Markdown files (PRD, ARD, TRD, TASKS, AGENTS) that a coding agent can build from.
One DeepSeek request supplies product meaning; TypeSafe Jev gates intake and integrity;
everything else (IDs, graph, file paths, phases, Markdown bytes) is local deterministic code.

This repository is the compiler. It is not any app the compiler has produced.

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
  persistence, and integration contracts link only to the features that declare them.
- Each data object declares `storage` (settings, records, document, secret, temporary, session);
  the preset maps that kind to a concrete store.
- Unknown references, and data objects or services no feature uses, are rejected. Nothing is
  inferred from wording. Don't add regexes that guess links or placement from feature prose.

## Rules for work here

- Fix the compiler, not its outputs. Packets under `/Volumes/omarchyuser/projekti/*` are
  disposable test outputs: reproduce a packet defect as a synthetic fixture in `tests/`, fix the
  compiler, and don't hand-edit the packet unless asked.
- Keep the compiler generic. Don't add vendor, domain, or product logic that exists only because
  one test idea needed it. Tests exist to check that packets are agent-ready; they are not the product.
  Prefer adding a case to `tests/idea-preset-matrix.test.ts` over a new per-idea test file.
- Keep these product requirements: exactly five exported files; preview bytes equal export bytes;
  API keys memory-only, never logged, persisted, or exported; no provider retry or repair.
- DeepSeek models: `deepseek-flash` (default) and `deepseek-v4-pro`. `deepseek-v4-flash` is a
  retired alias kept only for compatibility.

## Checks (all must pass before reporting code work done)

```sh
npm run typecheck && npm test
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

## Build, install, release

- `npm run install:app` builds the app, replaces `/Applications/NODAYSIDLE Cascade V3.app`, and
  verifies the signature. It deletes the installed app, so run it only when asked. Add `-- --clean`
  to remove build output afterwards.
- `scripts/bump-version.sh X.Y.Z` updates every version field; it doesn't commit or tag.
- Release steps: `scripts/README-hybrid-release.md`.
- If local commits are unpushed and `origin/main` moved, rebase onto it before pushing.
