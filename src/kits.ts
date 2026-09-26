import type { NormalizedBlueprint } from "./compiler"
import type { PresetId, ProjectIdentity } from "./presets"

// A starter kit is tested code for the platform plumbing a preset's packet otherwise describes in
// prose: the app entry, visible errors, storage helpers, and packaging. The agent copies it into the
// project before the first task, so those rules hold by construction instead of by reading.
export interface KitFile {
  readonly path: string
  readonly content: string
}

export const KIT_README = "README.md"

type NativeVariant = "desktop" | "menubar"

// Privacy usage strings for declared needs; macOS terminates an app that uses the camera, microphone,
// or location without them. Shared by the kit Info.plist and the TRD packaging details.
export function nativeUsageDescriptions(identity: ProjectIdentity, platformNeeds: readonly string[]): ReadonlyArray<readonly [string, string]> {
  return [
    ...(platformNeeds.includes("audio-input") ? [["NSMicrophoneUsageDescription", `${identity.projectName} uses the microphone only during a recording the user explicitly starts.`] as const] : []),
    ...(platformNeeds.includes("camera") ? [["NSCameraUsageDescription", `${identity.projectName} uses the camera only during a capture the user explicitly starts.`] as const] : []),
    ...(platformNeeds.includes("location") ? [
      ["NSLocationUsageDescription", `${identity.projectName} uses your location only for the feature you are using.`] as const,
      ["NSLocationWhenInUseUsageDescription", `${identity.projectName} uses your location only for the feature you are using.`] as const,
    ] : []),
  ]
}

export function presetKit(presetId: PresetId, identity: ProjectIdentity, blueprint: NormalizedBlueprint): readonly KitFile[] {
  if (presetId === "native-macos-swiftui-desktop") return nativeMacKit(identity, blueprint, "desktop")
  if (presetId === "native-macos-swiftui-menubar") return nativeMacKit(identity, blueprint, "menubar")
  return []
}

// Project paths the kit provides, excluding its own README.
export function kitProjectPaths(kit: readonly KitFile[]): string[] {
  return kit.filter(file => file.path !== KIT_README).map(file => file.path)
}

function nativeMacKit(identity: ProjectIdentity, blueprint: NormalizedBlueprint, variant: NativeVariant): KitFile[] {
  const module = identity.moduleName
  const storage = new Set(blueprint.persistenceNeeds.map(need => need.storage))
  const usesRecords = storage.has("records")
  const usesAppFiles = storage.has("app-files")
  // SQLite commits in transactions and UserDefaults per value, so the file writer is needed only when
  // an atomic-replace object lands in a file.
  const writesAtomically = blueprint.persistenceNeeds.some(need => need.writeMode === "atomic-replace" && (need.storage === "document" || need.storage === "app-files"))
  const usageDescriptions = nativeUsageDescriptions(identity, blueprint.platformNeeds)
  const storesCredentials = blueprint.externalServices.some(service => service.credentialRequirement !== "none")
    || blueprint.domainData.some(item => item.storage === "secret")
  const launchesAtLogin = blueprint.platformNeeds.includes("launch-at-login")
  const source = (name: string) => `Sources/${module}/${name}`
  const platform = (name: string) => `Sources/${module}/Platform/${name}`

  const files: KitFile[] = [
    { path: "Package.swift", content: packageSwift(module, usesRecords) },
    ...(variant === "desktop"
      ? [
        { path: source(`${module}App.swift`), content: appSwift(identity) },
        { path: source("AppState.swift"), content: appStateSwift(identity) },
      ]
      : [
        { path: source(`${module}App.swift`), content: menuBarAppSwift(identity) },
        { path: source("MenuBarController.swift"), content: menuBarControllerSwift(identity) },
        { path: source("SettingsWindow.swift"), content: SETTINGS_WINDOW_SWIFT },
      ]),
    { path: platform("ErrorCenter.swift"), content: ERROR_CENTER_SWIFT },
    ...(variant === "menubar" && launchesAtLogin ? [{ path: platform("LoginItem.swift"), content: LOGIN_ITEM_SWIFT }] : []),
    ...(writesAtomically || usesAppFiles ? [{ path: platform("AtomicFileWriter.swift"), content: ATOMIC_FILE_WRITER_SWIFT }] : []),
    ...(usesAppFiles ? [{ path: platform("AppFileStore.swift"), content: appFileStoreSwift(identity) }] : []),
    ...(usesRecords ? [{ path: platform("SQLiteDatabase.swift"), content: sqliteDatabaseSwift(identity) }] : []),
    ...(storesCredentials ? [{ path: platform("KeychainStore.swift"), content: keychainStoreSwift(identity) }] : []),
    { path: `Tests/${module}Tests/KitTests.swift`, content: kitTestsSwift(module, { usesRecords, usesAppFiles, writesAtomically, storesCredentials }) },
    { path: "Scripts/package_app.sh", content: packageAppScript(identity) },
    { path: "Resources/Info.plist", content: infoPlist(identity, usageDescriptions, variant === "menubar") },
    { path: "Resources/App.entitlements", content: ENTITLEMENTS_PLIST },
  ]
  return [{ path: KIT_README, content: kitReadme(identity, files.map(file => file.path), variant) }, ...files]
}

