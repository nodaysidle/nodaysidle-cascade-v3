import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"

const notes: SemanticBlueprint = {
  productName: "Monospace Notes",
  summary: "A native macOS document editor for a single person working in a local folder of plain-text notes. Saves are explicit with Cmd+S and also run as non-blocking background writes that replace the destination by renaming a temporary file.",
  targetUsers: ["A single writer who keeps a local folder of plain-text notes"],
  goals: ["Open and edit one .txt note at a time with TextKit 2 rendering"],
  nonGoals: ["No network access, accounts, or third-party APIs"],
  features: [
    {
      name: "Open and edit a plain-text note",
      userOutcome: "The user can open a .txt file from the local filesystem and edit its contents in a monospace text surface.",
      trigger: "The user chooses Open from the File menu or presses Cmd+O and selects a .txt file in the open panel.",
      behavior: "The app reads the selected .txt file as UTF-8 text and displays it in a TextKit 2 text view with the configured monospace font and point size. The window title shows the file name. Editing modifies the in-memory text buffer and marks the document as having unsaved changes.",
      failureOutcome: "If the file cannot be read, the app shows an error alert naming the file and the read error, and leaves the current document unchanged.",
      acceptanceSignals: ["After selecting a readable .txt file, the text view contains exactly the file's UTF-8 decoded contents.", "After a keystroke that changes the buffer, the document is marked as having unsaved changes."],
    },
    {
      name: "Explicit save with Cmd+S",
      userOutcome: "The user can commit the current buffer to disk on demand.",
      trigger: "The user presses Cmd+S while a document is open.",
      behavior: "The app writes the current buffer to the document's file path as UTF-8 text. If the document has no path, the app presents a save panel and uses the chosen path. On success, the unsaved-changes marker is cleared.",
      failureOutcome: "If the write fails, the app shows an error alert naming the path and the write error, and the document remains marked as having unsaved changes.",
      acceptanceSignals: ["After Cmd+S on a document with a path, reading that path returns exactly the buffer contents as UTF-8."],
    },
    {
      name: "Non-blocking background save",
      userOutcome: "The user can keep typing while the document is written to disk.",
      trigger: "The background autosave interval of 30000ms elapses after the last edit.",
      behavior: "The app writes the buffer to a temporary file in the same directory as the destination, then replaces the destination by renaming the temporary file over it. The write and rename run off the main thread so the text view remains responsive to keystrokes.",
      failureOutcome: "If the temporary write or rename fails, the app leaves the destination file unchanged, removes the temporary file when possible, and reports the failure in a non-modal status area.",
      acceptanceSignals: ["After a successful background save, the destination file contains exactly the buffer contents and no temporary file remains in the directory."],
    },
    {
      name: "Fuzzy search across the open workspace",
      userOutcome: "The user can locate a note by typing an approximate name or phrase and see matching results.",
      trigger: "The user presses Cmd+F and types one or more characters into the search field.",
      behavior: "The app matches the query against note file names and note contents in the currently open workspace folder using a fuzzy subsequence match, and lists matching notes ordered by match score. Selecting a result opens that note.",
      failureOutcome: "If no note matches, the results list shows an empty-state message and the current document remains open.",
      acceptanceSignals: ["For a workspace of 500 notes totaling 5MB, a query returns results within 50ms measured from the last keystroke.", "A query with no matches shows an empty-state message and does not change the open document."],
    },
    {
      name: "Settings window for typography and keybindings",
      userOutcome: "The user can change the monospace font, point size, and keybindings without editing files.",
      trigger: "The user chooses Settings from the macOS menu bar.",
      behavior: "The app opens a Settings window with controls for font family, point size, and keybinding assignments. Changes apply to the open document immediately and are written to UserDefaults.",
      failureOutcome: "If a chosen font family is unavailable, the app keeps the previous font family and shows an inline message naming the unavailable family.",
      acceptanceSignals: ["Reopening the Settings window shows the previously chosen values."],
    },
    {
      name: "Cold launch under 100ms",
      userOutcome: "The user sees an editable window almost immediately after launching the app.",
      trigger: "The user launches the app from Finder or the Dock.",
      behavior: "The app initializes its window, text view, and settings from UserDefaults and presents an editable document window. No network calls or remote resource loads occur during launch.",
      failureOutcome: "If launch initialization fails, the app presents an error alert and exits without leaving a partially initialized window.",
      acceptanceSignals: ["Measured from process start to the first editable window, cold launch completes in under 100ms on the reference machine."],
    },
    {
      name: "Keystroke rendering under 16ms",
      userOutcome: "The user sees typed characters appear in the text view without perceptible delay.",
      trigger: "The user presses a character key while the text view has focus.",
      behavior: "The app inserts the character into the text buffer and lays out and draws the updated text using TextKit 2. The main thread performs no file I/O during keystroke handling.",
      failureOutcome: "If layout or drawing fails, the app logs the failure and leaves the text buffer unchanged for that keystroke.",
      acceptanceSignals: ["No file read or write occurs on the main thread during keystroke handling.", "Measured from key event to updated text view drawing, keystroke rendering completes in under 16ms for a 100KB document."],
    },
    {
      name: "Dark monochromatic window appearance",
      userOutcome: "The user reads and writes on a black background with high-contrast monospace text.",
      trigger: "The app window is displayed.",
      behavior: "The window background is #000000 and the text is rendered in the configured monospace font at the configured point size with a foreground color that meets a contrast ratio of at least 7:1 against #000000.",
      failureOutcome: "If the configured foreground color does not meet the contrast ratio, the app substitutes a foreground color that does.",
      acceptanceSignals: ["The window background color equals #000000."],
    },
  ],
  dataObjects: [
    { name: "Note file", purpose: "Stores one plain-text note as a .txt file on the local filesystem.", sensitivity: "personal", retentionIntent: "Retained on the local filesystem until the user deletes or moves the file; the app does not delete notes on its own." },
    { name: "Open document buffer", purpose: "Holds the in-memory text of the currently open note while the user edits it.", sensitivity: "personal", retentionIntent: "Retained only for the lifetime of the open document and discarded when the document is closed or the app exits." },
    { name: "Temporary save file", purpose: "Holds the buffer during a background save so the destination can be replaced by rename.", sensitivity: "personal", retentionIntent: "Deleted immediately after a successful rename or after a failed save attempt." },
    { name: "Typography settings", purpose: "Stores the chosen monospace font family and point size in UserDefaults.", sensitivity: "internal", retentionIntent: "Retained in UserDefaults until the user changes or resets the settings." },
    { name: "Keybinding settings", purpose: "Stores the user's keybinding assignments in UserDefaults.", sensitivity: "internal", retentionIntent: "Retained in UserDefaults until the user changes or resets the settings." },
  ],
  externalServices: [],
  platformNeeds: ["filesystem", "local-storage"],
  qualityRequirements: ["Keystroke rendering completes in under 16ms for a 100KB document."],
  productConstraints: ["No network access, accounts, or third-party APIs are used."],
}

