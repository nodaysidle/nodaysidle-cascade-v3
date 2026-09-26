import type { NormalizedBlueprint } from "./compiler"
import type { ProjectIdentity } from "./presets"

export interface TauriKitFile {
  readonly path: string
  readonly content: string
}

// One Tauri plugin: its crate, its npm package, how lib.rs initializes it, and the only capability
// permissions it gets. Cargo.toml, package.json, lib.rs, and capabilities/default.json are all
// rendered from this list, so a permission can never name a plugin the app does not initialize.
interface TauriPlugin {
  readonly crate: string
  readonly crateVersion: string
  readonly npm: string
  readonly npmVersion: string
  readonly init: string
  readonly permissions: readonly string[]
}

// Versions are the ones the kit is built and tested with (npm run kit:check), all compatible with
// tauri 2.11.5; permission sets checked in the plugins-workspace permission references.
const PLUGINS = {
  clipboard: {
    crate: "tauri-plugin-clipboard-manager", crateVersion: "2.3.3", npm: "@tauri-apps/plugin-clipboard-manager", npmVersion: "2.3.3",
    init: "tauri_plugin_clipboard_manager::init()",
    // The plugin has no default set; copying needs only this. Add allow-read-text only for a feature that reads.
    permissions: ["clipboard-manager:allow-write-text"],
  },
  shortcut: {
    crate: "tauri-plugin-global-shortcut", crateVersion: "2.3.2", npm: "@tauri-apps/plugin-global-shortcut", npmVersion: "2.3.2",
    init: "tauri_plugin_global_shortcut::Builder::new().build()",
    permissions: ["global-shortcut:allow-register", "global-shortcut:allow-unregister", "global-shortcut:allow-is-registered"],
  },
  autostart: {
    crate: "tauri-plugin-autostart", crateVersion: "2.5.1", npm: "@tauri-apps/plugin-autostart", npmVersion: "2.5.1",
    init: "tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None)",
    permissions: ["autostart:default"],
  },
  notification: {
    crate: "tauri-plugin-notification", crateVersion: "2.4.0", npm: "@tauri-apps/plugin-notification", npmVersion: "2.4.0",
    init: "tauri_plugin_notification::init()",
    permissions: ["notification:default"],
  },
  dialog: {
    crate: "tauri-plugin-dialog", crateVersion: "2.7.2", npm: "@tauri-apps/plugin-dialog", npmVersion: "2.7.2",
    init: "tauri_plugin_dialog::init()",
    permissions: ["dialog:default"],
  },
} as const satisfies Record<string, TauriPlugin>

export interface TauriKitUses {
  readonly settings: boolean
  readonly records: boolean
  readonly secrets: boolean
  readonly tray: boolean
  readonly plugins: readonly TauriPlugin[]
  readonly usageDescriptions: ReadonlyArray<readonly [string, string]>
}

export function tauriKitUses(blueprint: NormalizedBlueprint, usageDescriptions: ReadonlyArray<readonly [string, string]>): TauriKitUses {
  const storage = new Set(blueprint.persistenceNeeds.map(need => need.storage))
  const needs = new Set<string>(blueprint.platformNeeds)
  // The normalized needs include filesystem whenever a feature shows a file panel or reopens a document.
  const opensFiles = needs.has("filesystem")
  return {
    settings: storage.has("settings"),
    records: storage.has("records"),
    secrets: blueprint.externalServices.some(service => service.credentialRequirement !== "none")
      || blueprint.domainData.some(item => item.storage === "secret"),
    tray: needs.has("background-execution"),
    plugins: [
      ...(needs.has("clipboard") ? [PLUGINS.clipboard] : []),
      ...(needs.has("global-hotkey") ? [PLUGINS.shortcut] : []),
      ...(needs.has("launch-at-login") ? [PLUGINS.autostart] : []),
      ...(needs.has("notifications") ? [PLUGINS.notification] : []),
      ...(opensFiles ? [PLUGINS.dialog] : []),
    ],
    usageDescriptions,
  }
}

