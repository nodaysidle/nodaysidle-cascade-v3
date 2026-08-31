import { describe, expect, it } from "vitest"
import { DOCUMENT_NAMES, compilePacket, type ProjectGraph } from "../src/compiler"
import { auditProjectGraph } from "../src/audit"
import { nodaysidleVoiceV5Blueprint } from "./fixtures/voice-v5"

const CONTRACT_AUTHORITY_DOCUMENTS = ["TRD.md", "TASKS.md"] as const

function ownerTask(graph: ProjectGraph, ownerId: string) {
  return graph.phases.flatMap(phase => phase.tasks.map(task => ({ phase, task })))
    .find(item => item.task.ownerIds.includes(ownerId))!
}

describe("full NODAYSIDLE Voice V5 acceptance regression", () => {
  it("compiles required contract and capability owners before dependent feature work and rejects cycles", async () => {
    const packet = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const phaseIndex = new Map(graph.phases.map((phase, index) => [phase.id, index]))

    expect(graph.foundationFiles).toEqual(expect.arrayContaining(["Package.swift", "Sources/NodaysidleVoice/MenuBarController.swift"]))
    for (const phase of graph.phases) {
      for (const dependency of phase.dependencies) expect(phaseIndex.get(dependency)!).toBeLessThan(phaseIndex.get(phase.id)!)
    }
    for (const feature of graph.features) {
      const featurePhase = phaseIndex.get(ownerTask(graph, feature.ownerId).phase.id)!
      for (const dependencyOwnerId of feature.requiredOwnerIds) {
        expect(phaseIndex.get(ownerTask(graph, dependencyOwnerId).phase.id)!).toBeLessThan(featurePhase)
      }
    }
    expect(graph.owners.at(-1)!.id).toBe("OWN-PACKAGING")
    expect(auditProjectGraph(graph)).toEqual([])

    const cyclic = structuredClone(graph) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    cyclic.phases[1] = { ...cyclic.phases[1]!, dependencies: [cyclic.phases[2]!.id] }
    cyclic.phases[2] = { ...cyclic.phases[2]!, dependencies: [cyclic.phases[1]!.id] }
    expect(auditProjectGraph(cyclic)).toContainEqual(expect.objectContaining({ rule: "graph.cycles" }))
  })

  it("locks the two exact OpenRouter roles behind one Keychain account", async () => {
    const packet = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const transcription = packet.graph.contracts.find(contract => contract.id === "CON-INTEGRATION-OPENROUTER-TRANSCRIPTION")!
    const refinement = packet.graph.contracts.find(contract => contract.id === "CON-INTEGRATION-OPENROUTER-REFINEMENT")!
    const credentials = packet.graph.contracts.filter(contract => contract.id.startsWith("CON-CREDENTIAL-OPENROUTER"))
    const transcriptionText = [transcription.decision, ...transcription.details, transcription.failureBehavior, ...transcription.recovery].join("\n")
    const refinementText = [refinement.decision, ...refinement.details, refinement.failureBehavior, ...refinement.recovery].join("\n")

    for (const marker of [
      "POST https://openrouter.ai/api/v1/audio/transcriptions",
      "openai/gpt-4o-transcribe",
      "Authorization: Bearer",
      "Content-Type: application/json",
      "input_audio",
      "base64",
      "data",
      "format",
      "language",
      "temperature",
      "X-Generation-Id",
      "usage.seconds",
      "usage.total_tokens",
      "usage.cost",
      "URLSessionTask.cancel()",
      "65 seconds",
      "429",
      "Retry-After",
      "error.metadata.error_type",
      "metadata is retained",
      "prompt and response logging is disabled by default",
    ]) expect(transcriptionText.toLowerCase()).toContain(marker.toLowerCase())
    expect(transcriptionText).toContain("one finalized audio input")
    expect(transcriptionText).not.toContain("URLSessionWebSocketTask")
    expect(transcriptionText).not.toContain("streamed audio")

    for (const marker of [
      "POST https://openrouter.ai/api/v1/chat/completions",
      "google/gemini-2.5-flash-lite",
      "temperature: 0.0",
      "reasoning: { effort: \"none\" }",
      "stream: false",
      "preserve meaning, names, code, and technical terms",
      "never invent speech",
      "choices[0].message.content",
      "finish_reason",
      "usage.prompt_tokens",
      "usage.completion_tokens",
      "usage.total_tokens",
      "usage.cost",
      "URLSessionTask.cancel()",
      "30 seconds",
      "Retry-After",
      "prompt and response logging is disabled by default",
    ]) expect(refinementText.toLowerCase()).toContain(marker.toLowerCase())

    expect(credentials).toHaveLength(1)
    expect(credentials[0]!.details).toContain(`Keychain account: openrouter-api-key`)
    expect(credentials[0]!.featureIds).toEqual(expect.arrayContaining([...transcription.featureIds, ...refinement.featureIds]))
  })

  it("renders one concrete persistence contract consistently through all five documents", async () => {
    const packet = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const required = [
      "macOS Keychain only",
      "UserDefaults",
      "SQLite",
      "Application Support",
      "PRAGMA user_version",
      "CREATE TABLE history",
      "CREATE TABLE modes",
      "CREATE TABLE vocabulary",
      "transactional migration",
      "configured retention boundary",
      "explicit deletion",
      "FileManager.default.temporaryDirectory",
      "delete after accepted success",
      "Saved recordings",
      "explicit user action",
    ]

    for (const name of CONTRACT_AUTHORITY_DOCUMENTS) {
      for (const marker of required) expect(packet.documents[name], `${name}: ${marker}`).toContain(marker)
    }
    for (const id of ["CON-PERSISTENCE-PROVIDER-CONFIGURATION", "CON-PERSISTENCE-HOTKEY-AND-APPLICATION-PREFERENCE"]) {
      const placement = packet.graph.contracts.find(contract => contract.id === id)!.details.find(detail => detail.startsWith("Placement:"))!
      expect(placement).toContain("UserDefaults")
      expect(placement).not.toContain("SQLite")
    }
    for (const id of ["CON-PERSISTENCE-TRANSCRIPTION-HISTORY-ENTRY", "CON-PERSISTENCE-DICTATION-MODE", "CON-PERSISTENCE-CUSTOM-VOCABULARY-ENTRY"]) {
      expect(packet.graph.contracts.find(contract => contract.id === id)!.details.join("\n")).toContain("SQLite")
    }
  })

  it("renders the complete paste workflow and focused branch tests", async () => {
    const packet = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const paste = packet.graph.contracts.find(contract => contract.id === "CON-PASTE-WORKFLOW")!
    const text = [paste.decision, ...paste.details, paste.failureBehavior, ...paste.recovery].join("\n")

    for (const marker of [
      "previously focused NSRunningApplication",
      "editable AXUIElement",
      "reactivate the captured target application",
      "kAXSelectedTextAttribute",
      "Accessibility insertion first",
      "clipboard plus synthetic Command-V only as fallback",
      "all NSPasteboard item representations",
      "NSPasteboard.changeCount",
      "restore only when the current changeCount equals the app-owned write changeCount",
      "external clipboard mutation wins",
      "never insert partial, failed, cancelled, or empty text",
      "preserve the completed transcript",
      "AX success without clipboard access",
      "target reactivation failure",
      "non-editable AX target fallback",
      "fallback paste and clipboard restoration",
      "external clipboard mutation skips restoration",
      "synthetic paste failure preserves transcript",
      "Accessibility denial manual path",
      "partial and failed text rejection",
    ]) expect(text.toLowerCase()).toContain(marker.toLowerCase())
  })

  it("uses package_app.sh as the sole packaging authority with dependency-safe ownership", async () => {
    const packet = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const packaging = graph.owners.find(owner => owner.id === "OWN-PACKAGING")!
    const packagingTask = ownerTask(graph, packaging.id).task
    const allFiles = graph.foundationFiles.concat(graph.owners.flatMap(owner => [owner.implementationFile, owner.focusedTestFile]))
    const contractText = graph.contracts.filter(contract => contract.kind === "packaging")
      .flatMap(contract => [contract.decision, ...contract.details]).join("\n")

    expect(packaging.implementationFile).toBe("Scripts/package_app.sh")
    expect(allFiles.filter(file => file === "Scripts/package_app.sh")).toHaveLength(1)
    expect(allFiles.some(file => file.endsWith("Packaging.swift"))).toBe(false)
    expect(packagingTask.filesToCreate).toEqual(expect.arrayContaining([
      "Scripts/package_app.sh",
      "Resources/Info.plist",
      "Resources/App.entitlements",
      "Resources/AppIcon.icns",
    ]))
    expect(graph.foundationFiles).not.toContain("Scripts/package_app.sh")
    for (const marker of [
      "com.nodaysidle.voice",
      "CFBundleIdentifier",
      "CFBundleExecutable",
      "CFBundleIconFile",
      "LSUIElement",
      "NSMicrophoneUsageDescription",
      "Resources/App.entitlements",
      "arm64",
      "Contents/MacOS",
      "Contents/Resources",
      "codesign --verify --deep --strict",
      "LaunchServices",
    ]) expect(contractText.toLowerCase()).toContain(marker.toLowerCase())
  })

  it("is exact-five, deterministic, fully traced, and exportable", async () => {
    const first = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")
    const second = await compilePacket(nodaysidleVoiceV5Blueprint, "native-macos-swiftui-menubar")

    expect(Object.keys(first.documents)).toEqual(DOCUMENT_NAMES)
    expect(first.documents).toEqual(second.documents)
    expect(first.hashes).toEqual(second.hashes)
    expect(first.failures).toEqual([])
    expect(first.exportable).toBe(true)
    for (const item of [...first.graph.features, ...first.graph.requirements, ...first.graph.contracts]) {
      for (const name of DOCUMENT_NAMES) expect(first.documents[name], `${name}: ${item.id}`).toContain(item.id)
    }
    for (const feature of first.graph.features) {
      const owner = first.graph.owners.find(item => item.id === feature.ownerId)!
      const { phase, task } = ownerTask(first.graph, owner.id)
      const requirement = first.graph.requirements.find(item => item.featureId === feature.id)!
      const contracts = first.graph.contracts.filter(contract => contract.featureIds.includes(feature.id))
      for (const kind of ["interface", "recovery"] as const) expect(contracts.some(contract => contract.kind === kind)).toBe(true)
      for (const name of DOCUMENT_NAMES) {
        const trace = first.documents[name].split("\n").find(line => line.startsWith(`- ${feature.id} —`) && line.includes(" — Requirement "))!
        const compactMarkers = [requirement.id, owner.id, owner.implementationFile, owner.focusedTestFile, phase.id, task.id, ...contracts.map(contract => contract.id)]
        const fullMarkers = [...compactMarkers, owner.focusedTestCommand, ...task.validationCommands]
        for (const marker of name === "TRD.md" || name === "TASKS.md" ? fullMarkers : compactMarkers) {
          expect(trace, `${name}: ${feature.id}: ${marker}`).toContain(marker)
        }
        if (name === "TRD.md" || name === "TASKS.md") {
          expect(trace).toContain("Downstream instruction")
        }
      }
    }
  })
})
