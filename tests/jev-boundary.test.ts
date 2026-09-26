import { describe, expect, it } from "vitest"
import { compileNormalizedPacket, compilePacket, type NormalizedBlueprint } from "../src/compiler"
import {
  buildJevPostflightRequest,
  buildJevPreflightRequest,
  healBlueprintPlatformNeeds,
  JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID,
  JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD,
  JEV_FOREIGN_STACK_NOUL_ID,
  JEV_INTEGRITY_THRESHOLD,
  JEV_PLATFORM_NEEDS,
  JEV_PRESET_MISMATCH_CONFIDENCE,
  JEV_PRESET_SELECTION_NOUL_ID,
  JEV_VIABILITY_NOUL_ID,
  JEV_VIABILITY_THRESHOLD,
  jevHealedNeedsDetail,
  jevPlatformNeedNoulId,
  jevPresetMismatchDetail,
  type JevPlatformNeed,
  type JevProvider,
  type JevRequest,
} from "../src/jev"
import {
  DEFAULT_API_URL,
  generatePacket,
  type BlueprintProvider,
  type PacketCompiler,
  type ProviderFailure,
  type ProviderRequest,
  type ProgressStage,
} from "../src/pipeline"
import { PRESET_IDS, isPresetId } from "../src/presets"
import type { SemanticBlueprint } from "../src/schema"
import { canExport, canGenerate, createInitialState, reduceAppState, statusActionLabel } from "../src/state"
import { fixtureJevProvider, fixtureProvider, smokeCases } from "../src/smoke"
import { fileOrganizerBlueprint } from "./fixtures/blueprints"

const selectedPreset = "native-macos-swiftui-desktop" as const
const idea = "Build a native file organizer with preview and exact undo."
const input = {
  requestId: "jev-boundary-request",
  idea,
  presetId: selectedPreset,
  model: "deepseek-v4-pro" as const,
  apiUrl: DEFAULT_API_URL,
  apiKey: "PRIVATE_DEEPSEEK_KEY_SENTINEL",
  jevApiKey: "PRIVATE_JEV_KEY_SENTINEL",
}

function deepseekSequence(responses: Array<string | ProviderFailure>): { provider: BlueprintProvider; requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = []
  const provider: BlueprintProvider = async request => {
    requests.push(request)
    const response = responses.shift()
    if (typeof response === "string") return response
    throw response ?? { kind: "transport", classification: "request-failed" }
  }
  return { provider, requests }
}

type JevScriptEntry = string | Error

function jevSequence(script: JevScriptEntry[]): { provider: JevProvider; requests: JevRequest[] } {
  const requests: JevRequest[] = []
  const provider: JevProvider = async request => {
    requests.push(request)
    const response = script.shift()
    if (typeof response === "string") return response
    throw response ?? new Error("unexpected Jev request")
  }
  return { provider, requests }
}

interface CompilerCapture {
  readonly presetId: string
  readonly blueprint: NormalizedBlueprint
}

function captureCompiler(captured: CompilerCapture[]): PacketCompiler {
  return async (blueprint, presetId, onProgress) => {
    captured.push({ presetId, blueprint })
    return await compileNormalizedPacket(blueprint, presetId, onProgress)
  }
}

function preflightJson(pTrue: number, choice: string = selectedPreset, confidence = 0): string {
  return JSON.stringify({
    outcomes: [
      { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue },
      { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice, confidence },
    ],
  })
}

function postflightJson(
  inferred: Partial<Record<JevPlatformNeed, number>> = {},
  leakage = 0,
  acceptanceVerifiability = 1,
): string {
  return JSON.stringify({
    outcomes: [
      ...JEV_PLATFORM_NEEDS.map(need => ({ kind: "boolean", id: jevPlatformNeedNoulId(need), pTrue: inferred[need] ?? 0 })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: leakage },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: acceptanceVerifiability },
    ],
  })
}

const allSevenInferred: Partial<Record<JevPlatformNeed, number>> = Object.fromEntries(
  JEV_PLATFORM_NEEDS.map(need => [need, 0.9]),
)