export function tauriKitFiles(identity: ProjectIdentity, uses: TauriKitUses): TauriKitFile[] {
  const lib = `${identity.slug.replace(/-/g, "_")}_lib`
  return [
    { path: "package.json", content: packageJson(identity, uses) },
    { path: "tsconfig.json", content: TSCONFIG },
    { path: "vite.config.ts", content: VITE_CONFIG },
    { path: "index.html", content: indexHtml(identity) },
    { path: "src/api.ts", content: API_TS },
    { path: "src/errors.ts", content: ERRORS_TS },
    { path: "src/main.ts", content: mainTs(identity) },
    { path: "src/style.css", content: STYLE_CSS },
    { path: "tests/kit.test.ts", content: KIT_TEST_TS },
    { path: "app-icon.svg", content: APP_ICON_SVG },
    { path: "scripts/package_app.sh", content: packageScript(identity) },
    { path: "src-tauri/Cargo.toml", content: cargoToml(identity, lib, uses) },
    { path: "src-tauri/build.rs", content: BUILD_RS },
    { path: "src-tauri/rustfmt.toml", content: RUSTFMT_TOML },
    { path: "src-tauri/src/main.rs", content: mainRs(lib) },
    { path: "src-tauri/src/lib.rs", content: libRs(uses) },
    { path: "src-tauri/src/error.rs", content: ERROR_RS },
    ...(uses.settings ? [{ path: "src-tauri/src/settings.rs", content: SETTINGS_RS }] : []),
    ...(uses.records ? [{ path: "src-tauri/src/database.rs", content: DATABASE_RS }] : []),
    ...(uses.secrets ? [{ path: "src-tauri/src/vault.rs", content: VAULT_RS }] : []),
    { path: "src-tauri/tests/kit_tests.rs", content: kitTestsRs(lib, uses) },
    { path: "src-tauri/tauri.conf.json", content: tauriConf(identity) },
    { path: "src-tauri/capabilities/default.json", content: capabilities(uses) },
    ...(uses.usageDescriptions.length ? [{ path: "src-tauri/Info.plist", content: infoPlist(uses.usageDescriptions) }] : []),
  ]
}

export function tauriKitReadme(identity: ProjectIdentity, paths: readonly string[], uses: TauriKitUses): string {
  return [
    `# ${identity.projectName} starter kit`,
    "",
    "Tested starting code for the Tauri plumbing in TRD.md. Before TASK-01, copy every file below from kit/ to the same path in the project root. The task that owns a file starts from this content and extends it; keep every behavior listed here.",
    "",
    ...paths.map(path => `- ${path}`),
    "",
    "## Behavior to keep",
    "",
    "- src-tauri/src/lib.rs: app_builder registers every plugin and command and nothing else; run() owns the only setup closure, because Builder::setup replaces any earlier one. Add each new command to generate_handler! and each new store to manage_state.",
    "- manage_state(app, folder) opens every store in one folder: run() passes app_data_dir(), tests pass a temporary folder, so tests never touch real app data.",
    "- src-tauri/tests/kit_tests.rs builds app_builder(mock_builder()) with the app's own context() and calls commands through get_ipc_response from the devUrl origin (http://localhost:1420); a request from any other origin is refused. Keep this test passing as commands are added.",
    "- Every command returns Result<T, AppError>; AppError carries a message written for the user, and the frontend shows it through errors.report(). errors.show() is for messages the frontend writes itself. Never show a raw runtime error.",
    "- src-tauri/capabilities/default.json lists only core:default and the permissions of the plugins lib.rs initializes. Add a permission only with the plugin feature that needs it.",
    ...(uses.settings ? ["- settings.rs replaces settings.json whole: a temporary file in the same folder, synced, then renamed."] : []),
    ...(uses.records ? ["- database.rs applies MIGRATIONS in order and records the schema version in PRAGMA user_version; append new migrations, never edit a shipped one."] : []),
    ...(uses.secrets ? ["- vault.rs is the only place secrets are stored: generic passwords in the login keychain under the bundle ID's credentials service. Tests use MemoryStore, never the keychain."] : []),
    ...(uses.tray ? ["- The tray keeps the app running: closing the window hides it, Show brings it back, and Quit (or quitting from outside) exits. RunEvent::ExitRequested with no exit code is prevented; an explicit exit code is not."] : []),
    ...(uses.usageDescriptions.length ? ["- src-tauri/Info.plist holds the privacy usage strings; Tauri merges it into the bundle's Info.plist."] : []),
    "- scripts/package_app.sh builds only the .app (no DMG), signs it ad hoc, and verifies it; with --install it waits for the running app to quit, moves the installed copy to src-tauri/target/rollback/ (never inside /Applications), installs, restores the previous copy if verification fails, registers, and launches by bundle ID. The first run generates src-tauri/icons from app-icon.svg.",
    "- Versions are exact (= in Cargo.toml, no ^ in package.json) because they are tested together; keep src-tauri/Cargo.lock and package-lock.json from the first build, and change a version only on purpose, never by a broad update.",
    "- src/style.css uses the system font and light and dark system colors; the page never scrolls, and .app-content scrolls inside the window.",
    "",
  ].join("\n")
}

