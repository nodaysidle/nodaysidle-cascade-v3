# Phase 3 — Session notes (round 2)

Round-1 notes (C1, C2, C3, CL1, CL2, AG, sessions 08-31 → 09-24 07:43) are in `audit/round-1/session-notes.md`. This round reads what came after, then re-checks the round-1 recurring items against today's state.

Sources:

- **R2** Cursor `9c514138…`, lines 244–279, 2026-09-24 09:25 → 13:27: push, live probe, the Jev integrity block, the headline and prompt fix, reinstall, and the preset question.
- **AG** Antigravity `history.jsonl`: nothing for this repo after 2026-09-22.
- **OC** OpenCode `opencode.db`: two sessions on 09-23 (model and connector config); no project work.
- **CL** Claude Code `b5f47ec4` (this session) and `9f12771f` (`/reload-skills`): no earlier project work.

Secrets: R2 line 253 contains a pasted live DeepSeek key. It is not reproduced here.

## 1. New events since round 1 (R2)

| Time | Event |
| --- | --- |
| 09:25 | Push approved after the agent explained two observations: the timing-sensitive `jev_boundary.rs` mock server, and `minLength` in strict mode. `af6d430` pushed; CI run 35969552551 passed. |
| 09:38 | The user ran the live probe with the key inline and pasted the whole command, key included, into chat. It passed on `deepseek-flash` in 12 s. The agent advised rotation and said to clear `~/.zsh_history`. |
| 09:38 | The agent said "The app's default is `deepseek-v4-pro`". Wrong: `src/state.ts:43` sets `deepseek-flash`. `deepseek-v4-pro` is only the probe's default. |
| 09:38 | The agent proposed a Tauri test idea (subscription tracker: notifications, tray, CSV, rates API with key). |
| 12:51 | The GUI run was blocked at Jev Integrity. The headline said "technology-stack conflict"; the real cause was two features (`Renewal Notifications`, `Tray Icon and Background Operation`) scoring below 0.65 on acceptance verifiability. The user asked "why", and what the right-hand window was (Technical details). |
| 12:5x | The agent offered three fixes. Option 3 ("send just that feature back to DeepSeek once to reword it") conflicts with `AGENTS.md:46` "no provider retry or repair", and the agent didn't flag that. The user chose options 1 and 2. |
| 13:17 | Uncommitted edits: `statusDetailText` in `src/app.ts`, a provider rule at `src/schema.ts:297`, and `tests/status-detail.test.ts`. 219 tests passed. Reinstalled with `npm run install:app -- --clean`. |
| 13:23 | The app recommended the Native macOS SwiftUI preset for a Tauri idea. The user asked which to pick; the agent said Tauri, since the recommendation is advisory only (`src/pipeline.ts:258-277`). |
| 13:27 | The session ends before the user reports the rerun. The outcome is unknown. |

## 2. Findings

### N1. The pasted API key is still on disk (R2 09:38) — verified now

- The literal key appears once in `~/.local/share/fish/fish_history` and once in the Cursor transcript `9c514138…jsonl`. I counted matches only and printed nothing.
- The agent's cleanup advice (`fc -W`, `~/.zsh_history`) was for zsh, but the user's shell is fish. `~/.zsh_history` has 0 matches, so that advice cleaned nothing.
- I can't verify whether the key was rotated.
- The root cause in the repo: `README.md:137` documents the inline `DEEPSEEK_API_KEY=… npm run probe:live` form (prompt-audit Q5).

### N2. The integrity headline and docs blamed the wrong cause (R2 12:51)

- The UI headline is fixed in the uncommitted `src/app.ts`. `USERGUIDE.md:18` and README still describe only stack conflicts (prompt-audit Q2).

### N3. A Jev block has no in-app recovery (R2 12:5x) — design decision, open

- One failing feature blocks the whole packet (`src/pipeline.ts:329-330`). The only remedies are a manual retry, which is another paid DeepSeek request, or rewording the idea.
- The product rule "no provider retry or repair" (`AGENTS.md:46`, `README.md:73`) rules out automatic rewording. The agent proposed it anyway without citing the rule.
- The user hasn't seen whether the new prompt rule (Q4) is enough; the rerun is pending.

### N4. Wrong-default statement (R2 09:38)

- Caused by the probe default (`deepseek-v4-pro`) differing from the app default (`deepseek-flash`); see prompt-audit Q3.

### N5. The preset recommendation leans native for tray and notification ideas (R2 13:23) — observation only

- A single data point. The code treats it as advisory. It's worth watching across the idea × preset matrix, but I have no evidence it's wrong.

### N6. The Obsidian project note was never updated after round 1

- The note's `dynamic_state_checked: 2026-09-19` predates both 09-23 commits and `af6d430`.
- The rule to update it (`~/.claude/CLAUDE.md:36`) loads only in Claude Code and Codex, but the work happened in Cursor and Antigravity. As a result, the one file every Claude or Codex agent must read first is the most stale (prompt-audit Q7).

## 3. Round-1 recurring items: status now

| Round-1 item | Status (verified 2026-09-24 13:40) |
| --- | --- |
| R1 rebuild + install | Scripted (`npm run install:app`); used successfully at 13:17. Resolved. |
| R2 leftovers | `--clean` flag; `git status` after the 13:17 install showed no build output. Resolved. |
| R3 "fix the compiler, not outputs" | In `AGENTS.md:39-44`. No repeat in R2. Resolved for Cursor and Claude. The Obsidian note still contradicts it indirectly (Q7). |
| R4 re-explaining the app | `AGENTS.md:1-8`. No repeat in R2. Resolved. |
| R5 handoff prompt | Template in `USERGUIDE.md:33-56`. Resolved. |
| R6 manual packet-audit loop | Still manual (the 12:51 run). It's the product's test loop and inherent. The matrix test covers the compile side. |
| Wording heuristics | Mostly removed; five remain (prompt-audit Q1). Open. |
| Flaky `jev_boundary.rs` | Values unchanged (`:21,65,77,93`: 500/700/250/500 ms). Passed locally today and in CI once. Open, low. |
| Sibling backups, parent `CLAUDE.md`, Cursor rules | Unchanged; still your decision. |
