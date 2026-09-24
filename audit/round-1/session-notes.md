# Phase 3 — Session notes

Sources (abbreviations used below):

- **C1** Cursor `aaaa67af…` — 2026-08-31 (initial root-cause audit, Copper Kite Astro test, first GitHub publish)
- **C2** Cursor `6487f034…` — 2026-09-22 04:14 (short audit start)
- **C3** Cursor `aec35f84…` — 2026-09-22 23:00 → 09-23 11:08 (7/10 audit, compiler fixes, Local Notes / Monospace Notes tests, v3.0.1 release)
- **CL1** Claude Code `3ed1892e…` — 2026-09-24 03:08–04:05 (review of global instruction files, skills, git hook)
- **CL2** Claude Code six small sessions — 2026-09-23 10:09–10:27 (`/login`, `/model`, `/effort`, `/skills` only; no project work)
- **AG** Antigravity CLI `~/.gemini/antigravity-cli/history.jsonl` — 2026-09-19 → 09-23 (user prompts only; no assistant text stored)
- OpenCode: log only, no transcript. Codex: no sessions for this repo.

Secrets: C1 contains a pasted DeepSeek API key (the agent advised rotation). It is not reproduced here.

## 1. Instructions the user keeps repeating

| # | Instruction | Evidence |
| --- | --- | --- |
| R1 | "Rebuild the app, put it in /Applications, remove the old one." | C1 08-31 03:41, 04:08; C3 09-23 00:29, 01:21, 01:37, 06:06, 10:18; AG 09-19 03:45, 09-21 07:11, 09-22 14:14, 19:59. At least 11 times across three tools. |
| R2 | "Remove the leftovers / don't want a dirty repo." | C3 09-23 00:00, 01:21, 05:55; AG 09-19 05:18, 09-21 07:11, 13:30. |
| R3 | "We are fixing the COMPILER, not the markdown outputs." | C3 09-23 00:43 ("dont give the fix prompt for the idea"), 00:44 ("i told you 4 times…"), 00:53 ("remove deepgram, remove openrouter from the COMPILER ITSELF"), 01:35; AG 09-22 21:05 ("i told you that the point is the compiler, not the output projects"). |
| R4 | Re-explaining what the app is and how it works at session start. | C1 08-31 03:21 (long description); C2 09-22 04:21 and 04:23 ("go read the GitHub repo and you will understand how it works"); C3 09-22 22:59 (multi-paragraph background in the prompt); AG 09-19 03:28, 09-22 20:57 (asks for a prompt that includes "a short explanation of what the app is"). |
| R5 | "Write me a prompt for hermes --profile eldio --tui / Codex to build from the five docs." | C1 08-31 04:21; C3 09-23 06:06; AG 09-19 03:38, 06:02, 09-21 07:31, 07:33 (correction: remind it of skills/delegation), 07:36 (correction: wrong subagent names). |
| R6 | "Audit the five markdowns at <path>." (manual generate → export → agent audit loop) | C1 08-31 03:54, 04:18; C3 09-23 00:36, 01:12, 01:29, 05:29; AG 09-19 05:46, 09-21 07:26, 09-22 20:30. Output folders: `projekti/cascadev3/copper-kite`, `projekti/localnotes`, `projekti/local-notes-editor`, `projekti/monospace-notes`, `projekti/monospace`, `projekti/cursorpad`, `/Volumes/omarchyuser/whisper-bar`. |

## 2. Corrections the user had to make

- **Test ideas are not product scope.** Agent kept Deepgram/OpenRouter voice logic in the compiler because the voice test idea used them; user corrected four times before the vendor wiring was removed (C3 09-23 00:00–00:53). The voice-domain heuristics that remain (see §6) are the same class of problem.
- **Model name.** User had to tell the agent twice that `deepseek-flash` is the current model and `deepseek-v4-flash` is a retired alias (AG 09-19 03:41, 03:44, citing DeepSeek news 2026-09-10).
- **Stale install.** User noticed the `/Applications` bundle still showed an old timestamp (C1 08-31 04:08). Agent found a half-updated install: the binary was overwritten by a sandboxed build but the bundle was not replaced.
- **Hermes context.** Agent invented subagent names that belong to a different Hermes profile (AG 09-21 07:36).
- **Default URL.** User had to supply the default endpoint `https://api.deepseek.com/responses` (AG 09-19 05:24).

## 3. Tasks done by hand repeatedly

