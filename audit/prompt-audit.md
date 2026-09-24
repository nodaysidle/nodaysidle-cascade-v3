# Phase 2 — Prompt and instruction audit (round 2)

Round-1 findings P1–P11 are in `audit/round-1/prompt-audit.md`. P1, P2, P4, P5, and P6 were fixed in `af6d430`. P3, P9, P10, and P11 were deferred to you and are re-listed here only where they still apply. Every item below was re-checked against the current files (Phase 4).

No security, safety, or product requirement is removed by any rewrite. Rewrites fix accuracy or remove duplication.

---

## In the repo

### Q1. `AGENTS.md` says nothing is inferred from wording, but the compiler still does it — verified

- **File:** `AGENTS.md:34-35`
- **Text:** "Nothing is inferred from wording. Don't add regexes that guess links or placement from feature prose."
- **Reality:** `src/compiler.ts` still reads prose in several places:
  - `:366-367` picks recovery text from failure wording ("exits", "falls back").
  - `:372` places temporary files when the text says "temporary" and "renam…".
  - `:407-408` detects an Astro content site from words like "catalog", "portfolio", "direct url".
  - `:776-779` rewrites save behavior when the blueprint says "atomically".

  Round 1's changelog already listed two of these as deferred.
- **Why it hurts:** an agent that trusts the file will misdiagnose a packet defect caused by these heuristics, or be told a rule that the code itself breaks. The user has repeatedly traced defects to wording heuristics (round-1 session notes §5).
- **Proposed rewrite:**
  > Links between features and data, services, or platform needs come only from the declared fields; they are never inferred from wording. A few older wording heuristics still exist in `src/compiler.ts` (recovery text from failure wording, temporary-file placement, atomic-write wording, Astro content-site detection). Don't add new ones; when one of them causes a defect, replace it with a declared field.

### Q2. Docs describe Jev integrity as a stack-leakage gate only — verified

- **Files and text:**
  - `USERGUIDE.md:12` "Jev may only append missing platform needs … or block a foreign-stack conflict."
  - `USERGUIDE.md:18` "**Integrity blocked** — the blueprint contains instructions for a stack that conflicts with the selected preset".
  - `README.md:55` "…platform-needs, and stack-leakage judgments".
  - `README.md:74` "…heals missing platform needs, and blocks foreign-stack leakage".
  - `README.md:175` "Jev platform-needs healing + stack-leakage integrity gate".
  - Spec `:26` "Jev platform-need healing and stack-leakage integrity gate".
- **Reality:** `src/pipeline.ts:327-334` also returns `blueprint-integrity-failed` when Jev scores any feature's acceptance signals below `JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD` (0.65, `src/jev.ts:26`).
- **Why it hurts:** this is the exact confusion from 12:51 today. The UI said "technology-stack conflict" when two features had failed verifiability. The uncommitted `src/app.ts` change fixes the UI text, but the guide still gives the wrong remedy ("revise the idea or preset").
- **Proposed rewrite (USERGUIDE:18):**
  > **Integrity blocked** — Jev found either a technology-stack conflict or features whose acceptance signals automated tests can't check. The headline says which; Technical details lists the fields. Retry, or describe those features as checkable outcomes.

  Make matching one-phrase additions ("…and untestable acceptance signals") to `USERGUIDE:12`, `README:55,74,175`, and spec `:26`.

### Q3. The live probe defaults to a different model than the app — verified

- **Files:** `tests/live-provider-probe.test.ts:6` (`?? "deepseek-v4-pro"`), `README.md:140` "(default `deepseek-v4-pro`)", and `src/state.ts:43` (app default `deepseek-flash`). `AGENTS.md:47` says `deepseek-flash (default)`.
- **Why it hurts:** at 09:38 the agent told you "The app's default is `deepseek-v4-pro`", which is wrong; it mixed up the two defaults. The probe also costs more by default than the app's own default.
- **Proposed change:** make the probe default `deepseek-flash` and update README:140. This is a one-token change to an existing test file, so it needs your approval.

