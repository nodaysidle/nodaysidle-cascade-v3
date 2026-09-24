# Cascade V3 — Friction audit report (round 2)

**Executive summary**

1. Round 1 worked. Every one of its ten applied items still holds, all five checks pass, and none of round 1's recurring requests (install, leftovers, "fix the compiler", re-explaining the app) came up again in today's later sessions.
2. The most urgent item is security. The live DeepSeek key pasted at 09:38 is still in your fish history and a Cursor transcript. The cleanup advice targeted zsh, and the README teaches the inline-key form that caused it.
3. The biggest context problem left is outside the repo. The Obsidian note that Claude and Codex must read first still says `deepseek-v4-flash`, "one repair", OpenRouter Jev, Deepgram, and "complete, no gaps".
4. The repo's own docs say Jev integrity only blocks stack conflicts. That caused today's 12:51 confusion, and `AGENTS.md` wrongly says the compiler no longer reads wording, while five heuristics remain.
5. Global instructions still contradict each other and this repo: delegation rules, "use consts instead of functions", Tailwind, a 120-line workspace atlas, and a duplicate parent `CLAUDE.md`. Cleaning them up helps every repo, but it's your call.

Supporting files: `inventory.md`, `prompt-audit.md` (Q1–Q13), and `session-notes.md` (N1–N6). Round 1 is preserved in `audit/round-1/`.