function packageJson(identity: ProjectIdentity, uses: TauriKitUses): string {
  const dependencies: Record<string, string> = { "@tauri-apps/api": "2.11.1" }
  for (const plugin of uses.plugins) dependencies[plugin.npm] = plugin.npmVersion
  return `${JSON.stringify({
    name: identity.slug,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc --noEmit && vite build",
      typecheck: "tsc --noEmit",
      test: "vitest run",
      tauri: "tauri",
    },
    dependencies,
    devDependencies: {
      "@tauri-apps/cli": "2.11.4",
      typescript: "5.9.3",
      vite: "7.3.6",
      vitest: "4.1.11",
    },
  }, null, 2)}\n`
}

const TSCONFIG = `${JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "ESNext",
    moduleResolution: "bundler",
    lib: ["ES2022", "DOM", "DOM.Iterable"],
    strict: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    skipLibCheck: true,
    types: ["vite/client"],
  },
  include: ["src", "tests", "vite.config.ts"],
}, null, 2)}\n`

const VITE_CONFIG = `import { defineConfig } from "vite"

// Tauri serves the dev frontend from this fixed port (tauri.conf.json devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "safari16", outDir: "dist", emptyOutDir: true },
})
`

function indexHtml(identity: ProjectIdentity): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <link rel="stylesheet" href="/src/style.css" />
    <title>${identity.projectName}</title>
  </head>
  <body>
    <main id="app"></main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

const API_TS = `import { invoke } from "@tauri-apps/api/core"

/** The error every Rust command returns (AppError): a kind and a message written for the user. */
export interface CommandError {
  kind: string
  message: string
}

const isCommandError = (value: unknown): value is CommandError =>
  typeof value === "object" && value !== null && typeof (value as CommandError).message === "string"

/** The message to show for a failed command; never a raw error string from the runtime. */
export const messageFor = (error: unknown): string =>
  isCommandError(error) ? error.message : "Something went wrong. Try again."

/** Calls a Rust command. Every frontend call goes through here so failures reach the error banner. */
export const call = <T>(command: string, args?: Record<string, unknown>): Promise<T> => invoke<T>(command, args)
`

const ERRORS_TS = `import { messageFor } from "./api"

/** One place for user-visible failures: features report here and the banner shows the message. */
export const createErrorBanner = (host: HTMLElement) => {
  const banner = document.createElement("div")
  banner.className = "error-banner"
  banner.setAttribute("role", "alert")
  banner.hidden = true
  const text = document.createElement("p")
  const dismiss = document.createElement("button")
  dismiss.type = "button"
  dismiss.textContent = "Dismiss"
  dismiss.addEventListener("click", () => { banner.hidden = true })
  banner.append(text, dismiss)
  const header = host.querySelector(".app-header")
  if (header) header.after(banner)
  else host.prepend(banner)

  const show = (message: string) => {
    text.textContent = message
    banner.hidden = false
  }

  return {
    /** A message the frontend wrote for the user. */
    show,
    /** A failed command: shows the message Rust wrote, never a raw runtime error. */
    report: (error: unknown) => show(messageFor(error)),
    dismiss: () => { banner.hidden = true },
  }
}
`

function mainTs(identity: ProjectIdentity): string {
  return `import { createErrorBanner } from "./errors"

// Composition root: feature tasks add their views to .app-content and call Rust commands through
// call() from ./api, reporting failures with errors.report().
const root = document.querySelector<HTMLElement>("#app")
if (!root) throw new Error("#app is missing from index.html")

root.innerHTML = \`
  <header class="app-header">
    <h1>${identity.projectName}</h1>
  </header>
  <section class="app-content" aria-label="${identity.projectName}"></section>
\`

export const errors = createErrorBanner(root)
`
}

const STYLE_CSS = `/* Native-feeling base: system font, system colors in light and dark, no page scroll. Features style
   their own views with these tokens. */
:root {
  color-scheme: light dark;
  --bg: #f5f5f7;
  --surface: #ffffff;
  --text: #1d1d1f;
  --text-2: #6e6e73;
  --line: #d2d2d7;
  --accent: #0a84ff;
  --danger: #d70015;
  --danger-bg: #fff0f0;
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1e1e1e;
    --surface: #2a2a2c;
    --text: #f5f5f7;
    --text-2: #a1a1a6;
    --line: #3a3a3c;
    --danger: #ff6961;
    --danger-bg: #3a1d1d;
  }
}

* { box-sizing: border-box; }
[hidden] { display: none !important; }

html, body { height: 100%; margin: 0; }
body { color: var(--text); background: var(--bg); overflow: hidden; }
#app { display: flex; flex-direction: column; height: 100%; }

.app-header { padding: 14px 20px 10px; border-bottom: 1px solid var(--line); }
.app-header h1 { margin: 0; font-size: 15px; font-weight: 650; }
.app-content { flex: 1; min-height: 0; overflow: auto; padding: 16px 20px; }

.error-banner { display: flex; align-items: flex-start; gap: 12px; margin: 10px 20px 0; padding: 9px 12px; color: var(--danger); background: var(--danger-bg); border-radius: 8px; }
.error-banner p { flex: 1; margin: 0; }
.error-banner button { color: inherit; background: none; border: 0; font: inherit; font-weight: 600; cursor: pointer; }

button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
`