// File access comes from userFileAccess and documents, so Jev never heals filesystem at the product level.
const HEALABLE_NEEDS = JEV_PLATFORM_NEEDS.filter(need => need !== "filesystem")

function withDeclaredNeeds(platformNeeds: JevPlatformNeed[]): SemanticBlueprint {
  const blueprint = structuredClone(fileOrganizerBlueprint)
  return { ...blueprint, platformNeeds, features: blueprint.features.map(feature => ({ ...feature, usesPlatformNeeds: [] })) }
}

describe("Jev preflight boundary", () => {
  it("rejects non-viable intake with one Jev request and zero DeepSeek calls", async () => {
    const { provider, requests: deepseekRequests } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([preflightJson(JEV_VIABILITY_THRESHOLD - 0.01)])
    const captured: CompilerCapture[] = []
    const stages: ProgressStage[] = []
    const result = await generatePacket(
      { ...input, onProgress: stage => stages.push(stage) },
      provider,
      captureCompiler(captured),
      jevProvider,
    )

    expect(result.status).toBe("intake-rejected")
    expect(result.exportable).toBe(false)
    expect(result.packet).toBeUndefined()
    expect(deepseekRequests).toHaveLength(0)
    expect(captured).toHaveLength(0)
    expect(jevRequests).toHaveLength(1)
    expect(stages).toEqual(["jev-preflight"])
    expect(result.issues).toEqual([
      { path: "$jev", rule: "jev.intake-rejected", message: "Jev did not confirm this idea as viable, so no provider request was made." },
    ])
  })

  it("passes at the exact viability threshold and exposes both Jev stages in order", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([
      preflightJson(JEV_VIABILITY_THRESHOLD),
      postflightJson(),
    ])
    const stages: ProgressStage[] = []
    const result = await generatePacket(
      { ...input, onProgress: stage => stages.push(stage) },
      provider,
      captureCompiler([]),
      jevProvider,
    )

    expect(result.status).toBe("gate-clean")
    expect(result.exportable).toBe(true)
    expect(jevRequests).toHaveLength(2)
    expect(stages).toEqual([
      "jev-preflight",
      "provider",
      "blueprint-validation",
      "jev-integrity",
      "local-normalization",
      "preset-compiler",
      "mechanical-audit",
      "agent-readiness-audit",
      "rendering",
      "export-gate",
    ])
    const preflightStageIndex = stages.indexOf("jev-preflight")
    const providerStageIndex = stages.indexOf("provider")
    const validationStageIndex = stages.indexOf("blueprint-validation")
    const integrityStageIndex = stages.indexOf("jev-integrity")
    expect(preflightStageIndex).toBeLessThan(providerStageIndex)
    expect(integrityStageIndex).toBeGreaterThan(validationStageIndex)
  })

  it("keeps the legacy stage sequence when no Jev provider is injected", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const stages: ProgressStage[] = []
    const result = await generatePacket({ ...input, onProgress: stage => stages.push(stage) }, provider)

    expect(result.status).toBe("gate-clean")
    expect(result.jev).toBeUndefined()
    expect(stages).toEqual(["provider", "blueprint-validation", "local-normalization", "preset-compiler", "mechanical-audit", "agent-readiness-audit", "rendering", "export-gate"])
  })

  it("warns about a preset mismatch without switching the preset or blocking generation", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider } = jevSequence([preflightJson(0.99, "astro-web", 0.85), postflightJson()])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("gate-clean")
    expect(result.jev?.presetMismatch).toEqual({ inferredPresetId: "astro-web", confidence: 0.85 })
    expect(result.packet?.presetId).toBe(selectedPreset)
    expect(captured).toHaveLength(1)
    expect(captured[0]!.presetId).toBe(selectedPreset)
  })

  it("does not warn below the mismatch confidence or on a matching choice", async () => {
    const below = await generatePacket(
      input,
      deepseekSequence([JSON.stringify(fileOrganizerBlueprint)]).provider,
      captureCompiler([]),
      jevSequence([preflightJson(0.99, "astro-web", JEV_PRESET_MISMATCH_CONFIDENCE - 0.01), postflightJson()]).provider,
    )
    expect(below.status).toBe("gate-clean")
    expect(below.jev?.presetMismatch).toBeUndefined()

    const matching = await generatePacket(
      input,
      deepseekSequence([JSON.stringify(fileOrganizerBlueprint)]).provider,
      captureCompiler([]),
      jevSequence([preflightJson(0.99, selectedPreset, 1), postflightJson()]).provider,
    )
    expect(matching.status).toBe("gate-clean")
    expect(matching.jev?.presetMismatch).toBeUndefined()
  })

  it("sends only the idea and the selected preset in the preflight state", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests } = jevSequence([preflightJson(0.9), postflightJson()])
    await generatePacket(input, provider, captureCompiler([]), jevProvider)

    const request = requests[0]!
    expect(Object.keys(request).sort()).toEqual(["apiKey", "nouls", "requestId", "state"])
    expect(Object.keys(request.state).sort()).toEqual(["idea", "phase", "presetId"])
    expect(request.state).toMatchObject({ phase: "preflight", idea, presetId: selectedPreset })
    expect(request.requestId).toBe(input.requestId)

    const nouls = request.nouls
    expect(nouls).toHaveLength(2)
    const viability = nouls.find(noul => noul.kind === "boolean")
    const selection = nouls.find(noul => noul.kind === "choice")
    expect(viability?.id).toBe(JEV_VIABILITY_NOUL_ID)
    expect(selection?.id).toBe(JEV_PRESET_SELECTION_NOUL_ID)
    if (!selection || selection.kind !== "choice") throw new Error("missing preset choice noul")
    expect(selection.options).toBe(PRESET_IDS)
    expect(selection.options).toEqual([...PRESET_IDS])
    expect(selection.options.every(option => isPresetId(option))).toBe(true)
  })

  it("fails closed when a Jev response chooses a preset outside PRESET_IDS", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests } = jevSequence([preflightJson(0.99, "flutter-desktop", 0.99)])
    const result = await generatePacket(input, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("jev-failure")
    expect(requests).toHaveLength(1)
  })
})

