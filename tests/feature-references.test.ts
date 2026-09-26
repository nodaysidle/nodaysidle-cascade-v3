import { describe, expect, it } from "vitest"
import { compilePacket, compileProjectGraph, NormalizationError, normalizeBlueprint } from "../src/compiler"
import { auditSemanticIntake, type SemanticBlueprint } from "../src/schema"
import { docsPortalBlueprint, fileOrganizerBlueprint, forecastGlanceBlueprint } from "./fixtures/blueprints"

const PRESET = "native-macos-swiftui-desktop" as const

function normalizationIssues(blueprint: SemanticBlueprint) {
  try {
    normalizeBlueprint(blueprint, PRESET)
  } catch (error) {
    if (error instanceof NormalizationError) return error.issues
    throw error
  }
  return []
}

describe("explicit feature references", () => {
  it("rejects a data reference that names no declared data object", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.features[0]!.usesData = ["Folder cache"]
    const expected = expect.objectContaining({ path: "features[0].usesData[0]", rule: "semantic.unknown-data-reference" })

    expect(auditSemanticIntake(blueprint)).toContainEqual(expected)
    expect(normalizationIssues(blueprint)).toContainEqual(expected)
  })

  it("rejects a service reference that names no declared external service", () => {
    const blueprint = structuredClone(forecastGlanceBlueprint)
    blueprint.features[1]!.usesServices = ["Radar service"]
    const expected = expect.objectContaining({ path: "features[1].usesServices[0]", rule: "semantic.unknown-service-reference" })

    expect(auditSemanticIntake(blueprint)).toContainEqual(expected)
    expect(normalizationIssues(blueprint)).toContainEqual(expected)
  })

  it("rejects data objects and services that no feature uses", () => {
    const blueprint = structuredClone(forecastGlanceBlueprint)
    blueprint.features = blueprint.features.map(feature => ({ ...feature, usesData: feature.usesData.filter(name => name !== "Saved places"), usesServices: [] }))
    const issues = auditSemanticIntake(blueprint)

    expect(issues).toContainEqual(expect.objectContaining({ path: "dataObjects[0]", rule: "semantic.unused-data-object" }))
    expect(issues).toContainEqual(expect.objectContaining({ path: "externalServices[0]", rule: "semantic.unused-external-service" }))
  })

  it("matches references regardless of case, spacing, or a trailing period", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.features[0]!.usesData = ["  organization   RULES. "]
    const graph = compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)

    expect(graph.contracts.find(contract => contract.id === "CON-DATA-ORGANIZATION-RULES")?.featureIds).toContain("FEAT-FOLDER-SCAN")
  })

  it("links permissions only from declared feature needs, never from wording", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.platformNeeds = [...blueprint.platformNeeds, "audio-input"]
    blueprint.features[0]!.behavior = "Record a spoken note with the microphone, copy it to the clipboard, and send a notification."
    const unlinked = compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)

    expect(unlinked.contracts.filter(contract => contract.kind === "permission").map(contract => contract.id)).toEqual(["CON-PERMISSION-FILESYSTEM"])

    blueprint.features[2]!.usesPlatformNeeds = [...blueprint.features[2]!.usesPlatformNeeds, "audio-input"]
    const linked = compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)

    expect(linked.contracts.find(contract => contract.id === "CON-PERMISSION-MICROPHONE")?.featureIds).toEqual(["FEAT-REVERSIBLE-BATCH"])
  })

  it("grants file access exactly to features that show a file panel or use a declared document", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    const permissionFeatures = () => compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)
      .contracts.find(contract => contract.id === "CON-PERMISSION-FILESYSTEM")?.featureIds

    expect(permissionFeatures()).toEqual(["FEAT-FOLDER-SCAN", "FEAT-MOVE-PREVIEW", "FEAT-REVERSIBLE-BATCH"])

    // Without a panel or a document, a feature gets no file access.
    blueprint.features[1]!.usesData = ["Organization rules"]
    expect(permissionFeatures()).toEqual(["FEAT-FOLDER-SCAN", "FEAT-REVERSIBLE-BATCH"])

    // A feature that opens a panel gets file access even when no document is declared for the file.
    blueprint.features[0]!.usesData = ["Organization rules"]
    expect(permissionFeatures()).toEqual(["FEAT-FOLDER-SCAN", "FEAT-REVERSIBLE-BATCH"])
    blueprint.features[0]!.userFileAccess = "none"
    expect(permissionFeatures()).toEqual(["FEAT-REVERSIBLE-BATCH"])
  })

  it("gives native clipboard features a write-only rule and a watcher rule with the paste-access prompt", () => {
    for (const presetId of ["native-macos-swiftui-desktop", "native-macos-swiftui-menubar"] as const) {
      const blueprint = structuredClone(fileOrganizerBlueprint)
      blueprint.features[0]!.usesPlatformNeeds = ["clipboard"]
      const clipboard = compileProjectGraph(normalizeBlueprint(blueprint, presetId), presetId)
        .contracts.find(contract => contract.id === "CON-PERMISSION-CLIPBOARD")!
      const text = [clipboard.decision, ...clipboard.details].join(" ")

      expect(clipboard.featureIds).toEqual(["FEAT-FOLDER-SCAN"])
      expect(text).toContain("read its contents only after changeCount changes")
      // Copy-only features (a transcript copied to the clipboard) must not grow a watcher.
      expect(text).toContain("A feature that only copies text to the clipboard writes with clearContents() and then setString(_:forType:) and never reads or polls NSPasteboard.general")
      expect(text).toContain("NSPasteboard.general.accessBehavior and, when it is alwaysDeny, stop reading")
      expect(text).toContain("Snapshot and restore the user's clipboard only when the PRD promises to preserve it.")
      expect(text).not.toContain("only for the explicit user action")
      expect(text).toContain("show the user how to allow clipboard access again")
    }
  })

  it("tells native global shortcuts how to handle a modifier key on its own", () => {
    for (const presetId of ["native-macos-swiftui-desktop", "native-macos-swiftui-menubar"] as const) {
      const blueprint = structuredClone(fileOrganizerBlueprint)
      blueprint.platformNeeds = [...blueprint.platformNeeds, "global-hotkey"]
      blueprint.features[0]!.usesPlatformNeeds = ["global-hotkey"]
      const contract = compileProjectGraph(normalizeBlueprint(blueprint, presetId), presetId)
        .contracts.find(item => item.id === "CON-PERMISSION-GLOBAL-INPUT")!
      const text = [contract.decision, ...contract.details].join(" ")
      expect(text).toContain("RegisterEventHotKey cannot bind a modifier key on its own")
      expect(text).toContain("act on a clean tap, pressed and released with no other key or modifier in between")
    }
  })

  it("keeps file access when the provider omits filesystem from the product-level needs", () => {
    const blueprint = { ...structuredClone(fileOrganizerBlueprint), platformNeeds: ["local-storage" as const] }
    const graph = compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)

    expect(graph.contracts.find(contract => contract.id === "CON-PERMISSION-FILESYSTEM")?.featureIds).toEqual(["FEAT-FOLDER-SCAN", "FEAT-MOVE-PREVIEW", "FEAT-REVERSIBLE-BATCH"])
  })

  it("links data and services only to the features that list them", () => {
    const graph = compileProjectGraph(normalizeBlueprint(forecastGlanceBlueprint, PRESET), PRESET)
    const featureIds = (id: string) => graph.contracts.find(contract => contract.id === id)?.featureIds

    expect(featureIds("CON-DATA-SAVED-PLACES")).toEqual(["FEAT-CURRENT-CONDITIONS", "FEAT-SAVED-PLACES"])
    expect(featureIds("CON-INTEGRATION-WEATHER-SERVICE")).toEqual(["FEAT-WEATHER-SERVICE-CONNECTION", "FEAT-CURRENT-CONDITIONS"])
    expect(featureIds("CON-PERMISSION-NETWORK")).toEqual(["FEAT-WEATHER-SERVICE-CONNECTION", "FEAT-CURRENT-CONDITIONS"])
  })

  it("takes recovery from the declared failureRecovery, never from failure wording", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.features[0]!.failureOutcome = "The app quits and falls back to the default folder."
    const recovery = (value: "retry" | "fallback" | "exit") => {
      blueprint.features[0]!.failureRecovery = value
      return normalizeBlueprint(blueprint, PRESET).features[0]!.recoveryExpectations[0]
    }

    expect(recovery("retry")).toMatch(/allow an explicit retry/)
    expect(recovery("fallback")).toMatch(/Apply the stated fallback/)
    expect(recovery("exit")).toMatch(/Release partial resources before exiting/)
  })

  it("adds the store-specific atomic write rule only for a declared atomic-replace data object", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.summary = `${blueprint.summary} Every journal save is written atomically by renaming a temporary file.`
    const writeMode = () => compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)
      .contracts.find(contract => contract.id === "CON-PERSISTENCE-MOVE-JOURNAL")!.details
      .filter(detail => detail.startsWith("Write mode:"))

    expect(writeMode()).toEqual([])
    blueprint.dataObjects[1]!.writeMode = "atomic-replace"
    expect(writeMode()).toEqual([expect.stringMatching(/commits in one SQLite transaction/)])
  })

  it("places Astro routes only from the declared surface, never from page wording", () => {
    const blueprint = structuredClone(docsPortalBlueprint)
    blueprint.features[0]!.surface = "main"
    blueprint.features[1]!.behavior = "Show results on a dedicated detail page with a permalink, plus an about page and a 404 page."
    const plan = () => compileProjectGraph(normalizeBlueprint(blueprint, "astro-web"), "astro-web").astroPlan!
    const pages = () => Object.values(plan().featurePlacements).flatMap(placement => placement.kind === "page" ? [placement.pageFile] : [])

    expect(pages()).toEqual([])
    blueprint.features[1]!.surface = "item-page"
    blueprint.features[2]!.surface = "about-page"
    blueprint.features[3]!.surface = "not-found-page"
    expect(pages()).toEqual(["src/pages/guides/[slug].astro", "src/pages/about.astro", "src/pages/404.astro"])
    expect(plan().contentCollection).toBe("guides")
  })

  it("links an undeclared-use temporary atomic copy to the features that save atomic data", () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.dataObjects[1]!.writeMode = "atomic-replace"
    blueprint.dataObjects.push({ name: "Store write temporary copy", purpose: "In-progress copy of a journal save.", sensitivity: "personal", retentionIntent: "Removed after the rename or on the next save attempt.", storage: "temporary", writeMode: "atomic-replace" })

    expect(auditSemanticIntake(blueprint).filter(issue => issue.rule === "semantic.unused-data-object")).toEqual([])
    const graph = compileProjectGraph(normalizeBlueprint(blueprint, PRESET), PRESET)
    expect(graph.contracts.find(contract => contract.id === "CON-PERSISTENCE-STORE-WRITE-TEMPORARY-COPY")?.featureIds).toEqual(["FEAT-REVERSIBLE-BATCH"])

    blueprint.dataObjects[1]!.writeMode = "direct"
    expect(auditSemanticIntake(blueprint)).toContainEqual(expect.objectContaining({ path: `dataObjects[${blueprint.dataObjects.length - 1}]`, rule: "semantic.unused-data-object" }))
  })

  it("places Tauri settings in JSON, keeps background running separate from launch at login, and words credentials per preset", async () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.dataObjects.push({ name: "Display preferences", purpose: "Remember the list density.", sensitivity: "internal", retentionIntent: "Keep until reset.", storage: "settings", writeMode: "atomic-replace" })
    blueprint.externalServices.push({ name: "Rates API", purpose: "Fetch exchange rates.", dataSent: ["currency codes"], credentialRequired: true })
    blueprint.features[0]!.usesData = [...blueprint.features[0]!.usesData, "Display preferences"]
    blueprint.features[1]!.usesServices = ["Rates API"]
    blueprint.features[1]!.usesPlatformNeeds = [...blueprint.features[1]!.usesPlatformNeeds, "network"]
    blueprint.features[2]!.usesPlatformNeeds = [...blueprint.features[2]!.usesPlatformNeeds, "background-execution"]
    const packet = await compilePacket(blueprint, "tauri2-rust-typescript-desktop")
    const contract = (id: string) => packet.graph.contracts.find(item => item.id === id)
    const text = Object.values(packet.documents).join("\n")

    expect(packet.exportable).toBe(true)
    expect(contract("CON-PERSISTENCE-DISPLAY-PREFERENCES")?.details).toContainEqual(expect.stringMatching(/^Placement: Atomic JSON/))
    expect(contract("CON-PERSISTENCE-DISPLAY-PREFERENCES")?.details).toContainEqual(expect.stringMatching(/^Write mode: .*renaming a temporary file/))
    expect(contract("CON-PERMISSION-BACKGROUND-EXECUTION")?.decision).toMatch(/prevent_exit/)
    expect(contract("CON-PERMISSION-BACKGROUND-EXECUTION")?.decision).toContain("in a Rust tokio task that emits events to the frontend, not in webview timers")
    expect(contract("CON-PERMISSION-BACKGROUND-STARTUP")).toBeUndefined()
    expect(contract("CON-LIFECYCLE-APPLICATION-LAUNCH")?.decision).toContain("start the declared background features")
    const foreground = await compilePacket(fileOrganizerBlueprint, "tauri2-rust-typescript-desktop")
    expect(foreground.graph.contracts.find(item => item.id === "CON-LIFECYCLE-APPLICATION-LAUNCH")?.decision).toContain("without starting privileged capture")
    expect(text).not.toContain("tauri-plugin-autostart")
    expect(text).toContain("pastes the Rates API key into a masked settings field")
    expect(text).not.toMatch(/API API|Keychain|connect_async/)
  })

  it("names one-word API services and camelCase products without doubling or flattening them", async () => {
    const blueprint = structuredClone(fileOrganizerBlueprint)
    blueprint.productName = "RenewalRadar"
    blueprint.externalServices.push({ name: "ExchangeRateAPI", purpose: "Fetch exchange rates.", dataSent: ["currency codes"], credentialRequired: true })
    blueprint.features[1]!.usesServices = ["ExchangeRateAPI"]
    blueprint.features[1]!.usesPlatformNeeds = [...blueprint.features[1]!.usesPlatformNeeds, "network"]
    const packet = await compilePacket(blueprint, "tauri2-rust-typescript-desktop")
    const text = Object.values(packet.documents).join("\n")

    expect(text).toContain("pastes the ExchangeRateAPI key into a masked settings field")
    expect(text).not.toContain("API API")
    expect(packet.graph.owners.map(owner => owner.name)).toContain("ExchangeRateApiIntegration")
    expect(text).not.toContain("Exchangerateapi")
  })

  it("never generates a bundle identity ending in .app and tells Tauri builds to re-sign ad hoc", async () => {
    const identity = async (productName: string) => (await compilePacket({ ...fileOrganizerBlueprint, productName }, "tauri2-rust-typescript-desktop")).graph.identity.bundleId

    expect(await identity("ClipVault")).toBe("com.clip.vault")
    expect(await identity("Notes")).toBe("com.notes.notes")
    expect(await identity("Harbor Sort")).toBe("com.harbor.sort")
    const packet = await compilePacket(fileOrganizerBlueprint, "tauri2-rust-typescript-desktop")
    expect(Object.values(packet.documents).join("\n")).toContain("codesign --force --deep --sign -")
  })
})