const KIT_TEST_TS = `import { describe, expect, it } from "vitest"
import { messageFor } from "../src/api"

describe("command errors", () => {
  it("shows the message Rust wrote for the user", () => {
    expect(messageFor({ kind: "storage", message: "Settings could not be saved." })).toBe("Settings could not be saved.")
  })

  it("never shows a raw runtime error", () => {
    expect(messageFor("IPC failed: stack trace")).toBe("Something went wrong. Try again.")
  })
})
`

// A text source for the app icon; scripts/package_app.sh turns it into src-tauri/icons with tauri icon.
const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="224" fill="#1d1d1f"/>
  <rect x="272" y="272" width="480" height="480" rx="96" fill="#0a84ff"/>
</svg>
`

function packageScript(identity: ProjectIdentity): string {
  return `#!/usr/bin/env bash
# Builds the macOS app bundle only (no DMG; that is a release step), signs it ad hoc, and verifies it.
# Usage: scripts/package_app.sh [--install]
#   --install  quit the running app, move any installed copy to src-tauri/target/rollback/ (never
#              inside /Applications), install the verified app, register it, and launch it by bundle ID.
#              If the new copy fails verification, the previous app is put back.
# SIGN_IDENTITY selects a Developer ID; the default "-" signs ad hoc for local proof.
set -euo pipefail

cd "$(dirname "$0")/.."
APP_NAME="${identity.projectName}"
BUNDLE_ID="${identity.bundleId}"
SIGN_IDENTITY="\${SIGN_IDENTITY:--}"
APP="src-tauri/target/release/bundle/macos/$APP_NAME.app"
INSTALLED="/Applications/$APP_NAME.app"
ROLLBACK="src-tauri/target/rollback/$APP_NAME.app"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

install=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -f src-tauri/icons/icon.icns ] || npm run tauri -- icon app-icon.svg
npm run tauri -- build --bundles app
codesign --force --deep --sign "$SIGN_IDENTITY" "$APP"
codesign --verify --deep --strict "$APP"

if [ "$install" = true ]; then
  osascript -e "tell application id \\"$BUNDLE_ID\\" to quit" >/dev/null 2>&1 || true
  # Launching while the old process is still quitting fails with error -600.
  for _ in $(seq 1 50); do
    pgrep -f "$INSTALLED/Contents/MacOS/" >/dev/null || break
    sleep 0.2
  done
  if [ -d "$INSTALLED" ]; then
    rm -rf "$ROLLBACK"
    mkdir -p "$(dirname "$ROLLBACK")"
    mv "$INSTALLED" "$ROLLBACK"
  fi
  cp -R "$APP" "$INSTALLED"
  if ! codesign --verify --deep --strict "$INSTALLED"; then
    rm -rf "$INSTALLED"
    [ -d "$ROLLBACK" ] && mv "$ROLLBACK" "$INSTALLED"
    echo "The new app failed verification; the previous app was restored." >&2
    exit 1
  fi
  # Only the installed bundle stays registered, so open -b always starts it.
  "$LSREGISTER" -u "$APP" >/dev/null 2>&1 || true
  "$LSREGISTER" -f "$INSTALLED"
  open -b "$BUNDLE_ID"
fi
`
}

function cargoToml(identity: ProjectIdentity, lib: string, uses: TauriKitUses): string {
  const tauriFeatures = uses.tray ? `["tray-icon"]` : "[]"
  const testFeatures = uses.tray ? `["tray-icon", "test"]` : `["test"]`
  return `[package]
name = "${identity.slug}"
version = "0.1.0"
edition = "2021"
rust-version = "1.85"

[lib]
name = "${lib}"
crate-type = ["staticlib", "cdylib", "rlib"]

# Exact versions, tested together by the compiler's kit check. Tauri's internal crates are pinned too:
# with caret versions Cargo mixes a newer tauri-runtime into tauri 2.11 and the build breaks.
[build-dependencies]
tauri-build = { version = "=2.6.3", features = [] }
tauri-codegen = "=2.6.3"

