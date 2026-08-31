<p align="center">
  <img src="Resources/icon.png" width="148" height="148" alt="NODAYSIDLE Cascade V3 icon">
</p>

<h1 align="center">NODAYSIDLE Cascade V3</h1>

<p align="center">
  <strong>Turn one software idea into five agent-ready markdown contracts.</strong><br>
  One model call for product meaning. Local code owns everything else.
</p>

<p align="center">
  <img alt="macOS 13+" src="https://img.shields.io/badge/macOS-13%2B-black?style=flat-square&logo=apple&logoColor=white">
  <img alt="Tauri 2" src="https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-destructive%20free-000000?style=flat-square&logo=rust&logoColor=white">
  <img alt="DeepSeek V4" src="https://img.shields.io/badge/DeepSeek-V4-4c8c6b?style=flat-square">
  <img alt="Local compiler" src="https://img.shields.io/badge/compiler-local--only-4c8c6b?style=flat-square">
  <img alt="No telemetry" src="https://img.shields.io/badge/telemetry-none-4c8c6b?style=flat-square">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat-square">
</p>

<p align="center">
  <a href="#why-cascade-v3">Why</a> ·
  <a href="#features">Features</a> ·
  <a href="#privacy">Privacy</a> ·
  <a href="#install">Install</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#output">Output</a> ·
  <a href="#presets">Presets</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#development">Development</a>
</p>

---

## Why Cascade V3?

Most idea-to-spec tools either dump vague prose or ask the model to invent file trees, APIs, and build commands. That drifts. Agents improvise. Exports disagree with previews.

**Cascade V3** splits the problem cleanly:

| Layer | Who owns it |
| --- | --- |
| **Product meaning** | One DeepSeek V4 request (Pro or Flash) |
| **IDs, graph, files, phases, contracts** | Deterministic local TypeScript compiler |
| **Five markdown documents** | Locked renderers — preview bytes equal export bytes |
| **Gate** | Mechanical + agent-readiness audits before export |

You describe the product once. Cascade returns exactly **`PRD.md`**, **`ARD.md`**, **`TRD.md`**, **`TASKS.md`**, and **`AGENTS.md`** — ready for Codex, Cursor, or any downstream coding agent.

## Features

| Area | Capability |
| --- | --- |
| **Semantic intake** | Compact JSON schema: features, data objects, integrations, constraints — no provider-invented file paths |
| **Five locked presets** | macOS SwiftUI desktop & menubar, Tauri 2 desktop, Astro web, Android Compose |
| **Preset compiler** | Stable `FEAT-*`, `OWN-*`, `CON-*`, `PHASE-*`, `TASK-*` IDs; create-before-modify file graph |
| **Agent-ready packet** | Full contract prose in TRD/TASKS; trace indexes in PRD/ARD/AGENTS |
| **Astro web quality** | Content collections, routes, design tokens, seed guidance for static portfolios |
| **Exact-five export** | Atomic write of five canonical files; SHA-256 hash equality with preview |
| **Safe provider boundary** | Rust HTTPS client; memory-only API key; no retry, no repair pass, no persisted secrets |
| **Validation ledger** | Local proof of compiler gates, graph audits, and export eligibility in the UI |

## Privacy

Cascade is local-first by design:

- **No accounts**, cloud backend, telemetry, analytics, or settings sync.
- Your **DeepSeek API key stays in memory** for the request, then is cleared after a Gate Clean export.
- Provider failures surface **safe, allowlisted diagnostics** — never raw response bodies or prompts in the UI.
- Exported markdown is written only to the folder you choose.
- The compiler and audits run **entirely on your Mac** after the single provider response.

## Install

### Build from source

**Requirements:** macOS 13+, [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) stable, and Xcode command-line tools.

```bash
git clone https://github.com/nodaysidle/nodaysidle-cascade-v3.git
cd nodaysidle-cascade-v3

npm install
npm run tauri:build
```

The release app bundle is written under `src-tauri/target/release/bundle/macos/`.

### Install to /Applications

```bash
cp -R "src-tauri/target/release/bundle/macos/NODAYSIDLE Cascade V3.app" /Applications/
open "/Applications/NODAYSIDLE Cascade V3.app"
```

