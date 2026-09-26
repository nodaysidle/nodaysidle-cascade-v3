import { describe, expect, it } from "vitest"
import {
  DOCUMENT_NAMES,
  compileNormalizedPacket,
  compilePacket,
  compileProjectGraph,
  normalizeBlueprint,
  packetForExport,
  verifyPacketHashes,
  type ProjectGraph,
} from "../src/compiler"
import { auditPacket, auditProjectGraph, implementationText } from "../src/audit"
import { PRESET_IDS, PRESETS, type PresetId } from "../src/presets"
import {
  docsPortalBlueprint,
  fileOrganizerBlueprint,
  fixtureCases,
  forecastGlanceBlueprint,
  habitTrackerBlueprint,
  knowledgeManagerBlueprint,
  landingPageBlueprint,
  networkMonitorBlueprint,
  scanDrawerBlueprint,
} from "./fixtures/blueprints"

function messyBlueprint() {
  const messy = structuredClone(fileOrganizerBlueprint)
  messy.productName = "  Harbor Sort  "
  messy.summary = "## Architecture: Build com.example.harbor in src/main.ts with Flutter; the placeholder label is legitimate product prose."
  messy.targetUsers.push("people who regularly organize crowded local folders.")
  messy.goals.push(messy.goals[0]!.toUpperCase() + ".")
  messy.features[0]!.trigger = "Run npm run preview from tests/provider.test.ts and associate FEAT-001."
  messy.features[0]!.acceptanceSignals.push(messy.features[0]!.acceptanceSignals[0]!.toUpperCase() + ".")
  messy.qualityRequirements.push("keyboard-operable controls with visible status and accessible labels.")
  return messy
}