[dependencies]
tauri = { version = "=2.11.5", features = ${tauriFeatures} }
tauri-runtime = "=2.11.3"
tauri-runtime-wry = "=2.11.4"
tauri-utils = "=2.9.3"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
${[
    ...(uses.records ? [`rusqlite = { version = "=0.37.0", features = ["bundled"] }`] : []),
    ...(uses.secrets ? [`keyring = { version = "=3.6.3", features = ["apple-native"] }`] : []),
    ...uses.plugins.map(plugin => `${plugin.crate} = "=${plugin.crateVersion}"`),
  ].join("\n")}

[dev-dependencies]
tauri = { version = "=2.11.5", features = ${testFeatures} }
tempfile = "3"
`.replace(/\n\n\n/g, "\n\n")
}

// Wrap only past max_width, so layout depends on line length alone and the kit stays formatted.
const RUSTFMT_TOML = `use_small_heuristics = "Max"
`

const BUILD_RS = `fn main() {
    tauri_build::build()
}
`

function mainRs(lib: string): string {
  return `// Prevents an extra console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ${lib}::run()
}
`
}

function libRs(uses: TauriKitUses): string {
  const modules = ["error", ...(uses.records ? ["database"] : []), ...(uses.settings ? ["settings"] : []), ...(uses.secrets ? ["vault"] : [])].sort()
  const autostart = uses.plugins.some(plugin => plugin.crate === "tauri-plugin-autostart")
  const commands = [...(uses.settings ? ["load_settings", "save_settings"] : []), ...(uses.records ? ["schema_version"] : [])]
  const stateFields = [
    ...(uses.settings ? ["    pub settings: SettingsFile,"] : []),
    ...(uses.records ? ["    pub database: Mutex<rusqlite::Connection>,"] : []),
    ...(uses.secrets ? ["    pub secrets: Box<dyn SecretStore>,"] : []),
  ]
  const stateLets = [
    ...(uses.settings ? ["    let settings = SettingsFile::new(folder);"] : []),
    ...(uses.records ? ["    let database = Mutex::new(database::open(folder)?);"] : []),
  ]
  const stateFieldNames = [...(uses.settings ? ["settings"] : []), ...(uses.records ? ["database"] : []), ...(uses.secrets ? ["secrets"] : [])]
  const imports = [
    ...(uses.records ? ["use std::sync::Mutex;", ""] : []),
    ...(uses.settings ? ["use serde::{Deserialize, Serialize};"] : []),
    ...(uses.tray ? ["use tauri::menu::{Menu, MenuItem};", "use tauri::tray::TrayIconBuilder;"] : []),
    `use tauri::{${["Manager", ...(uses.tray ? ["RunEvent"] : []), "Runtime", ...(commands.length ? ["State"] : []), ...(uses.tray ? ["WindowEvent"] : [])].join(", ")}};`,
    ...(autostart ? ["use tauri_plugin_autostart::MacosLauncher;"] : []),
    "",
    "use crate::error::AppError;",
    ...(uses.settings ? ["use crate::settings::SettingsFile;"] : []),
    ...(uses.secrets ? ["use crate::vault::SecretStore;"] : []),
  ]
  const pluginInit = (plugin: TauriPlugin) => plugin.crate === "tauri-plugin-autostart" ? "tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None)" : plugin.init
  return `//! Composition root. \`app_builder\` registers every plugin and command; \`run()\` and the packaging
//! test both use it, so a command missing from one is missing from both. \`run()\` owns the one
//! \`setup\` closure: \`Builder::setup\` replaces any earlier one, so a second call silently drops the first.

${modules.map(name => `pub mod ${name};`).join("\n")}

${imports.join("\n")}
${uses.settings ? `
/// Every saved setting. Feature tasks add fields; #[serde(default)] keeps older files readable.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct AppSettings {}
` : ""}
/// The stores every command reads through \`State<'_, AppState>\`.
pub struct AppState {
${stateFields.length ? stateFields.join("\n") : "    pub folder: std::path::PathBuf,"}
}
${uses.settings ? `
#[tauri::command]
fn load_settings(state: State<'_, AppState>) -> Result<AppSettings, AppError> {
    state.settings.load()
}

/// Saves the whole settings value and returns what was stored.
#[tauri::command]
fn save_settings(state: State<'_, AppState>, next: AppSettings) -> Result<AppSettings, AppError> {
    state.settings.save(&next)?;
    state.settings.load()
}
` : ""}${uses.records ? `
#[tauri::command]
fn schema_version(state: State<'_, AppState>) -> Result<usize, AppError> {
    let busy = |_| AppError::Storage("The saved records are busy.".into());
    let connection = state.database.lock().map_err(busy)?;
    database::user_version(&connection)
}
` : ""}
/// Opens the stores in \`folder\` and hands them to Tauri. \`run()\` passes the app-data folder; tests
/// pass a temporary one (the mock runtime does not run \`setup\`, and tests must not touch real data).
pub fn manage_state<R: Runtime, M: Manager<R>>(
    manager: &M,
    folder: &std::path::Path,${uses.secrets ? "\n    secrets: Box<dyn SecretStore>," : ""}
) -> Result<(), AppError> {
    let unavailable = |_| AppError::Storage("The app-data folder could not be created.".into());
    std::fs::create_dir_all(folder).map_err(unavailable)?;
${stateLets.length ? `${stateLets.join("\n")}\n` : ""}    manager.manage(AppState { ${stateFieldNames.length ? stateFieldNames.join(", ") : "folder: folder.to_path_buf()"} });
    Ok(())
}

