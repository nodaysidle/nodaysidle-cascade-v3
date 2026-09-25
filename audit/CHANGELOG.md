# Audit changelog

## Fourth GUI packet audit (2026-09-25)

Packet `/Volumes/omarchyuser/projekti/renewalradar` (03:58): compiler-owned parts all correct. Provider
gaps: trials counted in totals (the idea is silent on it), no feature to set the home currency, CSV
import "replaces or merges", and a notification check "at least once per day". Replaying the Jev
idea review on these features gave 0.79-0.97 faithful, so nothing was flagged; it stays advisory.
Added a provider rule: one decided behavior per rule (user-facing options are fine), and every
scheduled or repeated action gets an exact time or interval plus a duplicate guard. The user was
advised to state the trial and home-currency rules in the idea.

## Jev idea review (2026-09-25)

Added at the user's request after the third packet audit. The Jev atomic audit now receives the idea
and asks, per feature, a three-level choice (faithful, questionable, wrong); the bridge keeps the
option probabilities for that question only. Features with P(faithful) below 0.65 are listed in the
status line and Technical details at Gate Clean. It does not block export: calibration against Jev
jev-1.13 on the renewal-tracker cases gave wrong features 0.56 and 0.62 but also correct features
0.48 and 0.60, so a blocking gate would stop correct paid runs. The review list is not written into
the five documents.

## Round 2, third GUI packet audit (2026-09-25)

Packet `/Volumes/omarchyuser/projekti/renewalradar` (02:22) confirmed the scope fixes: no invented
About or not-found feature, no launch-at-login, notifications no longer own the tray check, recovery
kinds correct on all 11 features. Fixed with a test:

- A one-word service name ("ExchangeRateAPI") still produced "ExchangeRateAPI API key"; the label
  now also recognizes a trailing uppercase API.
- `pascal()` flattened camelCase ("ExchangerateapiIntegration", module "Renewalradar"); it now
  splits camelCase and acronym boundaries first. IDs, slugs, and bundle IDs are unchanged.

Not changed (user decision): provider content errors in that packet (trials counted in totals before
conversion, zero totals when no rates are cached, a retry action on the empty list). A Jev check of
each feature against the idea was proposed and deferred.

## Round 2, second GUI packet audit (2026-09-25)

Packet `/Volumes/omarchyuser/projekti/renewalwatch` confirmed the previous fixes (recovery kinds,
JSON settings, SQLite transactions, separate background execution, credential wording). It showed
three provider-content problems, fixed in the provider instructions with tests:

- Acceptance examples in the OS-feature rule were copied verbatim into the wrong feature
  (notifications owned a tray check built three phases later). The examples are removed, and a
  rule now says each acceptance signal checks only its own feature.
- The `surface` rule invited an invented About feature with a desktop "not-found page". Surface now
  defaults to main, special values apply only when the idea asks for that page, and features must
  never be added to fill a surface.
- "Include every applicable platform need" invited an unrequested launch-at-login setting (seen in
  two runs). Replaced with: list a need only when a stated feature uses it, and add no features,
  settings, or needs the idea does not ask for. `tests/schema.test.ts` now pins the new wording.

## Round 2, GUI packet audit fixes (2026-09-24, evening)

A live GUI run (subscription tracker, Tauri) exposed defects one stage at a time; each was fixed in
the compiler with a regression test: unused temporary atomic copy (`518e54e`), Jev per-feature
question judged OS features by name (`ec7aeaf`, measured against Jev jev-1.13), `<date>` format
tokens failing the export gate (`a157f89`). The packet then exported to
`/Volumes/omarchyuser/projekti/renewalradar` and its audit found, now fixed:

- Settings on Tauri, Astro, and Android used the records store; they now use the preset's
  settings placement (Tauri: atomic JSON).
- The atomic write rule said "rename a temporary file" for SQLite; SQLite now gets a transaction
  rule, files keep the rename rule, and stores that are atomic per value get none.
