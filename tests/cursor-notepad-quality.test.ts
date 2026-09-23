import { describe, expect, it } from "vitest"
import { compilePacket, verifyPacketHashes } from "../src/compiler"
import {
  buildJevPostflightRequest,
  buildJevPreflightRequest,
  evaluateJevPostflight,
  evaluateJevPreflight,
  JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID,
  JEV_FOREIGN_STACK_NOUL_ID,
  JEV_PLATFORM_NEEDS,
  JEV_PRESET_SELECTION_NOUL_ID,
  JEV_VIABILITY_NOUL_ID,
  jevPlatformNeedNoulId,
} from "../src/jev"
import { auditSemanticIntake, type SemanticBlueprint } from "../src/schema"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

export const cursorNotepadBlueprint: SemanticBlueprint = {
  productName: "CursorPad",
  summary: "A modern, ultra-fast native macOS notepad built in Swift 6 with a signature Cursor dark editor theme, sub-100ms launch, zero-latency TextKit 2 typing, instant fuzzy search, and local atomic persistence.",
  targetUsers: [
    "macOS developers and power users wanting a distraction-free notepad that matches the Cursor editor palette",
    "Engineers capturing scratch code, terminal output, and markdown notes without heavy Electron lag",
  ],
  goals: [
    "Render text with zero perceptible typing latency using native TextKit 2 and Metal-backed glyph caching",
    "Match the exact modern Cursor aesthetic with custom dark tokens (#181818 background, #1e1e1e sidebar, #2b2b2b border, #80bfff blue accent, and #e0e0e0 text)",
    "Launch from the Dock or global hotkey in under 100 milliseconds with state instantly restored",
    "Persist all notes as local plain-text/markdown files with atomic non-blocking disk operations",
  ],
  nonGoals: [
    "Cloud syncing, account login, telemetry, or remote server dependencies",
    "WYSIWYG rich text styling, word processor formatting, or PDF printing tools",
    "In-app code execution, compilation, or LSP terminal debugging",
  ],
  features: [
    {
      name: "Cursor Dark Monospace Editor",
      userOutcome: "Users type in a dark-mode editor styled after the Cursor IDE with line numbers and smooth caret animations.",
      trigger: "User opens a note or creates a new tab with Command+N.",
      behavior: "Initializes a native TextKit 2 text view configured with SF Mono 13pt typography, 1.45 line height, Cursor background color (#181818), selection tint (#264f78), and active line highlight (#222222). Line numbers render in the gutter with muted foreground (#6e7681).",
      failureOutcome: "Falls back to standard macOS monospaced system font if custom font descriptor fails to instantiate.",
      acceptanceSignals: [
        "Editor background color precisely matches hexadecimal #181818 in AppKit color space.",
        "Typing latency remains under 8 milliseconds per keystroke on Apple Silicon hardware.",
        "Gutter line numbers automatically recalculate as lines are added or removed.",
      ],
    },
    {
      name: "Command Palette Note Navigation",
      userOutcome: "Users quickly filter and open existing notes using fuzzy title matching without leaving the keyboard.",
      trigger: "User presses Command+P or Command+K from anywhere in the app window.",
      behavior: "Displays a floating glassmorphic spotlight modal with an auto-focused search input (#1e1e1e background, #2b2b2b border). As the user types, notes are ranked using prefix and fuzzy subsequence matching. Arrow keys navigate selections and Enter switches notes.",
      failureOutcome: "Displays 'No matching notes found' message when query yields zero results and keeps search field active.",
      acceptanceSignals: [
        "Pressing Command+P opens the palette overlay within 16 milliseconds without layout hitch.",
        "Fuzzy search filters a library of 1,000 notes in under 5 milliseconds.",
        "Pressing Escape closes the palette and restores first-responder focus to the editor.",
      ],
    },
    {
      name: "Non-Blocking Atomic Disk Storage",
      userOutcome: "Notes are auto-saved to disk immediately upon editing without blocking UI typing or risking data corruption.",
      trigger: "User edits text or creates a new note.",
      behavior: "Debounces text changes by 250ms and asynchronously writes UTF-8 bytes to the Application Support directory using atomic temporary file swap (NSDataWritingAtomic).",
      failureOutcome: "Surfaces a discreet status bar error indicator if disk write fails and retains modified text in memory buffer.",
      acceptanceSignals: [
        "Changes are committed to disk via atomic write within 300ms of user typing cessation.",
        "App crash or forced termination preserves the last auto-saved note state without file truncation.",
        "Disk write operations never execute on the main actor thread.",
      ],
    },
    {
      name: "Compact Sidebar Library",
      userOutcome: "Users view their note list with modified timestamps, word counts, and search filter.",
      trigger: "User toggles sidebar with Command+B or window launch.",
      behavior: "Renders a compact SwiftUI sidebar (#1e1e1e background) listing notes ordered by last updated timestamp. Displays note title, relative timestamp, and character count. Clicking an item binds the editor to that note.",
      failureOutcome: "Shows an empty state prompt inviting the user to press Command+N when no notes exist.",
      acceptanceSignals: [
        "Sidebar list updates note order dynamically when a note is edited.",
        "Selecting a note switches the editor contents within 16 milliseconds.",
        "Deleting a note moves the target file to the macOS Trash directory via NSFileManager.",
      ],
    },
  ],
  dataObjects: [
    {
      name: "NoteDocument",
      purpose: "Represents a single plain text note with metadata and file reference.",
      sensitivity: "personal",
      retentionIntent: "Retained locally until explicitly deleted by the user.",
    },
    {
      name: "EditorConfiguration",
      purpose: "Stores editor preferences including font size, tab width, and word wrap state.",
      sensitivity: "personal",
      retentionIntent: "Persisted across application launches in AppStorage.",
    },
  ],
  externalServices: [],
  platformNeeds: ["filesystem", "local-storage"],
  qualityRequirements: [
    "Cold launch to responsive typing state must complete within 100 milliseconds.",
    "Memory footprint must remain under 40MB for a 500-note library.",
    "Keyboard shortcuts must align with standard macOS conventions (Cmd+N, Cmd+P, Cmd+B, Cmd+W).",
  ],
  productConstraints: [
    "Swift 6 strict concurrency with zero compiler concurrency warnings.",
    "macOS 14+ target utilizing native SwiftUI and TextKit 2 without Electron or WebKit.",
    "Zero network access or third-party tracking libraries.",
  ],
}

