import { describe, expect, it } from "vitest"
import { normalizeBlueprint } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"
import type { JevAtomicAuditDecision } from "../src/jev"

describe("Atomic Audit Placement Alignment (H3)", () => {
  it("attaches storage tier to the correct persistent data object when prior objects are filtered", () => {
    const rawBlueprint: SemanticBlueprint = {
      productName: "ReaderApp",
      summary: "Reading app with API key, session draft, and reading history.",
      targetUsers: ["Readers"],
      goals: ["Read articles"],
      nonGoals: ["Audio"],
      features: [
        {
          name: "Article Reader",
          userOutcome: "Read articles",
          trigger: "User opens app",
          behavior: "Render article text and record reading history",
          failureOutcome: "Show error",
          acceptanceSignals: ["Articles load"],
        },
      ],
      // [0] API Key (credential -> filtered out of persistenceNeeds)
      // [1] Session Draft (in persistenceNeeds at index 0, sourceIndex 1)
      // [2] Reading History (in persistenceNeeds at index 1, sourceIndex 2)
      dataObjects: [
        {
          name: "API Key",
          purpose: "Provider token",
          sensitivity: "sensitive",
          retentionIntent: "Store in keychain",
        },
        {
          name: "Session Draft",
          purpose: "Transient editor buffer",
          sensitivity: "personal",
          retentionIntent: "session only",
        },
        {
          name: "Reading History",
          purpose: "Tracks completed articles",
          sensitivity: "personal",
          retentionIntent: "Keep in local database",
        },
      ],
      externalServices: [],
      platformNeeds: ["local-storage"],
      qualityRequirements: ["Fast load"],
      productConstraints: ["Offline-first"],
    }

    const atomicAuditDecision: JevAtomicAuditDecision = {
      blueprint: rawBlueprint,
      addedPlatformNeeds: [],
      foreignStackLeakage: false,
      unverifiableAcceptance: false,
      featureAudits: [],
      dataAudits: [
        { dataIndex: 0, dataName: "API Key", storageTier: "keychain", tierConfidence: 0.9 },
        { dataIndex: 1, dataName: "Session Draft", storageTier: "ephemeral", tierConfidence: 0.9 },
        { dataIndex: 2, dataName: "Reading History", storageTier: "sqlite", tierConfidence: 0.9 },
      ],
      unverifiableFeatures: [],
      featureIssues: [],
    }

    const normalized = normalizeBlueprint(rawBlueprint, "native-macos-swiftui-desktop", atomicAuditDecision)

    expect(normalized.persistenceNeeds).toHaveLength(2)
    const sessionDraftNeed = normalized.persistenceNeeds[0]!
    const historyNeed = normalized.persistenceNeeds[1]!

    expect(sessionDraftNeed.data).toBe("Session Draft")
    // If index was misaligned, Session Draft (at index 0 in filtered list) would match dataIndex 0 (Keychain)
    expect(sessionDraftNeed.placementTier).toBe("ephemeral")

    expect(historyNeed.data).toBe("Reading History")
    // If index was misaligned, Reading History (at index 1 in filtered list) would match dataIndex 1 (Ephemeral)
    expect(historyNeed.placementTier).toBe("sqlite")
  })
})