function kitReadme(identity: ProjectIdentity, paths: readonly string[], variant: NativeVariant): string {
  return [
    `# ${identity.projectName} starter kit`,
    "",
    "Tested starting code for the platform plumbing in TRD.md. Before TASK-01, copy every file below from kit/ to the same path in the project root. The task that owns a file starts from this content and extends it; keep every behavior listed here.",
    "",
    ...paths.map(path => `- ${path}`),
    "",
    "## Behavior to keep",
    "",
    ...(variant === "desktop"
      ? [
        "- The app entry uses @NSApplicationDelegateAdaptor and a WindowGroup; add app commands with CommandGroup(after:) so File > New Window and Dock-click reopen keep working.",
        "- Every feature reports a user-visible failure through AppState.errors.report(_:), which the root view shows as one alert; never swallow an error the PRD says the user sees.",
      ]
      : [
        "- The app entry is a MenuBarExtra with a Settings scene and no Dock icon (LSUIElement); the AppDelegate owns MenuBarController so launch-time work starts in didFinishLaunching, before the menu is first opened.",
        "- Every feature reports a user-visible failure through MenuBarController.errors.report(_:), which the menu shows as an ErrorBanner; never swallow an error the PRD says the user sees.",
        "- SettingsButton activates the app before opening Settings, so the Settings window comes to the front.",
        "- LoginItem, when present, is the only place that registers or unregisters the login item through SMAppService.mainApp; show the toggle as on only when the status is enabled, and when it requires approval, say so and offer LoginItem.openSystemSettings().",
      ]),
    "- AtomicFileWriter writes a temporary file in the destination's own folder and swaps it in whole.",
    "- AppFileStore keeps app-owned copies under Application Support with generated names; store only the returned file name.",
    "- SQLiteDatabase applies migrations in order and records the schema version in PRAGMA user_version; append new migrations, never edit applied ones.",
    "- Scripts/package_app.sh builds, signs, and verifies dist/; with --install it moves the old app to dist/rollback/ (never inside /Applications), installs, registers, and launches the bundle.",
    "- KeychainStore, when present, is the only place secrets are stored: generic passwords in the login keychain under the bundle ID's credentials service.",
    "- KitTests covers the kit; keep it passing.",
    "",
  ].join("\n")
}

function packageSwift(module: string, usesRecords: boolean): string {
  return `// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "${module}",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "${module}",
            path: "Sources/${module}"${usesRecords ? `,
            linkerSettings: [.linkedLibrary("sqlite3")]` : ""}
        ),
        .testTarget(
            name: "${module}Tests",
            dependencies: ["${module}"],
            path: "Tests/${module}Tests"
        ),
    ]
)
`
}

