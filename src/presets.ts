export const PRESET_IDS = [
  "native-macos-swiftui-desktop",
  "native-macos-swiftui-menubar",
  "tauri2-rust-typescript-desktop",
  "astro-web",
  "android-kotlin-compose",
] as const

export type PresetId = (typeof PRESET_IDS)[number]
export type OwnerKind = "feature" | "integration" | "data" | "credential" | "permission" | "lifecycle" | "packaging"
export const PERMISSION_CAPABILITIES = ["microphone", "accessibility", "notifications", "filesystem", "network", "camera", "location", "global-input", "clipboard", "background-startup"] as const
export type PermissionCapability = (typeof PERMISSION_CAPABILITIES)[number]
export type PresetRuntimeMode = "native" | "cross-platform" | "static" | "server" | "android"

export interface PresetSemanticInput {
  readonly externalServices: readonly { readonly credentialRequirement: "none" | "api-key" }[]
}

export interface ProjectIdentity {
  readonly projectName: string
  readonly slug: string
  readonly pascalName: string
  readonly moduleName: string
  readonly bundleId: string
  readonly packageName: string
  readonly packagePath: string
}

export interface OwnerFileInput {
  readonly kind: OwnerKind
  readonly slug: string
  readonly pascalName: string
  readonly identity: ProjectIdentity
  readonly serverIntegration?: boolean
  readonly pageFile?: string
}

export interface OwnerFiles {
  readonly implementationFile: string
  readonly focusedTestFile: string
  readonly focusedTestCommand: string
}

export interface PresetContract {
  readonly id: PresetId
  readonly label: string
  readonly platform: string
  readonly implementationMarker: string
  readonly allowedTechnologies: readonly string[]
  readonly forbiddenTechnologies: readonly string[]
  readonly testFramework: string
  readonly sourceLayout: (identity: ProjectIdentity) => readonly string[]
  readonly packagingFiles: (identity: ProjectIdentity) => readonly string[]
  readonly ownerFiles: (input: OwnerFileInput) => OwnerFiles
  readonly registrationFile: (kind: OwnerKind, identity: ProjectIdentity) => string
  readonly runtimeMode: (blueprint: PresetSemanticInput) => PresetRuntimeMode
  readonly runtimeArchitecture: readonly string[]
  readonly integrationBoundary: string
  readonly recoveryRules: readonly string[]
  readonly persistence: {
    readonly enabledDecision: string
    readonly disabledDecision: string
    readonly settingsPlacement: string
    readonly recordsPlacement: string
    readonly temporaryPlacement: string
  }
  readonly credentialPlacement: string
  readonly permissionPatterns: Readonly<Record<PermissionCapability, string>>
  readonly lifecycleRules: readonly string[]
  readonly accessibilityRules: readonly string[]
  readonly validationCommands: readonly ((identity: ProjectIdentity) => string)[]
  readonly packagingRules: readonly string[]
  readonly installationDecision: (identity: ProjectIdentity) => string
  readonly signingDecision: (identity: ProjectIdentity) => string
  readonly outputArtifact: string
  readonly artifactPath: (identity: ProjectIdentity) => string
  readonly completionEvidence: readonly string[]
}

const swiftPermissionPatterns: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Declare NSMicrophoneUsageDescription and request AVCaptureDevice audio authorization before capture.",
  accessibility: "Check AXIsProcessTrustedWithOptions before AXUIElement or synthesized-paste work; denial keeps a manual path.",
  notifications: "Request UNUserNotificationCenter authorization only from a user action and retain in-app status when denied.",
  filesystem: "Use NSOpenPanel and security-scoped bookmarks only for user-selected locations; release every access scope.",
  network: "Use URLSession for explicit outbound requests and declare the outbound network entitlement only if the signed sandbox contract enables it.",
  camera: "Declare NSCameraUsageDescription and request AVCaptureDevice video authorization before capture.",
  location: "Declare NSLocationUsageDescription and use CLLocationManager only while the user-visible feature needs it.",
  "global-input": "Register shortcuts with Carbon RegisterEventHotKey; use an event tap only when required and explain Input Monitoring denial.",
  clipboard: "Use NSPasteboard with representation-preserving snapshot and restoration around explicit copy or paste work.",
  "background-startup": "Use SMAppService.mainApp and expose an explicit login-item toggle; denial leaves manual launch available.",
}

