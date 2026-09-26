# Cascade V3 roadmap

Start here when resuming. Durable rules live in `AGENTS.md`; the detailed history of every change,
with the evidence behind it, lives in `audit/CHANGELOG.md` (newest first).

## Goal

For a chosen preset, any idea compiles into five documents whose contracts are correct and never
contradict each other, plus a tested starter kit where the preset has one, and a coding agent can
build a working app from them.

- Change the compiler only for preset-level or capability-level defects, never for one idea.
  Packets and apps under `/Volumes/omarchyuser/projekti/*` are disposable test evidence.
- Change it only for **blocking** findings: the packet would make an agent build the wrong app or
  guess. Polish (wording, size, an unused helper) goes on the polish list below and is fixed in an
  occasional batch, never between the user's runs. Report a correct packet as correct.
- Close capability gaps proactively (review each capability against current platform docs with a
  synthetic test) instead of discovering one gap per live idea.

## Status (2026-09-26)

| Preset | Kit | Capability review | Live evidence |
| --- | --- | --- | --- |
| native-macos-swiftui-desktop | Yes | Done | ReceiptShelf built and verified working (kit kept, embedded preview, window reopen, errors visible, `user_version`, clean install). LogLens built earlier, before the kit. |
| native-macos-swiftui-menubar | Yes | Done (shared with desktop) | PinBoard built; behavior correct, but the menu was clipped and amateur-looking until post-audit fixes (kit now ships `MenuStyle.swift` and a grouped Settings form). Its launch check never looked at the screen. |
| tauri2-rust-typescript-desktop | No | Not yet | RenewalDesk and ClipVault built before most of this work. |
| android-kotlin-compose | No | Not yet | Never built. |
| astro-web | No | Not yet | Never built. |

## Resume here, in order

1. **Murmur, the speech-to-text menu bar app** (packet regenerated and clean 2026-09-26 after the
   copy-only clipboard fix; **next: agent build, then the built-app audit with screenshots**) (next live test, `native-macos-swiftui-menubar`).
   It exercises the reviewed but unproven capabilities: microphone, global hotkey, HTTPS providers
   plus a localhost server (ATS exception), Keychain keys, provider and language choice lists,
   clipboard write without watching, launch at login, session-only recordings. Prompt:

   > Murmur — a minimal native macOS menu-bar speech-to-text app. The user presses a global keyboard shortcut (Option-Space by default, changeable in Settings) to start recording from the microphone and presses it again to stop; the menu-bar icon shows whether it is idle, recording, or transcribing. When recording stops, the app sends the audio to the speech-to-text provider selected in Settings and copies the returned text to the clipboard, and the menu shows the last transcript with a Copy Again button. Settings let the user choose the provider from OpenAI, Deepgram, ElevenLabs, and a local whisper.cpp server; the three cloud providers each need their own API key, entered in Settings and stored securely, while the local server needs only its address (http://localhost:8080 by default). Settings also hold the transcription language (Auto, English, German, Spanish, French; Auto by default) and a launch-at-login option, off by default. If the microphone is denied, a key is missing, or the provider returns an error, the menu shows what went wrong and nothing is copied. Recordings are kept in memory only and discarded after transcription; only the last transcript and the settings survive quit and relaunch. No accounts, no sync, no Dock icon, no window other than the menu and Settings.

   Audit the packet (use `blueprint.json` to see exactly what DeepSeek declared), then build it.
2. **Tauri next, then Android, then Astro.** For each preset: capability review against current
   docs, a starter kit in `src/kits.ts` checked by `npm run kit:check`, then one live idea built
   and audited. Tauri open items to fold in:
   - Capabilities must match initialized plugins: RenewalDesk granted `notification:default`,
     `dialog:default`, `fs:default` for plugins it never initialized. Every capability permission
     belongs to an initialized plugin, and every initialized plugin has least-privilege permissions.
   - The Tauri kit needs a real reopen/rollback-safe install flow like the native script.
3. **Regression fixtures from real blueprints.** Copy `blueprint.json` from apps that built well
   into `tests/fixtures/` and assert clean packets on their presets on every change.
4. **Other open items.**
   - Cross-feature state in focused tests (seen 4 times): add a generic packet rule that a focused
     test may set another feature's state through the data owner, so phase order never blocks it.
   - Distribution signing: with a Developer ID, notarization needs the hardened runtime
     (`--options runtime`), and microphone/camera then need `com.apple.security.device.audio-input`
     / `.camera` entitlements. The kit signs ad hoc without it; add when an app is distributed.
   - A declared-field way to pull system-view helpers (a `QLPreviewView` wrapper) into the kit;
     today the in-app preview is a prose rule, which the ReceiptShelf build followed.
   - Jev idea review stays advisory until more labelled packets exist.
   - Release: `package.json` is still 3.0.1. Bump with `scripts/bump-version.sh` and follow
     `scripts/README-hybrid-release.md` when the user asks.

## Polish list (batch occasionally, never between runs)

- Second packet diet: each feature's behavior still appears about six times (PRD journeys,
  feature contracts, requirement contracts, ARD flows and boundaries, TRD interfaces). ReceiptShelf
  is 229 KB; the target is about 120 KB.
