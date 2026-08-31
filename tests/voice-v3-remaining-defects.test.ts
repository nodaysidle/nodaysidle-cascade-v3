import { describe, expect, it } from "vitest"
import { DOCUMENT_NAMES, compileNormalizedPacket, compilePacket, normalizeBlueprint, packetForExport, type ProjectGraph } from "../src/compiler"
import { auditPacket, auditProjectGraph } from "../src/audit"
import { PRESETS } from "../src/presets"
import type { SemanticBlueprint } from "../src/schema"
import { exportedVoiceV3Blueprint } from "./fixtures/voice-v3-export"

const CONTRACT_AUTHORITY_DOCUMENTS = ["TRD.md", "TASKS.md"] as const

function ownerTask(graph: ProjectGraph, ownerId: string) {
  return graph.phases.flatMap((phase, phaseIndex) => phase.tasks.map(task => ({ phaseIndex, task })))
    .find(item => item.task.ownerIds.includes(ownerId))!
}

function contractText(graph: ProjectGraph, id: string): string {
  const item = graph.contracts.find(contract => contract.id === id)!
  return [item.decision, ...item.details, item.failureBehavior, ...item.recovery].join("\n")
}

function liveFailureBlueprint(): SemanticBlueprint {
  const blueprint: SemanticBlueprint = structuredClone(exportedVoiceV3Blueprint)
  blueprint.externalServices[0]!.name = "Deepgram Nova streaming"
  blueprint.productConstraints[1] = "Temporary audio: delete after completion, explicit discard, cancellation, or exhausted recovery."
  blueprint.dataObjects.push({
    name: "Active request state",
    purpose: "Tracks the explicit recovery decision for the current transcription request.",
    sensitivity: "internal",
    retentionIntent: "Delete after completion.",
  })
  return blueprint
}

