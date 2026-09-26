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
  <a href="https://github.com/nodaysidle/nodaysidle-cascade-v3/releases/download/v3.0.1/NODAYSIDLE-Cascade-V3-3.0.1-aarch64.dmg"><strong>Download Apple Silicon DMG (v3.0.1)</strong></a>
  ·
  <a href="https://github.com/nodaysidle/nodaysidle-cascade-v3">GitHub</a>
</p>

<p align="center">
  <em>Apple Silicon · ad-hoc signed / not notarized · no Windows, Linux, or Intel build</em>
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
| **Boundary decisions** | Jev viability, preset-fit, platform-needs, stack-leakage, and acceptance-verifiability judgments |
| **Product meaning** | One DeepSeek request (Pro or Flash) after intake passes, plus at most one repair request that names the checks the first response failed |
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
| **Jev guardrails** | Rejects non-product intake before DeepSeek, warns on preset conflict, heals missing platform needs, blocks foreign-stack leakage and untestable acceptance signals, and lists features that may not match your idea for review (never blocks) |
| **Validation ledger** | Local proof of compiler gates, graph audits, and export eligibility in the UI |

## Privacy

Cascade is local-first by design:

- **No accounts**, cloud backend, telemetry, analytics, or settings sync.
- Your separate **DeepSeek and TypeSafe Jev API keys stay in memory** for their requests, then are cleared after Gate Clean.
- Provider failures surface **safe, allowlisted diagnostics** — never raw response bodies or prompts in the UI.
- Exported markdown is written only to the folder you choose.
- The compiler and audits run **entirely on your Mac** after the single provider response.

## Install

### Download (macOS Apple Silicon)

1. Download [`NODAYSIDLE-Cascade-V3-3.0.1-aarch64.dmg`](https://github.com/nodaysidle/nodaysidle-cascade-v3/releases/download/v3.0.1/NODAYSIDLE-Cascade-V3-3.0.1-aarch64.dmg).
2. Open the DMG and drag the app to `/Applications`.
3. First launch: right-click → **Open** if Gatekeeper blocks it (ad-hoc / not notarized).

Apple Silicon only. No Windows, Linux, or Intel macOS build in this release.

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
3. Select **DeepSeek V4 Pro** or **DeepSeek Flash**.
4. Paste your **software idea** — product summary, users, features, data, and constraints.
5. Enter separate **DeepSeek** and **TypeSafe Jev** API keys (memory-only; not saved to disk).
6. Click **Generate** and wait for the pipeline:
   - Jev preflight → provider → blueprint validation → Jev integrity → local normalization → preset compiler → audits → rendering
7. When status is **Gate Clean**, inspect the five preview tabs and **Export** to a folder.

Hand the exported folder to your coding agent. Read **`AGENTS.md` first**, then follow **`TASKS.md`** in phase order.

### Live provider probe (optional)

Type the key at a hidden prompt so it never lands in shell history:

```sh
# fish
read -s -x -P 'DeepSeek key: ' DEEPSEEK_API_KEY; npm run probe:live; set -e DEEPSEEK_API_KEY

# zsh; in bash replace the first command with: read -rsp 'DeepSeek key: ' DEEPSEEK_API_KEY
read -rs 'DEEPSEEK_API_KEY?DeepSeek key: '; export DEEPSEEK_API_KEY; npm run probe:live; unset DEEPSEEK_API_KEY
```

Without `DEEPSEEK_API_KEY` the probe is skipped. It runs one authenticated DeepSeek request through the TypeScript pipeline (no Rust provider, no Jev) and reports whether local compilation reached Gate Clean. Set `CASCADE_MODEL=deepseek-flash` or `deepseek-v4-pro` to choose the model (default `deepseek-flash`).

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
idea + locked preset + model + two memory-only keys
  → Jev viability + preset-fit preflight
  → one Rust DeepSeek Responses request when viable
  → strict JSON schema validation
  → Jev platform-needs healing + integrity gate (stack leakage, untestable acceptance)
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
- `src/jev.ts` + `src-tauri/src/jev.rs` — closed Jev decisions and fixed TypeSafe Decisions boundary
- `src-tauri/src/export.rs` — hash revalidation and atomic export

Design notes live in [`docs/`](docs/).

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
| `npm run probe:live` | One authenticated DeepSeek request through the TypeScript pipeline |
| `npm run tauri:build` | Release `.app` and `.dmg` |
| `npm run install:app` | Build and replace `/Applications/NODAYSIDLE Cascade V3.app`; add `-- --clean` to remove build output |

## Status

Active development. The compiler, five-document render path, provider boundary, and Astro web preset improvements (content collections, routes, agent-ready task graphs) are implemented and covered by automated tests.

## License

MIT — see [LICENSE](LICENSE).