const contract = (packet: Awaited<ReturnType<typeof compilePacket>>, id: string) => {
  const found = packet.graph.contracts.find(item => item.id === id)
  if (!found) throw new Error(`missing ${id}`)
  return found
}

describe("monospace-notes traceability", () => {
  it("links data and permissions only to features that affirmatively use them", async () => {
    const packet = await compilePacket(notes, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)

    expect(contract(packet, "CON-DATA-TEMPORARY-SAVE-FILE").featureIds).toEqual(["FEAT-EXPLICIT-SAVE-WITH-CMD-S", "FEAT-NON-BLOCKING-BACKGROUND-SAVE"])

    const permission = contract(packet, "CON-PERMISSION-FILESYSTEM").featureIds
    expect(permission).not.toContain("FEAT-KEYSTROKE-RENDERING-UNDER-16MS")
    expect(permission).not.toContain("FEAT-SETTINGS-WINDOW-FOR-TYPOGRAPHY-AND-KEYBINDINGS")
    expect(permission).toContain("FEAT-OPEN-AND-EDIT-A-PLAIN-TEXT-NOTE")

    const note = contract(packet, "CON-DATA-NOTE-FILE").featureIds
    expect(note).not.toContain("FEAT-KEYSTROKE-RENDERING-UNDER-16MS")
    expect(note).not.toContain("FEAT-SETTINGS-WINDOW-FOR-TYPOGRAPHY-AND-KEYBINDINGS")
    expect(note).toContain("FEAT-EXPLICIT-SAVE-WITH-CMD-S")

    const keybinding = contract(packet, "CON-DATA-KEYBINDING-SETTINGS").featureIds
    expect(keybinding).not.toContain("FEAT-DARK-MONOCHROMATIC-WINDOW-APPEARANCE")
    expect(keybinding).not.toContain("FEAT-OPEN-AND-EDIT-A-PLAIN-TEXT-NOTE")
    expect(keybinding).toEqual(expect.arrayContaining(["FEAT-SETTINGS-WINDOW-FOR-TYPOGRAPHY-AND-KEYBINDINGS", "FEAT-COLD-LAUNCH-UNDER-100MS"]))
    expect(contract(packet, "CON-DATA-TYPOGRAPHY-SETTINGS").featureIds).toContain("FEAT-DARK-MONOCHROMATIC-WINDOW-APPEARANCE")
  })

  it("matches recovery and data failure text to the stated behavior and drops unused stack entries", async () => {
    const packet = await compilePacket(notes, "native-macos-swiftui-desktop")
    expect(contract(packet, "CON-COLD-LAUNCH-UNDER-100MS-INTERFACE").recovery.join(" ")).not.toMatch(/explicit retry/)
    expect(contract(packet, "CON-DARK-MONOCHROMATIC-WINDOW-APPEARANCE-INTERFACE").recovery.join(" ")).toMatch(/fallback automatically/)
    expect(contract(packet, "CON-DATA-OPEN-DOCUMENT-BUFFER").failureBehavior).toMatch(/in-memory state/)
    expect(packet.graph.lockedStack).not.toContain("Application Support")
  })

  it("declares a minimum macOS version that supports the @Observable stack it locks", async () => {
    const packet = await compilePacket(notes, "native-macos-swiftui-desktop")
    const trd = packet.documents["TRD.md"]
    expect(trd).toContain("@Observable")
    expect(trd).toContain("LSMinimumSystemVersion = 14.0")
    expect(trd).not.toContain("LSMinimumSystemVersion = 13.0")
  })
})