function appSwift(identity: ProjectIdentity): string {
  return `import AppKit
import SwiftUI

@main
struct ${identity.moduleName}App: App {
    // AppKit callbacks come through the adaptor; assigning NSApplication.shared.delegate would replace
    // the delegate SwiftUI uses for window reopening.
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState.makeProduction()

    var body: some Scene {
        WindowGroup {
            appState.rootView
                .environment(appState)
                .presentsErrors(appState.errors, title: "${identity.projectName}")
                .onAppear { appDelegate.appState = appState }
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var appState: AppState?

    func applicationWillTerminate(_ notification: Notification) {
        appState?.willTerminate()
    }
}
`
}

function appStateSwift(identity: ProjectIdentity): string {
  return `import SwiftUI

// The composition root: feature tasks add their owners here and replace rootView with the main window.
@Observable
@MainActor
final class AppState {
    let errors: ErrorCenter

    init(errors: ErrorCenter) {
        self.errors = errors
    }

    static func makeProduction() -> AppState {
        AppState(errors: ErrorCenter())
    }

    var rootView: some View {
        Text("${identity.projectName}")
            .frame(minWidth: 640, minHeight: 420)
    }

    func willTerminate() {}
}
`
}

function menuBarAppSwift(identity: ProjectIdentity): string {
  return `import AppKit
import SwiftUI

@main
struct ${identity.moduleName}App: App {
    // AppKit callbacks come through the adaptor; the delegate owns the controller so launch-time work
    // starts before the menu is first opened.
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra {
            appDelegate.controller.menuContent
                .environment(appDelegate.controller)
        } label: {
            Image(systemName: "menubar.rectangle")
                .accessibilityLabel("${identity.projectName}")
        }
        .menuBarExtraStyle(.window)

        Settings {
            SettingsWindow()
                .environment(appDelegate.controller)
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    let controller = MenuBarController.makeProduction()

    func applicationDidFinishLaunching(_ notification: Notification) {
        controller.didFinishLaunching()
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller.willTerminate()
    }
}
`
}

function menuBarControllerSwift(identity: ProjectIdentity): string {
  return `import AppKit
import SwiftUI

// The composition root: feature tasks add their owners here and fill menuContent.
@Observable
@MainActor
final class MenuBarController {
    let errors: ErrorCenter

    init(errors: ErrorCenter) {
        self.errors = errors
    }

    static func makeProduction() -> MenuBarController {
        MenuBarController(errors: ErrorCenter())
    }

    var menuContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            ErrorBanner(center: errors)
            Text("${identity.projectName}")
                .font(.headline)
            Divider()
            SettingsButton()
            Button("Quit ${identity.projectName}") { NSApp.terminate(nil) }
        }
        .padding(12)
        .frame(width: 300)
    }

    /// Starts the work the app does from launch, such as watching a system source.
    func didFinishLaunching() {}

    func willTerminate() {}
}

// A menu-bar app is an accessory app, so it activates itself before opening Settings; otherwise the
// Settings window opens behind the frontmost app.
struct SettingsButton: View {
    @Environment(\\.openSettings) private var openSettings

    var body: some View {
        Button("Settings…") {
            NSApp.activate()
            openSettings()
        }
    }
}
`
}

const SETTINGS_WINDOW_SWIFT = `import SwiftUI

// Feature tasks add their settings controls here.
struct SettingsWindow: View {
    @Environment(MenuBarController.self) private var controller

    var body: some View {
        Form {
            ErrorBanner(center: controller.errors)
        }
        .padding(20)
        .frame(width: 380)
    }
}
`

const LOGIN_ITEM_SWIFT = `import ServiceManagement

// The only place that registers or unregisters the app as a login item. Registration can end in
// requiresApproval, which the user resolves in System Settings > Login Items; show the toggle as on
// only when the status is enabled.
@MainActor
enum LoginItem {
    static var status: SMAppService.Status {
        SMAppService.mainApp.status
    }

    static var isEnabled: Bool {
        status == .enabled
    }

    static var needsApproval: Bool {
        status == .requiresApproval
    }

    static func setEnabled(_ enabled: Bool) throws {
        if enabled {
            try SMAppService.mainApp.register()
        } else {
            try SMAppService.mainApp.unregister()
        }
    }

    static func openSystemSettings() {
        SMAppService.openSystemSettingsLoginItems()
    }
}
`