> [!NOTE]
> Local builds are **ad-hoc signed and not Apple-notarized**. On first launch, macOS may ask you to right-click the app and choose **Open**, or approve it in **System Settings → Privacy & Security**.

## Usage

1. Launch **NODAYSIDLE Cascade V3**.
2. Choose a **technology preset** (for example, Astro Web or native macOS SwiftUI).
3. Select **DeepSeek V4 Pro** or **DeepSeek V4 Flash**.
4. Paste your **software idea** — product summary, users, features, data, and constraints.
5. Enter your **DeepSeek API key** (memory-only; not saved to disk).
6. Click **Generate** and wait for the pipeline:
   - Provider → blueprint validation → local normalization → preset compiler → audits → rendering
7. When status is **Gate Clean**, inspect the five preview tabs and **Export** to a folder.

Hand the exported folder to your coding agent. Read **`AGENTS.md` first**, then follow **`TASKS.md`** in phase order.

### Live provider probe (optional)

```bash
DEEPSEEK_API_KEY=your_key npm run probe:live
```

Runs an authenticated end-to-end generate against the DeepSeek API and reports whether the packet reached Gate Clean.

## Output

Every successful export contains exactly these five files:

| File | Purpose |
| --- | --- |
| `PRD.md` | Product scope, journeys, acceptance, design system |
| `ARD.md` | Architecture, owners, persistence, integrations |
| `TRD.md` | Stack lock, contracts, file map, validation commands |
| `TASKS.md` | Phased implementation tasks with create/modify rules |
| `AGENTS.md` | Downstream agent operating manual and completion gates |

Preview and export share **identical bytes**. Re-rendering the same accepted blueprint is deterministic.

## Presets

| Preset ID | Stack |
| --- | --- |
| `native-macos-swiftui-desktop` | Swift 6, SwiftUI, AppKit — desktop app |
| `native-macos-swiftui-menubar` | Swift 6, SwiftUI — menu bar utility |
| `tauri2-rust-typescript-desktop` | Tauri 2, Rust, TypeScript — cross-platform desktop |
| `astro-web` | Astro, TypeScript — static site / portfolio |
| `android-kotlin-compose` | Kotlin, Jetpack Compose — Android app |

Each preset owns runtime APIs, file layouts, ownership mappings, persistence, integrations, packaging, and validation commands. The provider cannot override them.

## Architecture

```text
idea + locked preset + model + memory-only key
  → one Rust DeepSeek Responses request
  → strict JSON schema validation
  → deterministic local normalization
  → preset compiler (graph, phases, tasks)
  → mechanical graph audit
  → agent-readiness audit
  → five-document render
  → rendered-byte audit + SHA-256 hashes
  → preview
  → atomic exact-five export
```

**Authority boundaries:**

- `src/schema.ts` — compact provider schema
- `src/compiler.ts` + `src/presets.ts` + `src/astroWeb.ts` — graph and preset policy
- `src/renderers.ts` — immutable markdown bytes
- `src/audit.ts` — mechanical and agent-readiness gates
- `src-tauri/src/provider.rs` — HTTPS boundary, cancellation, safe errors
- `src-tauri/src/export.rs` — hash revalidation and atomic export

Design notes and verification evidence live in [`docs/`](docs/).

## Development

```bash
# Frontend + compiler tests
npm run typecheck
npm test

# Tauri dev loop
npm run tauri:dev

# Production macOS app + DMG
npm run tauri:build

# Smoke build with fixture provider (no API key)
npm run tauri:build:smoke
```

```bash
# Rust checks
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (UI only) |
| `npm run build` | Production frontend bundle |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest — compiler, graph, audit, preset regressions |
| `npm run probe:live` | Authenticated DeepSeek end-to-end probe |
| `npm run tauri:build` | Release `.app` and `.dmg` |

## Status

Active development. The compiler, five-document render path, provider boundary, and Astro web preset improvements (content collections, routes, agent-ready task graphs) are implemented and covered by automated tests. See [`docs/evidence/verification.md`](docs/evidence/verification.md) for captured gate results.

## License

MIT — see [LICENSE](LICENSE).