describe("Jev postflight boundary", () => {
  it("heals all seven canonical platform needs add-only", async () => {
    const blueprint = withDeclaredNeeds([])
    const snapshot = structuredClone(blueprint)
    const { provider } = deepseekSequence([JSON.stringify(blueprint)])
    const { provider: jevProvider } = jevSequence([preflightJson(0.9), postflightJson(allSevenInferred)])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("gate-clean")
    expect(captured).toHaveLength(1)
    // Filesystem is present because the fixture's features open a folder, not because Jev healed it.
    expect(captured[0]!.blueprint.platformNeeds).toEqual([...HEALABLE_NEEDS, "filesystem"])
    // Healed needs never link permissions; file access comes only from the fixture's declared document.
    expect(captured[0]!.blueprint.permissionNeeds.map(need => need.capability)).toEqual(["filesystem"])
    expect(result.jev?.addedPlatformNeeds).toEqual(HEALABLE_NEEDS)
    expect(blueprint).toEqual(snapshot)
  })

  it("touches nothing except platformNeeds on a fresh clone of the parsed blueprint", () => {
    const declared: JevPlatformNeed[] = ["notifications", "filesystem"]
    const blueprint = { ...structuredClone(fileOrganizerBlueprint), platformNeeds: [...declared] }
    const { blueprint: healed, addedPlatformNeeds } = healBlueprintPlatformNeeds(blueprint, JEV_PLATFORM_NEEDS)

    expect(healed).not.toBe(blueprint)
    for (const key of Object.keys(blueprint) as Array<keyof typeof blueprint>) {
      if (key === "platformNeeds") continue
      expect(healed[key]).toBe(blueprint[key])
    }
    expect(blueprint.platformNeeds).toEqual(declared)
    expect(healed.platformNeeds).toEqual([
      "notifications",
      "filesystem",
      "audio-input",
      "camera",
      "clipboard",
      "global-hotkey",
      "accessibility-control",
    ])
    expect(addedPlatformNeeds).toEqual(["audio-input", "camera", "clipboard", "global-hotkey", "accessibility-control"])
  })

  it("preserves declared platform need order and appends only missing needs in canonical order", async () => {
    const declared: Array< (typeof JEV_PLATFORM_NEEDS)[number] > = ["notifications", "filesystem"]
    const blueprint = withDeclaredNeeds([...declared])
    const { provider } = deepseekSequence([JSON.stringify(blueprint)])
    const { provider: jevProvider } = jevSequence([preflightJson(0.9), postflightJson(allSevenInferred)])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("gate-clean")
    const healed = captured[0]!.blueprint
    expect(healed.platformNeeds).toEqual([
      "notifications",
      "filesystem",
      "audio-input",
      "camera",
      "clipboard",
      "global-hotkey",
      "accessibility-control",
    ])
    expect(result.jev?.addedPlatformNeeds).toEqual([
      "audio-input",
      "camera",
      "clipboard",
      "global-hotkey",
      "accessibility-control",
    ])
  })

  it("heals at exactly the integrity threshold and adds nothing below it", async () => {
    const emptyNeedsBlueprint = withDeclaredNeeds([])
    const atThreshold: Partial<Record<JevPlatformNeed, number>> = Object.fromEntries(
      JEV_PLATFORM_NEEDS.map(need => [need, JEV_INTEGRITY_THRESHOLD]),
    )
    const healed = await generatePacket(
      input,
      deepseekSequence([JSON.stringify(emptyNeedsBlueprint)]).provider,
      captureCompiler([]),
      jevSequence([preflightJson(0.9), postflightJson(atThreshold)]).provider,
    )
    expect(healed.status).toBe("gate-clean")
    expect(healed.jev?.addedPlatformNeeds).toEqual(HEALABLE_NEEDS)

    const belowThreshold: Partial<Record<JevPlatformNeed, number>> = Object.fromEntries(
      JEV_PLATFORM_NEEDS.map(need => [need, JEV_INTEGRITY_THRESHOLD - 0.01]),
    )
    const { provider } = deepseekSequence([JSON.stringify(emptyNeedsBlueprint)])
    const { provider: jevProvider } = jevSequence([preflightJson(0.9), postflightJson(belowThreshold, JEV_INTEGRITY_THRESHOLD - 0.01)])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("gate-clean")
    expect(captured[0]!.blueprint.platformNeeds).toEqual(["filesystem"])
    expect(result.jev?.addedPlatformNeeds).toEqual([])
    const expected = await compilePacket(emptyNeedsBlueprint, selectedPreset)
    expect(result.packet?.documents).toEqual(expected.documents)
  })

  it("blocks a foreign-stack blueprint before the compiler and export after one repair", async () => {
    const { provider, requests: deepseekRequests } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint), JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([preflightJson(0.9), postflightJson({}, 0.71), postflightJson({}, 0.71)])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("blueprint-integrity-failed")
    expect(result.exportable).toBe(false)
    expect(result.packet).toBeUndefined()
    expect(captured).toHaveLength(0)
    expect(deepseekRequests).toHaveLength(2)
    expect(deepseekRequests[1]!.input).toContain("(jev.foreign-stack-leakage)")
    expect(jevRequests).toHaveLength(3)
    expect(result.issues).toEqual([
      {
        path: "$jev",
        rule: "jev.foreign-stack-leakage",
        message: "Jev detected implementation instructions for a technology stack that conflicts with the selected preset.",
      },
    ])
  })

  it("sends only the selected preset and the parsed blueprint in the postflight state", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests } = jevSequence([preflightJson(0.9), postflightJson()])
    await generatePacket(input, provider, captureCompiler([]), jevProvider)

    const postflight = requests[1]!
    expect(Object.keys(postflight).sort()).toEqual(["apiKey", "nouls", "requestId", "state"])
    expect(Object.keys(postflight.state).sort()).toEqual(["blueprint", "phase", "presetId"])
    expect(postflight.state.phase).toBe("postflight")
    if (postflight.state.phase !== "postflight") throw new Error("missing postflight state")
    expect(postflight.state.presetId).toBe(selectedPreset)
    expect(postflight.state.blueprint).toEqual(fileOrganizerBlueprint)
    expect(postflight.nouls).toHaveLength(9)
    const needIds = postflight.nouls.map(noul => noul.id)
    expect(needIds).toEqual([...JEV_PLATFORM_NEEDS.map(jevPlatformNeedNoulId), JEV_FOREIGN_STACK_NOUL_ID, JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID])
    expect(needIds.filter(id => id === JEV_FOREIGN_STACK_NOUL_ID)).toHaveLength(1)
    expect(needIds.filter(id => id === JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID)).toHaveLength(1)
  })

  it("aligns the built postflight request with the runner contract", () => {
    const request = buildJevPostflightRequest({
      requestId: "built-postflight",
      apiKey: "PRIVATE_JEV_KEY_SENTINEL",
      presetId: selectedPreset,
      blueprint: fileOrganizerBlueprint,
    })
    expect(request.state.phase).toBe("postflight")
    expect(request.nouls).toHaveLength(9)

    const preflight = buildJevPreflightRequest({
      requestId: "built-preflight",
      apiKey: "PRIVATE_JEV_KEY_SENTINEL",
      idea,
      presetId: selectedPreset,
    })
    expect(preflight.state.phase).toBe("preflight")
    expect(preflight.nouls).toHaveLength(2)
  })
})