### Q4. The new provider rule's examples come from today's test idea — verified (uncommitted, your change)

- **File:** `src/schema.ts:297` (uncommitted).
- **Text:** "…'a notification request containing the item name is scheduled for the due date minus 3 days', 'after the main window closes the process keeps running and the tray menu lists Open and Quit'…"
- **Why it may hurt:** both examples are the subscription-tracker idea from 12:51 ("3 days before each renewal", "tray icon"). `AGENTS.md:42-43` forbids logic that exists because one test idea needed it. This is example wording, not logic, but a model at `temperature 0` tends to copy concrete numbers from examples. The rule itself is sound and generic.
- **Proposed rewrite of the examples:**
  > 'a notification request with the item's title is scheduled at the configured time', 'after the main window closes the process keeps running and the tray menu lists its actions', or 'when microphone permission is denied the record control is disabled and the denial message is shown'.

  `tests/status-detail.test.ts` asserts only the phrase "request the app makes or the app state a test can read", so it keeps passing.

### Q5. README tells you to put the key on the command line — verified

- **File:** `README.md:137` `DEEPSEEK_API_KEY=your_key npm run probe:live`
- **Why it hurts:** this form writes the key into shell history. It happened today: 09:38, and the key is still in `~/.local/share/fish/fish_history`; see session notes N1. It conflicts with the product's own rule that keys are never persisted (`AGENTS.md:46`).
- **Proposed rewrite (fish syntax, the user's shell, plus a zsh/bash line):**
  ```sh
  # fish
  read -s -P 'DeepSeek key: ' -x DEEPSEEK_API_KEY; npm run probe:live; set -e DEEPSEEK_API_KEY
  # zsh / bash
  read -rs 'DEEPSEEK_API_KEY?DeepSeek key: '; export DEEPSEEK_API_KEY; npm run probe:live; unset DEEPSEEK_API_KEY
  ```
  I'll check `read` flags in fish and zsh docs before editing (bash uses `read -rsp`, so the README will list the zsh form and note the bash difference).

### Q6. No findings in the other embedded prompts

`src/jev.ts` noul questions are single, specific sentences. There are no few-shot examples and no scratchpad rituals. Round-1 P7 (the idea sits in the system `instructions`) stays deferred because it needs paid A/B probing.

---

## Outside the repo (these load for agents here; changing them needs your approval)

### Q7. The Obsidian project note that agents must read first is wrong in seven places — verified

- **Rule that forces the read:** `~/.claude/CLAUDE.md:32-34`: "For tasks involving … the `nodaysidle` GitHub account: First read … `Unified-Index.md`, the matching note under `20-Projects/`…"
- **Note:** `~/Documents/codex-obsidian/20-Projects/nodaysidle-cascade.md`:
  1. "DeepSeek-only live generation uses `deepseek-v4-flash`" → retired alias; the default is `deepseek-flash`.
  2. "one-repair compilation", "at most one same-schema repair" → `AGENTS.md:46`: "no provider retry or repair".
  3. "Known Deepgram Nova-3 … OpenRouter … provider IDs expand only from a local immutable registry" → removed in `8dfd82c` and `af6d430`.
  4. "DeepSeek Flash + OpenRouter Jev" → Jev calls `https://api.typesafe.ai/v1/systemone` (`src-tauri/src/jev.rs:9`).
  5. `github_repos: []` → the repo is `nodaysidle/nodaysidle-cascade-v3`. `Unified-Index.md:53` maps the note to the V1 path `/Volumes/omarchyuser/nodaysidle-cascade` with "active GitHub mapping not confirmed".
  6. "Remaining gap: None … fully proven and closed. Status promoted to `complete`" → you doubted the 10/10 claim (Antigravity, 09-21), and a run was blocked today at 12:51.
  7. "Export can overwrite only the five canonical filenames after an explicit collision warning" → current export writes to a new folder with `RENAME_EXCL`, so it never overwrites.
- **Why it hurts:** this note re-seeds the facts you had to correct by hand ("fix the compiler", the model name, removing the vendors). It is the one context file an agent must read before anything else. The note drifts because most work here happens in Cursor and Antigravity, and those tools don't load the rule that says to update it.
- **Proposed rewrite:** replace the "Fixed constraints", "Remaining gap", and frontmatter with a short note that points to `AGENTS.md` as the source of truth. Set `github_repos: [nodaysidle/nodaysidle-cascade-v3]`, `status: active`, and fix `Unified-Index.md:53`. Keep the milestone history but mark it "historical (V1 and pre-3.0.1)".

### Q8. Two identical parent `CLAUDE.md` files load in every session (round-1 P1 remainder) — verified

- `/Volumes/omarchyuser/CLAUDE.md` and `/Volumes/omarchyuser/COMPILER/CLAUDE.md` are byte-identical (36 lines, `cmp` clean), and both appear in this session's context.
- **Proposed change:** delete the COMPILER copy, since the parent one already covers it. This affects sibling projects under `COMPILER/`, which still get the same text from the parent.

### Q9. Delegation rules contradict each other — verified

- `~/.claude/CLAUDE.md:207` "Use subagents only when the user explicitly requests subagents, delegation, or parallel agent work."
- `/Volumes/omarchyuser/CLAUDE.md:27` "Delegate when substantial, independent work justifies the overhead. Keep small tasks local; create review subagents only when the user requests them."
- **Why it hurts:** an agent can't tell whether it may delegate without being asked, and both files load together.
- **Proposed rewrite:** pick one. The project-level one is the more recent choice: "Delegate when substantial, independent work justifies it; keep small tasks local; create review subagents only on request." Remove `:207` from the global file, or make it say the same.

### Q10. Dependency-lookup ritual (round-1 P3) — still present, verified

- `/Volumes/omarchyuser/CLAUDE.md:18-20` "**Assume outdated knowledge:** Always assume…", "**Mandatory lookup before editing:** … Treat "I already know this API" as a trigger…"
- Round-1 rewrite still applies. It keeps the lookup requirement, drops the boosters, and names DeepSeek and TypeSafe Jev as APIs to check.

### Q11. The global front-end persona contradicts this repo's code style — verified

- `~/.claude/CLAUDE.md:452` "Always use Tailwind classes for styling HTML elements; avoid using CSS or tags." → this repo has no Tailwind; it uses `src/style.css`.
- `:456` "Use consts instead of functions" → the repo uses `function` declarations throughout (`src/app.ts:62,74,78,82,232`). Today's uncommitted `statusDetailText` correctly followed the repo, not this rule.
- `:453,455` "Use “class:” …", "on:click" → Svelte syntax; no Svelte in the workspace atlas.
- `:307-425` (≈120 lines) "Repository Atlas: 70+ projects" loads into every session in every repo.
- **Why it hurts:** agents in this repo have to ignore about 160 lines of global instruction on every turn. A less careful agent will follow "Use consts instead of functions" and add style churn.
- **Proposed change:** move the persona (`:427-469`) into the React/Next projects' own `CLAUDE.md` files, or scope it with a first line: "Applies only to React/Next.js/Tailwind projects." Move the atlas to a file that is referenced but not imported (for example `/Volumes/omarchyuser/WORKSPACE_OVERVIEW.md`, which the atlas already names).

### Q12. Obsidian "state three headings" ritual — verified

- `~/.claude/CLAUDE.md:35` "Before execution, state `Static context reused`, `Dynamic information newly read`, and `Content not reread`."
- This is a fixed preamble ritual on every task that touches `nodaysidle` GitHub, including one-line fixes. It adds output without changing behavior.
- **Proposed rewrite:** "Reuse the project note's static context; re-read current branch, status, and changed files when they can affect the task. Mention stale note facts you found." This keeps the requirement and drops the ritual.

### Q13. Cursor user rules (round-1 P9) — unchanged, still deferred to you

`~/.cursor/rules/front-end-cursor-rules.mdc:9` "Confirm, then write code!" (`alwaysApply: true`), `graphify.mdc:6` claims a `graphify-out/` that this repo lacks. No new evidence; listed so the next audit doesn't lose it.
