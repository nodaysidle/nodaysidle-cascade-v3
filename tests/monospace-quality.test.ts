import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"

export const monospaceBlueprint: SemanticBlueprint = {
  productName: "Monospace",
  summary: "A native macOS plain-text editor featuring a signature minimalist dark monochromatic interface, high-contrast monospace typography, and ultra-low-latency editing.",
  targetUsers: [
    "Software engineers writing code and technical notes locally",
    "Writers who prefer plain-text files and high-contrast typography",
  ],
  goals: [
    "Deliver sub-16ms keystroke rendering using TextKit 2 and Metal glyph caching",
    "Provide atomic local plain-text file persistence without remote sync",
    "Search workspace files with sub-50ms fuzzy matching",
  ],
  nonGoals: [
    "Cloud synchronization or remote storage",
    "Rich text formatting or document transcoding",
    "Telemetry or analytics tracking",
  ],
  features: [
    {
      name: "Monochromatic Dark Canvas",
      userOutcome: "Write in a distraction-free monochromatic workspace with pure black background and high-contrast typography.",
      trigger: "The user launches the application or focuses the editor canvas.",
      behavior: "Render a pure black background (#000000) canvas with high-contrast monochrome typography and configurable cursor style.",
      failureOutcome: "Default to fallback high-contrast monochromatic system font if custom font is missing.",
      acceptanceSignals: ["Pure black background (#000000) is rendered", "Cursor remains visible and responsive"],
    },
    {
      name: "TextKit 2 Editor Core",
      userOutcome: "Type text with sub-16ms keystroke rendering latency.",
      trigger: "The user presses keys or inputs text into the active document.",
      behavior: "Process keystrokes and perform character insertion using native TextKit 2 layout managers with Metal glyph caching.",
      failureOutcome: "Retain typed text in buffer without crashing if layout calculation exceeds threshold.",
      acceptanceSignals: ["Keystroke rendering latency is asserted under 16ms", "Selection highlights stay visually aligned"],
    },
    {
      name: "Local File Persistence",
      userOutcome: "Save and load plain-text files atomically on the local disk.",
      trigger: "The user triggers Cmd+S or opens a file via native open panel.",
      behavior: "Write document content to local plain-text files atomically via background I/O without blocking UI thread.",
      failureOutcome: "Preserve original file and display non-destructive error dialog if write fails.",
      acceptanceSignals: ["File is written atomically with matching SHA-256 hash", "Unsaved changes prompt appears on close"],
    },
    {
      name: "Fuzzy File Search",
      userOutcome: "Quickly locate files across the local workspace directory.",
      trigger: "The user presses Cmd+P or enters search queries.",
      behavior: "Perform fuzzy search across workspace directory file paths with sub-50ms query latency.",
      failureOutcome: "Display empty results state without blocking text input when no matches are found.",
      acceptanceSignals: ["Search returns ranked matches under 50ms for 10000 files", "Esc closes search palette"],
    },
  ],
  dataObjects: [
    { name: "Document content", purpose: "Store current text buffer and unsaved document changes.", sensitivity: "personal", retentionIntent: "Retain on local filesystem until file is closed or saved." },
    { name: "Editor settings", purpose: "Store font choice, line height, and keybindings.", sensitivity: "personal", retentionIntent: "Keep locally in UserDefaults until edited or reset." },
  ],
  externalServices: [],
  platformNeeds: ["filesystem", "local-storage"],
  qualityRequirements: [
    "Keystroke rendering latency under 16ms",
    "Cold launch time under 100ms",
  ],
  productConstraints: [
    "No telemetry or network calls",
    "Atomic file writes only",
  ],
}

describe("Monospace 10/10 quality verification", () => {
  it("compiles a 10/10 clean document packet without leaks or contradictions", async () => {
    const packet = await compilePacket(monospaceBlueprint, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)
    expect(packet.failures).toHaveLength(0)

    const allDocs = Object.values(packet.documents).join("\n")
    const ardText = packet.documents["ARD.md"]
    const trdText = packet.documents["TRD.md"]
    const tasksText = packet.documents["TASKS.md"]
    const agentsText = packet.documents["AGENTS.md"]

    // Zero ghost permissions
    expect(allDocs).not.toContain("NSMicrophoneUsageDescription")
    expect(allDocs).not.toContain("voice.sqlite3")
    expect(allDocs).not.toContain("audio.format")
    expect(allDocs).not.toContain("CON-PERMISSION-BACKGROUND-STARTUP")
    expect(allDocs).not.toContain("CON-PERMISSION-NOTIFICATIONS")
    expect(allDocs).not.toContain("CON-PERMISSION-GLOBAL-INPUT")

    // Clean stack without bloat
    expect(packet.graph.lockedStack).not.toContain("Keychain")
    expect(packet.graph.lockedStack).not.toContain("SQLite3")
    expect(packet.graph.lockedStack).not.toContain("SMAppService")
    expect(packet.graph.lockedStack).toContain("Swift 6")
    expect(packet.graph.lockedStack).toContain("SwiftUI")
    expect(packet.graph.lockedStack).toContain("UserDefaults")

    // Standalone local integration boundary without URLSession contradiction
    expect(packet.graph.integrationBoundary).toContain("Standalone local application")
    expect(agentsText).not.toContain("URLSession.data(for:)")

    // Clean persistence
    expect(packet.graph.persistence.decision).toContain("local filesystem at user-selected paths")
    expect(packet.graph.persistence.recordsPlacement).toContain("Local filesystem at user-selected paths")

    // All 5 documents include OWN-FOUNDATION in Owner Maps
    expect(ardText).toContain("OWN-FOUNDATION — Foundation owns")
    expect(trdText).toContain("OWN-FOUNDATION — Foundation — implementation")
    expect(agentsText).toContain("OWN-FOUNDATION — Foundation —")
    expect(tasksText).toContain("- Owners: OWN-FOUNDATION")

    // TASK-01 instructs App delegation to AppState
    const task01 = packet.graph.phases[0]?.tasks[0]
    expect(task01?.prompt).toContain("delegate all application state and commands to AppState.swift")
  })
})
