# Cascade V3 — Friction audit report

**Executive summary**

1. The biggest slowdown is missing project context: the repo's `CLAUDE.md` is a generic copy loaded three times, so you re-explained the app in at least five sessions and had to say "fix the compiler, not the outputs" five times.
2. The most repeated manual task is "rebuild, replace the app in /Applications, remove leftovers" (11+ requests across Cursor and Antigravity). There's no script for it, and one past install ended up half-updated.
3. Two of the five documented checks fail today (`cargo fmt --check` and `cargo clippy -D warnings`), and no CI runs them. TypeScript, Vitest (183 passed), the Vite build, and Cargo tests (36 passed) all pass.
4. Docs have drifted: the design spec still lists the retired `deepseek-v4-flash` model and leaves Jev out of the flow, the live probe can't pick `deepseek-flash`, and git tracks both `Scripts/` and `scripts/`.
5. The recurring compiler defect class is regex wording heuristics plus one test file per idea. Voice-app logic from a test idea is still hardcoded in the compiler, which is the larger follow-up.

Supporting files: `inventory.md` (Phase 1), `prompt-audit.md` (Phase 2), `session-notes.md` (Phase 3).

## Checks run (Phase 4, 2026-09-24)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 22 files passed, 1 skipped (live probe); 183 tests passed, 1 skipped |
| `vite build` (output redirected to `/tmp`) | pass |
| `cargo test` (target dir in `/tmp`) | 36 passed, 0 failed |
| `cargo fmt -- --check` | **fail**: `src-tauri/src/export.rs:146`, `src-tauri/tests/export_boundary.rs:84` |
| `cargo clippy --all-targets --all-features -- -D warnings` | **fail**: `clippy::needless_return` at `src-tauri/src/export.rs:133` (rustc/clippy 1.98.1) |

No files outside `audit/` were modified. Build output went to `/tmp/cascade-audit-target` and `/tmp/cascade-audit-dist`.

---

## Ranked findings (quick wins first)

### 1. Add a project instruction file with real project facts — high impact, low effort