function keychainStoreSwift(identity: ProjectIdentity): string {
  return `import Foundation
import Security

struct KeychainError: Error, Equatable {
    let status: OSStatus
}

// Secrets live only here, as generic passwords in the login keychain under ${identity.bundleId}.credentials.
// The data protection keychain (kSecUseDataProtectionKeychain) needs a team-signed keychain entitlement
// that the ad-hoc local build lacks, so it is not used. After each ad-hoc rebuild macOS may ask once
// whether the app may read its item; that prompt is expected.
struct KeychainStore: Sendable {
    let service: String

    init(service: String = "${identity.bundleId}.credentials") {
        self.service = service
    }

    func save(_ secret: String, account: String) throws {
        let query = baseQuery(account: account)
        let data = Data(secret.utf8)
        let updateStatus = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if updateStatus == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            let addStatus = SecItemAdd(item as CFDictionary, nil)
            guard addStatus == errSecSuccess else { throw KeychainError(status: addStatus) }
        } else if updateStatus != errSecSuccess {
            throw KeychainError(status: updateStatus)
        }
    }

    func read(account: String) throws -> String? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw KeychainError(status: status) }
        return String(decoding: data, as: UTF8.self)
    }

    func delete(account: String) throws {
        let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw KeychainError(status: status) }
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
`
}

const ERROR_CENTER_SWIFT = `import SwiftUI

// One place for user-visible failures: features report here and the root view shows an alert.
@Observable
@MainActor
final class ErrorCenter {
    private(set) var message: String?

    func report(_ message: String) {
        self.message = message
    }

    func dismiss() {
        message = nil
    }
}

// Inline form of the same message, for surfaces without a window to host an alert (a menu-bar menu).
struct ErrorBanner: View {
    let center: ErrorCenter

    var body: some View {
        if let message = center.message {
            HStack(alignment: .top, spacing: 8) {
                Text(message)
                    .foregroundStyle(.red)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Button("Dismiss") { center.dismiss() }
            }
            .accessibilityElement(children: .combine)
        }
    }
}

private struct ErrorAlert: ViewModifier {
    let center: ErrorCenter
    let title: String

    func body(content: Content) -> some View {
        content.alert(
            title,
            isPresented: Binding(
                get: { center.message != nil },
                set: { isPresented in if !isPresented { center.dismiss() } }
            ),
            actions: { Button("OK", role: .cancel) { center.dismiss() } },
            message: { Text(center.message ?? "") }
        )
    }
}

extension View {
    func presentsErrors(_ center: ErrorCenter, title: String) -> some View {
        modifier(ErrorAlert(center: center, title: title))
    }
}
`

const ATOMIC_FILE_WRITER_SWIFT = `import Foundation

// Writes a temporary file in the destination's own folder, then swaps it in whole, so a failed write
// leaves any previous file intact.
enum AtomicFileWriter {
    static func write(_ data: Data, to destination: URL) throws {
        let temporary = destination.deletingLastPathComponent()
            .appendingPathComponent(".\\(destination.lastPathComponent).\\(UUID().uuidString).tmp")
        do {
            try data.write(to: temporary)
            if FileManager.default.fileExists(atPath: destination.path) {
                _ = try FileManager.default.replaceItemAt(destination, withItemAt: temporary)
            } else {
                try FileManager.default.moveItem(at: temporary, to: destination)
            }
        } catch {
            // Best-effort cleanup; the original error is what the caller reports.
            try? FileManager.default.removeItem(at: temporary)
            throw error
        }
    }
}
`

