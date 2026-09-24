# Phase 1 — Inventory

Audit date: 2026-09-24. Repo: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3`, branch `main` (in sync with `origin/main`, HEAD `345c028 Release 3.0.1`). Only untracked file at start: `CLAUDE.md`.

Project type: Tauri 2 macOS app (TypeScript frontend + local compiler in `src/`, Rust provider/export/Jev boundary in `src-tauri/`). Tests: Vitest (`tests/`, 23 suites) and Cargo integration tests (`src-tauri/tests/`, 3 suites).

## 1. Project instruction files

| File | Tracked | Lines | Role |
| --- | --- | --- | --- |
| `CLAUDE.md` | no (untracked) | 41 | Agent working preferences. Byte-identical to `../CLAUDE.md` (`/Volumes/omarchyuser/COMPILER/CLAUDE.md`) and `../../CLAUDE.md` (`/Volumes/omarchyuser/CLAUDE.md`). Contains no project-specific content. |
| `README.md` | yes | 237 | Public README: product pitch, install, usage, architecture, dev commands. The only place that lists build/test commands. |
| `USERGUIDE.md` | yes | 38 | End-user guide (generate, outcomes, privacy). |
| `docs/superpowers/specs/2026-08-29-cascade-v3-design.md` | yes | 116 | Architecture spec from initial build (2026-08-29). |
| `scripts/README-hybrid-release.md` (tracked as `Scripts/README-hybrid-release.md`) | yes | 14 | Release procedure (local DMG + CI tag release). |
| `.github/workflows/release-on-tag.yml` | yes | 25 | CI: creates GitHub Release on `v*` tag; notes only. |
| `Scripts/attach-release-asset.sh` | yes | 26 | Uploads locally built DMG to a release. |

Not present: `AGENTS.md`, `.claude/`, `.cursor/`, `.cursorrules`, `.cursor/rules/`, `GEMINI.md`, `TODO*`, plan files. Plans (`docs/superpowers/plans/*`) and evidence docs (`docs/evidence/*`) were deleted in commit `8dfd82c` (2026-09-23).

## 2. Embedded prompts / prompt templates (in source)

| Location | What it is |
| --- | --- |
| `src/schema.ts:269-281` `buildBlueprintInstructions` | The single DeepSeek system `instructions` string; the user idea is interpolated at the end (`Software idea: …`). |
| `src/pipeline.ts:206` | Fixed DeepSeek `input` string. |
| `src-tauri/src/provider.rs:114-150` | Fixed request body (model allowlist, `temperature 0.0`, `top_p 1.0`, `reasoning.effort none`, strict JSON schema). |
| `src/jev.ts:267-330+` | Jev "noul" question templates (viability, preset selection, clarity, foreign stack, acceptance verifiability, per-platform-need and per-feature questions). |
| `src/renderers.ts`, `src/compiler.ts`, `src/presets.ts`, `src/astroWeb.ts` | Generate the downstream `AGENTS.md`/`TASKS.md` prose (product output, not instructions to agents working on *this* repo). |
| `src/smoke.ts:38` | Smoke fixture selection that depends on the literal `Software idea: <name>` in the instructions. |

Few-shot examples: none in prompts. Test fixtures (`tests/fixtures/*.ts`) are regression data, not prompt examples.

## 3. Instruction files outside the repo that apply to agents here

| File | Applies to | Notes |
| --- | --- | --- |
| `/Volumes/omarchyuser/CLAUDE.md`, `/Volumes/omarchyuser/COMPILER/CLAUDE.md` | Claude Code, Cursor (loaded as workspace rules) | Identical copies of the project `CLAUDE.md`. All three are injected together → 3× duplication. |
| `~/.claude/CLAUDE.md` (469 lines) | Claude Code (global) | Imported from Codex global rules; includes an Obsidian-vault rule that triggers for the `nodaysidle` GitHub account. |
| `~/.codex/AGENTS.md` (301 lines), `~/AGENTS.md` (22 lines) | Codex | Global. |
| `~/.claude/projects/-Volumes-omarchyuser-COMPILER-nodaysidle-cascade-v3/memory/` | Claude Code project memory | `MEMORY.md` + `git-push-on-request.md` (run plain `git push` when asked; force pushes hook-blocked). |
| `~/.cursor/rules/*.mdc` | Cursor (user-level, if loaded) | 5 of 6 are `alwaysApply: true`: three Next.js/React persona rules, a Rust async rule, and `graphify.mdc` claiming "This project has a graphify knowledge graph at graphify-out/". Not observed in this session's injected rules, so loading is unconfirmed. |
| Cursor user rules (settings) | Cursor | "Keep Cursor standalone… do not import assumptions from Eldio, Hermes, Codex…" |

## 4. Agent session history for this project

| Tool | Path | Sessions | Dates |
| --- | --- | --- | --- |
| Cursor | `~/.cursor/projects/Volumes-omarchyuser-COMPILER-nodaysidle-cascade-v3/agent-transcripts/` | `aaaa67af…` (366 KB + 3 subagents), `6487f034…` (31 KB), `aec35f84…` (766 KB), `9c514138…` (this audit) | 2026-08-31 → 2026-09-24 |
| Claude Code | `~/.claude/projects/-Volumes-omarchyuser-COMPILER-nodaysidle-cascade-v3/` | `3ed1892e…` (1.28 MB), plus six small sessions (2.5–12 KB) | 2026-09-23 → 2026-09-24 |
| Antigravity CLI | `~/.gemini/antigravity-cli/history.jsonl` | 69 lines mention the repo path | 2026-09 |
| OpenCode | `~/.local/share/opencode/log/opencode.log` | 96 lines mention the repo path (log only, no transcript) | 2026-09 |
| Codex | `~/.codex/sessions/` | none reference this repo | — |

## 5. Repo hygiene noted during inventory

- Git index tracks both `Scripts/` (2 files) and `scripts/` (1 file). On macOS's case-insensitive volume they merge into one `scripts/` folder; on Linux/CI they are two folders.
- `node_modules/` and `src-tauri/gen/` exist locally and are ignored.
