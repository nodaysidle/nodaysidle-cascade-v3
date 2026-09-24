# Phase 2 — Prompt and instruction audit

Scope: every instruction file and embedded prompt from `inventory.md`. Findings marked **[in repo]** are inside this project; **[outside repo]** are user-level files that affect agents here but are not part of the project. Every item was re-checked in Phase 4; status is noted.

No security, legal, or safety rule is removed by any rewrite below. Approval rules (commits, pushes, destructive operations, test changes) are kept word-for-word in intent.

---

## P1. Three identical copies of `CLAUDE.md`, none with project facts [in repo] — verified

- **Files:** `CLAUDE.md` (untracked), `/Volumes/omarchyuser/COMPILER/CLAUDE.md`, `/Volumes/omarchyuser/CLAUDE.md`. `diff` shows they are byte-identical (41 lines each).
- **Text:** the whole file, starting `# Working preferences`.
- **Why it hurts:** Claude Code and Cursor load all three, so the same 41 lines enter context three times. None of them says what this project is, how it is built, what the checks are, or which invariants matter. Sessions show the user re-explaining the app at the start of at least five sessions (session-notes R4).
- **Proposed rewrite:** keep the generic preferences in one place (`/Volumes/omarchyuser/CLAUDE.md`), and replace the project copy with a short project file containing only project facts (see REPORT item 1 for the draft). The COMPILER-level copy can then be removed or reduced to COMPILER-specific notes — your call, since it also covers sibling projects.

## P2. "Use the project's required checks" points at nothing [in repo] — verified

- **File:** `CLAUDE.md:25`
- **Text:** "Use the project's required checks and preserve meaningful coverage."
- **Why it hurts:** no instruction file defines the required checks. The only list is README "Development", and two of those commands currently fail (`cargo fmt --check`, `cargo clippy -D warnings`; see REPORT item 2). An agent cannot tell which checks are required or whether a failure is pre-existing.
- **Proposed rewrite (project file):** "Required checks before reporting code work done: `npm run typecheck`, `npm test`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`."

## P3. Dependency-lookup rule uses boosters and a mandatory ritual [in repo] — verified

- **File:** `CLAUDE.md:18-20`
- **Text:**
  - "**Assume outdated knowledge:** Always assume your existing understanding … is outdated."
  - "**Mandatory lookup before editing:** … Treat "I already know this API" as a trigger to look it up, not a reason to skip. Do this before the first edit, not after a failed check."
  - "Do not use web fetch or web search for dependency-related lookups."
- **Why it hurts:** "Always", "Mandatory", and "Treat … as a trigger" are emphasis boosters. As written, the rule applies to every edit touching any dependency, including trivial ones (bumping a version string, a one-line TypeScript change using a stable API). It also doesn't account for external HTTP APIs that Context7 may not cover: the DeepSeek model rename (`deepseek-v4-flash` → `deepseek-flash`) was found only because the user pasted the DeepSeek news page (AG 2026-09-19). The underlying requirement (check current docs for the pinned version) is legitimate and stays.
- **Proposed rewrite:**
  > Before writing or changing code or config that uses a dependency or external API, check its current docs for the version pinned in `package.json` / `src-tauri/Cargo.toml`: Context7 first; if it has no coverage, fetch the official docs with `curl`. This includes provider APIs (DeepSeek, TypeSafe Jev). Pure Git, filesystem, and repo-internal work needs no lookup.

## P4. Architecture spec is stale in five places, and README points to it [in repo] — verified

- **File:** `docs/superpowers/specs/2026-08-29-cascade-v3-design.md`; README line 196: "Design notes live in [`docs/`](docs/)."
- **Text and current reality:**
  - line 5: "one selected DeepSeek model, and one memory-only key" → there are two keys (DeepSeek + TypeSafe Jev), README line 125.
  - lines 19–33 (runtime flow) omit Jev preflight and Jev integrity; `src/pipeline.ts:41` `ProgressStage` includes `jev-preflight` and `jev-integrity`.
  - line 36: "There is exactly one provider request for each Generate action." → still true for DeepSeek, but Generate also makes Jev requests (`pipeline.ts:265`, `:315`).
  - line 42: "Selectable models: `deepseek-v4-pro` and `deepseek-v4-flash`" → selectable models are `deepseek-flash` and `deepseek-v4-pro` (`src/pipeline.ts:34-37`).
  - line 108: visible stages list omits the Jev stages.
- **Why it hurts:** an agent told to read "design notes" gets a model name that DeepSeek has retired and a flow without Jev, which is the kind of drift that led to past mistakes (session-notes §2).
- **Proposed rewrite:** fix those five statements in place (smallest change), keeping the rest of the spec, which still matches the code (provider body, authority boundaries, export).

## P5. Release README has a stale-by-design line and the wrong folder case [in repo] — verified