function appFileStoreSwift(identity: ProjectIdentity): string {
  return `import Foundation

// The app's own file library under Application Support/${identity.bundleId}/Files. Copies get generated
// names; callers store only the returned file name, never an absolute path.
struct AppFileStore: Sendable {
    let folder: URL

    static func production() throws -> AppFileStore {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        return try AppFileStore(folder: support
            .appendingPathComponent("${identity.bundleId}", isDirectory: true)
            .appendingPathComponent("Files", isDirectory: true))
    }

    init(folder: URL) throws {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        self.folder = folder
    }

    /// Copies a file the user chose into the library and returns the stored file name.
    func importCopy(of source: URL) throws -> String {
        let fileExtension = source.pathExtension.lowercased()
        let name = fileExtension.isEmpty ? UUID().uuidString : "\\(UUID().uuidString).\\(fileExtension)"
        let temporary = folder.appendingPathComponent(".\\(name).tmp")
        do {
            try FileManager.default.copyItem(at: source, to: temporary)
            try FileManager.default.moveItem(at: temporary, to: url(for: name))
        } catch {
            // Best-effort cleanup; the original error is what the caller reports.
            try? FileManager.default.removeItem(at: temporary)
            throw error
        }
        return name
    }

    func url(for name: String) -> URL {
        folder.appendingPathComponent(name)
    }

    func remove(_ name: String) throws {
        try FileManager.default.removeItem(at: url(for: name))
    }
}
`
}

function sqliteDatabaseSwift(identity: ProjectIdentity): string {
  return `import Foundation
import SQLite3

enum SQLiteValue: Sendable, Equatable {
    case null
    case integer(Int64)
    case real(Double)
    case text(String)
}

struct SQLiteError: Error, Equatable {
    let message: String
}

// One SQLite file whose schema version lives in PRAGMA user_version. Migrations run in order, each in
// its own transaction; append new ones and never edit applied ones. Own an instance from a single
// isolation domain, such as a DataStore actor.
final class SQLiteDatabase {
    private let handle: OpaquePointer
    private static let transient = unsafeBitCast(OpaquePointer(bitPattern: -1), to: sqlite3_destructor_type.self)

    static func productionURL() throws -> URL {
        let support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let folder = support.appendingPathComponent("${identity.bundleId}", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder.appendingPathComponent("${identity.slug}.sqlite3")
    }

    init(url: URL, migrations: [String]) throws {
        var pointer: OpaquePointer?
        let status = sqlite3_open_v2(url.path, &pointer, SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE, nil)
        guard status == SQLITE_OK, let pointer else {
            let message = pointer.map { String(cString: sqlite3_errmsg($0)) } ?? "Could not open the database."
            sqlite3_close(pointer)
            throw SQLiteError(message: message)
        }
        handle = pointer
        let applied = try userVersion()
        for (index, migration) in migrations.enumerated() where index >= applied {
            try transaction {
                try executeScript(migration)
                try executeScript("PRAGMA user_version = \\(index + 1)")
            }
        }
    }

    deinit {
        sqlite3_close(handle)
    }

    func userVersion() throws -> Int {
        guard case .integer(let version) = try query("PRAGMA user_version").first?.first else { return 0 }
        return Int(version)
    }

    /// Runs body in one transaction; any thrown error rolls the whole transaction back.
    func transaction<T>(_ body: () throws -> T) throws -> T {
        try executeScript("BEGIN IMMEDIATE")
        do {
            let result = try body()
            try executeScript("COMMIT")
            return result
        } catch {
            _ = sqlite3_exec(handle, "ROLLBACK", nil, nil, nil)
            throw error
        }
    }

    func execute(_ sql: String, _ values: [SQLiteValue] = []) throws {
        let statement = try prepare(sql, values)
        defer { sqlite3_finalize(statement) }
        guard sqlite3_step(statement) == SQLITE_DONE else { throw currentError() }
    }

    func query(_ sql: String, _ values: [SQLiteValue] = []) throws -> [[SQLiteValue]] {
        let statement = try prepare(sql, values)
        defer { sqlite3_finalize(statement) }
        var rows: [[SQLiteValue]] = []
        while true {
            let status = sqlite3_step(statement)
            if status == SQLITE_DONE { return rows }
            guard status == SQLITE_ROW else { throw currentError() }
            rows.append((0..<sqlite3_column_count(statement)).map { column(statement, $0) })
        }
    }

    private func executeScript(_ sql: String) throws {
        guard sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK else { throw currentError() }
    }

    private func prepare(_ sql: String, _ values: [SQLiteValue]) throws -> OpaquePointer {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK, let statement else { throw currentError() }
        for (offset, value) in values.enumerated() {
            let index = Int32(offset + 1)
            let status: Int32
            switch value {
            case .null: status = sqlite3_bind_null(statement, index)
            case .integer(let number): status = sqlite3_bind_int64(statement, index, number)
            case .real(let number): status = sqlite3_bind_double(statement, index, number)
            case .text(let text): status = sqlite3_bind_text(statement, index, text, -1, Self.transient)
            }
            guard status == SQLITE_OK else {
                sqlite3_finalize(statement)
                throw currentError()
            }
        }
        return statement
    }

    private func column(_ statement: OpaquePointer, _ index: Int32) -> SQLiteValue {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_INTEGER: return .integer(sqlite3_column_int64(statement, index))
        case SQLITE_FLOAT: return .real(sqlite3_column_double(statement, index))
        case SQLITE_TEXT: return .text(String(cString: sqlite3_column_text(statement, index)))
        default: return .null
        }
    }

    private func currentError() -> SQLiteError {
        SQLiteError(message: String(cString: sqlite3_errmsg(handle)))
    }
}
`
}

