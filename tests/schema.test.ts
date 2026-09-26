import { describe, expect, it } from "vitest"
import {
  SemanticBlueprintSchema,
  auditSemanticIntake,
  buildBlueprintInstructions,
  parseBlueprintJson,
  providerJsonSchema,
} from "../src/schema"
import { fixtureCases, fileOrganizerBlueprint } from "./fixtures/blueprints"

const compactFields = [
  "productName",
  "summary",
  "targetUsers",
  "goals",
  "nonGoals",
  "features",
  "dataObjects",
  "externalServices",
  "platformNeeds",
  "qualityRequirements",
  "productConstraints",
]

describe("compact semantic provider boundary", () => {
  it("parses every varied fixture with one authoritative runtime schema", () => {
    for (const fixture of fixtureCases) {
      const result = SemanticBlueprintSchema.safeParse(fixture.blueprint)
      expect(result.success, `${fixture.presetId}: ${fixture.blueprint.productName}`).toBe(true)
    }
  })

  it("exports only the compact closed provider JSON Schema", () => {
    expect(providerJsonSchema.type).toBe("object")
    expect(providerJsonSchema.additionalProperties).toBe(false)
    expect(Object.keys(providerJsonSchema.properties ?? {})).toEqual(compactFields)
    expect(providerJsonSchema.required).toEqual(compactFields)
    for (const mechanical of ["id", "files", "testPaths", "commands", "owners", "phases", "architecture", "documents"]) {
      expect(providerJsonSchema.properties).not.toHaveProperty(mechanical)
    }
  })

  it("keeps the response bounded to twelve features and eight secondary values", () => {
    const tooManyFeatures = { ...fileOrganizerBlueprint, features: Array.from({ length: 13 }, (_, index) => ({ ...fileOrganizerBlueprint.features[0]!, name: `Feature ${index}` })) }
    const tooManyGoals = { ...fileOrganizerBlueprint, goals: Array.from({ length: 9 }, (_, index) => `Goal ${index}`) }

    expect(SemanticBlueprintSchema.safeParse(tooManyFeatures).success).toBe(false)
    expect(SemanticBlueprintSchema.safeParse(tooManyGoals).success).toBe(false)
  })

  it("constructs one meaning-only prompt without duplicating the JSON schema", () => {
    const instructions = buildBlueprintInstructions({ idea: "Build a focused local file organizer." })
    const schemaJson = JSON.stringify(providerJsonSchema)

    expect(instructions).not.toContain(schemaJson)
    expect(instructions).toContain("semantic_blueprint json_schema")
    expect(instructions).toContain("Provide product meaning only")
    expect(instructions).toContain("Do not choose or recommend a technology stack")
    expect(instructions).toContain("Do not provide IDs, file paths, test paths, commands")
    expect(instructions).toContain("List a platform need only when a stated feature uses it")
    expect(instructions).toContain("When a feature offers a fixed set of choices, such as currencies, units, or levels, list every choice and state which one is selected initially.")
    expect(instructions).toContain("state the same rule in both features. Never let two features describe the same record field differently.")
    expect(instructions).toContain("Reading or writing the app's own settings, records, app-files, or temporary data never needs filesystem.")
    expect(instructions).toContain("Declare a document dataObject for every file or folder the user chooses to open, import, or save")
    expect(instructions).toContain("File access is granted only to features that list a document dataObject.")
    expect(instructions).toContain("a feature that only works on its content after it is loaded lists a session dataObject for that loaded content instead")
    expect(instructions).toContain("Set its writeMode to atomic-replace when a failed write must leave an existing file at that location unchanged.")
    expect(instructions).toContain("Do not add features, settings, or platform needs that the idea does not ask for")
    expect(instructions).not.toContain("Include every applicable platform need")
    expect(instructions).not.toContain("eight values in any secondary list")
    expect(instructions).not.toContain("native-macos-swiftui-desktop")
  })

  it("keeps platform needs closed to unknown values", () => {
    const result = parseBlueprintJson(JSON.stringify({
      ...fileOrganizerBlueprint,
      platformNeeds: ["screen-recording"],
    }))

    expect(result.ok).toBe(false)
    if (result.ok || result.failure.kind !== "schema-invalid") throw new Error("expected schema-invalid")
    expect(result.failure.issues).toContainEqual(expect.objectContaining({
      path: "platformNeeds[0]",
      rule: "schema.invalid_value",
    }))
  })

  it("classifies invalid JSON without retaining provider text", () => {
    const result = parseBlueprintJson('{"productName":"PRIVATE_PROVIDER_SENTINEL"')

    expect(result).toEqual({
      ok: false,
      failure: {
        kind: "invalid-json",
        issues: [{ path: "$", rule: "provider.invalid-json", message: "The completed provider response looks truncated before it became valid JSON." }],
      },
    })
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_SENTINEL")
  })

  it("accepts markdown-fenced and prose-wrapped provider JSON without echoing wrapper text", () => {
    const blueprint = JSON.stringify(fileOrganizerBlueprint)
    for (const wrapped of [
      `\`\`\`json\n${blueprint}\n\`\`\``,
      `Return this compact semantic JSON value:\n${blueprint}\nEnd of JSON.`,
      `Analysis complete.\n\`\`\`json\n${blueprint}\n\`\`\``,
    ]) {
      const result = parseBlueprintJson(wrapped)
      expect(result.ok, wrapped.slice(0, 24)).toBe(true)
      if (!result.ok) throw new Error("expected parse success")
      expect(result.blueprint.productName).toBe(fileOrganizerBlueprint.productName)
    }
    expect(parseBlueprintJson(JSON.stringify(JSON.stringify(fileOrganizerBlueprint))).ok).toBe(true)
  })

  it("reports schema-invalid JSON by exact path without echoing values", () => {
    const malformed = structuredClone(fileOrganizerBlueprint) as Record<string, unknown>
    const features = malformed.features as Array<Record<string, unknown>>
    features[0] = { ...features[0], acceptanceSignals: [], failureOutcome: "PRIVATE_PROVIDER_SENTINEL" }
    const result = parseBlueprintJson(JSON.stringify(malformed))

    expect(result.ok).toBe(false)
    if (result.ok || result.failure.kind !== "schema-invalid") throw new Error("expected schema-invalid")
    expect(result.failure.issues).toContainEqual(expect.objectContaining({ path: "features[0].acceptanceSignals", rule: "schema.too_small" }))
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_SENTINEL")
  })

  it("strictly rejects provider-owned mechanics as extra fields", () => {
    for (const [field, value] of [
      ["id", "FEAT-001"],
      ["files", ["src/main.ts"]],
      ["commands", ["npm test"]],
      ["documents", { "PRD.md": "provider markdown" }],
    ] as const) {
      const result = parseBlueprintJson(JSON.stringify({ ...fileOrganizerBlueprint, [field]: value }))
      expect(result.ok, field).toBe(false)
      if (result.ok || result.failure.kind !== "schema-invalid") throw new Error("expected schema-invalid")
      expect(result.failure.issues).toContainEqual(expect.objectContaining({ path: "$", rule: "schema.unrecognized_keys" }))
    }
  })

  it("accepts empty optional arrays and legitimate placeholder wording", () => {
    const candidate = {
      ...fileOrganizerBlueprint,
      features: fileOrganizerBlueprint.features.map(feature => ({ ...feature, usesData: [], usesPlatformNeeds: [] })),
      nonGoals: [],
      dataObjects: [],
      externalServices: [],
      platformNeeds: [],
      qualityRequirements: [],
      productConstraints: [],
      summary: "A writing tool that lets authors configure the visible placeholder label for an empty draft.",
    }

    expect(SemanticBlueprintSchema.safeParse(candidate).success).toBe(true)
    expect(auditSemanticIntake(candidate)).toEqual([])
  })
})