const tauriPermissionPatterns: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Expose one Rust command and a least-privilege Tauri capability for platform microphone authorization; never capture before approval.",
  accessibility: "Keep macOS Accessibility, Windows UI Automation, and Linux accessibility adapters behind one Rust command with denial recovery.",
  notifications: "Use the Tauri notification plugin with an explicit capability and preserve in-app status when the operating system denies alerts.",
  filesystem: "Use the Tauri dialog and filesystem scopes for user-selected paths only; canonicalize every Rust path before access.",
  network: "Perform remote calls in Rust with an allowlisted HTTPS destination and privacy-safe errors.",
  camera: "Expose camera access through a least-privilege capability and platform permission prompt only after an explicit action.",
  location: "Use a platform adapter with foreground-only access unless semantics explicitly require more; denial keeps non-location behavior available.",
  "global-input": "Register global shortcuts through the Tauri global-shortcut plugin and platform permission adapters without broad event capture.",
  clipboard: "Use the Tauri clipboard plugin through an explicit capability and restore prior content when the feature promises preservation.",
  "background-startup": "Use the Tauri autostart plugin behind an explicit user setting and preserve manual launch when denied.",
}

const webPermissionPatterns: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Call getUserMedia for audio only after an explicit control activation and stop every MediaStream track after use.",
  accessibility: "Rely on semantic HTML, focus management, and assistive-technology compatible DOM behavior; no privileged accessibility access exists on the web.",
  notifications: "Request the Notifications API permission only after an explicit opt-in and retain an in-page alternative when denied.",
  filesystem: "Use a user-initiated file input or File System Access API path with a download fallback; never assume persistent access.",
  network: "Use fetch only for documented HTTPS resources; static output performs no background request unless product semantics require it.",
  camera: "Call getUserMedia for video only after an explicit control activation and stop every MediaStream track after use.",
  location: "Use one foreground Geolocation API request after explicit consent and provide a manual alternative.",
  "global-input": "Web pages cannot register system-wide input; scope keyboard shortcuts to the focused page and state that boundary.",
  clipboard: "Use the Async Clipboard API only from a user action and retain a selectable-text fallback when permission is denied.",
  "background-startup": "Static web output cannot start at operating-system login; provide installable or bookmark guidance without claiming background startup.",
}

const androidPermissionPatterns: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Declare android.permission.RECORD_AUDIO and request it at runtime immediately before recording; denial leaves non-recording screens usable.",
  accessibility: "Use an AccessibilityService only when the product explicitly needs it, with a dedicated service declaration and a non-service fallback.",
  notifications: "Declare POST_NOTIFICATIONS on Android 13+ and request it from the reminder opt-in flow; denial keeps in-app status available.",
  filesystem: "Use the Storage Access Framework for user-selected documents and persist URI access only when the user approves it.",
  network: "Declare INTERNET and keep HTTPS calls behind the repository or service boundary with offline and retry states.",
  camera: "Declare CAMERA and request it at runtime from the capture action; denial leaves non-camera behavior available.",
  location: "Declare ACCESS_COARSE_LOCATION and request foreground access only from the location action; provide manual entry when denied.",
  "global-input": "Android does not expose arbitrary system-wide hotkeys to ordinary apps; use supported media, notification, or in-app actions only.",
  clipboard: "Use ClipboardManager only from a user action and never read clipboard contents in the background.",
  "background-startup": "Use WorkManager or exact platform-supported scheduling for bounded work; do not claim unrestricted startup at boot.",
}