function kitTestsSwift(module: string, uses: { usesRecords: boolean; usesAppFiles: boolean; writesAtomically: boolean; storesCredentials: boolean }): string {
  const atomic = uses.writesAtomically || uses.usesAppFiles
  return `import Foundation
import Testing
@testable import ${module}

@Suite struct KitTests {
    private func temporaryFolder() throws -> URL {
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("kit-\\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }

    @MainActor @Test func errorCenterShowsAndDismissesAMessage() {
        let center = ErrorCenter()
        center.report("Could not save.")
        #expect(center.message == "Could not save.")
        center.dismiss()
        #expect(center.message == nil)
    }
${atomic ? `
    @Test func atomicWriterReplacesTheWholeFile() throws {
        let destination = try temporaryFolder().appendingPathComponent("out.txt")
        try AtomicFileWriter.write(Data("first".utf8), to: destination)
        try AtomicFileWriter.write(Data("second".utf8), to: destination)
        #expect(try String(contentsOf: destination, encoding: .utf8) == "second")
        let leftovers = try FileManager.default.contentsOfDirectory(atPath: destination.deletingLastPathComponent().path)
        #expect(leftovers == ["out.txt"])
    }
` : ""}${uses.usesAppFiles ? `
    @Test func appFileStoreCopiesWithAGeneratedRelativeName() throws {
        let folder = try temporaryFolder()
        let source = folder.appendingPathComponent("chosen.PDF")
        try Data("receipt".utf8).write(to: source)
        let store = try AppFileStore(folder: folder.appendingPathComponent("Files"))
        let name = try store.importCopy(of: source)
        #expect(!name.contains("/"))
        #expect(name.hasSuffix(".pdf"))
        #expect(try Data(contentsOf: store.url(for: name)) == Data("receipt".utf8))
        try store.remove(name)
        #expect(!FileManager.default.fileExists(atPath: store.url(for: name).path))
    }
` : ""}${uses.usesRecords ? `
    @Test func sqliteRecordsTheSchemaVersionAndAppliesOnlyNewMigrations() throws {
        let url = try temporaryFolder().appendingPathComponent("store.sqlite3")
        let first = try SQLiteDatabase(url: url, migrations: ["CREATE TABLE items (name TEXT NOT NULL)"])
        #expect(try first.userVersion() == 1)
        try first.execute("INSERT INTO items (name) VALUES (?)", [.text("kept")])
        let second = try SQLiteDatabase(url: url, migrations: ["CREATE TABLE items (name TEXT NOT NULL)", "ALTER TABLE items ADD COLUMN note TEXT"])
        #expect(try second.userVersion() == 2)
        #expect(try second.query("SELECT name FROM items") == [[.text("kept")]])
    }

    @Test func sqliteTransactionRollsBackOnError() throws {
        let url = try temporaryFolder().appendingPathComponent("store.sqlite3")
        let database = try SQLiteDatabase(url: url, migrations: ["CREATE TABLE items (name TEXT NOT NULL)"])
        #expect(throws: SQLiteError.self) {
            try database.transaction {
                try database.execute("INSERT INTO items (name) VALUES (?)", [.text("lost")])
                try database.execute("INSERT INTO items (name) VALUES (?)", [.null])
            }
        }
        #expect(try database.query("SELECT COUNT(*) FROM items") == [[.integer(0)]])
    }