describe("deterministic exact-five compiler", () => {
  it("compiles every varied fixture into one clean exact-five packet", async () => {
    for (const fixture of fixtureCases) {
      const packet = await compilePacket(fixture.blueprint, fixture.presetId)
      expect(Object.keys(packet.documents), fixture.blueprint.productName).toEqual(DOCUMENT_NAMES)
      expect(Object.values(packet.documents).every(document => document.trim().length > 0)).toBe(true)
      expect(Object.values(packet.hashes).every(hash => /^[a-f0-9]{64}$/.test(hash))).toBe(true)
      expect(packet.failures).toEqual([])
      expect(packet.ledger.every(entry => entry.status === "pass")).toBe(true)
      expect(packet.exportable).toBe(true)
      expect(await verifyPacketHashes(packet)).toBe(true)
    }
  })

  it("normalizes harmless provider mechanics, duplicates, capitalization, punctuation, and framework wording locally", async () => {
    const normalized = normalizeBlueprint(messyBlueprint(), "native-macos-swiftui-desktop")
    const packet = await compileNormalizedPacket(normalized, "native-macos-swiftui-desktop")
    const decisions = implementationText(packet.documents)

    expect(normalized.projectName).toBe("Harbor Sort")
    expect(normalized.goals.filter(goal => /preview every planned move/i.test(goal))).toHaveLength(1)
    expect(normalized.features[0]!.acceptanceOutcomes).toHaveLength(1)
    expect(packet.exportable).toBe(true)
    expect(decisions).toContain("WindowGroup")
    expect(decisions).not.toMatch(/com\.example|src\/main\.ts|tests\/provider\.test\.ts|npm run preview|FEAT-001|Flutter/)
    expect(decisions).toContain("placeholder label")
  })

  it("compiles the same normalized blueprint to byte-identical packets", async () => {
    const normalized = normalizeBlueprint(forecastGlanceBlueprint, "native-macos-swiftui-menubar")
    const first = await compileNormalizedPacket(normalized, "native-macos-swiftui-menubar")
    const second = await compileNormalizedPacket(normalized, "native-macos-swiftui-menubar")

    expect(second.documents).toEqual(first.documents)
    expect(second.hashes).toEqual(first.hashes)
    expect(second.graph).toEqual(first.graph)
  })

  it("deduplicates semantic feature-name variants before allocating stable IDs", () => {
    const duplicate = structuredClone(fileOrganizerBlueprint)
    duplicate.features = [
      { ...duplicate.features[0]!, name: "Fast Search" },
      { ...duplicate.features[1]!, name: "fast-search." },
    ]
    duplicate.dataObjects = duplicate.dataObjects.filter(item => ["Organization rules", "Selected folder"].includes(item.name))
    const normalized = normalizeBlueprint(duplicate, "native-macos-swiftui-desktop")
    const graph = compileProjectGraph(normalized, "native-macos-swiftui-desktop")

    expect(graph.features.map(item => item.id)).toEqual(["FEAT-FAST-SEARCH"])
    const allIds = [...graph.features.map(item => item.id), ...graph.contracts.map(item => item.id), ...graph.phases.map(item => item.id), ...graph.phases.flatMap(phase => phase.tasks.map(task => task.id))]
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it("traces every feature and contract through all five documents", async () => {
    const packet = await compilePacket(knowledgeManagerBlueprint, "tauri2-rust-typescript-desktop")
    for (const item of [...packet.graph.features, ...packet.graph.contracts]) {
      for (const name of DOCUMENT_NAMES) expect(packet.documents[name], `${name}: ${item.id}`).toContain(item.id)
    }
  })

  it("derives stable requirement IDs and traces every requirement through all five documents", async () => {
    const packet = await compilePacket(knowledgeManagerBlueprint, "tauri2-rust-typescript-desktop")
    const requirements = packet.graph.requirements

    expect(requirements).toHaveLength(packet.graph.features.length)
    expect(requirements.map(item => item.id)).toEqual(packet.graph.features.map(feature => feature.id.replace(/^FEAT-/, "REQ-")))
    for (const requirement of requirements) {
      expect(packet.graph.features.some(feature => feature.id === requirement.featureId)).toBe(true)
      for (const name of DOCUMENT_NAMES) expect(packet.documents[name], `${name}: ${requirement.id}`).toContain(requirement.id)
    }
  })

  it("maps every owner to one implementation file, focused test, and dependency-safe phase", () => {
    const normalized = normalizeBlueprint(forecastGlanceBlueprint, "native-macos-swiftui-menubar")
    const graph = compileProjectGraph(normalized, "native-macos-swiftui-menubar")
    const fileOwners = new Set<string>()
    const testOwners = new Set<string>()
    const phaseIndex = new Map(graph.phases.map((phase, index) => [phase.id, index]))

    for (const owner of graph.owners) {
      expect(owner.implementationFile).not.toBe("")
      expect(owner.focusedTestFile).not.toBe("")
      expect(fileOwners.has(owner.implementationFile)).toBe(false)
      expect(testOwners.has(owner.focusedTestFile)).toBe(false)
      fileOwners.add(owner.implementationFile)
      testOwners.add(owner.focusedTestFile)
      expect(phaseIndex.has(owner.createPhaseId)).toBe(true)
      for (const modifyPhase of owner.modifyPhaseIds) expect(phaseIndex.get(modifyPhase)!).toBeGreaterThan(phaseIndex.get(owner.createPhaseId)!)
    }
    expect(auditProjectGraph(graph)).toEqual([])
  })

  it("uses immutable preview bytes for export without rerendering", async () => {
    const packet = await compilePacket(docsPortalBlueprint, "astro-web")
    const files = packetForExport(packet)

    expect(files.map(file => file.name)).toEqual(DOCUMENT_NAMES)
    for (const [index, name] of DOCUMENT_NAMES.entries()) {
      expect(files[index]!.content).toBe(packet.documents[name])
      expect(files[index]!.sha256).toBe(packet.hashes[name])
    }
  })

  it("exports the native macOS desktop starter kit after the five documents, hashed and owned by tasks", async () => {
    const packet = await compilePacket(scanDrawerBlueprint, "native-macos-swiftui-desktop")
    const files = packetForExport(packet)
    const module = packet.graph.identity.moduleName

    expect(files.slice(0, 5).map(file => file.name)).toEqual(DOCUMENT_NAMES)
    expect(files.slice(5).map(file => file.name)).toEqual([
      "kit/README.md",
      "kit/Package.swift",
      `kit/Sources/${module}/${module}App.swift`,
      `kit/Sources/${module}/AppState.swift`,
      `kit/Sources/${module}/Platform/ErrorCenter.swift`,
      `kit/Sources/${module}/Platform/AtomicFileWriter.swift`,
      `kit/Sources/${module}/Platform/AppFileStore.swift`,
      `kit/Sources/${module}/Platform/SQLiteDatabase.swift`,
      `kit/Tests/${module}Tests/KitTests.swift`,
      "kit/Scripts/package_app.sh",
      "kit/Resources/Info.plist",
      "kit/Resources/App.entitlements",
    ])
    for (const file of files.slice(5)) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(file.content).not.toMatch(/\$\{identity|undefined/)
    }
    const app = files.find(file => file.name.endsWith(`${module}App.swift`))!.content
    expect(app).toContain("@NSApplicationDelegateAdaptor(AppDelegate.self)")
    expect(app).not.toContain("NSApplication.shared.delegate =")
    expect(app).not.toContain("CommandGroup(replacing: .newItem)")

    // Every kit source file is owned by exactly one task, so "create only" lists stay exact.
    const created = packet.graph.phases.flatMap(phase => phase.tasks).flatMap(task => task.filesToCreate)
    for (const path of packet.graph.kitPaths) expect(created.filter(file => file === path), path).toHaveLength(1)
    expect(packet.documents["AGENTS.md"]).toContain("Before TASK-01, copy every file under kit/")
    expect(packet.documents["TASKS.md"]).toContain("Before TASK-01, copy every file under kit/")
  })

  it("sizes the kit from declared storage and has no kit for other presets", async () => {
    const habit = await compilePacket(habitTrackerBlueprint, "native-macos-swiftui-desktop")
    const names = habit.kit.map(file => file.name)
    expect(names.some(name => name.endsWith("SQLiteDatabase.swift"))).toBe(true)
    expect(names.some(name => name.endsWith("AppFileStore.swift"))).toBe(false)
    for (const presetId of PRESET_IDS.filter(id => id !== "native-macos-swiftui-desktop")) {
      expect((await compilePacket(scanDrawerBlueprint, presetId)).kit, presetId).toEqual([])
    }
  })
})

describe("preset-owned decisions", () => {
  const expected = {
    "native-macos-swiftui-desktop": ["WindowGroup", "Swift Testing", ".app", "codesign --verify --deep --strict"],
    "native-macos-swiftui-menubar": ["MenuBarExtra", "SMAppService", ".app", "codesign --verify --deep --strict"],
    "tauri2-rust-typescript-desktop": ["tauri::Builder", "Vite", "npm run tauri -- build --bundles app", "DMG/MSI/AppImage"],
    "astro-web": ["Astro", "static output", "npm run test:a11y", "dist/"],
    "android-kotlin-compose": ["Jetpack Compose", "StateFlow", "./gradlew assembleDebug", "app-debug.apk"],
  } satisfies Record<PresetId, string[]>

  it("owns stack, packaging, validation, artifacts, and completion evidence for all five presets", async () => {
    for (const presetId of PRESET_IDS) {
      const packet = await compilePacket(fileOrganizerBlueprint, presetId)
      const text = Object.values(packet.documents).join("\n")
      for (const marker of expected[presetId]) expect(text).toContain(marker)
      expect(PRESETS[presetId].validationCommands.length).toBeGreaterThan(1)
      expect(PRESETS[presetId].completionEvidence.length).toBeGreaterThan(1)
      expect(PRESETS[presetId].outputArtifact).not.toBe("")
      for (const rule of PRESETS[presetId].lifecycleRules) expect(text).toContain(rule)
    }
  })

  it("keeps the Tauri DMG build out of local proof and points at the built .app", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, "tauri2-rust-typescript-desktop")
    const text = Object.values(packet.documents).join("\n")
    expect(text).not.toContain("tauri:build")
    expect(PRESETS["tauri2-rust-typescript-desktop"].validationCommands.map(command => command(packet.graph.identity))).toContain("npm run tauri -- build --bundles app")
    expect(text).toContain(`src-tauri/target/release/bundle/macos/${packet.graph.identity.projectName}.app`)
  })

  it.each([
    ["native-macos-swiftui-desktop", "VoiceOver and keyboard"],
    ["native-macos-swiftui-menubar", "VoiceOver and keyboard"],
    ["tauri2-rust-typescript-desktop", "semantic HTML"],
    ["astro-web", "WCAG 2.2 AA"],
    ["android-kotlin-compose", "TalkBack"],
  ] as const)("locks concrete accessibility mechanics for %s", async (presetId, marker) => {
    const packet = await compilePacket(fileOrganizerBlueprint, presetId)
    expect(packet.documents["TRD.md"]).toContain(marker)
  })

  it.each([
    ["native-macos-swiftui-desktop", "@Observable @MainActor"],
    ["native-macos-swiftui-menubar", "MenuBarExtra and Settings"],
    ["tauri2-rust-typescript-desktop", "typed Tauri invoke"],
    ["astro-web", "Astro components render the content-first shell"],
    ["android-kotlin-compose", "MainActivity.setContent"],
  ] as const)("locks concrete runtime APIs for %s", async (presetId, marker) => {
    const packet = await compilePacket(fileOrganizerBlueprint, presetId)
    expect(packet.documents["TRD.md"]).toContain(marker)
  })

  it("derives credential, integration, permission, persistence, lifecycle, recovery, and packaging contracts from the idea", async () => {
    const packet = await compilePacket(forecastGlanceBlueprint, "native-macos-swiftui-menubar")
    const text = Object.values(packet.documents).join("\n")

    for (const marker of ["Weather service", "Keychain", "Swift Package Manager", "codesign", "LaunchServices", "/Applications/Forecast Glance.app"]) {
      expect(text.toLowerCase()).toContain(marker.toLowerCase())
    }
    const kinds = new Set(packet.graph.contracts.map(contract => contract.kind))
    for (const kind of ["interface", "data", "integration", "lifecycle", "persistence", "credential", "permission", "recovery", "security", "packaging"]) {
      expect(kinds).toContain(kind)
    }
    expect(packet.graph.contracts.find(contract => contract.id === "CON-PERMISSION-NETWORK")?.featureIds.length).toBeGreaterThan(0)
  })

  it("makes persistence-enabled and persistence-disabled behavior explicit", async () => {
    const enabled = await compilePacket(habitTrackerBlueprint, "android-kotlin-compose")
    const disabled = await compilePacket(landingPageBlueprint, "astro-web")

    expect(enabled.graph.persistence.enabled).toBe(true)
    expect(enabled.documents["TRD.md"]).toContain("Persistence: enabled")
    expect(disabled.graph.persistence.enabled).toBe(false)
    expect(disabled.documents["TRD.md"]).toContain("Persistence: disabled")
    expect(disabled.documents["TRD.md"]).toContain("No application data is retained between visits")
  })
})