- A kit test string reads `"receipt"`; rename to a neutral sample.
- Integration contracts name no endpoint, auth header, or model. Add a native rule to take each
  declared service's endpoint, authentication, request format, and model from the provider's current
  documentation and keep them as constants in its integration owner (Murmur, 2026-09-26).
- The integration decision says "HTTPS requests" even for a declared `http://localhost` service; the
  network contract already allows it. Word the decision per scheme, and let the kit add
  `NSAllowsLocalNetworking` once services declare an endpoint.

## Done on 2026-09-25 and 2026-09-26 (details in `audit/CHANGELOG.md`)

- **PinBoard audited.** Behavior passed but the menu was clipped and unusable, missed by agent and
  audit alike; the launch check now requires looking at screenshots. Foundation task names the
  preset's state owner and the kit README names only shipped helpers.
- **Provider step became structured.** One fact per field, asked as a required answer:
  `userFileAccess` per feature, `choiceLists` (every option plus the initial one), `ideaCoverage`
  (every numbered idea sentence maps to features, product, non-goal, or constraint; unrequested
  features are rejected). Prompt rules for shared record fields, filter clearing, and automatic
  fallback. One bounded repair request with the failed checks and the previous response (secrets
  redacted); the UI shows a "Provider repair" row.
- **Contracts became precise for any idea.** `app-files` storage and per-preset `documentPlacement`;
  file access from `userFileAccess` or documents; retry vs fallback contradiction removed; sentence
  form, acronyms, and "without" fixed; lifecycle listed once; reopen by saved path on native, Tauri
  (Rust `std::fs`), and Android (persistable URI permission); native clipboard watcher rule with the
  macOS 15.4 paste-access prompt; Jev no longer heals `filesystem`, and a permission bug it masked
  is fixed.
- **Build agent guided by code, not only prose.** Wiring rules on every preset (failures visible,
  launch check leaves no test data, SQLite `user_version`). Native rules: embedded system views,
  `@NSApplicationDelegateAdaptor`, reopenable window, rollback outside `/Applications`, launch only
  the installed bundle, warning-free release builds. Starter kits for native desktop and menu bar:
  app entry, error alert or banner, `AtomicFileWriter`, `AppFileStore`, `SQLiteDatabase`,
  `KeychainStore`, `LoginItem`, `package_app.sh --install`, `Info.plist` with usage strings,
  entitlements, `KitTests`; files chosen from declared fields and owned by the foundation task.
- **Native capability review.** Login keychain (not data protection) for API keys, login item
  `requiresApproval`, camera and location usage strings, ATS for http endpoints, ad-hoc rebuilds
  re-prompt privacy access. Reviewed unchanged: microphone, camera, location calls, Accessibility,
  notifications, global hotkeys, background execution.
- **Packet diet.** One short index per document; a contract's decision lives only in TRD. Real
  packets went from 392 KB to about 200–230 KB.