/// The app's one generated context (config, capabilities, icons). Tests build with it too, so a
/// command the capabilities refuse fails in tests exactly as it would in the app.
pub fn context<R: Runtime>() -> tauri::Context<R> {
    tauri::generate_context!()
}

/// Plugins and commands only; \`run()\` adds state and the ${uses.tray ? "tray" : "window behavior"}.
pub fn app_builder<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
${uses.plugins.map(plugin => `    let builder = builder.plugin(${pluginInit(plugin)});`).join("\n")}${uses.plugins.length ? "\n" : ""}    builder.invoke_handler(tauri::generate_handler![${commands.join(", ")}])
}
${uses.tray ? `
/// Closing the window hides it; the tray's Show brings it back and Quit exits.
fn install_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let tooltip = app.package_info().name.clone();
    let mut tray = TrayIconBuilder::with_id("main").menu(&menu).tooltip(tooltip);
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, event| match event.id.as_ref() {
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => app.exit(0),
        _ => {}
    })
    .build(app)?;
    Ok(())
}
` : ""}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app_builder(tauri::Builder::default())
        .setup(|app| {
            let folder = app.path().app_data_dir()?;${uses.secrets ? `
            let secrets = Box::new(vault::KeychainStore::new(&app.config().identifier));
            manage_state(app, &folder, secrets)?;` : `
            manage_state(app, &folder)?;`}${uses.tray ? "\n            install_tray(app)?;" : ""}
            Ok(())
        })${uses.tray ? `
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })` : ""}
        .build(context())
        .expect("the app could not start")
        .run(${uses.tray ? `|_app, event| {
            // An explicit Quit passes an exit code; closing the last window does not.
            if let RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        }` : "|_app, _event| {}"});
}
`
}

const ERROR_RS = `use serde::Serialize;

/// The only error a command returns. The frontend shows \`message\`; nothing raw crosses the boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "kebab-case")]
pub enum AppError {
    Storage(String),
    NotFound(String),
    Invalid(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Storage(text) | Self::NotFound(text) | Self::Invalid(text) => f.write_str(text),
        }
    }
}

impl std::error::Error for AppError {}
`

const SETTINGS_RS = `use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::{de::DeserializeOwned, Serialize};

use crate::error::AppError;

const SAVE_FAILED: &str = "Settings could not be saved. The previous settings were kept.";

/// Settings as one JSON file in the app-data folder, replaced whole: a temporary file in the same
/// folder is written and synced, then renamed over the old one, so a crash never leaves half a file.
pub struct SettingsFile {
    path: PathBuf,
}

impl SettingsFile {
    pub fn new(folder: &Path) -> Self {
        Self { path: folder.join("settings.json") }
    }

