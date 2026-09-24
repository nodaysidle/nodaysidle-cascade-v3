import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"


const blueprint: SemanticBlueprint = {
  productName: "Field Notes",
  summary: "A local note editor that writes each note file atomically.",
  targetUsers: ["A person editing local notes"],
  goals: ["Edit a local note file and save it on the machine"],
  nonGoals: ["Network sync"],
  features: [
    {
      name: "Type Text",
      userOutcome: "The user sees each typed character.",
      trigger: "The user types while the editor is focused.",
      behavior: "The editor updates the cursor while typing into documents up to 100000 characters.",
      failureOutcome: "The last visible text stays in place.",
      failureRecovery: "retry",
      surface: "main",
      acceptanceSignals: ["A typed character appears at the cursor"],
      usesPlatformNeeds: [],
      usesData: ["Editor Buffer", "Typography Preferences"],
      usesServices: [],
    },
    {
      name: "Save Note",
      userOutcome: "The user stores the note on disk.",
      trigger: "The user chooses Save.",
      behavior: "Write the current text to the note file.",
      failureOutcome: "The previous file bytes stay in place.",
      failureRecovery: "retry",
      surface: "main",
      acceptanceSignals: ["The file bytes equal the editor text"],
      usesPlatformNeeds: ["filesystem"],
      usesData: ["Note File"],
      usesServices: [],
    },
    {
      name: "Close Record",
      userOutcome: "The user leaves the record without losing a choice.",
      trigger: "The user closes the window.",
      behavior: "If the record has unsaved changes, the app prompts before closing.",
      failureOutcome: "The window stays open.",
      failureRecovery: "retry",
      surface: "main",
      acceptanceSignals: ["Cancel leaves the window open"],
      usesPlatformNeeds: [],
      usesData: ["Editor Buffer"],
      usesServices: [],
    },
    {
      name: "Find Notes",
      userOutcome: "The user finds a note by typing a query.",
      trigger: "The user types in the search field.",
      behavior: "Rank note file names with a fuzzy query.",
      failureOutcome: "The editor text stays unchanged.",
      failureRecovery: "retry",
      surface: "main",
      acceptanceSignals: ["A matching file name appears in the results"],
      usesPlatformNeeds: [],
      usesData: ["Search Index"],
      usesServices: [],
    },
  ],
  dataObjects: [
    { name: "Note File", purpose: "Plain-text content of one note file.", sensitivity: "personal", retentionIntent: "Keep the file on the local filesystem until the user deletes it.", storage: "document", writeMode: "atomic-replace" },
    { name: "Editor Buffer", purpose: "In-memory text and cursor state for the editing session.", sensitivity: "personal", retentionIntent: "Discarded when the window closes and not written to disk.", storage: "session", writeMode: "direct" },
    { name: "Typography Preferences", purpose: "Font family and font size for the editor.", sensitivity: "internal", retentionIntent: "Keep in UserDefaults until the user resets them.", storage: "settings", writeMode: "direct" },
    { name: "Search Index", purpose: "Derived searchable terms from note file names.", sensitivity: "personal", retentionIntent: "Held in memory for the session and not written to disk.", storage: "session", writeMode: "direct" },
  ],
  externalServices: [],
  platformNeeds: ["filesystem", "local-storage"],
  qualityRequirements: ["Typing stays responsive"],
  productConstraints: ["Save the note file atomically after each explicit request."],
}

function contract(packet: Awaited<ReturnType<typeof compilePacket>>, id: string) {
  const found = packet.graph.contracts.find(item => item.id === id)
  expect(found, id).toBeDefined()
  return found!
}