describe("complete 5 by 5 preset isolation matrix", () => {
  const representatives = [fileOrganizerBlueprint, networkMonitorBlueprint, knowledgeManagerBlueprint, landingPageBlueprint, habitTrackerBlueprint]

  it("passes all 25 source-idea by selected-preset cells", async () => {
    let cells = 0
    for (const source of representatives) {
      for (const selected of PRESET_IDS) {
        const packet = await compilePacket(source, selected)
        const decisions = implementationText(packet.documents)
        expect(decisions).toContain(PRESETS[selected].implementationMarker)
        for (const other of PRESET_IDS.filter(id => id !== selected)) expect(decisions).not.toContain(PRESETS[other].implementationMarker)
        expect(packet.exportable).toBe(true)
        cells += 1
      }
    }
    expect(cells).toBe(25)
  })
})

describe("agent readiness and negative gate behavior", () => {
  it("keeps substantially different realistic ideas specific", async () => {
    const packets = await Promise.all(fixtureCases.map(item => compilePacket(item.blueprint, item.presetId)))
    for (const [index, packet] of packets.entries()) {
      const source = fixtureCases[index]!.blueprint
      const text = Object.values(packet.documents).join("\n")
      expect(text).toContain(source.productName)
      for (const feature of source.features) expect(text).toContain(feature.name)
      for (const other of fixtureCases.filter(item => item.blueprint.productName !== source.productName)) expect(text).not.toContain(other.blueprint.productName)
    }
  })

  it("locks export for extra files, missing references, secrets, and unresolved text", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, "native-macos-swiftui-desktop")
    const extra = { ...packet.documents, "EXTRA.md": "unexpected" } as Record<string, string>
    expect(auditPacket(packet.graph, extra, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "packet.exact-five" }))

    const missing = { ...packet.documents, "ARD.md": packet.documents["ARD.md"].replaceAll(packet.graph.features[0]!.id, "") }
    expect(auditPacket(packet.graph, missing, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "trace.missing-reference" }))

    const secret = { ...packet.documents, "PRD.md": `${packet.documents["PRD.md"]}\n\nsk-abcdefghijklmnopqrstuvwxyz012345` }
    expect(auditPacket(packet.graph, secret, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "content.secret-shaped" }))

    const unresolved = { ...packet.documents, "TASKS.md": `${packet.documents["TASKS.md"]}\n\nTBD` }
    expect(auditPacket(packet.graph, unresolved, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "content.unfinished" }))
  })

  it("keeps stated format tokens readable and exportable while filler tokens still block export", async () => {
    const withToken = structuredClone(fileOrganizerBlueprint)
    withToken.features[0]!.acceptanceSignals = ["The status line reads \"scanned <file count> files at <time>\" after a scan"]
    const clean = await compilePacket(withToken, "tauri2-rust-typescript-desktop")
    expect(clean.exportable).toBe(true)
    expect(clean.documents["PRD.md"]).toContain("scanned {file count} files at {time}")

    const withFiller = structuredClone(fileOrganizerBlueprint)
    withFiller.features[0]!.acceptanceSignals = ["The window title shows <Your App Name> after a scan"]
    const blocked = await compilePacket(withFiller, "tauri2-rust-typescript-desktop")
    expect(blocked.exportable).toBe(false)
    expect(blocked.failures).toContainEqual(expect.objectContaining({ rule: "content.unfinished", message: expect.stringContaining("<Your App Name>") }))
  })

  it("detects create-before-modify corruption as a local compiler defect", () => {
    const normalized = normalizeBlueprint(fileOrganizerBlueprint, "native-macos-swiftui-desktop")
    const graph = structuredClone(compileProjectGraph(normalized, "native-macos-swiftui-desktop"))
    graph.owners[0]!.modifyPhaseIds = [graph.phases[0]!.id]

    expect(auditProjectGraph(graph)).toContainEqual(expect.objectContaining({ rule: "graph.create-before-modify" }))
  })

  it("rejects validation commands that are not executable from the project root", () => {
    const normalized = normalizeBlueprint(fileOrganizerBlueprint, "native-macos-swiftui-desktop")
    const graph = structuredClone(compileProjectGraph(normalized, "native-macos-swiftui-desktop")) as ProjectGraph & { validationCommands: string[] }
    graph.validationCommands[0] = "/tmp/private-validator"

    expect(auditProjectGraph(graph)).toContainEqual(expect.objectContaining({
      path: "/tmp/private-validator",
      rule: "validation.commands",
    }))
  })
})