    /// A missing file gives the defaults; an unreadable one is an error the caller shows.
    pub fn load<T: DeserializeOwned + Default>(&self) -> Result<T, AppError> {
        let unreadable = || AppError::Storage("Saved settings could not be read.".into());
        match fs::read(&self.path) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| unreadable()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(T::default()),
            Err(_) => Err(unreadable()),
        }
    }

    pub fn save<T: Serialize>(&self, value: &T) -> Result<(), AppError> {
        let failed = || AppError::Storage(SAVE_FAILED.into());
        let folder = self.path.parent().ok_or_else(failed)?;
        fs::create_dir_all(folder).map_err(|_| failed())?;
        let bytes = serde_json::to_vec_pretty(value).map_err(|_| failed())?;
        let temporary = folder.join(format!(".settings-{}.tmp", std::process::id()));
        let result = (|| {
            let mut file = fs::File::create(&temporary)?;
            file.write_all(&bytes)?;
            file.sync_all()?;
            fs::rename(&temporary, &self.path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
        }
        result.map_err(|_| failed())
    }
}
`

const DATABASE_RS = `use std::path::Path;

use rusqlite::Connection;

use crate::error::AppError;

/// Schema changes, applied in order. Feature tasks append their tables; never edit one that has shipped.
pub const MIGRATIONS: &[&str] = &[];

/// The records database in the app-data folder; PRAGMA user_version holds the schema version.
pub fn open(folder: &Path) -> Result<Connection, AppError> {
    let mut connection = Connection::open(folder.join("records.sqlite3"))
        .map_err(|_| AppError::Storage("The saved records could not be opened.".into()))?;
    migrate(&mut connection, MIGRATIONS)?;
    Ok(connection)
}

/// Applies the migrations after the stored version, each in its own transaction with its version.
pub fn migrate(connection: &mut Connection, migrations: &[&str]) -> Result<(), AppError> {
    let failed = |_| AppError::Storage("The saved records could not be upgraded.".into());
    let version = user_version(connection)?;
    for (index, sql) in migrations.iter().enumerate().skip(version) {
        let transaction = connection.transaction().map_err(failed)?;
        transaction.execute_batch(sql).map_err(failed)?;
        transaction.pragma_update(None, "user_version", index + 1).map_err(failed)?;
        transaction.commit().map_err(failed)?;
    }
    Ok(())
}

pub fn user_version(connection: &Connection) -> Result<usize, AppError> {
    connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|_| AppError::Storage("The saved records could not be read.".into()))
}
`

const VAULT_RS = `use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use crate::error::AppError;

const SAVE_FAILED: &str = "The key could not be saved. The previous key was kept.";

/// Where secrets live. The app uses the login keychain; tests use MemoryStore, so a test run never
/// touches the user's keychain.
pub trait SecretStore: Send + Sync {
    fn read(&self, account: &str) -> Result<Option<String>, AppError>;
    fn write(&self, account: &str, secret: &str) -> Result<(), AppError>;
    fn delete(&self, account: &str) -> Result<(), AppError>;
}

/// Generic passwords in the macOS login keychain (keyring's apple-native store), under one service
/// named after the bundle identifier. Secrets never go to the frontend after they are saved.
pub struct KeychainStore {
    service: String,
}

impl KeychainStore {
    pub fn new(identifier: &str) -> Self {
        Self { service: format!("{identifier}.credentials") }
    }

    fn entry(&self, account: &str) -> Result<keyring::Entry, AppError> {
        keyring::Entry::new(&self.service, account)
            .map_err(|_| AppError::Storage("The keychain could not be opened.".into()))
    }
}

impl SecretStore for KeychainStore {
    fn read(&self, account: &str) -> Result<Option<String>, AppError> {
        match self.entry(account)?.get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(AppError::Storage("The key could not be read from the keychain.".into())),
        }
    }

    fn write(&self, account: &str, secret: &str) -> Result<(), AppError> {
        self.entry(account)?.set_password(secret).map_err(|_| AppError::Storage(SAVE_FAILED.into()))
    }

    fn delete(&self, account: &str) -> Result<(), AppError> {
        match self.entry(account)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(AppError::Storage("The key could not be removed.".into())),
        }
    }
}

/// The test double for SecretStore. It lives here so tests can reach it; production code never
/// constructs it (the packaging test checks run() uses KeychainStore).
#[derive(Default)]
pub struct MemoryStore {
    map: Mutex<HashMap<String, String>>,
}

impl MemoryStore {
    fn values(&self) -> Result<MutexGuard<'_, HashMap<String, String>>, AppError> {
        self.map.lock().map_err(|_| AppError::Storage("The test store is busy.".into()))
    }
}

impl SecretStore for MemoryStore {
    fn read(&self, account: &str) -> Result<Option<String>, AppError> {
        Ok(self.values()?.get(account).cloned())
    }

    fn write(&self, account: &str, secret: &str) -> Result<(), AppError> {
        self.values()?.insert(account.into(), secret.into());
        Ok(())
    }

    fn delete(&self, account: &str) -> Result<(), AppError> {
        self.values()?.remove(account);
        Ok(())
    }
}
`

function kitTestsRs(lib: string, uses: TauriKitUses): string {
  const commandChecks = [
    ...(uses.records ? [`    assert_eq!(invoke(&webview, "schema_version", json!({})).unwrap(), json!(0));`] : []),
    ...(uses.settings ? [`    assert_eq!(invoke(&webview, "save_settings", json!({ "next": {} })).unwrap(), json!({}));`, `    assert_eq!(invoke(&webview, "load_settings", json!({})).unwrap(), json!({}));`] : []),
  ]
  return `use ${lib} as backend;

use serde_json::{json, Value};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY};
use tauri::webview::InvokeRequest;
use tauri::{WebviewWindow, WebviewWindowBuilder};

