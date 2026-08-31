import { describe, expect, it } from "vitest"
import { normalizeBlueprint } from "../src/compiler"
import { DEFAULT_API_URL, generatePacket, type BlueprintProvider, type ProviderRequest } from "../src/pipeline"
import { parseBlueprintJson, providerJsonSchema } from "../src/schema"

const allPlatformNeeds = [
  "audio-input",
  "camera",
  "clipboard",
  "global-hotkey",
  "accessibility-control",
  "notifications",
  "filesystem",
  "local-storage",
  "network",
  "background-execution",
  "launch-at-login",
  "location",
] as const

const messyProviderBlueprint = {
  productName: "  Harbor Sort  ",
  summary: "## Architecture: Build com.example.harbor in src/main.ts with Flutter; the placeholder label is legitimate product prose.",
  targetUsers: ["People organizing downloads", "people organizing downloads."],
  goals: ["Preview every move", "preview every move."],
  nonGoals: [],
  features: [
    {
      name: "Move Preview",
      userOutcome: "See every source and destination before any file changes.",
      trigger: "Choose a folder and request a preview with npm run preview.",
      behavior: "FEAT-001 groups files and explains collisions without moving them.",
      failureOutcome: "Unreadable files stay in place and remain visible.",
      acceptanceSignals: ["Every eligible file appears once", "every eligible file appears once."],
    },
    {
      name: "Reversible Batch",
      userOutcome: "Undo a completed organization batch exactly.",
      trigger: "Approve the reviewed move plan.",
      behavior: "Apply only reviewed moves and retain enough meaning for undo.",
      failureOutcome: "Stop at the first failed move and retain the completed subset.",
      acceptanceSignals: ["Undo restores every completed move"],
    },
  ],
  dataObjects: [
    {
      name: "Move journal",
      purpose: "Remember completed source and destination pairs for undo.",
      sensitivity: "personal",
      retentionIntent: "Keep until the configured undo window expires.",
    },
  ],
  externalServices: [],
  platformNeeds: ["filesystem", "local-storage"],
  qualityRequirements: ["Keyboard-accessible controls", "keyboard accessible controls."],
  productConstraints: ["Never upload filenames or file contents."],
}

describe("tolerant semantic intake architecture", () => {
  it("accepts every valid platform need and deduplicates harmless repeats locally", () => {
    const result = parseBlueprintJson(JSON.stringify({
      ...messyProviderBlueprint,
      platformNeeds: [...allPlatformNeeds, "audio-input", "network"],
    }))

    expect(result.ok, JSON.stringify(result.ok ? [] : result.failure.issues)).toBe(true)
    if (!result.ok) return

    expect(normalizeBlueprint(result.blueprint, "native-macos-swiftui-desktop").platformNeeds).toEqual(allPlatformNeeds)
  })

  it("compiles one schema-valid messy response locally with exactly one provider call", async () => {
    const requests: ProviderRequest[] = []
    const provider: BlueprintProvider = async request => {
      requests.push(request)
      return JSON.stringify(messyProviderBlueprint)
    }

    const result = await generatePacket({
      requestId: "tolerant-intake-red",
      idea: "Build a trustworthy local file organizer.",
      presetId: "native-macos-swiftui-desktop",
      model: "deepseek-v4-pro",
      apiUrl: DEFAULT_API_URL,
      apiKey: "memory-only-test-key",
    }, provider)

    expect(requests).toHaveLength(1)
    expect(requests[0]).not.toHaveProperty("kind")
    expect(Object.keys(providerJsonSchema.properties ?? {})).toEqual([
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
    ])
    expect(result.status).toBe("gate-clean")
    expect(result.exportable).toBe(true)
  })
})