- `background-execution` (keep running after the window closes) now has its own capability and
  per-preset decision (Tauri `prevent_exit`, AppKit `applicationShouldTerminateAfterLastWindowClosed`)
  instead of the launch-at-login autostart contract.
- `failureRecovery` instruction: fallback only when the failure names what the app switches to;
  rejections and errors are retry.
- Wording: "Keychain" removed from preset-neutral credential recovery, "X API API key" fixed, and
  the optional streaming clauses removed from the Swift and Tauri integration instructions.

Not changed: phase order within ready owners stays alphabetical by owner ID. Ordering by the
blueprint's feature order broke the existing invariant that reversing the provider's feature order
yields the same packet (`tests/graph-construction.test.ts`); the invariant was kept.

## Round 2, follow-up (2026-09-24, 14:10–14:40)

Committed as `5511d19` together with round 2; not pushed. The app was rebuilt and installed with
`npm run install:app -- --clean` (binary 14:28, codesign verified, launches).

- **Astro palette:** dark-first Void Black (`#0B0F14`) is the default; it switches to light-first only
  when the summary, quality requirements, or constraints explicitly ask for a light palette, theme,
  or mode. Test in `tests/astro-markdown-quality.test.ts`.
- **Item 7, Jev boundary test flake — root cause fixed:** on macOS an accepted socket inherits the
  listener's nonblocking mode, so the mock's first `read` returned `WouldBlock` and it answered
  before the request arrived (hyper `UnexpectedMessage` → `transport`). The mock now switches the
  stream to blocking, reads the full request (headers + content-length body), and waits up to 3 s
  for the first connection. The original file failed 2/30 idle and 5/10 under a parallel release
  build; the fix passed 40/40 idle and 15/15 under load. Suite time unchanged (0.76 s).
- **Item 1, key cleanup:** README probe now reads the key at a hidden prompt (fish and zsh forms
  tested with a dummy value). The leaked entry was deleted from fish history with `history delete`
  and replaced with `sk-***` in Cursor transcript `9c514138…`; both now have 0 matches. Rotation
  is still yours.
- **Item 8, global instructions** (outside the repo; backups in
  `/Volumes/omarchyuser/COMPILER/audit-backups/global-instructions-*`): deleted the duplicate
  `COMPILER/CLAUDE.md`; delegation rule aligned; Context7 rule rewritten without boosters (same
  requirement); Obsidian three-heading ritual replaced; workspace atlas moved verbatim to
  `~/.claude/workspace-atlas.md` with a short pointer; React/Tailwind persona scoped to React,
  Next.js, and Tailwind projects; commit guidelines kept global. Git-safety, secret, deploy, test,
  and approval rules verified unchanged.

### Still open

- The live probe of the new provider schema needs your key (README form).
- Key-shaped strings (`sk-` + 32 or more characters) remain in about 20 other agent logs (Cursor
  projects for hermes and prd-compiler-v2-lab, Cursor `aaaa67af` for this repo, and Antigravity
  `brain/*` transcripts). Not touched: out of scope, and some may be other keys or test values.
  Rotating the affected keys is the fix.