function swiftOwnerFiles(input: OwnerFileInput): OwnerFiles {
  if (input.kind === "packaging") {
    return {
      implementationFile: "Scripts/package_app.sh",
      focusedTestFile: `Tests/${input.identity.moduleName}Tests/PackagingContractTests.swift`,
      focusedTestCommand: `swift test --filter PackagingContractTests`,
    }
  }
  const folder = input.kind === "feature" ? "Features" : "Platform"
  const implementationFile = `Sources/${input.identity.moduleName}/${folder}/${input.pascalName}.swift`
  const focusedTestFile = `Tests/${input.identity.moduleName}Tests/${input.pascalName}Tests.swift`
  return { implementationFile, focusedTestFile, focusedTestCommand: `swift test --filter ${input.pascalName}Tests` }
}

function tauriOwnerFiles(input: OwnerFileInput): OwnerFiles {
  if (input.kind === "feature") {
    return {
      implementationFile: `src/features/${input.slug}.ts`,
      focusedTestFile: `tests/features/${input.slug}.test.ts`,
      focusedTestCommand: `npm test -- tests/features/${input.slug}.test.ts`,
    }
  }
  const folder = input.kind === "integration" ? "integrations" : "platform"
  return {
    implementationFile: `src-tauri/src/${folder}/${input.slug}.rs`,
    focusedTestFile: `src-tauri/tests/${input.slug}_tests.rs`,
    focusedTestCommand: `cargo test --manifest-path src-tauri/Cargo.toml --test ${input.slug}_tests`,
  }
}

function astroOwnerFiles(input: OwnerFileInput): OwnerFiles {
  if (input.kind === "feature") {
    if (input.pageFile) {
      return {
        implementationFile: input.pageFile,
        focusedTestFile: `tests/${input.slug}.test.ts`,
        focusedTestCommand: `npm test -- tests/${input.slug}.test.ts`,
      }
    }
    return {
      implementationFile: `src/components/${input.pascalName}.astro`,
      focusedTestFile: `tests/${input.slug}.test.ts`,
      focusedTestCommand: `npm test -- tests/${input.slug}.test.ts`,
    }
  }
  const implementationFile = input.kind === "integration"
    ? input.serverIntegration ? `src/pages/api/${input.slug}.ts` : `src/lib/${input.slug}.ts`
    : `src/lib/${input.slug}.ts`
  const focusedTestFile = `tests/${input.slug}.test.ts`
  return { implementationFile, focusedTestFile, focusedTestCommand: `npm test -- ${focusedTestFile}` }
}

function androidOwnerFiles(input: OwnerFileInput): OwnerFiles {
  const mainRoot = `app/src/main/java/${input.identity.packagePath}`
  const testRoot = `app/src/test/java/${input.identity.packagePath}`
  const folder = input.kind === "feature" ? `feature/${input.slug}` : `platform/${input.slug}`
  const implementationFile = `${mainRoot}/${folder}/${input.pascalName}.kt`
  const focusedTestFile = `${testRoot}/${folder}/${input.pascalName}Test.kt`
  return {
    implementationFile,
    focusedTestFile,
    focusedTestCommand: `./gradlew testDebugUnitTest --tests "${input.identity.packageName}.${folder.replaceAll("/", ".")}.${input.pascalName}Test"`,
  }
}