- **File:** `scripts/README-hybrid-release.md` (tracked as `Scripts/README-hybrid-release.md`)
- **Text:** line 14 "Existing Latest release is **v3.0.1**. This automation does not republish or replace it…"; lines 9–11 "`Scripts/attach-release-asset.sh`".
- **Why it hurts:** line 14 must be hand-edited on every release (it was, in C3 09-23). Git tracks `Scripts/` and `scripts/` as two folders; on Linux and in CI they are separate, on macOS they merge (REPORT item 4).
- **Proposed rewrite:** drop the version sentence; keep "This automation does not republish or replace an existing release; a new `v*` tag is required." Reference `scripts/attach-release-asset.sh` once the folder case is fixed.

## P6. README describes the live probe as end-to-end; it isn't [in repo] — verified

- **File:** `README.md:140`
- **Text:** "Runs an authenticated end-to-end generate against the DeepSeek API and reports whether the packet reached Gate Clean."
- **Why it hurts:** `tests/live-provider-probe.test.ts` builds its own request with `fetch` (lines 10–91) instead of the Rust provider, never passes a Jev provider (so Jev stages are skipped), and can only select `deepseek-v4-flash` or `deepseek-v4-pro` (line 105), not the current `deepseek-flash`. In C1 (2026-08-31) this probe passed while the GUI failed.
- **Proposed rewrite:** "Runs one authenticated DeepSeek request through the TypeScript pipeline (no Rust provider, no Jev) and reports whether local compilation reached Gate Clean. Set `CASCADE_MODEL=deepseek-flash` or `deepseek-v4-pro`." Plus the code fix in REPORT item 5.

## P7. Embedded provider prompt: user idea is in the system channel; minor boosters [in repo] — verified, low priority

- **File:** `src/schema.ts:269-281` (`buildBlueprintInstructions`); `src/pipeline.ts:206`.
- **Text:** instructions end with `` `Software idea: ${input.idea.trim()}` ``; `input` is the fixed string "Return the compact semantic JSON value for the supplied software idea."; line 276 "Never use subjective or hyperbolic phrases…"; line 277 "Never write 'documented defaults'…"; line 275 "Define features strictly as…".
- **Why it hurts:** the idea (up to 32,000 chars, can be pasted text) is given system-level authority; injected text in the idea could compete with the rules above it. Impact is limited by the strict JSON schema and local audits (shell-injection gate exists: `src/audit.ts:63`). The "Never" lines are concrete and testable, so they are not harmful boosters.
- **Proposed change:** none now. Moving the idea into `input` is a model-behavior change that needs live A/B probing, and `src/smoke.ts:38` depends on the current layout. Listed in REPORT as deferred.

## P8. No few-shot examples, no scratchpad rituals in project prompts — verified

Nothing to fix. Jev noul questions (`src/jev.ts:267-330`) are single-sentence and specific.

---

## Outside-repo instruction files (reported, not proposed for this project's changes)

### P9. User-level Cursor rules carry the boosters that were removed from Claude's copy [outside repo] — verified in files; loading unconfirmed

- **Files:** `~/.cursor/rules/front-end-cursor-rules.mdc:5,8,9` ("…are a genius at reasoning", "First think step-by-step - describe your plan … in pseudocode, written out in great detail.", "Confirm, then write code!"), all `alwaysApply: true`. CL1 (2026-09-24) removed exactly these lines from `~/.claude/CLAUDE.md` but not from this Cursor copy.
- `~/.cursor/rules/graphify.mdc:6` "This project has a graphify knowledge graph at graphify-out/." — `alwaysApply: true`; this repo has no `graphify-out/`.
- Three of the five always-apply rules are Next.js/React personas; this project uses neither.
- These rules did not appear in this session's injected context, so Cursor may not load this folder. If it does, "Confirm, then write code!" contradicts the project `CLAUDE.md:31` ("Proceed with reversible local work within the requested scope").

### P10. Superpowers session hook uses heavy emphasis [outside repo]

- Hook text injected into Cursor sessions: "EXTREMELY_IMPORTANT", "If you think there is even a 1% chance a skill might apply … YOU DO NOT HAVE A CHOICE. YOU MUST USE IT."
- Conflicts in spirit with `CLAUDE.md:27` ("Keep small tasks local") and the Cursor user rule ("Be concise…"). The hook's own text says user instructions take precedence, so behavior is recoverable, but it adds noise to every session.

### P11. Cross-tool preferences live in tool-specific places [outside repo]

- "Push when I say git push" exists only in Claude Code project memory (`~/.claude/projects/…/memory/git-push-on-request.md`).
- "Blocked on me / Changed / Found" long-run report format exists only in `~/.claude/CLAUDE.md:290`.
- The user works on this repo in Cursor, Claude Code, Antigravity, and OpenCode (inventory §4). Preferences recorded in one tool don't reach the others. No contradiction found: the push memory is consistent with `CLAUDE.md:31` ("existing explicit approval for that action is sufficient").