- `src-tauri/src/lib.rs` `delayed_server` unit-test helper still starts its hold window at spawn
  (same pattern as the old Jev mock, but it never answers, so it can't hit the race above).
- A fresh-session check that the scoped persona no longer applies here was not run.

## Round 2 (2026-09-24, afternoon)

Nothing is committed or pushed, and the app in `/Applications` was not rebuilt. Final checks:
`npm run typecheck` clean; `npm test` 222 passed, 1 skipped (live probe, no key); `cargo fmt
--check` clean; `cargo clippy -D warnings` clean; `cargo test` 36 passed; `git diff --check` clean.

### Changed (approved items 2, 3, 4, 5, 6, plus the compiler repair)

- **Item 2: Jev integrity docs.** `USERGUIDE.md`, `README.md`, and the spec now say the integrity
  gate blocks stack conflicts and untestable acceptance signals; the USERGUIDE remedy is "retry, or
  describe those features as checkable outcomes".
- **Item 5: provider rule examples.** `src/schema.ts` OS-feature rule no longer uses the
  subscription test idea ("3 days", "Open and Quit").
- **Item 6: deepseek-flash everywhere by default.** Live probe default and README are
  `deepseek-flash`; the fixture smoke run (`src/smoke.ts`) alternates `deepseek-flash` and
  `deepseek-v4-pro` instead of the retired alias. The alias stays accepted for compatibility.
- **Compiler repair (report item 9): declared fields replace every remaining wording heuristic.**
  - Feature `failureRecovery` (retry, fallback, exit) replaces the failure-wording regex.
  - Feature `surface` (main, item-page, about-page, not-found-page) replaces the Astro
    catalog/detail/about/404 patterns; the content collection is named after the declared public
    data object (for example "Project catalog entry" → `project-catalog-entry`), not guessed.
  - Data object `writeMode` (direct, atomic-replace) replaces the "atomically"/"temporary…rename"
    regexes. The atomic rule is now a `Write mode:` detail on the data's persistence contract, so
    a feature that only reads the file no longer gets a write sentence.
  - Found and fixed while doing this: the no-meaningful-feature intake gate read enum values as
    prose, so a placeholder-only feature could pass once any enum was set. It now checks prose
    fields only (`featureProse` in `src/schema.ts`).
  - Tests: fixtures declare the new fields; three assertions moved from feature prose to the
    persistence contract; the docs-portal fixture declares a `Guides` data object and an item-page
    feature; three new tests in `tests/feature-references.test.ts` prove wording no longer decides
    recovery, write mode, or routes.
- **Item 3: `AGENTS.md`.** Documents the new declared fields, states that links, placement,
  recovery, and routes are never inferred from wording, names the one remaining design regex
  (Astro "dark-first" palette in `src/renderers.ts`), and requires one live probe after any provider
  schema or instruction change.
- **Item 4: Obsidian note** (outside the repo). `20-Projects/nodaysidle-cascade.md` now has
  current facts pointing to `AGENTS.md`, `status: active`, the GitHub repo, and open items; old
  milestones are kept under "Historical" headings. `Unified-Index.md` row points to V3. Backups:
  `/Volumes/omarchyuser/COMPILER/audit-backups/obsidian-20260924T1400*/`.
- Round-1 audit files are preserved unchanged in `audit/round-1/`.

### Not done, and why

- **Item 1 (leaked key cleanup, README hidden-prompt form):** not approved. The key is still in
  `~/.local/share/fish/fish_history` and the Cursor transcript; rotation is unverified.
- **Items 7 and 8** (Jev mock-server timing, global instruction cleanup): not approved.
- **Live probe of the new schema:** the provider schema gained three required enum fields. Tests
  cover parsing and compiling, but only a paid request shows whether DeepSeek fills them well.
- **Reinstall:** `/Applications/NODAYSIDLE Cascade V3.app` is the 13:19 build and does not have
  these changes. `npm run install:app -- --clean` when you want it.

## Round 1 (2026-09-24, morning)

Nothing here is committed or pushed. Checks at the end: `npm run typecheck` clean, `npm test`
215 passed / 1 skipped (live probe, no key), `cargo fmt --check` clean, `cargo clippy -D warnings`
clean, `cargo test` 36 passed. The installed app in `/Applications` was replaced with a build of
this working tree through `npm run install:app -- --clean`.

## Changed

- **Item 9: hardcoded voice-app logic removed.** Voice persistence, dictation insertion, paste
  workflow, the fixed microphone copy, the voice audit rule, and `TranscriptionRoutingSchema` are
  gone. Credential services now get a generic "Credential entry" contract line (masked settings
  field on apps, server environment variable on Astro). Voice-only test suites and fixtures were
  deleted with your approval.
- **Item 8: idea × preset matrix.** `tests/idea-preset-matrix.test.ts` compiles 10 generic ideas
  across all 5 presets and checks invariants (gate clean, determinism, no orphan permissions, no
  domain terms the idea didn't state, credential entry rendered). It exposed "copy" being read as
  clipboard; fixed.
- **Structural compiler fix (from the item 9 follow-up).**
  - Features declare `usesPlatformNeeds`, `usesData`, `usesServices`; contracts link only to them.
    The keyword regex linker is deleted.
  - Data objects declare `storage` (settings, records, document, secret, temporary, session);
    placement follows it per preset. Jev's storage tier no longer overrides placement.
  - Intake and normalization reject unknown references and data objects or services that no
    feature uses. The audit fails any data, persistence, or integration contract with no feature.
  - Jev's confident per-feature capability is added to that feature's needs.
  - New `tests/feature-references.test.ts` covers the rejections and wording-never-links.
- **Item 1: project instructions.** New tracked `AGENTS.md` (compiler purpose, five presets, how
  linking works, rules, checks, install and release). Repo `CLAUDE.md` is now `@AGENTS.md`; the old
  content was byte-identical to the two parent `CLAUDE.md` files, which still load.
- **Item 2: Rust checks pass.** `cargo fmt` on `export.rs` and `tests/export_boundary.rs`;
  `export.rs` `return if …;` became a tail expression. No behavior change.
- **Item 3: install script.** `scripts/install-app.sh` and `npm run install:app`: quits the app,
  builds into `/tmp/nodaysidle-cascade-v3-target`, replaces the installed bundle with `ditto`,
  verifies codesign and version. `--clean` removes `dist/`, `src-tauri/gen/`, and the default
  target dir (a custom `CARGO_TARGET_DIR` is kept).
- **Item 4: `Scripts/` → `scripts/`.** Two-step `git mv`; references updated; stale "Latest release
  is v3.0.1" sentence dropped. `Scripts/package_app.sh` in `src/` is a path inside generated macOS
  packets, not this repo, so it stays.
- **Item 5: stale docs.** Spec now lists two keys, Jev stages, current models, feature references,
  and storage kind; README probe wording is accurate and lists `install:app`.
- **Item 6: live probe model.** `CASCADE_MODEL` accepts `deepseek-flash`, `deepseek-v4-pro`, or
  `deepseek-v4-flash`; default stays `deepseek-v4-pro`.
- **Item 7: CI workflow.** `.github/workflows/checks.yml` runs the five checks on macOS for pushes
  and PRs. Action versions from current docs.
- **Item 10: version bump.** `scripts/bump-version.sh X.Y.Z` updates package.json, the lockfile,
  tauri.conf.json, Cargo.toml, Cargo.lock, and README DMG links; tested in a temporary copy (six
  files changed, tests passed). Added as step 1 of the release README.
- **Handoff template.** `USERGUIDE.md` has a tool-neutral prompt for giving a packet to any coding
  agent and comparing results.

## Not done, and why

- **CI run (item 7):** needs a push; waiting for your approval.
- **Paid live probe (item 6):** needs your DeepSeek key in your own terminal.
- **Wording helpers (structural step 5):** deferred as agreed; one regex still picks between the two
  temporary-file placements on native macOS, and the Astro content-site check is regex-based.
- **Deferred from the report:** moving the idea into provider `input` (needs live A/B), sibling
  backups, parent `CLAUDE.md` copies, and user-level Cursor rules (your decisions).

## Observed, not changed

- `src-tauri/tests/jev_boundary.rs`: two tests failed once right after a heavy compile and passed
  on three reruns. They use a 500 ms connect timeout to a local mock server, so they're
  load-sensitive.
- Most provider-schema strings carry `minLength`/`maxLength`, which DeepSeek documents as
  unsupported in strict mode. This predates the changes; a live probe would show whether it matters.