const swiftDesktop: PresetContract = {
  id: "native-macos-swiftui-desktop",
  label: "Native macOS SwiftUI Desktop",
  platform: "macOS",
  implementationMarker: "WindowGroup",
  allowedTechnologies: ["Swift 6", "SwiftUI", "AppKit bridges where native macOS APIs require them", "Swift Package Manager", "Swift Testing", "Keychain", "UserDefaults", "SQLite3", "Application Support"],
  forbiddenTechnologies: ["iOS", "Catalyst", "Flutter", "Tauri", "Electron"],
  testFramework: "Swift Testing",
  sourceLayout: identity => [
    "Package.swift",
    `Sources/${identity.moduleName}/${identity.moduleName}App.swift`,
    `Sources/${identity.moduleName}/AppState.swift`,
    `Tests/${identity.moduleName}Tests/ContractTests.swift`,
  ],
  packagingFiles: () => ["Resources/Info.plist", "Resources/App.entitlements", "Resources/AppIcon.icns"],
  ownerFiles: swiftOwnerFiles,
  registrationFile: (_kind, identity) => `Sources/${identity.moduleName}/AppState.swift`,
  runtimeMode: () => "native",
  runtimeArchitecture: ["Use an @main SwiftUI App entry with WindowGroup; one @Observable @MainActor AppState owns presentation state, feature services are injected at the composition root, and AppKit adapters remain in Platform owners.", "Run I/O and provider work in cancellable async tasks or actors off the main actor and publish UI state on the main actor."],
  integrationBoundary: "Use one actor-owned URLSession boundary: URLSession.data(for:) for HTTPS requests and URLSessionWebSocketTask for streaming; encode and decode typed Codable DTOs, map failures before they reach UI state, and never expose raw response bodies.",
  recoveryRules: ["Represent operations as idle, active, succeeded, failed, or cancelled and preserve the last valid user state.", "Use explicit user retries only; cancel tasks and close streams, file handles, delegates, and temporary resources on every terminal path."],
  persistence: {
    enabledDecision: "Persistence: enabled with UserDefaults for lightweight settings and SQLite for durable record collections in Application Support.",
    disabledDecision: "Persistence: disabled; keep transient state in memory and write no application records between launches.",
    settingsPlacement: "UserDefaults with versioned keys and explicit reset behavior.",
    recordsPlacement: "SQLite in Application Support with schema-versioned transactional migrations and owner-scoped repositories.",
    temporaryPlacement: "Use FileManager.default.temporaryDirectory with one per-operation subdirectory; retain it only for an explicit recovery decision and verify deletion after success, discard, or exhausted recovery.",
  },
  credentialPlacement: "Store API keys in macOS Keychain only, with the project bundle ID as service and a deterministic provider-account name.",
  permissionPatterns: swiftPermissionPatterns,
  lifecycleRules: ["Use WindowGroup as the Dock-first application entry.", "Cancel tasks and release AppKit delegates during application termination.", "Model window restoration only for product-owned state."],
  accessibilityRules: ["Require VoiceOver and keyboard operation for every control, expose stable accessibility labels, roles, values, and focus order, and verify with SwiftUI accessibility tests plus Accessibility Inspector."],
  validationCommands: [
    () => "swift test",
    () => "swift build -c release",
    () => "./Scripts/package_app.sh",
    identity => `codesign --verify --deep --strict \"dist/${identity.projectName}.app\"`,
    identity => `open \"dist/${identity.projectName}.app\"`,
  ],
  packagingRules: ["Scripts/package_app.sh is the sole packaging authority for release build, app assembly, resources, signing, strict verification, and DMG creation.", "Assemble one native arm64 macOS .app from the Swift Package Manager release executable, Info.plist, App.entitlements, and AppIcon.icns.", "Ad-hoc sign local builds or use an explicitly supplied Developer ID for distribution, then require codesign --verify --deep --strict.", "Register and launch the installed bundle through LaunchServices."],
  installationDecision: identity => `Install the verified signed app at /Applications/${identity.projectName}.app after a scoped rollback copy, then register and launch that exact bundle through LaunchServices.`,
  signingDecision: identity => `Sign ${identity.projectName}.app with an explicit Developer ID for distribution or ad-hoc identity '-' for local proof; codesign strict verification is mandatory.`,
  outputArtifact: "native macOS .app and DMG",
  artifactPath: identity => `dist/${identity.projectName}.app`,
  completionEvidence: ["Swift tests and release build exit successfully.", "The .app has the locked bundle ID and resources.", "codesign strict verification succeeds.", "LaunchServices starts the production process."],
}