describe("Jev failure handling", () => {
  it("fails closed when the preflight transport throws without a DeepSeek call or retry", async () => {
    const { provider, requests: deepseekRequests } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([
      Object.assign(new Error("PRIVATE_JEV_FAILURE_SENTINEL"), { detail: "PRIVATE_JEV_KEY_SENTINEL" }),
    ])
    const result = await generatePacket(input, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("jev-failure")
    expect(result.exportable).toBe(false)
    expect(deepseekRequests).toHaveLength(0)
    expect(jevRequests).toHaveLength(1)
    expect(result.issues).toEqual([
      { path: "$jev", rule: "jev.transport", message: "The Jev decision request could not establish a safe connection." },
    ])
  })

  it("fails closed when the postflight request fails without compiling", async () => {
    const { provider, requests: deepseekRequests } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([
      preflightJson(0.9),
      Object.assign(new Error("PRIVATE_JEV_FAILURE_SENTINEL"), { detail: "PRIVATE_JEV_KEY_SENTINEL" }),
    ])
    const captured: CompilerCapture[] = []
    const result = await generatePacket(input, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("jev-failure")
    expect(captured).toHaveLength(0)
    expect(deepseekRequests).toHaveLength(1)
    expect(jevRequests).toHaveLength(2)
    expect(result.issues).toEqual([
      { path: "$jev", rule: "jev.transport", message: "The Jev decision request could not establish a safe connection." },
    ])
  })

  it.each([
    { name: "truncated JSON", response: `{"outcomes":[{"kind":"boolean","id":"${JEV_VIABILITY_NOUL_ID}","pTrue":0.9}` },
    {
      name: "missing noul",
      response: JSON.stringify({ outcomes: [{ kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 0.9 }] }),
    },
    {
      name: "unknown noul id",
      response: JSON.stringify({
        outcomes: [
          { kind: "boolean", id: "PRIVATE_JEV_RESPONSE_SENTINEL", pTrue: 0.9 },
          { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: selectedPreset, confidence: 0.9 },
        ],
      }),
    },
    {
      name: "probability above range",
      response: JSON.stringify({
        outcomes: [
          { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 1.01 },
          { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: selectedPreset, confidence: 0.9 },
        ],
      }),
    },
    {
      name: "non-numeric probability",
      response: JSON.stringify({
        outcomes: [
          { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: "high" },
          { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: selectedPreset, confidence: 0.9 },
        ],
      }),
    },
    {
      name: "extra outcome",
      response: JSON.stringify({
        outcomes: [
          { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 0.9 },
          { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: selectedPreset, confidence: 0.9 },
          { kind: "boolean", id: "PRIVATE_JEV_RESPONSE_SENTINEL", pTrue: 0.9 },
        ],
      }),
    },
    {
      name: "unknown top-level field",
      response: JSON.stringify({
        outcomes: [
          { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 0.9 },
          { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: selectedPreset, confidence: 0.9 },
        ],
        note: "PRIVATE_JEV_RESPONSE_SENTINEL",
      }),
    },
  ])("fails closed on a malformed Jev response: $name", async ({ response }) => {
    const { provider, requests: deepseekRequests } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider, requests: jevRequests } = jevSequence([response])
    const result = await generatePacket(input, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("jev-failure")
    expect(deepseekRequests).toHaveLength(0)
    expect(jevRequests).toHaveLength(1)
    expect(result.issues).toEqual([
      { path: "$jev", rule: "jev.invalid-response", message: "The Jev decision response was not a closed, valid decision document." },
    ])
  })
})

describe("Jev cancellation", () => {
  it("cancels during a preflight Jev request without a DeepSeek call", async () => {
    const controller = new AbortController()
    const provider: BlueprintProvider = async () => {
      throw new Error("DeepSeek provider must not run")
    }
    const requests: JevRequest[] = []
    const jevProvider: JevProvider = async request => {
      requests.push(request)
      controller.abort()
      return preflightJson(0.99)
    }
    const result = await generatePacket({ ...input, signal: controller.signal }, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("cancelled")
    expect(requests).toHaveLength(1)
  })

  it("returns cancelled before any Jev request when the signal is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const jevRequests: JevRequest[] = []
    const jevProvider: JevProvider = async request => {
      jevRequests.push(request)
      return preflightJson(0.99)
    }
    const result = await generatePacket(
      { ...input, signal: controller.signal },
      deepseekSequence([JSON.stringify(fileOrganizerBlueprint)]).provider,
      captureCompiler([]),
      jevProvider,
    )

    expect(result.status).toBe("cancelled")
    expect(jevRequests).toHaveLength(0)
  })

  it("cancels after postflight without compiling or accepting a packet", async () => {
    const controller = new AbortController()
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    let jevCall = 0
    const jevProvider: JevProvider = async () => {
      jevCall += 1
      if (jevCall === 2) controller.abort()
      return jevCall === 1 ? preflightJson(0.99) : postflightJson()
    }
    const captured: CompilerCapture[] = []
    const result = await generatePacket({ ...input, signal: controller.signal }, provider, captureCompiler(captured), jevProvider)

    expect(result.status).toBe("cancelled")
    expect(jevCall).toBe(2)
    expect(captured).toHaveLength(0)
  })
})

describe("Jev safe fixed diagnostics", () => {
  it("never echoes the idea, keys, or provider text in any Jev result", async () => {
    const secretIdea = "Build PRIVATE_IDEA_SENTINEL for PRIVATE_DEEPSEEK_KEY_SENTINEL and PRIVATE_JEV_KEY_SENTINEL."
    const cases: Array<{ name: string; script: JevScriptEntry[]; expectedStatus: string }> = [
      { name: "intake rejected", script: [preflightJson(0.1, "astro-web", 0.99)], expectedStatus: "intake-rejected" },
      {
        name: "transport failure",
        script: [Object.assign(new Error("PRIVATE_JEV_FAILURE_SENTINEL"), { body: "PRIVATE_JEV_RESPONSE_SENTINEL" })],
        expectedStatus: "jev-failure",
      },
      {
        name: "invalid response",
        script: ['{"outcomes":[{"kind":"boolean","id":"PRIVATE_JEV_RESPONSE_SENTINEL","pTrue":0.9}]}'],
        expectedStatus: "jev-failure",
      },
    ]

    for (const testCase of cases) {
      const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
      const { provider: jevProvider } = jevSequence(testCase.script)
      const result = await generatePacket(
        { ...input, idea: secretIdea },
        provider,
        captureCompiler([]),
        jevProvider,
      )
      expect(result.status).toBe(testCase.expectedStatus)
      expect(JSON.stringify(result)).not.toMatch(/PRIVATE_IDEA_SENTINEL|PRIVATE_DEEPSEEK_KEY_SENTINEL|PRIVATE_JEV_KEY_SENTINEL|PRIVATE_JEV_RESPONSE_SENTINEL|PRIVATE_JEV_FAILURE_SENTINEL/)
    }

    const leakage = await generatePacket(
      { ...input, idea: secretIdea },
      deepseekSequence([JSON.stringify(fileOrganizerBlueprint), JSON.stringify(fileOrganizerBlueprint)]).provider,
      captureCompiler([]),
      jevSequence([preflightJson(0.9), postflightJson({}, 0.99), postflightJson({}, 0.99)]).provider,
    )
    expect(leakage.status).toBe("blueprint-integrity-failed")
    expect(JSON.stringify(leakage)).not.toMatch(/PRIVATE_IDEA_SENTINEL|PRIVATE_DEEPSEEK_KEY_SENTINEL|PRIVATE_JEV_KEY_SENTINEL|PRIVATE_JEV_RESPONSE_SENTINEL|PRIVATE_JEV_FAILURE_SENTINEL/)
  })

  it("renders preset mismatch and healed needs as fixed closed-value detail rows", () => {
    const mismatchDetail = jevPresetMismatchDetail({ inferredPresetId: "astro-web", confidence: 0.85 })
    expect(mismatchDetail).toBe("Jev inferred astro-web at confidence 0.85. The selected preset remains authoritative.")
    expect(mismatchDetail).not.toContain("PRIVATE")

    const healedDetail = jevHealedNeedsDetail(["camera", "clipboard"])
    expect(healedDetail).toBe("Jev added missing platform needs in canonical order: camera, clipboard.")
  })
})

describe("Jev UI state and keys", () => {
  it("requires both the DeepSeek and Jev keys before generation is possible", () => {
    expect(canGenerate(createInitialState({ idea, apiKey: "PRIVATE_DEEPSEEK_KEY_SENTINEL", jevApiKey: "PRIVATE_JEV_KEY_SENTINEL" }))).toBe(true)
    expect(canGenerate(createInitialState({ idea, apiKey: "PRIVATE_DEEPSEEK_KEY_SENTINEL", jevApiKey: "" }))).toBe(false)
    expect(canGenerate(createInitialState({ idea, apiKey: "", jevApiKey: "PRIVATE_JEV_KEY_SENTINEL" }))).toBe(false)
  })

  it("clears both keys only after a gate-clean success", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, selectedPreset)
    let state = createInitialState(input)
    expect(canGenerate(state)).toBe(true)
    state = reduceAppState(state, { type: "generation-started", requestId: input.requestId })
    expect(state.form.apiKey).toBe(input.apiKey)
    expect(state.form.jevApiKey).toBe(input.jevApiKey)
    state = reduceAppState(state, { type: "generation-succeeded", packet })
    expect(state.status).toBe("gate-clean")
    expect(state.form.apiKey).toBe("")
    expect(state.form.jevApiKey).toBe("")
    expect(state.form.idea).toBe(idea)

    for (const status of ["intake-rejected", "blueprint-integrity-failed", "jev-failure"] as const) {
      let failed = createInitialState(input)
      failed = reduceAppState(failed, { type: "generation-started", requestId: input.requestId })
      failed = reduceAppState(failed, {
        type: "generation-failed",
        status,
        issues: [{ path: "$jev", rule: "jev.test", message: "Safe fixed message." }],
      })
      expect(failed.form.apiKey).toBe(input.apiKey)
      expect(failed.form.jevApiKey).toBe(input.jevApiKey)
      expect(statusActionLabel(failed)).toBe("Retry")
      expect(canExport(failed)).toBe(false)
    }
  })

  it("keeps the Jev report persistently visible in state until the next input change", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, selectedPreset)
    const report = { presetMismatch: { inferredPresetId: "astro-web" as const, confidence: 0.85 }, addedPlatformNeeds: ["camera"] as const }
    let state = createInitialState(input)
    state = reduceAppState(state, { type: "generation-started", requestId: input.requestId })
    state = reduceAppState(state, { type: "generation-succeeded", packet, jev: report })
    expect(state.jev).toEqual(report)
    state = reduceAppState(state, { type: "progressed", stage: "provider" })
    expect(state.jev).toEqual(report)
    state = reduceAppState(state, { type: "form-changed", field: "idea", value: `${idea} Again.` })
    expect(state.jev).toBeUndefined()
  })
})