- **Build + install + verify** (R1): `npm run tauri:build`, `rm -rf` the installed bundle, `cp -R`, `codesign --verify --deep --strict`, launch, check timestamp/version. No script exists; each agent rediscovers the steps (C1 lines ~240–660 of assistant text; C3 09-23 multiple).
- **Release**: bump version in `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`; update two README DMG links and the "Existing Latest release" line in the release README; build DMG; mount and verify signature/version; tag; wait for CI; attach DMG; hand-edit release notes because generated notes omit direct commits (C3 09-23 ~10:55–11:08).
- **Packet audit loop** (R6): user generates in the GUI, exports, pastes a path, agent audits, agent writes a synthetic fixture to reproduce each defect, fixes the compiler, rebuilds, user regenerates.
- **Backups before risky agent runs**: AG 09-19 03:47 ("make a snapshot/backup … in case he fucks up"). Sibling folders now hold ~2.1 GB: `../nodaysidle-cascade-v3.zip` (1.6 GB), `../nodaysidle-cascade-v3-rollbacks` (319 MB), `../backups` (200 MB), `../rollback-backups` (21 MB).

## 4. Missing context that caused mistakes

- No project instruction file describes what the app is, the authority boundaries, or the commands (R4). `CLAUDE.md` in the repo is a generic copy of the parent files.
- No written rule that the compiler must stay generic and that per-idea fixtures must not add domain logic (R3).
- No note that generated packets in `/Volumes/omarchyuser/projekti/*` are disposable test outputs (C3 09-23 01:35: "the monospace-notes etc are all tests of the app itself").
- Live probe gave false confidence: it uses its own fetch path in the test, a short idea, and no Jev, so it passed while the GUI failed on JSON wrapping (C1 08-31 ~03:50: "The earlier live probe used a short Harbor Sort idea and a test-side fetch path — so it didn't catch this in the GUI").

## 5. Failed approaches / recurring defect class

- **Regex word-matching heuristics** in the compiler repeatedly mis-linked features and data:
  - `\bpage\b` matched "home page" → create-before-modify failure (C1 08-31 ~04:15).
  - "note file names" matched the document-role regex (C3 09-23 ~05:40).
  - "request" in a negated sentence granted network permission (C3).
  - Commit `8dfd82c` message: "Link features … only through affirmed text (negated clauses stripped)".
  - Agent's own caveat (C3 09-23 ~01:29): "Most data linking and placement comes from matching wording. A blueprint phrased differently from what I tested can still link data to the wrong feature."
- **Per-idea regression suites**: each GUI test idea produced a new test file named after it (`voice-v3-*`, `voice-v5-*`, `monospace-*`, `cursor-notepad-*`, `astro-markdown-*`). The C3 audit recommended "a property-style matrix of generic ideas across all 5 presets" instead (C3 09-22 23:24).
- **Flaky Rust test**: `surfaces_only_the_status_for_http_failures` failed once under a parallel debug build and passed on rerun (C3 09-23 ~05:50).

## 6. Unfinished work / decisions not recorded in project instructions

- **Deferred redesign**: "I did not extract the Deepgram and OpenRouter wire text into separate domain packs … Moving them out is a redesign" (C3 09-22 ~23:40). Vendor wiring was later removed (C3 09-23 ~01:00), but voice-domain logic (dictation insertion, `voice.sqlite3` schema, microphone copy "record dictation", voice persistence audit) is still in `src/compiler.ts` and `src/audit.ts`.
- **"Make this a memory or a markdown in the repo, this project is very important"** (AG 09-19 06:08). `SUMMARIZE.md`/`MILESTONE.md`/`GUIDE.md` were created then deleted as stale in C3 (09-23 ~01:25; untracked, not recoverable). No durable project context file replaced them.
- **Rebase-before-push** decision (C3 09-23 10:55): user asked, agent recommended rebase for unpushed local commits; not recorded.
- **Push on request** preference: recorded only in Claude Code memory (CL1 09-24 04:01), not visible to Cursor/Codex/Antigravity.
- **Blocked on me / Changed / Found** reporting rule: approved in CL1 (09-24 03:14) and added only to `~/.claude/CLAUDE.md:290`; other tools don't get it.
- **Hybrid release flow** (PR #1): documented in `scripts/README-hybrid-release.md` but not linked from README's Development section.

## 7. Historical observations already resolved (verified in Phase 4)

- Provider wrapper rejecting `reasoning` items; schema duplicated in prompt; dev port mismatch (C1) — fixed.
- JSON fences / prose around provider JSON (C1) — tolerant parser exists (`parseBlueprintJson`).
- C3 audit H1–H4, M1–M6 (OpenRouter leak, ghost permissions, atomic-audit index, shell injection, credential-vault crash, redirects, payload cap, export race, per-keystroke Jev calls) — fixed in `8dfd82c` with regression tests (`ghost-permissions-rejection`, `executable-injection-rejection`, `atomic-audit-placement-alignment`, etc.).
- App model selector uses `deepseek-flash` (`src/pipeline.ts:35`).
- `tests/cursor-notepad-quality.test.ts` no longer writes into the repo.