const swiftMenubar: PresetContract = {
  ...swiftDesktop,
  id: "native-macos-swiftui-menubar",
  label: "Native macOS SwiftUI Menu Bar",
  implementationMarker: "MenuBarExtra",
  allowedTechnologies: ["Swift 6", "SwiftUI", "MenuBarExtra", "AppKit bridges for hotkeys, event monitoring, floating panels, activation policy, and permissions", "Swift Package Manager", "Swift Testing", "Keychain", "UserDefaults", "SQLite3", "Application Support", "SMAppService"],
  forbiddenTechnologies: ["Dock-first architecture unless semantics require a Dock window", "iOS", "Catalyst", "Flutter", "Tauri", "Electron"],
  sourceLayout: identity => [
    "Package.swift",
    `Sources/${identity.moduleName}/${identity.moduleName}App.swift`,
    `Sources/${identity.moduleName}/MenuBarController.swift`,
    `Sources/${identity.moduleName}/SettingsWindow.swift`,
    `Tests/${identity.moduleName}Tests/ContractTests.swift`,
  ],
  registrationFile: (_kind, identity) => `Sources/${identity.moduleName}/MenuBarController.swift`,
  runtimeArchitecture: ["Use an @main SwiftUI App entry with MenuBarExtra and Settings; one @Observable @MainActor MenuBarController owns menu, settings, HUD, and feature presentation while AppKit adapters remain in Platform owners.", "Run capture and provider work in cancellable actors or async tasks, keep exactly one active recording state machine, and publish UI state on the main actor."],
  lifecycleRules: ["Use MenuBarExtra as the primary application entry and LSUIElement for a menu-bar lifecycle.", "Open a dedicated settings window without changing the default activation policy.", "Use SMAppService for the explicit login-item setting.", "Release global hotkeys, event monitors, floating panels, and temporary resources during termination."],
}

