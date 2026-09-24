# Phase 1 — Inventory (round 2)

Audit date: 2026-09-24, from 13:35. Repo: `/Volumes/omarchyuser/COMPILER/nodaysidle-cascade-v3`, branch `main`, HEAD `af6d430` (pushed; CI run 35969552551 passed).

Round 1 ran 07:43–09:25 the same day, and its approved items were committed in `af6d430`. Its files are preserved unchanged in `audit/round-1/`. This round re-checks the round-1 results and covers everything since.

Uncommitted work at start (user-owned, not touched): `src/app.ts`, `src/schema.ts`, and the new `tests/status-detail.test.ts`. Cursor session `9c514138` made these at 13:17 to fix the misleading "technology-stack conflict" headline and to add a provider rule for OS-dependent acceptance signals.

## What the app does

The app is a macOS Tauri 2 compiler. It takes one software idea and one locked preset and produces exactly five Markdown files (PRD, ARD, TRD, TASKS, AGENTS) that a coding agent can build from. The flow:

1. Jev intake: viability check plus an advisory preset-fit check.
2. One DeepSeek Responses request, made in Rust, that returns strict JSON.
3. Tolerant parse and intake audit.
4. Jev integrity: foreign-stack leakage, added platform needs, and per-feature acceptance verifiability.
5. Deterministic local normalization, graph, render, and audit gates.
6. Atomic export of the five files.

Keys stay in memory only. There is no provider retry or repair. The five presets live in `src/presets.ts` and `src/astroWeb.ts`.

## 1. Project instruction and documentation files

| File | Tracked | Lines | Role |
| --- | --- | --- | --- |
| `AGENTS.md` | yes (new in `af6d430`) | 66 | Project facts, presets, linking rules, work rules, checks, install/release. |
| `CLAUDE.md` | yes | 1 | `@AGENTS.md` import. |
| `README.md` | yes | 237 | Public README; architecture, dev commands. |
| `USERGUIDE.md` | yes | 64 | End-user guide plus agent handoff prompt. |
| `docs/superpowers/specs/2026-08-29-cascade-v3-design.md` | yes | 116 | Architecture spec (refreshed in round 1). |
| `scripts/README-hybrid-release.md` | yes | 15 | Release steps. |
| `.github/workflows/checks.yml` | yes | 32 | CI: the five checks on `macos-latest`. |
| `.github/workflows/release-on-tag.yml` | yes | 25 | CI: release on `v*` tag. |
| `scripts/install-app.sh`, `scripts/bump-version.sh`, `scripts/attach-release-asset.sh`, `scripts/live-provider-probe.mjs` | yes | — | Repeated-task scripts. |
| `audit/*` | yes | — | Round-1 audit (committed in `af6d430`). |

Not present in the repo: `.claude/`, `.cursor/`, `.cursorrules`, `GEMINI.md`, TODO files, and plans.

## 2. Embedded prompts and prompt templates

| Location | What it is |
| --- | --- |
| `src/schema.ts:~285-305` `buildBlueprintInstructions` | The DeepSeek `instructions` string. The idea is interpolated at the end. It gains one uncommitted line on OS-dependent acceptance signals. |
| `src/pipeline.ts` | Fixed DeepSeek `input` string. |
| `src-tauri/src/provider.rs` | Fixed request body: model allowlist, strict JSON schema. |
| `src/jev.ts` | Jev noul questions (viability, preset choice, platform needs, foreign stack, overall and per-feature acceptance verifiability, per-feature capability). Thresholds `:23-26`. |
| `src/renderers.ts`, `src/compiler.ts`, `src/presets.ts`, `src/astroWeb.ts` | Generate the packet's downstream `AGENTS.md` and `TASKS.md` text. This is product output. |
| `USERGUIDE.md:37-54` | Tool-neutral handoff prompt for downstream agents. |

Few-shot examples: none. The only examples inside prompts are the illustrative ones in the new uncommitted instruction line.

## 3. Instruction files outside the repo that load for agents here

| File | Loaded by | Notes |
| --- | --- | --- |
| `/Volumes/omarchyuser/CLAUDE.md`, `/Volumes/omarchyuser/COMPILER/CLAUDE.md` | Claude Code (both, as parent dirs) | Byte-identical, 36 lines each; both are injected into this session. |
| `~/.claude/CLAUDE.md` | Claude Code (global) | 469 lines: "Global Codex Operating Rules", the Obsidian rule, a 70+-project "Repository Atlas", and a React/Tailwind front-end persona. |
| `~/.codex/AGENTS.md` (301), `~/AGENTS.md` (22) | Codex | Not changed since round 1. |
| `~/.cursor/rules/*.mdc` | Cursor (user-level) | 6 files; `front-end-cursor-rules`, `nextjs-react-generalist`, `graphify`, and others are `alwaysApply: true`. Not changed since round 1. |
| `~/Documents/codex-obsidian/20-Projects/nodaysidle-cascade.md` | Any agent following `~/.claude/CLAUDE.md:30-38` (mandatory read for `nodaysidle` GitHub work) | Project note, last `dynamic_state_checked: 2026-09-19`. |
| `~/.claude/projects/-Volumes-omarchyuser-COMPILER-nodaysidle-cascade-v3/memory/` | Claude Code | `git-push-on-request.md`. |

## 4. Agent session history

| Tool | Session | Dates | Covered |
| --- | --- | --- | --- |
| Cursor | `9c514138…` (517 KB, 279 lines) | 09-24 07:43 → 13:27 | Round-1 audit up to 09:22 was already covered. **This round reads lines 244–279 (09:25 → 13:27).** |
| Cursor | `aaaa67af`, `6487f034`, `aec35f84` | 08-31 → 09-23 | Round 1; not re-read. Findings re-verified in Phase 4. |
| Claude Code | `b5f47ec4…` (this session), `9f12771f…` (`/reload-skills` only) | 09-24 11:34 → | No earlier project work in them. |
| Claude Code | `3ed1892e…` + six small sessions | 09-23 → 09-24 06:05 | Round 1. |
| Antigravity CLI | `~/.gemini/antigravity-cli/history.jsonl` | last entry for this repo 09-22 | Round 1; nothing newer. |
| OpenCode | `opencode.db`: 2 sessions (09-23 10:09, 10:15) | — | Model and connector config only; no project work. |
| Codex | `~/.codex/sessions/` | — | No sessions reference this repo. |

## 5. Repo and workspace state noted during inventory

- Sibling backups next to the repo are unchanged from round 1 (about 2.1 GB): `../nodaysidle-cascade-v3.zip` (1.6 GB), `../nodaysidle-cascade-v3-rollbacks` (319 MB), `../backups` (200 MB), and `../rollback-backups` (21 MB).
- `/Volumes/omarchyuser/nodaysidle-cascade` (V1) still exists, and the Obsidian note lists it as this project's first path.
- The installed `/Applications/NODAYSIDLE Cascade V3.app` was rebuilt at 13:19 from the uncommitted tree.
