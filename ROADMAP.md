# Cascade V3 roadmap

What to do next to make the compiler better, and how to audit its output. Read this before
changing the compiler. Durable rules live in `AGENTS.md`; history lives in `audit/CHANGELOG.md`.

## Goal

For a chosen preset, any idea must compile into five documents whose contracts are correct and
never contradict each other, and a coding agent must be able to build a working app from them.
Only preset-level defects justify a compiler change. DeepSeek's content choices for one idea are
notes for the user, not compiler work.

## Evidence so far (2026-09-25)

| Run | Result | What it taught |
| --- | --- | --- |
| RenewalDesk (Tauri) | Packet 9.5/10. Built app hollow: no plugins, commands, or tray; in-memory stores; agent reported DONE | Per-owner unit tests accept stand-ins. Added `CON-RUNTIME-WIRING` and the "no DONE with stand-ins" stop rule. |
| ClipVault (Tauri) | No compiler findings in the packet. Built app genuinely wired (4 plugins, 26 commands, Rust clipboard monitor, tray, prevent_exit); agent reported PARTIAL honestly | The wiring gate works. Remaining defects were app-level (frontmost-app attribution), a packaging gap (ad-hoc re-sign), and an identity fallback (`com.clipvault.app`). |

## Open work, highest value first

1. **Prove the wiring gate on the other presets.** Generate and build one app each for native
   macOS desktop, macOS menu bar, Android, and Astro. Only Tauri has been built end to end. The
   Swift, Android, and Astro wiring rules are untested in practice.
2. **Local Tauri builds without the DMG step.** `npm run tauri:build` builds a DMG whose Finder
   styling step times out in headless agent sessions (ClipVault). Make the local proof command
   `npm run tauri -- build --bundles app` and keep the DMG as a separate release step.
3. **Capabilities must match initialized plugins.** RenewalDesk granted `notification:default`,
   `dialog:default`, and `fs:default` for plugins it never initialized. Add a Tauri wiring rule:
   every capability permission belongs to an initialized plugin, and every initialized plugin has
   its least-privilege permissions.
4. **Cross-feature state in focused tests.** Provider acceptance signals sometimes mention another
   feature's state (ClipVault: recording tests mention pins built later). Add a generic packet
   rule: a focused test may set another feature's state directly through the data owner instead
   of its UI, so phase order never blocks a test.
5. **Needs a feature declares but never uses.** DeepSeek listed `filesystem` on a pin feature and
   `notifications` on a tray feature. Candidate fix: a Jev question per declared feature need
   ("does this feature's behavior use X?"). Calibrate it on real packets before wiring it in; it
   may only warn.
6. **Hands-on checks agents can't run.** Headless agents can't click the tray or press global
   shortcuts, so GUI checks stay PARTIAL. Explore a preset-defined, test-only smoke entry the agent
   can drive from the command line, without shipping test doubles.
7. **Jev idea review stays advisory.** Calibration on 20+ features showed overlapping scores for
   wrong and correct features. Revisit only with more labelled packets.
8. **Release.** `package.json` is still 3.0.1 after many compiler changes. Bump with
   `scripts/bump-version.sh` and follow `scripts/README-hybrid-release.md` when the user asks.

## Decided, do not reopen without new evidence

- Phase order within ready owners is alphabetical by owner ID so the same blueprint gives the same
  packet regardless of the provider's feature order (`tests/graph-construction.test.ts`).
- No provider retry or repair. Jev checks that block (stack leakage, untestable acceptance) keep
  blocking; the idea review never blocks.
- Links, placement, recovery, and routes come only from declared fields (`usesPlatformNeeds`,
  `usesData`, `usesServices`, `storage`, `writeMode`, `failureRecovery`, `surface`), never from
  wording.

## How to audit a packet

1. Confirm the export folder and timestamp; the app never overwrites, so a new run may land in a
   new folder named after the product.
2. List features and every `Recovery:` line in PRD.md; check recovery kinds against failure text.
3. For each permission, data, persistence, credential, and integration contract in TRD.md, check
   the feature trace, placement, and write mode.
4. Scan all five files for known bad wording (`API API`, `Keychain` on non-Apple presets,
   `<...>` placeholders, undecided "X or Y" behaviors, unrequested scope).
5. Check the packaging task owns `CON-RUNTIME-WIRING` and AGENTS.md carries the test-double rules.
6. Label every finding **compiler** or **idea**. Fix only compiler findings, each with a test.

## How to audit a built app

1. Read the agent's report, then the composition roots first (Tauri: `src-tauri/src/lib.rs`
   `app_builder`/`run`, and `src/main.ts` adapters). Stand-ins there mean the app is hollow.
2. Run every validation command with build output outside the project
   (`CARGO_TARGET_DIR=/private/tmp/...`).
3. Check the installed bundle: `codesign --verify --deep --strict`, bundle ID, icon, launch.
4. Test live behavior from the shell where possible: `pbcopy` for clipboard apps, `sqlite3` on the
   app-data database, quit and relaunch for persistence. Test strings must not look like secrets
   (no single 16+ character token mixing letters, digits, and symbols), or a secret filter will
   correctly skip them.
5. Check saved state the agent's tests may have left behind (ClipVault was left paused).
