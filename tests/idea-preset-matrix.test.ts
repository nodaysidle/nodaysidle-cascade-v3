import { describe, expect, test } from "vitest"
import { DOCUMENT_NAMES, compilePacket } from "../src/compiler"
import { PRESET_IDS } from "../src/presets"
import type { SemanticBlueprint } from "../src/schema"
import {
  docsPortalBlueprint,
  fileOrganizerBlueprint,
  forecastGlanceBlueprint,
  habitTrackerBlueprint,
  invoiceArchiveBlueprint,
  knowledgeManagerBlueprint,
  landingPageBlueprint,
  networkMonitorBlueprint,
  photoCleanerBlueprint,
  trailChecklistBlueprint,
} from "./fixtures/blueprints"

const ideas: readonly SemanticBlueprint[] = [
  fileOrganizerBlueprint,
  photoCleanerBlueprint,
  networkMonitorBlueprint,
  knowledgeManagerBlueprint,
  invoiceArchiveBlueprint,
  landingPageBlueprint,
  docsPortalBlueprint,
  habitTrackerBlueprint,
  trailChecklistBlueprint,
  forecastGlanceBlueprint,
]

const matrix = ideas.flatMap(blueprint => PRESET_IDS.map(presetId => ({ idea: blueprint.productName, presetId, blueprint })))

const domainTerms: readonly RegExp[] = [
  /\bdictation\b/i,
  /\btranscri\w*/i,
  /\bmicrophone\b/i,
  /\bvoice\b/i,
  /\bpaste\b/i,
  /\bclipboard\b/i,
  /\bNSPasteboard\b/,
  /\bDeepgram\b/i,
  /\bOpenRouter\b/i,
]

describe("every idea compiles to an agent-ready packet in every preset", () => {
  test.for(matrix)("$idea × $presetId", async ({ blueprint, presetId }) => {
    const packet = await compilePacket(blueprint, presetId)
    const text = Object.values(packet.documents).join("\n")
    const ideaText = JSON.stringify(blueprint)

    expect(packet.failures).toEqual([])
    expect(packet.exportable).toBe(true)
    expect(Object.keys(packet.documents)).toEqual(DOCUMENT_NAMES)
    expect(packet.ledger.filter(entry => entry.status !== "pass")).toEqual([])

    const again = await compilePacket(blueprint, presetId)
    expect(again.hashes).toEqual(packet.hashes)

    for (const contract of packet.graph.contracts.filter(item => item.kind === "permission")) {
      expect(contract.featureIds, contract.id).not.toEqual([])
    }

    for (const term of domainTerms) {
      if (!term.test(ideaText)) expect(text, `${term} is not in the idea`).not.toMatch(term)
    }
    for (const other of ideas.filter(item => item !== blueprint)) {
      expect(text, `leaked ${other.productName}`).not.toContain(other.productName)
    }

    for (const service of blueprint.externalServices.filter(item => item.credentialRequired)) {
      const credential = packet.graph.contracts.find(item => item.kind === "credential" && item.name === `${service.name} credential`)
      expect(credential, service.name).toBeDefined()
      const entry = credential!.details.find(detail => detail.startsWith("Credential entry:"))
      expect(entry, service.name).toBeDefined()
      expect(packet.documents["TRD.md"]).toContain(entry!)
    }

    if (presetId.startsWith("native-macos") && packet.documents["TRD.md"].includes("@Observable")) {
      expect(packet.documents["TRD.md"]).toContain("LSMinimumSystemVersion = 14.0")
    }
  })
})