` : ""}${uses.storesCredentials ? `
    @Test func keychainStoreSavesReplacesAndDeletesASecret() throws {
        let store = KeychainStore(service: "kit-tests.\\(UUID().uuidString)")
        defer { try? store.delete(account: "provider-api-key") }
        #expect(try store.read(account: "provider-api-key") == nil)
        try store.save("first-value", account: "provider-api-key")
        try store.save("second-value", account: "provider-api-key")
        #expect(try store.read(account: "provider-api-key") == "second-value")
        try store.delete(account: "provider-api-key")
        #expect(try store.read(account: "provider-api-key") == nil)
    }
` : ""}}
`
}

function packageAppScript(identity: ProjectIdentity): string {
  return `#!/usr/bin/env bash
# Builds, assembles, signs, and verifies dist/${identity.projectName}.app and dist/${identity.projectName}.dmg.
# Usage: Scripts/package_app.sh [--install]
#   --install  move any installed app to dist/rollback/ (never inside /Applications), install the
#              verified app, register it with LaunchServices, and launch it by bundle ID.
# SIGN_IDENTITY selects a Developer ID; the default "-" signs ad hoc for local proof.
set -euo pipefail

cd "$(dirname "$0")/.."
APP_NAME="${identity.projectName}"
EXECUTABLE="${identity.moduleName}"
BUNDLE_ID="${identity.bundleId}"
SIGN_IDENTITY="\${SIGN_IDENTITY:--}"
APP="dist/$APP_NAME.app"
INSTALLED="/Applications/$APP_NAME.app"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

install=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

for required in Resources/Info.plist Resources/App.entitlements Resources/AppIcon.icns; do
  [ -f "$required" ] || { echo "Missing $required" >&2; exit 1; }
done

swift build -c release --arch arm64
BINARY="$(swift build -c release --arch arm64 --show-bin-path)/$EXECUTABLE"
[ "$(lipo -archs "$BINARY")" = "arm64" ] || { echo "$BINARY is not arm64-only" >&2; exit 1; }

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BINARY" "$APP/Contents/MacOS/$EXECUTABLE"
cp Resources/Info.plist "$APP/Contents/Info.plist"
cp Resources/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

codesign --force --sign "$SIGN_IDENTITY" --entitlements Resources/App.entitlements "$APP"
codesign --verify --deep --strict "$APP"

rm -f "dist/$APP_NAME.dmg"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP" -format UDZO "dist/$APP_NAME.dmg" >/dev/null

if [ "$install" = true ]; then
  osascript -e "tell application id \\"$BUNDLE_ID\\" to quit" >/dev/null 2>&1 || true
  if [ -d "$INSTALLED" ]; then
    rm -rf "dist/rollback/$APP_NAME.app"
    mkdir -p dist/rollback
    mv "$INSTALLED" "dist/rollback/$APP_NAME.app"
  fi
  cp -R "$APP" "$INSTALLED"
  codesign --verify --deep --strict "$INSTALLED"
  # Only the installed bundle stays registered, so open -b always starts it.
  "$LSREGISTER" -u "$APP" >/dev/null 2>&1 || true
  "$LSREGISTER" -f "$INSTALLED"
  open -b "$BUNDLE_ID"
fi
`
}

function infoPlist(identity: ProjectIdentity, usageDescriptions: ReadonlyArray<readonly [string, string]>, uiElement: boolean): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleIdentifier</key>
    <string>${identity.bundleId}</string>
    <key>CFBundleName</key>
    <string>${identity.projectName}</string>
    <key>CFBundleExecutable</key>
    <string>${identity.moduleName}</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSMinimumSystemVersion</key>
    <string>14.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <${uiElement ? "true" : "false"}/>${usageDescriptions.map(([key, text]) => `
    <key>${key}</key>
    <string>${text}</string>`).join("")}
</dict>
</plist>
`
}

const ENTITLEMENTS_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>
`
