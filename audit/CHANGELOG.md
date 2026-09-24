# Audit changelog (2026-09-24)

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
