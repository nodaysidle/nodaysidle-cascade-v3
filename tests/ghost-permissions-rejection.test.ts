import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import { auditProjectGraph } from "../src/audit"
import type { SemanticBlueprint } from "../src/schema"
import { monospaceBlueprint } from "./monospace-quality.test"

describe("Ghost Permissions Rejection & Orphan Contract Audit Gate (H2 & M1)", () => {
  it("prunes declared platform needs that have no corresponding feature requirements", async () => {
    // Monospace blueprint with unneeded permissions declared
    const bloatedBlueprint: SemanticBlueprint = {
      ...monospaceBlueprint,
      platformNeeds: [
        "filesystem",
        "local-storage",
        "accessibility-control", // Ghost permission
        "launch-at-login",       // Ghost permission
      ],
    }

    const packet = await compilePacket(bloatedBlueprint, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)
    expect(packet.failures).toHaveLength(0)

    // Ghost permission contracts must NOT be generated
    expect(packet.graph.contracts.some(c => c.id.includes("ACCESSIBILITY"))).toBe(false)
    expect(packet.graph.contracts.some(c => c.id.includes("BACKGROUND-STARTUP"))).toBe(false)
    expect(Object.values(packet.documents).join("\n")).not.toContain("CON-PERMISSION-ACCESSIBILITY")
    expect(Object.values(packet.documents).join("\n")).not.toContain("CON-PERMISSION-BACKGROUND-STARTUP")
  })

  it("fails the audit gate if an orphan permission contract with zero linked features exists", async () => {
    const packet = await compilePacket(monospaceBlueprint, "native-macos-swiftui-desktop")
    
    // Artificially inject an orphan permission contract
    const mutatedGraph = {
      ...packet.graph,
      contracts: [
        ...packet.graph.contracts,
        {
          id: "CON-PERMISSION-ORPHAN",
          kind: "permission" as const,
          name: "Orphan permission",
          featureIds: [], // 0 linked features
          ownerId: "OWN-PERMISSION-COORDINATOR",
          decision: "Orphan decision",
          details: ["Detail"],
          failureBehavior: "Fail",
          recovery: ["Recover"],
        },
      ],
    }

    const failures = auditProjectGraph(mutatedGraph)
    expect(failures.some(f => f.rule === "graph.coverage" && f.message.includes("has no linked features"))).toBe(true)
  })

  it("does not crash with unknown owner OWN-CREDENTIAL-VAULT when domainData has credentials but no services (M1)", async () => {
    const credentialDataBlueprint: SemanticBlueprint = {
      ...monospaceBlueprint,
      productName: "SecretStash",
      dataObjects: [
        {
          name: "API Secret Key",
          purpose: "User-entered private token stored securely for custom plugins.",
          sensitivity: "sensitive",
          retentionIntent: "Retain securely until removed by user.",
        },
      ],
      externalServices: [], // No external services declared!
    }

    const packet = await compilePacket(credentialDataBlueprint, "native-macos-swiftui-desktop")
    expect(packet.exportable).toBe(true)
    expect(packet.failures).toHaveLength(0)
    expect(packet.graph.owners.some(o => o.id === "OWN-CREDENTIAL-VAULT")).toBe(true)
    expect(packet.documents["ARD.md"]).toContain("OWN-CREDENTIAL-VAULT")
  })
})