describe("compiler contract consistency", () => {
  it("keeps persistence decisions, feature traces, file extensions, and permissions aligned", async () => {
    const packet = await compilePacket(blueprint, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)

    const note = contract(packet, "CON-PERSISTENCE-NOTE-FILE")
    const buffer = contract(packet, "CON-PERSISTENCE-EDITOR-BUFFER")
    const type = contract(packet, "CON-PERSISTENCE-TYPOGRAPHY-PREFERENCES")
    const index = contract(packet, "CON-PERSISTENCE-SEARCH-INDEX")
    const noteText = `${note.decision} ${note.details.join(" ")}`
    const bufferText = `${buffer.decision} ${buffer.details.join(" ")}`
    const typeText = `${type.decision} ${type.details.join(" ")}`
    const indexText = `${index.decision} ${index.details.join(" ")}`

    expect(noteText).not.toMatch(/SQLite/)
    expect(noteText).toMatch(/local filesystem/)
    expect(typeText).not.toMatch(/SQLite/)
    expect(typeText).toMatch(/UserDefaults/)
    expect(bufferText).not.toMatch(/temporaryDirectory|SQLite/)
    expect(bufferText).toMatch(/not written to disk/)
    expect(indexText).not.toMatch(/temporaryDirectory|SQLite/)
    expect(indexText).toMatch(/not written to disk/)

    expect(note.featureIds).toContain("FEAT-SAVE-NOTE")
    expect(buffer.featureIds).toContain("FEAT-TYPE-TEXT")
    expect(index.featureIds).toContain("FEAT-FIND-NOTES")

    const save = packet.graph.features.find(feature => feature.id === "FEAT-SAVE-NOTE")!
    expect(save.behavior).toMatch(/note file/)
    const noteFile = contract(packet, "CON-PERSISTENCE-NOTE-FILE")
    expect(noteFile.featureIds).toContain("FEAT-SAVE-NOTE")
    expect(noteFile.details).toContainEqual(expect.stringMatching(/^Write mode: .*renaming a temporary file/))

    const close = packet.graph.requirements.find(requirement => requirement.featureId === "FEAT-CLOSE-RECORD")!
    expect(close.statement.startsWith("If the record")).toBe(true)
    expect(close.statement).not.toMatch(/^The product must If/)

    const typing = packet.graph.features.find(feature => feature.id === "FEAT-TYPE-TEXT")!
    expect(typing.resourceIds).not.toContain("permission:filesystem")

    const termination = contract(packet, "CON-LIFECYCLE-APPLICATION-TERMINATION")
    expect(`${termination.decision} ${termination.details.join(" ")}`).not.toMatch(/clipboard snapshots/)
    expect(packet.graph.lockedStack).not.toContain("SQLite3")
  })

  it("keeps one atomic save path, session-only workspace state, and trigger-only shortcuts out of data links", async () => {
    const editor: SemanticBlueprint = {
      productName: "Rename Notes",
      summary: "A local plain-text note editor for a workspace folder.",
      targetUsers: ["A person editing local notes"],
      goals: ["Edit and save local note files"],
      nonGoals: ["Network sync"],
      features: [
        {
          name: "Explicit Save",
          userOutcome: "The user saves the current note to its file on demand.",
          trigger: "The user presses Cmd+S.",
          behavior: "The app writes the current document contents to the note's file path.",
          failureOutcome: "The document stays marked as unsaved.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["Reading the path returns the editor contents"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File", "Temporary Write File"],
          usesServices: [],
        },
        {
          name: "Background Write",
          userOutcome: "Edits are persisted without interrupting typing.",
          trigger: "The user edits a note that already has a file path.",
          behavior: "The app performs non-blocking background writes that replace the destination file by writing a temporary file and renaming it over the destination.",
          failureOutcome: "The document stays dirty and an error is shown.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["No temporary file remains after a successful write"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File", "Temporary Write File"],
          usesServices: [],
        },
        {
          name: "Open Note",
          userOutcome: "The user opens an existing note from the local filesystem.",
          trigger: "The user chooses Open from the File menu or uses the open shortcut.",
          behavior: "The app presents an open panel and reads the selected note into the editor.",
          failureOutcome: "The current document stays unchanged.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["The chosen note text appears in the editor"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File"],
          usesServices: [],
        },
        {
          name: "Workspace Search",
          userOutcome: "The user finds notes in the open workspace folder.",
          trigger: "The user types a query.",
          behavior: "The app ranks note file names in the workspace folder with a fuzzy query.",
          failureOutcome: "The app reports that search cannot run.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["A matching note appears in the results"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Workspace Folder Reference"],
          usesServices: [],
        },
        {
          name: "Settings Window",
          userOutcome: "The user adjusts keybindings.",
          trigger: "The user chooses Settings.",
          behavior: "The app edits keybinding preferences stored in UserDefaults.",
          failureOutcome: "A conflicting keybinding is rejected.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["A changed keybinding takes effect without relaunch"],
          usesPlatformNeeds: ["local-storage"],
          usesData: ["Keybinding Preferences"],
          usesServices: [],
        },
      ],
      dataObjects: [
        { name: "Note File", purpose: "Plain-text content of one note file.", sensitivity: "personal", retentionIntent: "Kept on the local filesystem until the user deletes it.", storage: "document", writeMode: "atomic-replace" },
        { name: "Keybinding Preferences", purpose: "Keybinding assignments for editor commands.", sensitivity: "internal", retentionIntent: "Retained in UserDefaults until the user resets them.", storage: "settings", writeMode: "direct" },
        { name: "Workspace Folder Reference", purpose: "Identifies the local folder whose notes are searched.", sensitivity: "internal", retentionIntent: "Retained only for the current session or until the user selects a different folder.", storage: "session", writeMode: "direct" },
        { name: "Temporary Write File", purpose: "Holds note contents during a write before being renamed over the destination file.", sensitivity: "personal", retentionIntent: "Removed immediately after a successful rename or cleaned up after a failed write.", storage: "temporary", writeMode: "atomic-replace" },
      ],
      externalServices: [],
      platformNeeds: ["filesystem", "local-storage"],
      qualityRequirements: ["Typing stays responsive"],
      productConstraints: ["No network access."],
    }
    const packet = await compilePacket(editor, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)

    const noteFile = contract(packet, "CON-PERSISTENCE-NOTE-FILE")
    expect(noteFile.featureIds).toContain("FEAT-EXPLICIT-SAVE")
    expect(noteFile.details).toContainEqual(expect.stringMatching(/renaming a temporary file in the same directory/))

    const scratch = contract(packet, "CON-PERSISTENCE-TEMPORARY-WRITE-FILE")
    const scratchText = `${scratch.decision} ${scratch.details.join(" ")}`
    expect(scratch.featureIds).toEqual(expect.arrayContaining(["FEAT-EXPLICIT-SAVE", "FEAT-BACKGROUND-WRITE"]))
    expect(scratchText).toMatch(/destination file's own directory/)
    expect(scratchText).not.toMatch(/FileManager\.default\.temporaryDirectory\/|only through an explicit user action/)
    expect(scratchText).toMatch(/automatically at its stated retention boundary/)

    const workspace = contract(packet, "CON-PERSISTENCE-WORKSPACE-FOLDER-REFERENCE")
    const workspaceText = `${workspace.decision} ${workspace.details.join(" ")} ${workspace.failureBehavior}`
    expect(workspaceText).toMatch(/not written to disk/)
    expect(workspaceText).not.toMatch(/temporaryDirectory|failed write/)

    const note = contract(packet, "CON-PERSISTENCE-NOTE-FILE")
    expect(note.details.join(" ")).not.toMatch(/Application Support/)
    expect(packet.documents["ARD.md"]).not.toMatch(/transient session scratch/)
    expect(Object.values(packet.documents).join("\n")).not.toMatch(/API keys are forbidden/)

    const open = packet.graph.features.find(feature => feature.id === "FEAT-OPEN-NOTE")!
    expect(open.resourceIds).not.toContain("data:keybinding-preferences")
    const settings = packet.graph.features.find(feature => feature.id === "FEAT-SETTINGS-WINDOW")!
    expect(settings.resourceIds).toContain("data:keybinding-preferences")
  })

  it("rejects a failure outcome that falls back to documented defaults", async () => {
    const vague = structuredClone(blueprint)
    vague.features[0] = { ...vague.features[0]!, failureOutcome: "Invalid stored preferences fall back to documented defaults." }
    await expect(compilePacket(vague, "native-macos-swiftui-desktop")).rejects.toThrow(/default or interval that the blueprint never states/)
  })

  it("keeps temp-file saves, session folders, shortcut triggers, and unstated defaults consistent", async () => {
    const editor: SemanticBlueprint = {
      productName: "Plain Pad",
      summary: "A local plain-text note editor.",
      targetUsers: ["A person editing local notes"],
      goals: ["Edit and save local plain-text notes"],
      nonGoals: ["Network sync"],
      features: [
        {
          name: "Explicit Save",
          userOutcome: "The user saves the current note to its file on demand.",
          trigger: "The user presses Cmd+S.",
          behavior: "The app writes the current document contents to the note's file path.",
          failureOutcome: "The document stays marked unsaved.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["Reading the path returns the editor contents"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File", "Temporary Write File"],
          usesServices: [],
        },
        {
          name: "Background Write",
          userOutcome: "Edits are persisted without interrupting typing.",
          trigger: "The user edits a note that has a file path.",
          behavior: "The app replaces the destination file by writing a temporary file and renaming it over the destination.",
          failureOutcome: "The document stays marked unsaved.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["No temporary file remains after a successful write"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File", "Temporary Write File"],
          usesServices: [],
        },
        {
          name: "Open Note",
          userOutcome: "The user opens an existing note.",
          trigger: "The user chooses Open or uses the open shortcut.",
          behavior: "The app reads the selected .txt file into the editor.",
          failureOutcome: "The current document stays unchanged.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["The editor shows the file contents"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File"],
          usesServices: [],
        },
        {
          name: "Workspace Search",
          userOutcome: "The user finds a note in the open workspace folder.",
          trigger: "The user types a query.",
          behavior: "The app ranks note names in the open workspace folder with a fuzzy query.",
          failureOutcome: "The app reports that search cannot run.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["A matching note appears in the results"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Workspace Folder Reference"],
          usesServices: [],
        },
        {
          name: "Settings Window",
          userOutcome: "The user changes the editor font.",
          trigger: "The user opens Settings.",
          behavior: "The app stores the chosen font family and size in the typography preferences.",
          failureOutcome: "The previous font stays active.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["The new font applies immediately"],
          usesPlatformNeeds: ["local-storage"],
          usesData: ["Typography Preferences"],
          usesServices: [],
        },
      ],
      dataObjects: [
        { name: "Note File", purpose: "Plain-text content of one note file.", sensitivity: "personal", retentionIntent: "Kept on the local filesystem until the user deletes it.", storage: "document", writeMode: "atomic-replace" },
        { name: "Typography Preferences", purpose: "Font family and font size for the editor.", sensitivity: "internal", retentionIntent: "Kept in UserDefaults until the user resets them.", storage: "settings", writeMode: "direct" },
        { name: "Workspace Folder Reference", purpose: "Identifies the local folder available to search.", sensitivity: "internal", retentionIntent: "Retained only for the current session or until the user selects a different folder.", storage: "session", writeMode: "direct" },
        { name: "Temporary Write File", purpose: "Holds note contents during a write before being renamed over the destination file.", sensitivity: "personal", retentionIntent: "Removed immediately after a successful rename or cleaned up after a failed write.", storage: "temporary", writeMode: "atomic-replace" },
      ],
      externalServices: [],
      platformNeeds: ["filesystem", "local-storage"],
      qualityRequirements: ["Typing stays responsive"],
      productConstraints: ["No network access"],
    }
    const packet = await compilePacket(editor, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)
    const text = Object.values(packet.documents).join("\n")

    expect(contract(packet, "CON-PERSISTENCE-NOTE-FILE").details).toContainEqual(expect.stringMatching(/renaming a temporary file/))
    const scratch = contract(packet, "CON-PERSISTENCE-TEMPORARY-WRITE-FILE")
    expect(scratch.featureIds).toEqual(expect.arrayContaining(["FEAT-EXPLICIT-SAVE", "FEAT-BACKGROUND-WRITE"]))
    expect(contract(packet, "CON-DATA-TEMPORARY-WRITE-FILE").featureIds).toContain("FEAT-EXPLICIT-SAVE")
    const scratchText = `${scratch.decision} ${scratch.details.join(" ")} ${scratch.recovery.join(" ")}`
    expect(scratchText).toMatch(/destination file's own directory/)
    expect(scratchText).not.toMatch(/only through an explicit user action/)
    expect(scratchText).toMatch(/automatically/)

    const folder = contract(packet, "CON-PERSISTENCE-WORKSPACE-FOLDER-REFERENCE")
    const folderText = `${folder.decision} ${folder.details.join(" ")}`
    expect(folderText).toMatch(/not written to disk/)
    expect(folderText).not.toMatch(/temporaryDirectory/)

    const open = packet.graph.features.find(feature => feature.id === "FEAT-OPEN-NOTE")!
    expect(open.resourceIds).not.toContain("data:typography-preferences")

    expect(text).not.toMatch(/transient session scratch/)
    expect(text).not.toMatch(/API keys are forbidden/)

    const unstated = structuredClone(editor)
    unstated.features[4] = { ...unstated.features[4]!, failureOutcome: "The app falls back to documented defaults." }
    await expect(compilePacket(unstated, "native-macos-swiftui-desktop")).rejects.toThrow(/default or interval that the blueprint never states/)
  })

  it("classifies a named rename scratch file, keeps a search index off save features, and writes a grammatical problem statement", async () => {
    const editor: SemanticBlueprint = {
      productName: "Mono Pad",
      summary: "A local monospace plain-text note editor.",
      targetUsers: ["A single writer who keeps a local folder of plain-text notes"],
      goals: ["Open and edit one .txt note at a time"],
      nonGoals: ["No network access, accounts, or third-party APIs"],
      features: [
        {
          name: "Explicit Save",
          userOutcome: "The user saves the current note on demand.",
          trigger: "The user presses Cmd+S.",
          behavior: "The app writes the current note to its file by renaming a temporary file in the same directory.",
          failureOutcome: "The note stays marked unsaved.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["The file bytes equal the editor text"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Note File", "Temporary Save File"],
          usesServices: [],
        },
        {
          name: "Workspace Search",
          userOutcome: "The user finds a note in the open workspace folder.",
          trigger: "The user types a query.",
          behavior: "The app ranks note names in the open workspace folder with a fuzzy query.",
          failureOutcome: "The app reports that search cannot run.",
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["A matching note appears in the results"],
          usesPlatformNeeds: ["filesystem"],
          usesData: ["Workspace Search Index"],
          usesServices: [],
        },
      ],
      dataObjects: [
        { name: "Note File", purpose: "Stores the plain-text contents of one note as a .txt file.", sensitivity: "personal", retentionIntent: "Retained until the user deletes or moves the file.", storage: "document", writeMode: "atomic-replace" },
        { name: "Temporary Save File", purpose: "Holds note contents during a background write before being renamed over the destination file.", sensitivity: "personal", retentionIntent: "Removed immediately after a successful rename or on the next save attempt after a failure.", storage: "temporary", writeMode: "atomic-replace" },
        { name: "Workspace Search Index", purpose: "Holds in-memory searchable representations of note file names and contents for fuzzy search.", sensitivity: "personal", retentionIntent: "Held only in memory for the duration of the app session and discarded on quit.", storage: "session", writeMode: "direct" },
      ],
      externalServices: [],
      platformNeeds: ["filesystem", "local-storage"],
      qualityRequirements: ["Typing stays responsive"],
      productConstraints: ["No network access"],
    }
    const packet = await compilePacket(editor, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)

    const scratch = contract(packet, "CON-PERSISTENCE-TEMPORARY-SAVE-FILE")
    const scratchText = `${scratch.decision} ${scratch.details.join(" ")} ${scratch.recovery.join(" ")}`
    expect(scratchText).toMatch(/destination file's own directory/)
    expect(scratchText).toMatch(/automatically/)
    expect(scratchText).not.toMatch(/user-selected paths|only through an explicit user action/)

    for (const id of ["CON-DATA-WORKSPACE-SEARCH-INDEX", "CON-PERSISTENCE-WORKSPACE-SEARCH-INDEX"]) {
      expect(contract(packet, id).featureIds).not.toContain("FEAT-EXPLICIT-SAVE")
      expect(contract(packet, id).featureIds).toContain("FEAT-WORKSPACE-SEARCH")
    }
    const index = contract(packet, "CON-PERSISTENCE-WORKSPACE-SEARCH-INDEX")
    expect(`${index.details.join(" ")} ${index.recovery.join(" ")}`).toMatch(/never written to disk/)
    expect(`${index.details.join(" ")} ${index.recovery.join(" ")}`).not.toMatch(/explicit user action/)

    expect(packet.documents["PRD.md"]).toContain("A single writer who keeps a local folder of plain-text notes needs a focused way to open and edit one .txt note at a time without network access, accounts, or third-party APIs.")
  })

  it("rejects a contract that names an interval the blueprint never states", async () => {
    const missing = structuredClone(blueprint)
    missing.features = [{
      ...missing.features[1]!,
      behavior: "Write the current text to the note file when the background save interval elapses.",
    }]
    missing.dataObjects = missing.dataObjects.filter(item => item.name === "Note File")
    await expect(compilePacket(missing, "native-macos-swiftui-desktop")).rejects.toThrow(/interval that the blueprint never states/)
  })
})