describe("CursorPad: Quality Test of 5-Document Spec with Jev Enhancements", () => {
  it("passes semantic intake audit with no unusable meaning or secret material", () => {
    const issues = auditSemanticIntake(cursorNotepadBlueprint)
    expect(issues).toEqual([])
  })

  it("passes Jev preflight viability and preset fit check", () => {
    const request = buildJevPreflightRequest({
      requestId: "cursorpad-preflight",
      apiKey: "memory-key",
      idea: cursorNotepadBlueprint.summary,
      presetId: "native-macos-swiftui-desktop",
    })
    expect(request.nouls).toHaveLength(2)

    // Simulate high-confidence viability and correct preset match
    const decision = evaluateJevPreflight([
      { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 0.98 },
      { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: "native-macos-swiftui-desktop", confidence: 0.95 },
    ], "native-macos-swiftui-desktop")

    expect(decision.viable).toBe(true)
    expect(decision.presetMismatch).toBeUndefined()
  })

  it("passes Jev postflight integrity and acceptance-verifiability gate", () => {
    const request = buildJevPostflightRequest({
      requestId: "cursorpad-postflight",
      apiKey: "memory-key",
      presetId: "native-macos-swiftui-desktop",
      blueprint: cursorNotepadBlueprint,
    })
    expect(request.nouls).toHaveLength(9)

    // Simulate Jev postflight outcomes
    const decision = evaluateJevPostflight([
      ...JEV_PLATFORM_NEEDS.map(need => ({
        kind: "boolean" as const,
        id: jevPlatformNeedNoulId(need),
        pTrue: ["filesystem", "local-storage"].includes(need) ? 0.95 : 0.05,
      })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.02 },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.96 },
    ], cursorNotepadBlueprint)

    expect(decision.foreignStackLeakage).toBe(false)
    expect(decision.unverifiableAcceptance).toBe(false)
  })

  it("compiles the 5 documents to gate-clean with zero failures and verified hashes", async () => {
    const packet = await compilePacket(cursorNotepadBlueprint, "native-macos-swiftui-desktop")

    expect(packet.exportable).toBe(true)
    expect(packet.failures).toHaveLength(0)
    expect(await verifyPacketHashes(packet)).toBe(true)

    // Check all 5 canonical documents exist
    const docNames = Object.keys(packet.documents)
    expect(docNames.sort()).toEqual(["AGENTS.md", "ARD.md", "PRD.md", "TASKS.md", "TRD.md"])

    // Verify zero placeholders exist across all documents
    for (const [, content] of Object.entries(packet.documents)) {
      expect(content).not.toMatch(/TODO|TBD|PLACEHOLDER|<insert\s+[^>]+>/i)
      expect(content.length).toBeGreaterThan(500)
    }

    // Verify Cursor theme colors and key architectural tokens are present in contracts
    expect(packet.documents["PRD.md"]).toContain("CursorPad")
    expect(packet.documents["TRD.md"]).toContain("Native macOS SwiftUI Desktop")
    expect(packet.documents["TASKS.md"]).toContain("PHASE-01-FOUNDATION")
    expect(packet.documents["AGENTS.md"]).toContain("Swift 6")

    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "cascade-cursorpad-"))
    for (const [name, content] of Object.entries(packet.documents)) {
      await fs.writeFile(path.join(outDir, name), content, "utf8")
    }

    const exportedFiles = await fs.readdir(outDir)
    await fs.rm(outDir, { recursive: true, force: true })
    expect(exportedFiles.sort()).toEqual(["AGENTS.md", "ARD.md", "PRD.md", "TASKS.md", "TRD.md"])
  })
})