describe("Jev acceptance verifiability boundary", () => {
  it("rejects blueprints when Jev detects unverifiable acceptance signals", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint), JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider } = jevSequence([
      preflightJson(0.95),
      postflightJson({}, 0, JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD - 0.01),
      postflightJson({}, 0, JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD - 0.01),
    ])
    const result = await generatePacket(input, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("blueprint-integrity-failed")
    expect(result.exportable).toBe(false)
    expect(result.issues).toEqual([
      {
        path: "$jev",
        rule: "jev.unverifiable-acceptance",
        message: "Jev detected feature acceptance signals that are not mechanically verifiable through tests or observable state changes.",
      },
    ])
  })

  it("passes when Jev confirms acceptance signals are mechanically verifiable", async () => {
    const { provider } = deepseekSequence([JSON.stringify(fileOrganizerBlueprint)])
    const { provider: jevProvider } = jevSequence([
      preflightJson(0.95),
      postflightJson({}, 0, JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD),
    ])
    const result = await generatePacket(input, provider, captureCompiler([]), jevProvider)

    expect(result.status).toBe("gate-clean")
    expect(result.exportable).toBe(true)
  })
})

describe("smoke fixture path", () => {
  it("reaches gate-clean for all five smoke cases with fixture Jev decisions and no network provider", async () => {
    for (const testCase of smokeCases) {
      const expected = await compilePacket(testCase.blueprint, testCase.presetId)
      const { provider: jevProvider, requests: jevRequests } = jevSequence([
        await fixtureJevProvider(buildJevPreflightRequest({
          requestId: `smoke-${testCase.presetId}`,
          apiKey: "fixture-smoke-memory-only-jev-key",
          idea: testCase.blueprint.productName,
          presetId: testCase.presetId,
        })),
        await fixtureJevProvider(buildJevPostflightRequest({
          requestId: `smoke-${testCase.presetId}`,
          apiKey: "fixture-smoke-memory-only-jev-key",
          presetId: testCase.presetId,
          blueprint: testCase.blueprint,
        })),
      ])
      const result = await generatePacket(
        {
          requestId: `smoke-${testCase.presetId}`,
          idea: testCase.blueprint.productName,
          presetId: testCase.presetId,
          model: "deepseek-v4-pro",
          apiUrl: DEFAULT_API_URL,
          apiKey: "fixture-smoke-memory-only-key",
          jevApiKey: "fixture-smoke-memory-only-jev-key",
        },
        fixtureProvider,
        captureCompiler([]),
        jevProvider,
      )

      expect(result.status).toBe("gate-clean")
      expect(result.exportable).toBe(true)
      expect(jevRequests).toHaveLength(2)
      expect(result.jev?.addedPlatformNeeds).toEqual([])
      expect(result.jev?.presetMismatch).toBeUndefined()
      expect(result.packet?.documents).toEqual(expected.documents)
    }
  })

  it("serves fixture Jev decisions for the fixture blueprint provider", async () => {
    const [first] = smokeCases
    expect(first).toBeDefined()
    const preflight = await fixtureJevProvider(buildJevPreflightRequest({
      requestId: "fixture-request",
      apiKey: "fixture-smoke-memory-only-jev-key",
      idea: first!.blueprint.productName,
      presetId: first!.presetId,
    }))
    expect(JSON.parse(preflight)).toMatchObject({
      outcomes: [
        { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 1 },
        { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: first!.presetId, confidence: 1 },
      ],
    })
  })
})