describe("hard semantic blockers", () => {
  it("rejects a feature that lists filesystem without a document dataObject", () => {
    const candidate = structuredClone(fileOrganizerBlueprint)
    candidate.features[1]!.usesData = ["Organization rules"]

    expect(auditSemanticIntake(candidate)).toEqual([{
      path: "features[1].usesPlatformNeeds",
      rule: "semantic.filesystem-without-document",
      message: "Feature 'Move preview' lists filesystem but no document dataObject for the file or folder the user chooses.",
    }])

    candidate.features[1]!.usesPlatformNeeds = []
    expect(auditSemanticIntake(candidate)).toEqual([])
  })

  it("blocks actual secret material by exact path without exposing it", () => {
    const candidate = structuredClone(fileOrganizerBlueprint)
    candidate.features[0]!.behavior = "Send the request with sk-abcdefghijklmnopqrstuvwxyz012345."
    const issues = auditSemanticIntake(candidate)

    expect(issues).toEqual([{ path: "features[0].behavior", rule: "semantic.secret-material", message: "Secret material is not accepted in provider content." }])
    expect(JSON.stringify(issues)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345")
  })

  it.each([
    ["productName", { productName: "TBD" }, "semantic.unusable-product"],
    ["summary", { summary: "TODO" }, "semantic.unusable-summary"],
  ])("blocks unusable %s meaning", (_label, change, rule) => {
    const candidate = { ...fileOrganizerBlueprint, ...change }
    expect(auditSemanticIntake(candidate)).toContainEqual(expect.objectContaining({ rule }))
  })

  it("blocks a schema-valid blueprint with no meaningful feature", () => {
    const candidate = structuredClone(fileOrganizerBlueprint)
    candidate.features = [{
      name: "TBD",
      userOutcome: "Unknown",
      trigger: "N/A",
      behavior: "TODO",
      failureOutcome: "Unknown",
      failureRecovery: "retry",
      surface: "main",
      acceptanceSignals: ["TBD"],
      usesPlatformNeeds: [],
      usesData: [],
      usesServices: [],
    }]

    expect(SemanticBlueprintSchema.safeParse(candidate).success).toBe(true)
    expect(auditSemanticIntake(candidate)).toContainEqual(expect.objectContaining({
      path: "features",
      rule: "semantic.no-meaningful-features",
    }))
  })
})
