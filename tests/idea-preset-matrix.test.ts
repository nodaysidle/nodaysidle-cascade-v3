import { describe, expect, test } from "vitest"
import { DOCUMENT_NAMES, compilePacket } from "../src/compiler"
import { PRESET_IDS, PRESETS } from "../src/presets"
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
  scanDrawerBlueprint,
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
  scanDrawerBlueprint,
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

    const wiring = packet.graph.contracts.find(item => item.id === "CON-RUNTIME-WIRING")
    expect(wiring?.ownerId).toBe("OWN-PACKAGING")
    expect(wiring?.details).toEqual(PRESETS[presetId].wiringRules)
    const packagingTask = packet.graph.phases.flatMap(phase => phase.tasks).find(task => task.ownerIds.includes("OWN-PACKAGING"))!
    expect(packagingTask.contractIds).toContain("CON-RUNTIME-WIRING")
    expect(packagingTask.filesToModify).toContain(PRESETS[presetId].registrationFile("feature", packet.graph.identity))
    expect(packet.documents["AGENTS.md"]).toContain("Keep test doubles (in-memory stores, console-only output, fake platform calls) in test files only")
    expect(packet.documents["AGENTS.md"]).toContain("Report PARTIAL, not DONE, while any production entry point uses a test double")

    if (presetId.startsWith("native-macos") && packet.documents["TRD.md"].includes("@Observable")) {
      expect(packet.documents["TRD.md"]).toContain("LSMinimumSystemVersion = 14.0")
    }
  })
})

describe("declared storage, recovery, and sentence form stay precise", () => {
  test.for(PRESET_IDS)("Scan Drawer × %s", async presetId => {
    const packet = await compilePacket(scanDrawerBlueprint, presetId)
    const text = Object.values(packet.documents).join("\n")
    expect(packet.failures).toEqual([])

    // App-owned files never land at user-selected paths.
    const stored = packet.graph.contracts.find(item => item.id === "CON-PERSISTENCE-STORED-SCANS")!
    expect(stored.details.find(detail => detail.startsWith("Placement:"))).not.toMatch(/at user-selected paths/)
    if (presetId !== "astro-web") {
      expect(stored.details).toContain(`Placement: ${PRESETS[presetId].persistence.appFilesPlacement(packet.graph.identity)}`)
    }
    if (presetId.startsWith("native-macos")) {
      expect(stored.details).toContain(`Placement: Files in Application Support/${packet.graph.identity.bundleId}/Files/, created only by the app under generated unique file names; stored references hold the file name relative to that folder, never an absolute path or a user-selected location.`)
      expect(packet.documents["ARD.md"]).toContain(`- App files: ${PRESETS[presetId].persistence.appFilesPlacement(packet.graph.identity)}`)
      expect(packet.graph.persistence.decision).toBe("Persistence: enabled with UserDefaults for lightweight settings, SQLite for durable record collections in Application Support, and app-owned files in Application Support.")
    }

    // A declared automatic fallback never sits next to a rule that forbids non-user retries.
    const fallback = packet.graph.contracts.find(item => item.id === "CON-TAG-FILTER-RECOVERY")!
    expect(fallback.recovery.join(" ")).toContain("Apply the stated fallback automatically")
    expect(text).not.toContain("Use explicit user retries only")

    // Full-sentence behaviors stay verbatim; no requirement reads "The product must On ...".
    expect(text).not.toMatch(/The product must [A-Z]/)
    const removal = packet.graph.requirements.find(item => item.featureId === "FEAT-SCAN-REMOVAL")!
    expect(removal.statement).toBe(scanDrawerBlueprint.features[1]!.behavior)

    // Acronyms keep their case and "without" is not chained.
    expect(packet.documents["PRD.md"]).toContain("need a focused way to keep scans in a local library without network access and without OCR or automatic text extraction.")

    // The ARD lifecycle section lists each lifecycle contract once.
    const lifecycle = packet.documents["ARD.md"].split("## Platform Lifecycle")[1]!.split("\n## ")[0]!.split("\n").filter(line => line.startsWith("- "))
    expect(new Set(lifecycle).size).toBe(lifecycle.length)
    expect(lifecycle.length).toBe(packet.graph.contracts.filter(item => item.kind === "lifecycle").length)
  })
})