fn invoke(webview: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
    get_ipc_response(
        webview,
        InvokeRequest {
            cmd: cmd.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            // Debug builds serve the frontend from devUrl; any other origin is remote and refused.
            url: "http://localhost:1420".parse().unwrap(),
            body: InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    )
    .map(|response| response.deserialize::<Value>().unwrap())
}

/// The real builder, context, and capabilities, with the stores in a temporary folder.
#[test]
fn every_command_is_registered_and_allowed() {
    let app = backend::app_builder(mock_builder()).build(backend::context()).expect("app builds");
    let folder = tempfile::tempdir().unwrap();${uses.secrets ? `
    let secrets = Box::new(backend::vault::MemoryStore::default());
    backend::manage_state(&app, folder.path(), secrets).unwrap();` : `
    backend::manage_state(&app, folder.path()).unwrap();`}
    let builder = WebviewWindowBuilder::new(&app, "main", Default::default());
    let webview = builder.build().expect("webview");
${commandChecks.join("\n")}${commandChecks.length ? "\n" : ""}    assert!(invoke(&webview, "no_such_command", json!({})).is_err());
}
${uses.settings ? `
#[test]
fn settings_replace_whole_and_a_missing_file_gives_defaults() {
    let folder = tempfile::tempdir().unwrap();
    let file = backend::settings::SettingsFile::new(folder.path());
    assert_eq!(file.load::<Option<Value>>().unwrap(), None);
    file.save(&json!({ "theme": "dark" })).unwrap();
    assert_eq!(file.load::<Option<Value>>().unwrap(), Some(json!({ "theme": "dark" })));
    let files = std::fs::read_dir(folder.path()).unwrap().count();
    assert_eq!(files, 1, "no temporary file is left behind");
}
` : ""}${uses.records ? `
#[test]
fn migrations_apply_in_order_and_record_the_schema_version() {
    use backend::database::{migrate, user_version};
    let mut connection = rusqlite::Connection::open_in_memory().unwrap();
    let create = "CREATE TABLE sample (id INTEGER PRIMARY KEY)";
    let alter = "ALTER TABLE sample ADD COLUMN name TEXT";
    migrate(&mut connection, &[create]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 1);
    migrate(&mut connection, &[create, alter]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 2);
    migrate(&mut connection, &[create, alter]).unwrap();
    assert_eq!(user_version(&connection).unwrap(), 2, "applied migrations never run twice");
}
` : ""}${uses.secrets ? `
#[test]
fn secrets_round_trip_in_the_test_store() {
    use backend::vault::{MemoryStore, SecretStore};
    let store = MemoryStore::default();
    assert_eq!(store.read("provider").unwrap(), None);
    store.write("provider", "fixture-key").unwrap();
    assert_eq!(store.read("provider").unwrap().as_deref(), Some("fixture-key"));
    store.delete("provider").unwrap();
    assert_eq!(store.read("provider").unwrap(), None);
}
` : ""}`
}

function tauriConf(identity: ProjectIdentity): string {
  return `${JSON.stringify({
    $schema: "https://schema.tauri.app/config/2",
    productName: identity.projectName,
    version: "0.1.0",
    identifier: identity.bundleId,
    build: {
      beforeDevCommand: "npm run dev",
      devUrl: "http://localhost:1420",
      beforeBuildCommand: "npm run build",
      frontendDist: "../dist",
    },
    app: {
      windows: [{ label: "main", title: identity.projectName, width: 960, height: 640, minWidth: 720, minHeight: 480 }],
      // Remote calls go through Rust, so the webview needs only its own files and the IPC channel.
      security: { csp: "default-src 'self'; connect-src ipc: http://ipc.localhost; img-src 'self' asset: data:; style-src 'self'" },
    },
    bundle: {
      active: true,
      targets: ["app"],
      icon: ["icons/32x32.png", "icons/128x128.png", "icons/128x128@2x.png", "icons/icon.icns", "icons/icon.ico"],
      macOS: { minimumSystemVersion: "13.0", signingIdentity: "-" },
    },
  }, null, 2)}\n`
}

function capabilities(uses: TauriKitUses): string {
  return `${JSON.stringify({
    $schema: "../gen/schemas/desktop-schema.json",
    identifier: "default",
    description: "Permissions for the main window: core, plus exactly the plugins lib.rs initializes.",
    windows: ["main"],
    permissions: ["core:default", ...uses.plugins.flatMap(plugin => plugin.permissions)],
  }, null, 2)}\n`
}

function infoPlist(usageDescriptions: ReadonlyArray<readonly [string, string]>): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${usageDescriptions.map(([key, value]) => `    <key>${key}</key>\n    <string>${value}</string>`).join("\n")}
</dict>
</plist>
`
}
