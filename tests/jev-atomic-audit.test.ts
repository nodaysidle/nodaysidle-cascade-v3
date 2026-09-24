import { describe, expect, it } from "vitest"
import { compileNormalizedPacket, compileProjectGraph, normalizeBlueprint } from "../src/compiler"
import {
  buildJevAtomicAuditRequest,
  evaluateJevAtomicAudit,
  JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID,
  JEV_FOREIGN_STACK_NOUL_ID,
  JEV_PLATFORM_NEEDS,
  jevDataStorageTierNoulId,
  jevFeatureCapabilityNoulId,
  jevFeatureVerifiableNoulId,
  jevPlatformNeedNoulId,
  type JevOutcome,
  type JevProvider,
} from "../src/jev"
import { DEFAULT_API_URL, generatePacket, type BlueprintProvider } from "../src/pipeline"
import type { SemanticBlueprint } from "../src/schema"
import { fileOrganizerBlueprint } from "./fixtures/blueprints"

function createSampleBlueprint(): SemanticBlueprint {
  return {
    ...fileOrganizerBlueprint,
    features: [
      {
        name: "Preview Pane",
        behavior: "Displays preview of files in the current folder.",
        trigger: "User clicks a file row.",
        userOutcome: "Preview panel displays the file metadata and thumbnail.",
        acceptanceSignals: ["Preview updates within 50ms of selection", "Error state rendered if file unreadable"],
        usesPlatformNeeds: ["filesystem"],
        usesData: ["UserPreferences", "TemporaryScanBuffer"],
        usesServices: [],
        failureOutcome: "Empty preview with error notification.",
        failureRecovery: "retry",
        surface: "main",
      },
      {
        name: "Magic AI Suggestions",
        behavior: "Suggests nice folder reorganizations.",
        trigger: "User asks for AI advice.",
        userOutcome: "Feels smart and delights the user with intuitive organization.",
        acceptanceSignals: ["User feels delighted by the suggestions", "Suggestions feel natural and intuitive"],
        usesPlatformNeeds: [],
        usesData: ["FileAuditHistory"],
        usesServices: [],
        failureOutcome: "No suggestions.",
        failureRecovery: "retry",
        surface: "main",
      },
    ],
    dataObjects: [
      {
        name: "UserPreferences",
        purpose: "Lightweight UI settings and theme",
        retentionIntent: "Preserved across restarts in user defaults",
        storage: "settings", writeMode: "direct",
        sensitivity: "personal" as const,
      },
      {
        name: "FileAuditHistory",
        purpose: "Durable log of all file rename and move operations",
        retentionIntent: "Structured SQLite storage for undo/redo history",
        storage: "records", writeMode: "direct",
        sensitivity: "personal" as const,
      },
      {
        name: "TemporaryScanBuffer",
        purpose: "Transient memory/disk buffer while scanning directories",
        retentionIntent: "Deleted immediately upon scan completion",
        storage: "temporary", writeMode: "direct",
        sensitivity: "personal" as const,
      },
    ],
  }
}