- **Problem and evidence:** `CLAUDE.md` in the repo is byte-identical to `/Volumes/omarchyuser/CLAUDE.md` and `/Volumes/omarchyuser/COMPILER/CLAUDE.md`, and all three are loaded. None of them describes the app, commands, or invariants. You re-explained the app in C1 (08-31), C2 (09-22 ×2), C3 (09-22), and AG (09-19, 09-22). "Fix the compiler, not the outputs" was repeated in C3 09-23 00:43, 00:44 ("i told you 4 times"), 00:53, 01:35 and in AG 09-22 21:05. `CLAUDE.md:25` says "Use the project's required checks", but none are defined anywhere.
- **Proposed change:** create a tracked `AGENTS.md`, which Cursor, Codex, and Antigravity read. Replace the untracked repo `CLAUDE.md` with a one-line import of `AGENTS.md`, so Claude Code reads the same file. I'll confirm the current import syntax for each tool in its docs before editing. Leave the two parent `CLAUDE.md` files alone unless you say otherwise. Draft content:

  ```markdown
  # NODAYSIDLE Cascade V3

  macOS Tauri 2 app that turns one software idea + one locked stack preset into exactly five
  Markdown files (PRD, ARD, TRD, TASKS, AGENTS) for downstream coding agents.
  One DeepSeek request supplies product meaning; TypeSafe Jev gates intake and integrity;
  everything else (IDs, graph, files, phases, Markdown bytes) is local deterministic code.

  ## Where things live
  - `src/schema.ts` provider schema and prompt · `src/pipeline.ts` generate flow
  - `src/compiler.ts`, `src/presets.ts`, `src/astroWeb.ts` graph and preset policy
  - `src/renderers.ts` Markdown bytes · `src/audit.ts` gates · `src/jev.ts` Jev decisions
  - `src-tauri/src/provider.rs`, `jev.rs` HTTPS boundaries · `export.rs` atomic export

  ## Rules for work here
  - The target is the compiler. Packets under `/Volumes/omarchyuser/projekti/*` are disposable
    test outputs: reproduce a packet defect as a synthetic fixture in `tests/`, fix the compiler,
    don't hand-edit the packet unless asked.
  - Keep the compiler generic. Don't add vendor, domain, or product logic that exists only
    because one test idea needed it.
  - Keep these product requirements: exactly five exported files; preview bytes equal export
    bytes; API keys memory-only, never logged/persisted/exported; no provider retry or repair.
  - DeepSeek models: `deepseek-flash` (current) and `deepseek-v4-pro`; `deepseek-v4-flash` is a
    retired alias kept only for compatibility.

  ## Checks (all must pass before reporting code work done)
  npm run typecheck && npm test
  cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
  cargo test --manifest-path src-tauri/Cargo.toml

  ## Build, install, release
  - Install to /Applications: `npm run install:app` (item 3); remove build leftovers afterwards.
  - Release: `scripts/README-hybrid-release.md`.
  - If local commits are unpushed and `origin/main` moved, rebase onto it before pushing.
  ```

- **Affects:** every agent session in this repo; no code.
- **Test:** check that the file loads, then start a fresh agent session and ask "What does this project do, which checks must pass, and where would you fix a TASKS.md defect?". It should answer from the file without reading source. Also confirm every command listed runs (they're the same commands as item 2).

### 2. Make the documented Rust checks pass — high impact, very low effort

- **Problem and evidence:** see the checks table. Two formatting diffs and one clippy error. README "Development" tells agents to run both, so every agent hits a pre-existing failure and has to work out whether it caused it.
- **Proposed change:** run `cargo fmt` on the two files. At `src-tauri/src/export.rs:133`, replace `return if rc == 0 { … } else { … };` with a tail expression. No behavior change.
- **Affects:** `src-tauri/src/export.rs`, `src-tauri/tests/export_boundary.rs`.
- **Test:** `cargo fmt --check`, `cargo clippy … -D warnings`, and `cargo test` all pass, with the target dir in `/tmp`.

### 3. Script the build → install → verify loop — high impact, low-medium effort

- **Problem and evidence:** requested 11+ times (session-notes R1). Each agent rediscovers the steps. In C1 (08-31 04:08) a sandboxed build overwrote only the binary inside the old bundle, so the installed app was half-updated. Leftover cleanup was requested 6+ times (R2), and `src-tauri/target` regrows to about 4.7 GB (C3).
- **Proposed change:** add `scripts/install-app.sh` and `npm run install:app`. The script quits the running app, runs `npm run tauri:build`, removes the old `/Applications/NODAYSIDLE Cascade V3.app`, copies the new bundle with `ditto`, runs `codesign --verify --deep --strict`, and prints the bundle version and binary timestamp. An optional `--clean` flag removes `src-tauri/target` and `dist` afterwards. The script removes the installed app, so agents run it only when you ask for an install.
- **Affects:** new script and a `package.json` script entry; `/Applications` when run.
- **Test:** run it once. The installed `CFBundleShortVersionString` should equal `package.json`, the binary mtime should be fresh, codesign should pass, and the app should launch. Run it with `--clean` and confirm `src-tauri/target` is gone and `git status` is clean.

### 4. Fix the `Scripts/` vs `scripts/` case collision — medium impact, very low effort

- **Problem and evidence:** `git ls-files` lists `Scripts/README-hybrid-release.md`, `Scripts/attach-release-asset.sh` and `scripts/live-provider-probe.mjs`. On macOS they merge into one folder; on Linux and in CI they're two folders.
- **Proposed change:** move the two `Scripts/` files to `scripts/` with a two-step `git mv`, which is needed on a case-insensitive disk. Update the references in `.github/workflows/release-on-tag.yml` (comment), `scripts/README-hybrid-release.md`, and the usage line in `attach-release-asset.sh`. Drop the stale "Existing Latest release is v3.0.1" sentence (prompt-audit P5).
- **Affects:** the three files above. The release workflow itself doesn't call the script.
- **Test:** `git ls-files | rg -i '^scripts/'` shows one casing, `bash -n scripts/attach-release-asset.sh` passes, and `rg 'Scripts/'` finds nothing.

### 5. Correct stale docs: spec, README probe claim — medium impact, low effort

- **Problem and evidence:** prompt-audit P4 (spec lines 5, 19–33, 36, 42, 108) and P6 (README line 140). The spec still names `deepseek-v4-flash`, which you corrected twice in AG 09-19.
- **Proposed change:** edit only those statements. List two keys and the Jev stages in the flow and stage list, say "one DeepSeek request plus Jev decision requests", and list the current models. Reword the README probe line as in P6.
- **Affects:** `docs/superpowers/specs/2026-08-29-cascade-v3-design.md`, `README.md`.
- **Test:** `rg -n 'deepseek-v4-flash|one memory-only key' docs README.md` returns nothing. Also check each changed statement against `src/pipeline.ts`.

### 6. Let the live probe use the current model — medium impact, low effort (touches an existing test)

- **Problem and evidence:** `tests/live-provider-probe.test.ts:105` only chooses between `deepseek-v4-flash` and `deepseek-v4-pro`, so the app's default model `deepseek-flash` (`src/state.ts:43`) can't be probed. The probe also skips Jev and the Rust provider (P6). That's why it passed in C1 while the GUI failed.
- **Proposed change:** accept `CASCADE_MODEL` values `deepseek-flash`, `deepseek-v4-pro`, or `deepseek-v4-flash`, and keep `deepseek-v4-pro` as the default so current behavior holds. No assertion changes. Covering Jev in the probe would need a Jev fetch adapter; I'd treat that as a separate item.
- **Affects:** `tests/live-provider-probe.test.ts`. It edits an existing test, and your approval of this item counts as permission for that.
- **Test:** `npm test` still skips the probe when no key is set. A real run with `CASCADE_MODEL=deepseek-flash` costs one paid request, so it runs only if you supply the key in your own terminal.

### 7. Add a CI check workflow — medium impact, medium effort (changes a shared system)

- **Problem and evidence:** the only workflow is `release-on-tag.yml`, which creates releases only. The fmt and clippy failures (item 2) landed unnoticed in `8dfd82c` and `345c028`.
- **Proposed change:** add `.github/workflows/checks.yml`, triggered on push and PR, running on a macOS runner (Tauri needs it). It runs `npm ci`, typecheck, tests, cargo fmt, clippy, and cargo test.
- **Affects:** GitHub Actions minutes; nothing locally.
- **Test:** it needs a push to a branch, which requires your approval. Watch the run: it should pass after item 2 and fail if I introduce a deliberate formatting error on a throwaway branch.

### 8. Add a generic cross-preset idea matrix test — high impact, medium effort

- **Problem and evidence:** wording heuristics caused repeated mis-links: `\bpage\b` in C1, "note file names" and a negated "request" in C3, and the negated-clause fix in `8dfd82c`. `src/compiler.ts` has 67 `/\b…` regex literals, `src/audit.ts` 35, and `src/astroWeb.ts` 15. Tests grew one file per idea (`voice-v3`, `voice-v5`, `monospace-*`, `cursor-notepad-*`), and `tests/cross-preset-quality.test.ts` has a single fixture. The C3 audit recommended a matrix, and it was never done.
- **Proposed change:** add one new test file. It compiles about 8 short, generic, deliberately varied blueprints (web catalog, notes editor, menu-bar timer, Android list, Tauri file tool, and phrasing variants with negations) across all 5 presets. It asserts invariants rather than text: gate clean, no orphan permission contracts, no voice/dictation/SQLite tokens unless the blueprint states them, and each feature linked only to data it names.
- **Affects:** new test file only. It may expose real compiler bugs. If so, I'll report them rather than fix them in this item.
- **Test:** `npm test`. Record which invariants fail on the current compiler as findings.

### 9. Remove voice-app logic that is still hardcoded in the compiler — high impact, high effort (needs your decision)

- **Problem and evidence:** in C3 09-23 00:53 you asked to "remove deepgram, remove openrouter from the COMPILER ITSELF". The vendor wiring is gone, but voice-domain logic from the same test idea remains: `hasVoicePersistence` and the `voice.sqlite3` schema (`src/compiler.ts:962-975`, `1036-1055`, `1328-1336`, `1606`, `1661`), dictation insertion behavior (`334-341`, `1070-1089`), the fixed microphone copy "record dictation" (`1095`), the voice persistence audit (`src/audit.ts:434-443`), `TranscriptionRoutingSchema` (`src/schema.ts:66`), and a voice fixture that `src/smoke.ts` imports from `tests/`.
- **Proposed change:** do this after item 8 exists. Replace the voice-specific branches with generic persistence and permission rules, and move voice expectations into fixtures. The voice test suites (`voice-v3-remaining-defects`, `voice-v5-acceptance`) assert this behavior, so this item changes existing tests and needs your explicit approval and scope.
- **Affects:** compiler output for native macOS audio apps. Behavior changes by design.
- **Test:** full `npm test`, the item 8 matrix, and one real GUI generate for a voice idea and one for a non-voice idea, then audit the packets.

### 10. Release version bump helper — low-medium impact, low effort

- **Problem and evidence:** the v3.0.1 release (C3 09-23 ~11:00) needed hand edits to `package.json`, `package-lock.json`, `tauri.conf.json`, `Cargo.toml`, `Cargo.lock`, two README DMG links, and the release README. Generated release notes also left out the direct-commit changes, so they were rewritten by hand.
- **Proposed change:** add `scripts/bump-version.sh X.Y.Z`. It uses `npm version --no-git-tag-version`, a `jq` edit of `tauri.conf.json`, a `Cargo.toml` edit followed by `cargo update -p nodaysidle-cascade-v3 --offline`, and a README link rewrite, then prints the diff. It doesn't commit or tag.
- **Affects:** new script only.
- **Test:** run it in a temporary copy of the repo (not the working tree). The diff should touch exactly those files, and typecheck and tests should pass in the copy.

---

## Needs your decision (not proposed as changes to this repo)

- **Sibling backups:** about 2.1 GB next to the repo: `../nodaysidle-cascade-v3.zip` (1.6 GB), `../nodaysidle-cascade-v3-rollbacks` (319 MB), `../backups` (200 MB), `../rollback-backups` (21 MB). Deleting them is destructive, so I'll only do it on your say-so.
- **Parent `CLAUDE.md` copies:** whether to keep the generic preferences only in `/Volumes/omarchyuser/CLAUDE.md` and remove the COMPILER-level duplicate. That affects sibling projects.
- **User-level Cursor rules** (`~/.cursor/rules`, prompt-audit P9): these still contain "Confirm, then write code!" and a graphify rule for a folder that doesn't exist here. It isn't confirmed that Cursor loads them.
- **Cross-tool preferences** (P11): "git push when asked" and the "Blocked on me / Changed / Found" format exist only in Claude Code. The item 1 file could carry them for all tools if you want.
- **Downstream handoff prompt** (session-notes R5): you asked for a Hermes or Codex build prompt 7+ times. Per your Cursor rule I haven't assumed Hermes details. If you want it, a generic template in `USERGUIDE.md` would cover it: read `AGENTS.md` first, follow `TASKS.md` in phase order, report DONE/PARTIAL/BLOCKED.
- **Deferred:** moving the user idea from the provider `instructions` into `input` (P7). It needs paid live A/B probes and changes model behavior.

## Historical observations already resolved (dropped)

All of these were fixed in `8dfd82c` or earlier, and the regression tests pass:

- The provider rejected responses containing `reasoning` items.
- The schema was duplicated in the prompt.
- The dev port was mismatched.
- JSON wrapped in fences was rejected.
- The C3 audit issues: OpenRouter template leak, ghost permissions, atomic-audit index bug, shell-injection passthrough, credential-vault crash, reqwest redirects (now `Policy::none()` + `https_only`), missing outbound size cap, export rename race (now `renamex_np(RENAME_EXCL)`), per-keystroke Jev calls, and cancel-status regression.
- The app model selector used the retired name (now `deepseek-flash`).
- `cursor-notepad-quality.test.ts` wrote into the repo.
- The flaky Rust test `surfaces_only_the_status_for_http_failures` passed in this run. There isn't enough evidence to call it an open problem.

---

**Stopping here.** Tell me which items to apply, by number. I won't modify anything outside `audit/` until you do.