const tauriDesktop: PresetContract = {
  id: "tauri2-rust-typescript-desktop",
  label: "Tauri 2 Rust + TypeScript Desktop",
  platform: "macOS, Windows, and Linux",
  implementationMarker: "tauri::Builder",
  allowedTechnologies: ["Tauri 2", "Rust", "TypeScript", "Vite", "DOM-driven frontend", "platform-safe Tauri commands and capabilities", "reqwest", "tokio-tungstenite when streaming is required", "Vitest", "Cargo test"],
  forbiddenTechnologies: ["Electron", "Flutter", "SwiftUI application architecture"],
  testFramework: "Vitest for frontend behavior and Cargo test for Rust boundaries",
  sourceLayout: identity => [
    "package.json",
    "src/main.ts",
    "src/style.css",
    "tests/contract.test.ts",
    "src-tauri/Cargo.toml",
    "src-tauri/src/main.rs",
    "src-tauri/src/lib.rs",
    "src-tauri/tests/contract_tests.rs",
    "src-tauri/tauri.conf.json",
    "src-tauri/capabilities/default.json",
    `src-tauri/icons/${identity.slug}.png`,
  ],
  packagingFiles: () => [],
  ownerFiles: tauriOwnerFiles,
  registrationFile: kind => kind === "feature" ? "src/main.ts" : "src-tauri/src/lib.rs",
  runtimeMode: () => "cross-platform",
  runtimeArchitecture: ["The TypeScript DOM frontend owns presentation and sends typed Tauri invoke requests; Rust commands own filesystem, network, credential, persistence, and platform operations behind least-privilege capabilities.", "Managed Rust state owns cancellable operations and returns allowlisted serializable results; frontend state never receives secrets, raw provider bodies, or unrestricted paths."],
  integrationBoundary: "Use reqwest::Client inside a dedicated Rust integration owner for HTTPS and tokio_tungstenite::connect_async only when streaming is required; expose typed DTOs through Tauri commands and keep credentials and raw responses in Rust memory only.",
  recoveryRules: ["Return one allowlisted error enum through each Tauri command and preserve the last valid frontend state.", "Use cancellation tokens and scoped Rust resources; roll back transactions and remove temporary files before reporting a terminal result."],
  persistence: {
    enabledDecision: "Persistence: enabled and local-first; settings use atomic JSON and record collections use SQLite through a Rust repository boundary.",
    disabledDecision: "Persistence: disabled; keep transient state in memory and create no app-data files.",
    settingsPlacement: "Atomic JSON in the Tauri app-data directory through one Rust command boundary.",
    recordsPlacement: "SQLite in the Tauri app-data directory with migrations and transactions owned by Rust.",
    temporaryPlacement: "Use the Tauri app-cache directory with one random per-operation file owned by Rust; retain only for explicit recovery and delete on success, discard, cancellation, or exhausted recovery.",
  },
  credentialPlacement: "Store external credentials through a Rust platform credential-vault adapter; never expose stored values to the frontend after insertion.",
  permissionPatterns: tauriPermissionPatterns,
  lifecycleRules: ["Use tauri::Builder as the cross-platform desktop entry.", "Close managed tasks, database handles, temporary files, and platform listeners on exit.", "Keep platform differences behind Rust commands and capability files."],
  accessibilityRules: ["Use semantic HTML, native controls, ARIA only where native semantics are insufficient, visible focus, full keyboard operation, reduced motion, and Vitest DOM accessibility assertions."],
  validationCommands: [
    () => "npm run typecheck",
    () => "npm test",
    () => "cargo fmt --manifest-path src-tauri/Cargo.toml -- --check",
    () => "cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings",
    () => "cargo test --manifest-path src-tauri/Cargo.toml",
    () => "npm run tauri:build",
  ],
  packagingRules: ["Build the frontend with Vite and the native boundary with Cargo.", "Bundle macOS, Windows, and Linux targets with Tauri 2.", "Use least-privilege capabilities for every command and plugin.", "Verify the platform installer or bundle before launch smoke."],
  installationDecision: () => "Install the selected platform installer or bundle using the native DMG app copy, MSI installer, or verified Linux package flow; then launch the installed identity and preserve rollback evidence.",
  signingDecision: () => "Use Tauri platform signing: macOS codesign/notarization, Windows code signing, and verified Linux package checksums; local macOS proof may use ad-hoc signing.",
  outputArtifact: "DMG/MSI/AppImage platform bundles",
  artifactPath: identity => `src-tauri/target/release/bundle/${identity.slug}`,
  completionEvidence: ["TypeScript, Vitest, Rust format, Clippy, and Cargo tests pass.", "Tauri builds platform bundles from the locked capabilities.", "The selected platform bundle installs and launches.", "Local data and temporary-resource cleanup survive restart smoke."],
}