- **Export.** Five documents, then `kit/` files, then `blueprint.json` (on by default, "Include
  blueprint.json" checkbox). The Rust export validates each and writes atomically.

## Decided, do not reopen without new evidence

- Phase order within ready owners is alphabetical by owner ID so the same blueprint gives the same
  packet regardless of the provider's feature order (`tests/graph-construction.test.ts`).
- One bounded repair request (decided 2026-09-26, replacing "no provider retry or repair"): when
  the provider's content fails a deterministic check, the pipeline sends the failed checks and the
  previous response once, reruns every check, and stops if it still fails. Transport, cancellation,
  Jev service, and local compiler failures are never repaired. Jev checks that block (stack
  leakage, untestable acceptance) keep blocking; the idea review never blocks.
- Links, placement, recovery, and routes come only from declared fields (`usesPlatformNeeds`,
  `usesData`, `usesServices`, `userFileAccess`, `choiceLists`, `storage`, `writeMode`,
  `failureRecovery`, `surface`), never from wording. Each fact is declared in one place and asked
  as a required field, never as an optional declaration the provider can forget.
- Platform plumbing an agent keeps getting wrong becomes kit code (compiled and tested by
  `npm run kit:check`), not another prose rule. The export may carry `kit/` files and one
  `blueprint.json` after the five documents (decided 2026-09-26).
- The legacy `prd-compiler` chained five model calls and drifted; V3 keeps one model call for
  product meaning and renders all five documents from one graph.

## How to audit a packet

1. Confirm the export folder and timestamp. The export refuses to overwrite a folder, so the user
   deletes or renames the old one first.
2. Read `blueprint.json` for what DeepSeek declared (per-feature `userFileAccess`,
   `usesPlatformNeeds`, `usesData`, `choiceLists`, `ideaCoverage`, data `storage`/`writeMode`).
3. Check every feature against the idea (coverage), and every `Recovery:` line against its failure
   text.
4. In TRD.md, check each permission, data, persistence, credential, and integration contract: the
   feature trace, placement, write mode, and the preset rule text.
5. Check `kit/` holds the expected files for the declared fields, and AGENTS.md and TASKS.md carry
   the copy-the-kit rule.
6. Scan all five files for known bad wording (`API API`, `Keychain` on non-Apple presets, `<...>`
   placeholders, "a fixed list", undecided "X or Y", unrequested scope).
7. Label every finding **compiler blocking**, **compiler polish**, or **idea**. Fix only compiler
   blocking findings, each with a synthetic test; add polish to the list above.

## How to audit a built app

1. Read the agent's report, then the composition root (native: the app entry and
   `AppState`/`MenuBarController`; Tauri: `src-tauri/src/lib.rs` and `src/main.ts`). Stand-ins mean
   the app is hollow.
2. Diff the kit files against the project (`cmp kit/<path> <path>`): storage helpers and the
   packaging script should be unchanged; the app entry and error center may be extended, never
   replaced (no `NSApplication.shared.delegate =`, no `CommandGroup(replacing: .newItem)`).
3. Run every validation command with build output outside the project
   (`swift test --scratch-path /private/tmp/...`, `CARGO_TARGET_DIR=/private/tmp/...`).
4. Check the installed bundle: `codesign --verify --deep --strict`, bundle ID, arm64, icon, and that
   `/Applications` holds one bundle per ID.
5. Look at every window and menu with long real content (screenshot, or ask the user to look);
   clipped or unreadable screens fail the audit even when every behavior passes. Opening is not
   working. Then test live behavior. The terminal has Accessibility access, so `osascript` UI scripting works
   (a menu bar item is `menu bar 2` of the process). The user runs AeroSpork, so `frontmost` and
   window focus are not reliable signals. Also use `pbcopy`, `sqlite3` on the app-data store, and
   quit and relaunch. Test strings must not look like secrets.
6. Remove any data your own checks created, and check what the agent's run left behind.

## Commands

```sh
npm run typecheck && npm test          # plus cargo fmt/clippy/test, see AGENTS.md
npm run kit:check                      # after any change to src/kits.ts
npm run install:app -- --clean         # rebuild and install the Cascade app (deletes the old copy)
npm run probe:live                     # paid DeepSeek request, the user runs it with their key
```