describe("Opportunity 2: Jev Atomic Contract & Placement Auditor", () => {
  it("constructs a closed atomic audit request with per-feature and per-data nouls", () => {
    const blueprint = createSampleBlueprint()
    const request = buildJevAtomicAuditRequest({
      requestId: "atomic-req-1",
      apiKey: "test-jev-key",
      presetId: "native-macos-swiftui-desktop",
      blueprint,
    })

    expect(request.state.phase).toBe("atomic-audit")
    expect(request.nouls.length).toBe(
      7 + // platform needs
      1 + // foreign stack
      1 + // acceptance verifiability
      (blueprint.features.length * 2) + // per-feature: verifiable + capability
      blueprint.dataObjects.length // per-data: storage tier
    )

    // Verify feature nouls
    expect(request.nouls.some(n => n.id === jevFeatureVerifiableNoulId(0))).toBe(true)
    expect(request.nouls.some(n => n.id === jevFeatureCapabilityNoulId(0))).toBe(true)
    expect(request.nouls.some(n => n.id === jevFeatureVerifiableNoulId(1))).toBe(true)
    const featureQuestion = request.nouls.find(n => n.id === jevFeatureVerifiableNoulId(1))!.question
    expect(featureQuestion).toContain("`blueprint.features[1].acceptanceSignals`")
    expect(featureQuestion).toContain("a test double may stand in for the OS")
    expect(request.nouls.some(n => n.id === jevFeatureCapabilityNoulId(1))).toBe(true)

    // Verify data nouls
    expect(request.nouls.some(n => n.id === jevDataStorageTierNoulId(0))).toBe(true)
    expect(request.nouls.some(n => n.id === jevDataStorageTierNoulId(1))).toBe(true)
    expect(request.nouls.some(n => n.id === jevDataStorageTierNoulId(2))).toBe(true)
  })

  it("discriminates between verifiable and subjective features with granular issue reporting", () => {
    const blueprint = createSampleBlueprint()
    const outcomes: JevOutcome[] = [
      ...JEV_PLATFORM_NEEDS.map(need => ({
        kind: "boolean" as const,
        id: jevPlatformNeedNoulId(need),
        pTrue: blueprint.platformNeeds.includes(need) ? 0.95 : 0.05,
      })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.01 },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.95 },
      // Feature 0: Preview Pane is verifiable
      { kind: "boolean", id: jevFeatureVerifiableNoulId(0), pTrue: 0.98 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(0), choice: "filesystem", confidence: 0.9 },
      // Feature 1: Magic AI Suggestions is subjective/unverifiable
      { kind: "boolean", id: jevFeatureVerifiableNoulId(1), pTrue: 0.12 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(1), choice: "none", confidence: 0.8 },
      // Data objects
      { kind: "choice", id: jevDataStorageTierNoulId(0), choice: "userdefaults", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(1), choice: "sqlite", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(2), choice: "ephemeral", confidence: 0.95 },
    ]

    const decision = evaluateJevAtomicAudit(outcomes, blueprint)

    expect(decision.unverifiableAcceptance).toBe(true)
    expect(decision.unverifiableFeatures.length).toBe(1)
    expect(decision.unverifiableFeatures[0]!.featureIndex).toBe(1)
    expect(decision.unverifiableFeatures[0]!.featureName).toBe("Magic AI Suggestions")

    // Granular issue targeting
    expect(decision.featureIssues.length).toBe(1)
    expect(decision.featureIssues[0]!.path).toBe("features[1].acceptanceSignals")
    expect(decision.featureIssues[0]!.rule).toBe("jev.feature-unverifiable-acceptance")
    expect(decision.featureIssues[0]!.message).toContain("Magic AI Suggestions")
  })

  it("detects missing platform needs per feature and heals them add-only", () => {
    const base = createSampleBlueprint()
    // Intentionally remove filesystem from declared platform needs
    const blueprint = {
      ...base,
      platformNeeds: base.platformNeeds.filter(p => p !== "filesystem"),
      features: base.features.map(feature => ({ ...feature, usesPlatformNeeds: feature.usesPlatformNeeds.filter(p => p !== "filesystem") })),
    }

    const outcomes: JevOutcome[] = [
      ...JEV_PLATFORM_NEEDS.map(need => ({
        kind: "boolean" as const,
        id: jevPlatformNeedNoulId(need),
        pTrue: 0.1, // Jev platform needs noul alone didn't cross threshold
      })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.01 },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.95 },
      // Feature 0 requires filesystem capability with high confidence
      { kind: "boolean", id: jevFeatureVerifiableNoulId(0), pTrue: 0.95 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(0), choice: "filesystem", confidence: 0.96 },
      // Feature 1
      { kind: "boolean", id: jevFeatureVerifiableNoulId(1), pTrue: 0.95 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(1), choice: "none", confidence: 0.8 },
      // Data objects
      { kind: "choice", id: jevDataStorageTierNoulId(0), choice: "userdefaults", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(1), choice: "sqlite", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(2), choice: "ephemeral", confidence: 0.95 },
    ]

    const decision = evaluateJevAtomicAudit(outcomes, blueprint)
    expect(decision.addedPlatformNeeds).toContain("filesystem")
    expect(decision.blueprint.features[0]!.usesPlatformNeeds).toContain("filesystem")
    expect(decision.blueprint.features[1]!.usesPlatformNeeds).not.toContain("filesystem")

    const normalized = normalizeBlueprint(decision.blueprint, "native-macos-swiftui-desktop", decision)
    expect(normalized.platformNeeds).toContain("filesystem")
    expect(normalized.permissionNeeds.map(need => need.capability)).toContain("filesystem")
    const graph = compileProjectGraph(normalized, "native-macos-swiftui-desktop")
    expect(graph.contracts.find(contract => contract.id === "CON-PERMISSION-FILESYSTEM")?.featureIds).toEqual(["FEAT-PREVIEW-PANE"])
  })

  it("assigns persistence placement from the declared storage kind without regex fragility", async () => {
    const blueprint = createSampleBlueprint()
    const outcomes: JevOutcome[] = [
      ...JEV_PLATFORM_NEEDS.map(need => ({
        kind: "boolean" as const,
        id: jevPlatformNeedNoulId(need),
        pTrue: blueprint.platformNeeds.includes(need) ? 0.95 : 0.05,
      })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.01 },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.95 },
      { kind: "boolean", id: jevFeatureVerifiableNoulId(0), pTrue: 0.95 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(0), choice: "none", confidence: 0.9 },
      { kind: "boolean", id: jevFeatureVerifiableNoulId(1), pTrue: 0.95 },
      { kind: "choice", id: jevFeatureCapabilityNoulId(1), choice: "none", confidence: 0.9 },
      // Storage tier assignments from Jev
      { kind: "choice", id: jevDataStorageTierNoulId(0), choice: "userdefaults", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(1), choice: "sqlite", confidence: 0.95 },
      { kind: "choice", id: jevDataStorageTierNoulId(2), choice: "ephemeral", confidence: 0.95 },
    ]

    const decision = evaluateJevAtomicAudit(outcomes, blueprint)
    const normalized = normalizeBlueprint(blueprint, "native-macos-swiftui-desktop", decision)

    const prefNeed = normalized.persistenceNeeds.find(p => p.data === "UserPreferences")
    const histNeed = normalized.persistenceNeeds.find(p => p.data === "FileAuditHistory")
    const buffNeed = normalized.persistenceNeeds.find(p => p.data === "TemporaryScanBuffer")

    expect(prefNeed?.storage).toBe("settings")
    expect(histNeed?.storage).toBe("records")
    expect(buffNeed?.storage).toBe("temporary")
    expect(buffNeed?.temporary).toBe(true)

    // Compile packet and verify contracts
    const packet = await compileNormalizedPacket(normalized, "native-macos-swiftui-desktop")
    const contracts = packet.graph.contracts

    const prefContract = contracts.find(c => c.id === "CON-PERSISTENCE-USERPREFERENCES")
    const histContract = contracts.find(c => c.id === "CON-PERSISTENCE-FILEAUDITHISTORY")
    const buffContract = contracts.find(c => c.id === "CON-PERSISTENCE-TEMPORARYSCANBUFFER")

    expect(prefContract?.details.some(d => d.includes("UserDefaults"))).toBe(true)
    expect(histContract?.details.some(d => d.includes("SQLite"))).toBe(true)
    expect(buffContract?.details.some(d => d.includes("temporaryDirectory"))).toBe(true)
  })

  it("integrates with pipeline and surfaces granular feature integrity failure", async () => {
    const blueprint = createSampleBlueprint()
    const mockProvider: BlueprintProvider = async () => JSON.stringify(blueprint)

    const jevProvider: JevProvider = async request => {
      if (request.state.phase === "preflight") {
        return JSON.stringify({
          outcomes: [
            { kind: "boolean", id: "viability", pTrue: 1 },
            { kind: "choice", id: "preset-selection", choice: "native-macos-swiftui-desktop", confidence: 1 },
          ],
        })
      }
      if (request.state.phase === "atomic-audit") {
        return JSON.stringify({
          outcomes: [
            ...JEV_PLATFORM_NEEDS.map(need => ({
              kind: "boolean",
              id: jevPlatformNeedNoulId(need),
              pTrue: 0.95,
            })),
            { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.01 },
            { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.95 },
            // Feature 0 verifiable
            { kind: "boolean", id: jevFeatureVerifiableNoulId(0), pTrue: 0.95 },
            { kind: "choice", id: jevFeatureCapabilityNoulId(0), choice: "none", confidence: 0.9 },
            // Feature 1 UNVERIFIABLE
            { kind: "boolean", id: jevFeatureVerifiableNoulId(1), pTrue: 0.1 },
            { kind: "choice", id: jevFeatureCapabilityNoulId(1), choice: "none", confidence: 0.9 },
            // Data
            { kind: "choice", id: jevDataStorageTierNoulId(0), choice: "userdefaults", confidence: 0.95 },
            { kind: "choice", id: jevDataStorageTierNoulId(1), choice: "sqlite", confidence: 0.95 },
            { kind: "choice", id: jevDataStorageTierNoulId(2), choice: "ephemeral", confidence: 0.95 },
          ],
        })
      }
      throw new Error("unexpected phase")
    }

    const result = await generatePacket(
      {
        requestId: "atomic-pipeline-test",
        idea: "File organizer",
        presetId: "native-macos-swiftui-desktop",
        model: "deepseek-v4-pro",
        apiUrl: DEFAULT_API_URL,
        apiKey: "test-key",
        jevApiKey: "test-jev-key",
        atomicAuditor: true,
      },
      mockProvider,
      compileNormalizedPacket,
      jevProvider,
    )

    expect(result.status).toBe("blueprint-integrity-failed")
    expect(result.issues.length).toBe(1)
    expect(result.issues[0]!.path).toBe("features[1].acceptanceSignals")
    expect(result.issues[0]!.rule).toBe("jev.feature-unverifiable-acceptance")
    expect(result.issues[0]!.message).toContain("Magic AI Suggestions")
  })

  it("passes clean pipeline run with atomicAuditor enabled and returns atomicAudits in jev report", async () => {
    const blueprint = createSampleBlueprint()
    const mockProvider: BlueprintProvider = async () => JSON.stringify(blueprint)

    const jevProvider: JevProvider = async request => {
      if (request.state.phase === "preflight") {
        return JSON.stringify({
          outcomes: [
            { kind: "boolean", id: "viability", pTrue: 1 },
            { kind: "choice", id: "preset-selection", choice: "native-macos-swiftui-desktop", confidence: 1 },
          ],
        })
      }
      if (request.state.phase === "atomic-audit") {
        return JSON.stringify({
          outcomes: [
            ...JEV_PLATFORM_NEEDS.map(need => ({
              kind: "boolean",
              id: jevPlatformNeedNoulId(need),
              pTrue: need === "filesystem" ? 0.95 : 0.05,
            })),
            { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0.01 },
            { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 0.95 },
            // Both features verifiable
            { kind: "boolean", id: jevFeatureVerifiableNoulId(0), pTrue: 0.95 },
            { kind: "choice", id: jevFeatureCapabilityNoulId(0), choice: "none", confidence: 0.9 },
            { kind: "boolean", id: jevFeatureVerifiableNoulId(1), pTrue: 0.95 },
            { kind: "choice", id: jevFeatureCapabilityNoulId(1), choice: "none", confidence: 0.9 },
            // Data
            { kind: "choice", id: jevDataStorageTierNoulId(0), choice: "userdefaults", confidence: 0.95 },
            { kind: "choice", id: jevDataStorageTierNoulId(1), choice: "sqlite", confidence: 0.95 },
            { kind: "choice", id: jevDataStorageTierNoulId(2), choice: "ephemeral", confidence: 0.95 },
          ],
        })
      }
      throw new Error("unexpected phase")
    }

    const result = await generatePacket(
      {
        requestId: "atomic-pipeline-clean",
        idea: "File organizer",
        presetId: "native-macos-swiftui-desktop",
        model: "deepseek-v4-pro",
        apiUrl: DEFAULT_API_URL,
        apiKey: "test-key",
        jevApiKey: "test-jev-key",
        atomicAuditor: true,
      },
      mockProvider,
      compileNormalizedPacket,
      jevProvider,
    )

    expect(result.status).toBe("gate-clean")
    expect(result.exportable).toBe(true)
    expect(result.jev?.atomicAudits).toBeDefined()
    expect(result.jev?.atomicAudits?.featureAudits.length).toBe(2)
    expect(result.jev?.atomicAudits?.dataAudits.length).toBe(3)
  })
})