const astroWeb: PresetContract = {
  id: "astro-web",
  label: "Astro Web",
  platform: "Web",
  implementationMarker: "astro.config.mjs",
  allowedTechnologies: ["Astro", "TypeScript", "semantic HTML", "accessible CSS", "minimal client-side JavaScript", "static output by default", "Vitest", "accessibility and performance audits"],
  forbiddenTechnologies: ["Next.js", "Tauri", "Flutter", "native mobile architecture"],
  testFramework: "Vitest plus browser accessibility checks",
  sourceLayout: () => [
    "package.json",
    "astro.config.mjs",
    "tsconfig.json",
    "src/pages/index.astro",
    "src/layouts/BaseLayout.astro",
    "src/styles/global.css",
    "tests/contract.test.ts",
    "tests/accessibility.test.ts",
    "tests/performance.test.ts",
  ],
  packagingFiles: () => [],
  ownerFiles: astroOwnerFiles,
  registrationFile: kind => kind === "feature" ? "src/pages/index.astro" : "astro.config.mjs",
  runtimeMode: blueprint => blueprint.externalServices.some(service => service.credentialRequirement !== "none") ? "server" : "static",
  runtimeArchitecture: ["Astro components render the content-first shell at build or request time; use client islands only for interaction that cannot be expressed with native HTML and CSS.", "Static output is mandatory unless a server-held credential requires an explicit adapter; browser code never receives deployment secrets."],
  integrationBoundary: "Use standards-based fetch with typed local request and response validators; credentialed calls run only in Astro server endpoints using import.meta.env, while public browser calls use allowlisted HTTPS URLs and AbortController cancellation.",
  recoveryRules: ["Preserve entered form content across validation, transport, timeout, and server failures and require an explicit resubmission.", "Remove event listeners, abort fetches, stop media tracks, and revoke object URLs when an island unmounts."],
  persistence: {
    enabledDecision: "Persistence: enabled through Astro content collections at build time by default; browser IndexedDB is used only when product semantics explicitly require client-side retention without build-time content.",
    disabledDecision: "Persistence: disabled. No application data is retained between visits; static assets use ordinary HTTP caching only.",
    settingsPlacement: "Build-time content schema in src/content/config.ts; browser-only settings use IndexedDB only when semantics explicitly require client-side retention.",
    recordsPlacement: "Public catalog records live in src/content/{collection}/ and compile through getCollection(); authenticated remote records require an explicit server-rendered contract.",
    temporaryPlacement: "Keep temporary values in memory as Blob or structured state and revoke object URLs on completion; do not mirror build-time catalog data into IndexedDB.",
  },
  credentialPlacement: "Never ship service credentials to the browser; a required secret switches output to server rendering and reads the deployment secret at request time.",
  permissionPatterns: webPermissionPatterns,
  lifecycleRules: ["Generate static output by default.", "Enable server rendering only when a server-held credential or remote account contract makes it necessary.", "Clean up event listeners, observers, media tracks, and object URLs when interactive components unmount."],
  accessibilityRules: ["Meet WCAG 2.2 AA with semantic landmarks, ordered headings, keyboard access, visible focus, text alternatives, reduced motion, and automated accessibility checks."],
  validationCommands: [
    () => "npm run check",
    () => "npm test",
    () => "npm run test:a11y",
    () => "npm run build",
    () => "npm run audit:performance",
  ],
  packagingRules: ["Generate static output unless the graph records a server-required decision.", "Emit semantic metadata, sitemap, robots rules, and canonical URLs.", "Run accessibility, link, SEO metadata, and performance gates against the production build.", "Deploy the dist/ output or the documented server adapter artifact."],
  installationDecision: () => "Deploy dist/ or the locked server-adapter artifact to the target HTTPS host, verify the deployed commit and asset hashes, then run link, accessibility, and performance smoke checks against that URL.",
  signingDecision: () => "No application code signature applies; deploy the verified production artifact over HTTPS with immutable asset hashes.",
  outputArtifact: "dist/ static site or explicit server adapter output",
  artifactPath: () => "dist/",
  completionEvidence: ["Type, content, unit, and production build checks pass.", "Accessibility has no critical findings.", "SEO metadata and internal links validate.", "The production performance budget passes."],
}