describe("confirmed V3 compiler defect regressions", () => {
  it("normalizes the combined live provider-wire and temporary-audio gate failure into one consistent packet", async () => {
    const normalized = normalizeBlueprint(liveFailureBlueprint(), "native-macos-swiftui-menubar")
    const packet = await compileNormalizedPacket(normalized, "native-macos-swiftui-menubar")

    expect(packet.failures).toEqual([])
    expect(packet.exportable).toBe(true)
    expect(Object.keys(packet.documents)).toEqual(DOCUMENT_NAMES)
    const exportedFiles = packetForExport(packet)
    expect(exportedFiles).toEqual(DOCUMENT_NAMES.map(name => ({
      name,
      content: packet.documents[name],
      sha256: packet.hashes[name],
    })))
    const encoder = new TextEncoder()
    for (const file of exportedFiles) expect(encoder.encode(file.content)).toEqual(encoder.encode(packet.documents[file.name]))

    const deepgram = packet.graph.contracts.find(contract => contract.id === "CON-INTEGRATION-DEEPGRAM-NOVA-STREAMING-TRANSCRIPTION")!
    expect(deepgram).toBeDefined()
    const requiredDeepgramMeaning = [
      "Deepgram WebSocket streaming is exclusively for live microphone audio",
      "Imported audio files never enter this microphone PCM stream",
      "wss://api.deepgram.com/v1/listen",
      "model=nova-3",
      "Authorization: Token",
      "linear16",
      "16000 Hz",
      "one channel",
      "binary WebSocket frames",
      "URLSessionWebSocketTask",
      "15-second connection timeout",
      "30-minute resource timeout",
      "typed Codable",
      "KeepAlive",
      "Finalize",
      "CloseStream",
      "Results",
      "is_final",
      "SpeechStarted",
      "UtteranceEnd",
      "Metadata",
      "privacy-safe terminal states",
      "discard late events",
      "explicit retry",
      "explicit provider switch",
      "no automatic provider retry",
      "automatic paid retry",
    ]
    const temporaryAudioMeaning = [
      "Audio exists only for the active request.",
      "After a recoverable provider failure, temporary audio may be retained only while awaiting an explicit retry or explicit provider switch.",
      "Accepted success, explicit discard, cancellation, unrecoverable malformed audio, or exhausted recovery deletes temporary audio and verifies absence.",
      "Saved recordings survive only after explicit user action.",
      "Incomplete, failed, cancelled, or partial text is never pasted or persisted as completed output.",
    ]
    for (const name of CONTRACT_AUTHORITY_DOCUMENTS) {
      for (const marker of [...requiredDeepgramMeaning, ...temporaryAudioMeaning]) {
        expect(packet.documents[name], `${name}: ${marker}`).toContain(marker)
      }
    }

    const incomplete = structuredClone(packet.graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const deepgramIndex = incomplete.contracts.findIndex(contract => contract.id === deepgram.id)
    incomplete.contracts[deepgramIndex] = {
      ...incomplete.contracts[deepgramIndex]!,
      details: incomplete.contracts[deepgramIndex]!.details.filter(detail => !detail.includes("15-second connection timeout")),
    }
    expect(auditProjectGraph(incomplete)).toContainEqual(expect.objectContaining({ rule: "contract.provider-wire" }))

    const deleteBeforeRetry = {
      ...packet.documents,
      "PRD.md": `${packet.documents["PRD.md"]}\n\nTemporary audio is deleted after a recoverable provider failure before the user can choose retry or provider switch.`,
    }
    expect(auditPacket(packet.graph, deleteBeforeRetry, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "contract.persistence", path: "PRD.md" }))

    const retainAfterSuccess = {
      ...packet.documents,
      "TASKS.md": `${packet.documents["TASKS.md"]}\n\nTemporary audio is retained after accepted success for possible later reuse.`,
    }
    expect(auditPacket(packet.graph, retainAfterSuccess, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({ rule: "contract.persistence", path: "TASKS.md" }))
  })

  it("routes live microphone audio only to Deepgram and imported files only to OpenRouter", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const live = graph.features.find(feature => feature.id === "FEAT-GLOBAL-HOTKEY-DICTATION")!
    const imported = graph.features.find(feature => feature.id === "FEAT-FILE-TRANSCRIPTION")!
    const deepgram = graph.contracts.find(contract => contract.id === "CON-INTEGRATION-DEEPGRAM-NOVA-STREAMING-TRANSCRIPTION")!
    const openRouter = graph.contracts.find(contract => contract.id === "CON-INTEGRATION-OPENROUTER-TRANSCRIPTION")!

    expect(graph.blueprint.transcriptionRouting).toEqual({
      liveFeatureNames: ["Global hotkey dictation"],
      importedFeatureNames: ["File transcription"],
      liveProviderName: "Deepgram",
      importedProviderName: "OpenRouter",
      supportedImportedFormats: ["wav", "mp3", "flac", "m4a", "ogg", "webm", "aac"],
      maxImportedDurationSeconds: 60,
      maxImportedPayloadBytes: 25_000_000,
      overLimitBehavior: "reject-before-paid-upload",
      audioRewriteBehavior: "forbidden",
    })
    expect(deepgram.featureIds).toContain(live.id)
    expect(deepgram.featureIds).not.toContain(imported.id)
    expect(openRouter.featureIds).toContain(imported.id)
    expect(openRouter.featureIds).not.toContain(live.id)

    for (const name of DOCUMENT_NAMES) {
      expect(packet.documents[name]).toContain("Deepgram WebSocket streaming is exclusively for live microphone audio")
      expect(packet.documents[name]).toContain("Imported audio-file transcription uses the configured batch/file-capable provider, OpenRouter")
      expect(packet.documents[name]).not.toMatch(/(?:send|stream|route)[^.\n]{0,120}(?:selected|chosen) (?:transcription )?(?:provider|service)/i)
    }
  })

  it("rejects unsupported or oversized imported audio locally before any paid provider request", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const feature = graph.features.find(item => item.id === "FEAT-FILE-TRANSCRIPTION")!
    const owner = graph.owners.find(item => item.id === feature.ownerId)!
    const task = ownerTask(graph, owner.id).task
    const interfaceContract = contractText(graph, "CON-FILE-TRANSCRIPTION-INTERFACE")
    const providerContract = contractText(graph, "CON-INTEGRATION-OPENROUTER-TRANSCRIPTION")
    const taskText = [task.acceptanceCriteria, task.prompt].flat().join("\n")
    const required = [
      "wav, mp3, flac, m4a, ogg, webm, and aac",
      "60 seconds",
      "25 MB (25,000,000 bytes)",
      "before reading audio bytes, base64 encoding, URLRequest construction, or URLSessionTask creation",
      "before any paid upload",
      "Do not split, chunk, transcode, or stitch",
      "clear user guidance",
      "create no provider request",
      "release local inspection resources",
    ]

    expect(owner.implementationFile).toBe("Sources/NodaysidleVoice/Features/FileTranscriptionFeature.swift")
    expect(owner.focusedTestFile).toBe("Tests/NodaysidleVoiceTests/FileTranscriptionFeatureTests.swift")
    expect(task.focusedTests).toEqual([owner.focusedTestFile])
    expect(task.validationCommands).toContain("swift test --filter FileTranscriptionFeatureTests")
    for (const marker of required) {
      expect(`${feature.behavior}\n${interfaceContract}\n${providerContract}\n${taskText}`, marker).toContain(marker)
      for (const name of CONTRACT_AUTHORITY_DOCUMENTS) expect(packet.documents[name], `${name}: ${marker}`).toContain(marker)
    }
  })

  it("fails the rendered packet audit on unresolved routing or long-file alternatives", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    expect(packet.failures).toEqual([])
    for (const name of DOCUMENT_NAMES) {
      expect(packet.documents[name]).not.toMatch(/reject or (?:explicitly )?split|\beither\b.{0,120}\bor\b|\bchoose (?:one|between)\b|\bdecide whether\b/i)
    }

    const unresolved = {
      ...packet.documents,
      "TASKS.md": `${packet.documents["TASKS.md"]}\n\nEither reject or split oversized imported audio; choose one during implementation.`,
    }
    expect(auditPacket(packet.graph, unresolved, PRESETS[packet.presetId])).toContainEqual(expect.objectContaining({
      rule: "content.unresolved-decision",
      path: "TASKS.md",
    }))
  })

  it("keeps Voice task scope structural and rejects injected acceptance criteria", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph

    for (const { task } of graph.phases.flatMap(phase => phase.tasks.map(task => ({ task })))) {
      if (!task.ownerIds.length || task.ownerIds.includes("OWN-PACKAGING")) continue
      for (const featureId of task.featureIds) {
        expect(task.ownerIds, `${task.id} scopes future feature ${featureId}`).toContain(graph.features.find(feature => feature.id === featureId)!.ownerId)
      }
      for (const requirementId of task.requirementIds) {
        const featureId = graph.requirements.find(requirement => requirement.id === requirementId)!.featureId
        expect(task.featureIds, `${task.id} scopes future requirement ${requirementId}`).toContain(featureId)
      }
      for (const contractId of task.contractIds) expect(graph.contracts.find(contract => contract.id === contractId)!.ownerId).toBe(task.ownerIds[0])
      for (const acceptanceId of task.acceptanceIds) expect(graph.acceptance.find(item => item.id === acceptanceId)!.ownerId).toBe(task.ownerIds[0])
    }

    for (const ownerId of ["OWN-CREDENTIAL-VAULT", "OWN-DATA-STORE", "OWN-PERMISSION-COORDINATOR", "OWN-LIFECYCLE-COORDINATOR"]) {
      const task = ownerTask(graph, ownerId).task
      expect(task.featureIds).toEqual([])
      expect(task.requirementIds).toEqual([])
    }

    expect(packet.documents["TRD.md"]).toContain("macOS Keychain only")
    expect(packet.documents["TRD.md"]).toContain("UserDefaults")
    expect(packet.documents["TRD.md"]).toContain("SQLite")

    const laterOutcome = graph.features.find(feature => feature.id === "FEAT-GLOBAL-HOTKEY-DICTATION")!.acceptanceOutcomes[0]!
    const phaseIndex = graph.phases.findIndex(phase => phase.tasks.some(task => task.ownerIds.includes("OWN-CREDENTIAL-VAULT")))
    const tampered = structuredClone(graph) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    const phase = tampered.phases[phaseIndex]!
    const task = phase.tasks[0]!
    tampered.phases[phaseIndex] = { ...phase, tasks: [{ ...task, acceptanceCriteria: [...task.acceptanceCriteria, laterOutcome] }] }
    expect(auditProjectGraph(tampered)).toContainEqual(expect.objectContaining({
      rule: "graph.acceptance-ownership",
      message: expect.stringContaining("do not exactly match its authoritative acceptance IDs, contract IDs, and focused tests"),
    }))

    const wrongScope = structuredClone(graph) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    const scopePhase = wrongScope.phases[phaseIndex]!
    const scopeTask = scopePhase.tasks[0]!
    wrongScope.phases[phaseIndex] = { ...scopePhase, tasks: [{ ...scopeTask, featureIds: ["FEAT-GLOBAL-HOTKEY-DICTATION"] }] }
    expect(auditProjectGraph(wrongScope)).toContainEqual(expect.objectContaining({ rule: "graph.task-scope" }))

    const focused = structuredClone(graph) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    const focusedPhase = focused.phases[phaseIndex]!
    const focusedTask = focusedPhase.tasks[0]!
    const foreignFocusedTest = graph.owners.find(owner => owner.id !== "OWN-CREDENTIAL-VAULT")!.focusedTestFile
    focused.phases[phaseIndex] = { ...focusedPhase, tasks: [{
      ...focusedTask,
      focusedTests: [foreignFocusedTest],
      acceptanceCriteria: focusedTask.acceptanceCriteria.map(criterion => criterion.startsWith("Focused test ") ? `Focused test ${foreignFocusedTest} passes.` : criterion),
    }] }
    expect(auditProjectGraph(focused)).toContainEqual(expect.objectContaining({ rule: "graph.focused-test-ownership" }))
  })

  it("keeps credentials Keychain-only and settings and records in their one declared stores", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const credentialData = graph.contracts.find(contract => contract.id === "CON-DATA-API-CREDENTIALS")!

    expect(credentialData.ownerId).toBe("OWN-CREDENTIAL-VAULT")
    expect(graph.contracts.some(contract => contract.id === "CON-PERSISTENCE-API-CREDENTIALS")).toBe(false)
    expect(ownerTask(graph, "OWN-CREDENTIAL-VAULT").task.contractIds).toContain(credentialData.id)
    expect(ownerTask(graph, "OWN-DATA-STORE").task.contractIds).not.toContain(credentialData.id)
    for (const marker of ["macOS Keychain only", "com.nodaysidle.voice.credentials", "deepgram-nova-streaming-transcription-api-key", "openrouter-api-key", "never UserDefaults, SQLite, files, logs, UI state, diagnostics, or generated output"]) {
      expect(contractText(graph, credentialData.id).toLowerCase()).toContain(marker.toLowerCase())
    }

    const settings = graph.contracts.find(contract => contract.id === "CON-PERSISTENCE-USER-SETTINGS")!
    expect(settings.details.find(detail => detail.startsWith("Placement:"))).toContain("UserDefaults")
    expect(settings.details.find(detail => detail.startsWith("Placement:"))).not.toContain("SQLite")
    for (const id of ["CON-PERSISTENCE-TRANSCRIPTION-HISTORY-ENTRY", "CON-PERSISTENCE-CUSTOM-DICTATION-MODE", "CON-PERSISTENCE-CUSTOM-VOCABULARY-ENTRY"]) {
      expect(contractText(graph, id)).toContain("SQLite")
    }
    for (const id of ["CON-DATA-TEMPORARY-AUDIO-RECORDING", "CON-PERSISTENCE-TEMPORARY-AUDIO-RECORDING", "CON-PERSISTENCE-VOICE-LOCAL-STORAGE"]) {
      expect(contractText(graph, id)).toContain("After a recoverable provider failure, temporary audio may be retained only while awaiting an explicit retry or explicit provider switch.")
      expect(contractText(graph, id)).toContain("Accepted success, explicit discard, cancellation, unrecoverable malformed audio, or exhausted recovery deletes temporary audio and verifies absence.")
    }
    expect(contractText(graph, "CON-PERSISTENCE-VOICE-LOCAL-STORAGE")).toContain("CredentialVault exclusively owns API credential data")
    expect(contractText(graph, "CON-PERSISTENCE-VOICE-LOCAL-STORAGE")).toContain("DataStore never owns, serializes, migrates, or persists secret values")

    for (const name of CONTRACT_AUTHORITY_DOCUMENTS) {
      const markdown = packet.documents[name]
      expect(markdown).toContain("CON-DATA-API-CREDENTIALS")
      expect(markdown).toContain("Owner OWN-CREDENTIAL-VAULT")
      expect(markdown).toContain("macOS Keychain only")
      expect(markdown).not.toContain("CON-PERSISTENCE-API-CREDENTIALS")
      expect(markdown).toContain("CON-PERSISTENCE-USER-SETTINGS")
      expect(markdown).toContain("Placement: UserDefaults")
      expect(markdown).not.toContain("Deleted immediately after the cloud request completes or fails")
      expect(markdown).not.toMatch(/audio is deleted after the cloud request unless/i)
      expect(markdown).not.toContain("delete after completion, explicit discard")
    }
    for (const name of DOCUMENT_NAMES) {
      expect(packet.documents[name]).toContain("CON-DATA-API-CREDENTIALS")
      expect(packet.documents[name]).toContain("CON-PERSISTENCE-USER-SETTINGS")
    }

    const wrongOwner = structuredClone(graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const credentialIndex = wrongOwner.contracts.findIndex(contract => contract.id === credentialData.id)
    wrongOwner.contracts[credentialIndex] = { ...wrongOwner.contracts[credentialIndex]!, ownerId: "OWN-DATA-STORE" }
    expect(auditProjectGraph(wrongOwner)).toContainEqual(expect.objectContaining({ rule: "contract.persistence-ownership" }))

    const wrongPlacement = structuredClone(graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const settingsIndex = wrongPlacement.contracts.findIndex(contract => contract.id === settings.id)
    wrongPlacement.contracts[settingsIndex] = { ...wrongPlacement.contracts[settingsIndex]!, details: ["Placement: SQLite"] }
    expect(auditProjectGraph(wrongPlacement)).toContainEqual(expect.objectContaining({ rule: "contract.persistence-placement" }))

    const wrongCredentialPlacement = structuredClone(graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const wrongCredentialIndex = wrongCredentialPlacement.contracts.findIndex(contract => contract.id === credentialData.id)
    wrongCredentialPlacement.contracts[wrongCredentialIndex] = { ...wrongCredentialPlacement.contracts[wrongCredentialIndex]!, details: ["Placement: SQLite"] }
    expect(auditProjectGraph(wrongCredentialPlacement)).toContainEqual(expect.objectContaining({ rule: "contract.persistence-placement" }))

    const documents = { ...packet.documents }
    documents["TRD.md"] = documents["TRD.md"].replace(
      `### ${credentialData.id} —`,
      `### ${credentialData.id} — TAMPER —`,
    ).replace(`Owner: OWN-CREDENTIAL-VAULT`, `Owner: OWN-DATA-STORE`)
    expect(auditPacket(graph, documents, PRESETS[graph.presetId])).toContainEqual(expect.objectContaining({ rule: "contract.persistence-ownership", path: "TRD.md" }))

    const conflictingRetention = { ...packet.documents, "PRD.md": `${packet.documents["PRD.md"]}\n\nAudio is deleted after the cloud request unless the user explicitly saves it.` }
    expect(auditPacket(graph, conflictingRetention, PRESETS[graph.presetId])).toContainEqual(expect.objectContaining({ rule: "contract.persistence", path: "PRD.md" }))

    const ambiguousRetention = { ...packet.documents, "TRD.md": `${packet.documents["TRD.md"]}\n\nTemporary audio: delete after completion, explicit discard, cancellation, or exhausted recovery.` }
    expect(auditPacket(graph, ambiguousRetention, PRESETS[graph.presetId])).toContainEqual(expect.objectContaining({ rule: "contract.persistence", path: "TRD.md" }))
  })

  it("renders the complete deterministic native insertion contract and every focused branch", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const paste = contractText(packet.graph, "CON-PASTE-WORKFLOW")
    const required = [
      "NSRunningApplication identity",
      "process identifier",
      "current Accessibility focused element",
      "exactly one insertion candidate",
      "Never paste partial, empty, failed, cancelled, or unapproved text",
      "editable selected-text boundary",
      "every existing NSPasteboard item and representation",
      "original changeCount",
      "app-owned post-write changeCount",
      "verify that it became frontmost",
      "one Command-V through CGEvent",
      "750 ms",
      "current changeCount still equals the app-owned post-write changeCount",
      "never overwrite that newer clipboard content",
      "copy, preview, and explicit retry actions",
      "Preview mode never inserts before explicit approval",
      "Copy-only mode intentionally leaves the transcript on the clipboard",
      "direct Accessibility insertion",
      "Command-V fallback",
      "captured application no longer available",
      "activation failure",
      "Accessibility denial",
      "clipboard changed by another process",
      "clipboard restoration",
      "copy-only behavior",
      "preview approval and cancellation",
      "incomplete transcript rejection",
      "insertion failure preserving the transcript",
      "AppKit",
      "ApplicationServices",
      "small injectable native adapters",
    ]
    for (const marker of required) expect(paste.toLowerCase()).toContain(marker.toLowerCase())
    for (const name of ["TRD.md", "TASKS.md"] as const) {
      for (const marker of required) expect(packet.documents[name], `${name}: ${marker}`).toContain(marker)
      expect(packet.documents[name]).not.toMatch(/where practical/i)
    }

    const tampered = structuredClone(packet.graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const pasteIndex = tampered.contracts.findIndex(contract => contract.id === "CON-PASTE-WORKFLOW")
    tampered.contracts[pasteIndex] = { ...tampered.contracts[pasteIndex]!, details: tampered.contracts[pasteIndex]!.details.filter(detail => !detail.includes("app-owned post-write changeCount")) }
    expect(auditProjectGraph(tampered)).toContainEqual(expect.objectContaining({ rule: "contract.paste" }))
  })

  it("renders the complete official Deepgram Nova streaming wire contract", async () => {
    const packet = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const graph = packet.graph
    const id = "CON-INTEGRATION-DEEPGRAM-NOVA-STREAMING-TRANSCRIPTION"
    const deepgram = contractText(graph, id)
    for (const marker of [
      "wss://api.deepgram.com/v1/listen",
      "model=nova-3",
      "Authorization: Token",
      "encoding=linear16",
      "sample_rate=16000",
      "channels=1",
      "interim_results=true",
      "endpointing=300",
      "utterance_end_ms=1000",
      "vad_events=true",
      "smart_format=true",
      "16-bit little-endian signed PCM",
      "binary WebSocket",
      "URLSessionWebSocketTask",
      "15-second connection timeout",
      "30-minute resource timeout",
      "{\"type\":\"KeepAlive\"}",
      "every 4 seconds",
      "10-second",
      "{\"type\":\"Finalize\"}",
      "{\"type\":\"CloseStream\"}",
      "Results",
      "is_final",
      "speech_final",
      "from_finalize",
      "SpeechStarted",
      "UtteranceEnd",
      "Metadata",
      "request_id",
      "model_info",
      "model_uuid",
      "duration",
      "transaction_key",
      "no documented usage object",
      "typed Codable",
      "dg-request-id",
      "dg-error",
      "400",
      "401",
      "403",
      "429",
      "1008 DATA-0000",
      "1011 NET-0000",
      "NET-0001",
      "NET-0002",
      "malformed",
      "discard late events",
      "explicit retry",
      "explicit provider switch",
      "preserve temporary audio",
      "never sends recorded user audio",
    ]) expect(deepgram.toLowerCase()).toContain(marker.toLowerCase())

    const tampered = structuredClone(graph) as ProjectGraph & { contracts: Array<ProjectGraph["contracts"][number]> }
    const index = tampered.contracts.findIndex(contract => contract.id === id)
    tampered.contracts[index] = { ...tampered.contracts[index]!, details: tampered.contracts[index]!.details.filter(detail => !detail.includes("KeepAlive")) }
    expect(auditProjectGraph(tampered)).toContainEqual(expect.objectContaining({ rule: "contract.provider-wire" }))
  })

  it("preserves OpenRouter, exact-five determinism, full references, and preset isolation", async () => {
    const first = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    const second = await compilePacket(exportedVoiceV3Blueprint, "native-macos-swiftui-menubar")
    expect(first.graph.features).toHaveLength(12)
    expect(Object.keys(first.documents)).toEqual(DOCUMENT_NAMES)
    expect(Object.values(first.documents).every(document => document.trim().length > 0)).toBe(true)
    expect(first.documents).toEqual(second.documents)
    expect(first.hashes).toEqual(second.hashes)
    expect(first.failures).toEqual([])
    expect(first.exportable).toBe(true)

    for (const item of [...first.graph.features, ...first.graph.requirements, ...first.graph.contracts]) {
      for (const name of DOCUMENT_NAMES) expect(first.documents[name], `${name}: ${item.id}`).toContain(item.id)
    }
    for (const marker of ["openai/gpt-4o-transcribe", "google/gemini-2.5-flash-lite", "temperature: 0.0", "reasoning: { effort: \"none\" }", "batch final-transcription contract"]) {
      expect(Object.values(first.documents).join("\n")).toContain(marker)
    }

    for (const presetId of ["tauri2-rust-typescript-desktop", "astro-web", "android-kotlin-compose"] as const) {
      const packet = await compilePacket(exportedVoiceV3Blueprint, presetId)
      const text = Object.values(packet.documents).join("\n")
      for (const nativeMarker of ["URLSessionWebSocketTask", "NSPasteboard", "ApplicationServices", "FileManager.default.temporaryDirectory/com.nodaysidle.voice"]) {
        expect(text, `${presetId}: ${nativeMarker}`).not.toContain(nativeMarker)
      }
      expect(packet.failures).toEqual([])
      expect(packet.exportable).toBe(true)
    }
  })
})
