import { describe, expect, it } from "vitest"
import { compileProjectGraph, NormalizationError, normalizeBlueprint } from "../src/compiler"
import { auditSemanticIntake, type SemanticBlueprint } from "../src/schema"
import { fileOrganizerBlueprint, forecastGlanceBlueprint } from "./fixtures/blueprints"

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

  it("links data and services only to the features that list them", () => {
    const graph = compileProjectGraph(normalizeBlueprint(forecastGlanceBlueprint, PRESET), PRESET)
    const featureIds = (id: string) => graph.contracts.find(contract => contract.id === id)?.featureIds

    expect(featureIds("CON-DATA-SAVED-PLACES")).toEqual(["FEAT-CURRENT-CONDITIONS", "FEAT-SAVED-PLACES"])
    expect(featureIds("CON-INTEGRATION-WEATHER-SERVICE")).toEqual(["FEAT-WEATHER-SERVICE-CONNECTION", "FEAT-CURRENT-CONDITIONS"])
    expect(featureIds("CON-PERMISSION-NETWORK")).toEqual(["FEAT-WEATHER-SERVICE-CONNECTION", "FEAT-CURRENT-CONDITIONS"])
  })
})