const androidCompose: PresetContract = {
  id: "android-kotlin-compose",
  label: "Android Kotlin Compose",
  platform: "Android",
  implementationMarker: "Jetpack Compose",
  allowedTechnologies: ["Kotlin", "Jetpack Compose", "Material 3", "Gradle Kotlin DSL", "coroutines", "StateFlow", "ViewModel", "repository or service boundaries", "JUnit", "Compose UI tests", "instrumentation tests"],
  forbiddenTechnologies: ["iOS", "Flutter", "React Native", "Tauri", "XML-first UI architecture"],
  testFramework: "JUnit unit tests, Compose UI tests, and Android instrumentation tests where platform behavior requires them",
  sourceLayout: identity => [
    "settings.gradle.kts",
    "build.gradle.kts",
    "gradle/libs.versions.toml",
    "app/build.gradle.kts",
    "app/src/main/AndroidManifest.xml",
    `app/src/main/java/${identity.packagePath}/MainActivity.kt`,
    `app/src/main/java/${identity.packagePath}/App.kt`,
    `app/src/test/java/${identity.packagePath}/ContractTest.kt`,
    `app/src/androidTest/java/${identity.packagePath}/LaunchTest.kt`,
  ],
  packagingFiles: () => [],
  ownerFiles: androidOwnerFiles,
  registrationFile: (kind, identity) => kind === "permission" ? "app/src/main/AndroidManifest.xml" : `app/src/main/java/${identity.packagePath}/App.kt`,
  runtimeMode: () => "android",
  runtimeArchitecture: ["MainActivity.setContent hosts a Material 3 Compose tree; ViewModels expose immutable StateFlow UI state and call repository or platform-service owners through constructor-injected interfaces.", "Collect state with lifecycle-aware Compose APIs, run I/O in structured coroutines off the main dispatcher, and keep Activity instances free of durable state."],
  integrationBoundary: "Use HttpsURLConnection inside a coroutine-backed service or repository owner, map JSON into locked Kotlin data classes before returning, close streams in finally blocks, and expose only privacy-safe typed failures to ViewModels.",
  recoveryRules: ["Model loading, success, empty, denied, failed, and cancelled states explicitly in immutable UI state.", "Use structured coroutine cancellation, Room transactions, and cache-file cleanup; retries and provider changes always require an explicit user action."],
  persistence: {
    enabledDecision: "Persistence: enabled with DataStore for settings and Room for record collections behind repository boundaries.",
    disabledDecision: "Persistence: disabled; ViewModel state is transient and no application records survive process death.",
    settingsPlacement: "Preferences DataStore with typed keys and explicit reset behavior.",
    recordsPlacement: "Room entities, DAO transactions, migrations, and repository APIs for durable records.",
    temporaryPlacement: "Use Context.cacheDir with one per-operation file; retain only for explicit recovery and delete after success, discard, cancellation, or exhausted recovery.",
  },
  credentialPlacement: "Store app-owned credentials with Android Keystore-backed encryption and never expose decrypted values to Compose state.",
  permissionPatterns: androidPermissionPatterns,
  lifecycleRules: ["Collect StateFlow with lifecycle-aware Compose APIs.", "Keep durable work in repositories or WorkManager rather than Activity instances.", "Release sensors, media, callbacks, and temporary files when lifecycle ownership ends."],
  accessibilityRules: ["Expose Compose semantics for TalkBack, content descriptions for non-text controls, logical traversal, 48dp targets, scalable text, and Compose accessibility tests."],
  validationCommands: [
    () => "./gradlew test",
    () => "./gradlew lintDebug",
    () => "./gradlew connectedDebugAndroidTest",
    () => "./gradlew assembleDebug",
    () => "adb install -r app/build/outputs/apk/debug/app-debug.apk",
  ],
  packagingRules: ["Use Gradle Kotlin DSL and a version catalog.", "Build an Android-only APK with the locked applicationId.", "Declare only required permissions and test denied paths.", "Install the debug APK on an identified emulator or device for launch smoke."],
  installationDecision: identity => `Re-identify the adb target, run adb install -r app/build/outputs/apk/debug/app-debug.apk, and launch applicationId ${identity.packageName} before collecting device smoke evidence.`,
  signingDecision: identity => `Sign debug builds with the Gradle debug key and release builds with a protected release keystore for applicationId ${identity.packageName}; never commit keystore material.`,
  outputArtifact: "app-debug.apk",
  artifactPath: () => "app/build/outputs/apk/debug/app-debug.apk",
  completionEvidence: ["Unit, lint, Compose UI, and required instrumentation tests pass.", "assembleDebug produces the expected APK.", "The manifest contains only derived permissions.", "adb installs and launches the locked applicationId."],
}

export const PRESETS: Readonly<Record<PresetId, PresetContract>> = Object.freeze({
  "native-macos-swiftui-desktop": swiftDesktop,
  "native-macos-swiftui-menubar": swiftMenubar,
  "tauri2-rust-typescript-desktop": tauriDesktop,
  "astro-web": astroWeb,
  "android-kotlin-compose": androidCompose,
})

export function isPresetId(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value)
}