## Checks run (Phase 4, 2026-09-24 13:37, on the current tree including your uncommitted changes)

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm test` | 20 files passed, 1 skipped (live probe); 219 tests passed, 1 skipped |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | pass |
| `cargo clippy … --all-targets --all-features -- -D warnings` | pass (target dir in `/private/tmp`) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | 36 passed, 0 failed |

Outside `audit/`, nothing was modified. The only new directory is `audit/round-1/`, a copy of round 1. Your uncommitted `src/app.ts`, `src/schema.ts`, and `tests/status-detail.test.ts` are untouched.

---

## Ranked findings (quick wins first)

### 1. Remove the leaked DeepSeek key and stop the README from teaching the leak — high impact, very low effort

- **Problem and evidence:** session-notes N1. The key appears once in `~/.local/share/fish/fish_history` and once in `~/.cursor/projects/…/9c514138…jsonl`. I counted matches and printed nothing. The 09:38 advice said to clear `~/.zsh_history`, which has 0 matches, because your shell is fish. `README.md:137` shows `DEEPSEEK_API_KEY=your_key npm run probe:live`, which writes the key to history.
- **Proposed change:**
  - (a) **You:** revoke the key in the DeepSeek console if you haven't yet. Only you can do that.
  - (b) **Me:** delete that one entry with fish's own `history delete --exact --case-sensitive` (the entry is matched in a script and never printed), then replace the key in the Cursor transcript line with `sk-***` using an in-place `sed`, keeping a `.bak` copy in the scratchpad that I delete after checking.
  - (c) **Me:** rewrite `README.md:137-140` to read the key with a hidden prompt (fish and zsh forms, prompt-audit Q5). I'll check `read` flags in the fish and zsh docs first.
- **Affects:** two files outside the repo (history, transcript) and `README.md`.
- **Test:** both `grep -c 'DEEPSEEK_API_KEY=sk-[A-Za-z0-9]'` counts return 0. Run the new README fish line with a dummy key and confirm the key is not in `fish_history` afterwards, and the probe skips or fails cleanly.

### 2. Make the docs say what Jev integrity actually blocks — high impact, very low effort

- **Problem and evidence:** prompt-audit Q2. `USERGUIDE.md:12,18`, `README.md:55,74,175`, and spec `:26` all describe a stack-conflict-only gate, but `src/pipeline.ts:327-334` also blocks on per-feature acceptance verifiability. That is the 12:51 incident, and `USERGUIDE:18` still gives the wrong remedy.
- **Proposed change:** the USERGUIDE:18 rewrite in Q2, plus one-phrase additions in the other five places. Docs only.
- **Affects:** `USERGUIDE.md`, `README.md`, and the spec.
- **Test:** `rg -n 'stack-leakage integrity gate|blocks foreign-stack leakage\b' README.md USERGUIDE.md docs` should show only the updated phrases, and I'll check each sentence against `src/pipeline.ts:327-334`.

### 3. Make `AGENTS.md` accurate about the remaining wording heuristics — medium-high impact, very low effort

- **Problem and evidence:** prompt-audit Q1. `AGENTS.md:34-35` says "Nothing is inferred from wording". `src/compiler.ts:366-367, 372, 407-408, 776-779` still read prose.
- **Proposed change:** the Q1 rewrite. It names the heuristics, forbids new ones, and says to replace one with a declared field when it causes a defect.
- **Affects:** `AGENTS.md`, and so every agent session here.
- **Test:** every heuristic named in the new text still matches its line (`rg -n` each pattern). In a fresh agent session, ask "does the compiler infer anything from feature wording?"; it should name those areas without reading source.

### 4. Rewrite the Obsidian project note — high impact, low effort (outside repo)

- **Problem and evidence:** prompt-audit Q7 lists seven wrong facts, and session-notes N6 explains why it drifts. `~/.claude/CLAUDE.md:32-34` makes it the first file an agent reads for any `nodaysidle` GitHub task.
- **Proposed change:** in `20-Projects/nodaysidle-cascade.md`:
  - Set the frontmatter to `status: active`, `github_repos: [nodaysidle/nodaysidle-cascade-v3]`, and `local_paths` with the V3 path first.
  - Replace "Fixed constraints" with 5 lines that match `AGENTS.md` and point to it as the source of truth.
  - Replace "Remaining gap: None" with the open items from this report.
  - Label the milestones "historical (V1 and pre-3.0.1)" and leave them otherwise untouched.
  - Fix `Unified-Index.md:53` to the V3 path and repo.
- **Affects:** two vault files. No secrets go in.
- **Test:** `rg -n 'deepseek-v4-flash|one-repair|OpenRouter Jev|Remaining gap' 20-Projects/nodaysidle-cascade.md` returns only lines marked historical. Also check the frontmatter parses (`python3 -c 'import yaml'` if available, otherwise a visual check).

### 5. Neutralize the test-idea examples in your new provider rule — medium impact, very low effort (your uncommitted change)

- **Problem and evidence:** prompt-audit Q4. `src/schema.ts:297` uses "due date minus 3 days" and "tray menu lists Open and Quit", both from the 12:51 subscription idea. `AGENTS.md:42-43` warns against exactly this kind of carry-over.
- **Proposed change:** replace the two examples with the neutral wording in Q4 and keep the rule itself.
- **Affects:** the DeepSeek instructions for every preset.
- **Test:** `npm run typecheck && npm test`. `tests/status-detail.test.ts:30` asserts only the generic phrase, so it still passes. `rg -n '3 days|Open and Quit' src` returns nothing.

### 6. Align the live probe's default model with the app — low-medium impact, very low effort (edits an existing test)

- **Problem and evidence:** prompt-audit Q3 and session-notes N4. The probe defaults to `deepseek-v4-pro` while the app defaults to `deepseek-flash`, and the agent confused the two at 09:38.
- **Proposed change:** `tests/live-provider-probe.test.ts:6` default becomes `"deepseek-flash"`, and `README.md:140` says "(default `deepseek-flash`)". No assertion changes.
- **Test:** `npm test` still skips the probe without a key. A paid run is optional, in your terminal, using the item-1 README form.

### 7. Give the Jev mock server realistic time limits — low-medium impact, low effort (edits an existing test)

- **Problem and evidence:** round-1 observation. It's still present at `src-tauri/tests/jev_boundary.rs:21,65,77,93` (500/700/250/500 ms). Two tests failed once locally after a heavy compile. CI has passed once on shared runners, where a flake would block PRs.
- **Proposed change:** raise the mock server's total and idle deadlines and the test client's timeouts to 3000 ms. Leave the assertions on the real Jev timeouts (5 s / 15 s) and the cancellation assertion at `:491` unchanged.
- **Test:** `cargo test --manifest-path src-tauri/Cargo.toml` passes 5 times in a row, including once while a parallel `cargo build --release` runs (target dir in `/private/tmp`). Suite time should grow by under 2 s.

### 8. Clean up global instruction conflicts — high impact across all repos, medium effort (outside repo, your decision per sub-item)

- **Problem and evidence:** prompt-audit Q8–Q12.
- **Proposed change,** pick any:
  - (a) Delete `/Volumes/omarchyuser/COMPILER/CLAUDE.md`. It's byte-identical to the parent file, so sibling projects keep the same rules.
  - (b) Resolve the delegation contradiction (`~/.claude/CLAUDE.md:207` vs `/Volumes/omarchyuser/CLAUDE.md:27`) in favor of the project-level wording.
  - (c) Apply the round-1 P3 rewrite of the Context7 rule. It keeps the lookup requirement and drops the boosters.
  - (d) Scope the React/Tailwind persona (`~/.claude/CLAUDE.md:427-469`) to web projects, and move the 120-line atlas (`:307-425`) into a referenced file.
  - (e) Replace the "state three headings" ritual (`:35`) with the Q12 wording.
- I'll back up each file to a timestamped folder outside the repo before editing.
- **Affects:** every Claude Code session on this machine.
- **Test:** `cmp` and `rg` checks that the removed text is gone and the kept rules (git safety, secrets, approvals, checks) are still present word for word. Then open a fresh session in this repo and in one React project, and confirm each gets the rules meant for it (ask "which style rules apply here?").

### 9. Replace the remaining wording heuristics with declared fields — high impact, high effort (behavior change; needs your decision)

- **Problem and evidence:** prompt-audit Q1. There are five heuristics in `src/compiler.ts`, plus the Astro content-site check at `:407-408`. This is the recurring defect class from round 1 §5.
- **Proposed change:** add explicit blueprint fields: a failure `recovery` kind, a data object `writeMode: atomic | direct`, and a site `kind: content | app`. Map them per preset, then delete the regexes. It changes the provider schema, so it's one more schema-strict-mode risk to verify with one live probe.
- **Affects:** `src/schema.ts`, `src/compiler.ts`, fixtures, and the provider schema.
- **Test:** full checks, new matrix cases in `tests/idea-preset-matrix.test.ts` where different wording must produce identical output, and one paid probe on `deepseek-flash`.

---

## Needs your decision (not proposed as changes)

- **Jev block recovery (session-notes N3):** keep "no provider retry or repair" as is (recommended; it's a stated product requirement) and rely on manual Retry plus item 5's prompt rule. Or relax the rule to allow one targeted reword, which is a product change. Your rerun result will show whether the prompt rule is enough.
- **Committing your uncommitted fix:** after items 2 and 5, the headline fix, prompt rule, and new test form one coherent commit. I'll commit or push only when you say so.
- **Carried over from round 1:** the sibling backups (~2.1 GB), the Cursor user rules (Q13), and moving the idea into the provider `input`.

## Historical observations resolved or dropped

- All round-1 items applied in `af6d430`: `AGENTS.md`, Rust checks, install script, `Scripts/` casing, stale spec, probe model list, CI, idea matrix, voice logic removal, and the bump script. Verified by the checks table and `rg` (no voice, dictation, or Deepgram logic left in `src/`).
- The misleading integrity headline is fixed in your uncommitted `src/app.ts`, with tests.
- `minLength` in strict mode: the live probe passed on `deepseek-flash` at 09:38. Dropped.
- The preset recommendation leaning native (N5) is one data point, advisory only. Dropped until there's more evidence.

---

**Stopping here.** Tell me which items to apply, by number (and sub-letter for items 1 and 8). I won't modify anything outside `audit/` until you do.
