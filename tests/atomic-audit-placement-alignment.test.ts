import { describe, expect, it } from "vitest"
import { normalizeBlueprint } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"
import type { JevAtomicAuditDecision } from "../src/jev"

describe("Atomic Audit Placement Alignment (H3)", () => {
  it("places each data object by its declared storage kind, keeps secrets out of persistence, and ignores conflicting Jev tiers", () => {
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
          failureRecovery: "retry",
          surface: "main",
          acceptanceSignals: ["Articles load"],
          usesPlatformNeeds: ["local-storage"],
          usesData: ["API Key", "Session Draft", "Reading History"],
          usesServices: [],
          userFileAccess: "none",
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
          storage: "secret", writeMode: "direct",
        },
        {
          name: "Session Draft",
          purpose: "Transient editor buffer",
          sensitivity: "personal",
          retentionIntent: "session only",
          storage: "session", writeMode: "direct",
        },
        {
          name: "Reading History",
          purpose: "Tracks completed articles",
          sensitivity: "personal",
          retentionIntent: "Keep in local database",
          storage: "records", writeMode: "direct",
        },
      ],
      externalServices: [],
      platformNeeds: ["local-storage"],
      qualityRequirements: ["Fast load"],
      productConstraints: ["Offline-first"],
      ideaCoverage: [{ sentence: 1, features: [], outsideFeatures: "product" }],
    }

    const atomicAuditDecision: JevAtomicAuditDecision = {
      blueprint: rawBlueprint,
      addedPlatformNeeds: [],
      foreignStackLeakage: false,
      unverifiableAcceptance: false,
      featureAudits: [],
      ideaReviewFeatures: [],
      dataAudits: [
        { dataIndex: 0, dataName: "API Key", storageTier: "userdefaults", tierConfidence: 0.9 },
        { dataIndex: 1, dataName: "Session Draft", storageTier: "sqlite", tierConfidence: 0.9 },
        { dataIndex: 2, dataName: "Reading History", storageTier: "ephemeral", tierConfidence: 0.9 },
      ],
      unverifiableFeatures: [],
      featureIssues: [],
    }

    const normalized = normalizeBlueprint(rawBlueprint, "native-macos-swiftui-desktop", atomicAuditDecision)

    expect(normalized.persistenceNeeds.map(need => [need.data, need.storage])).toEqual([
      ["Session Draft", "session"],
      ["Reading History", "records"],
    ])
    expect(normalized.domainData.find(item => item.name === "API Key")?.storage).toBe("secret")
  })
})
