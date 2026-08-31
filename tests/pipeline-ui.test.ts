import { describe, expect, it } from "vitest"
import { compilePacket, GraphConstructionError } from "../src/compiler"
import {
  DEFAULT_API_URL,
  MAX_BLUEPRINT_OUTPUT_TOKENS,
  generatePacket,
  normalizeProviderFailure,
  type BlueprintProvider,
  type ProviderFailure,
  type ProviderRequest,
} from "../src/pipeline"
import {
  canExport,
  canGenerate,
  createInitialState,
  reduceAppState,
  statusActionLabel,
  visibleIssues,
  type AppStatus,
} from "../src/state"
import { providerJsonSchema } from "../src/schema"
import { fileOrganizerBlueprint } from "./fixtures/blueprints"

const input = {
  requestId: "request-1",
  idea: "Build a native file organizer with preview and exact undo.",
  presetId: "native-macos-swiftui-desktop" as const,
  model: "deepseek-v4-pro" as const,
  apiUrl: DEFAULT_API_URL,
  apiKey: "memory-only-test-key",
}

function sequenceProvider(responses: Array<string | ProviderFailure>): { provider: BlueprintProvider; requests: ProviderRequest[] } {
  const requests: ProviderRequest[] = []
  const provider: BlueprintProvider = async request => {
    requests.push(request)
    const response = responses.shift()
    if (typeof response === "string") return response
    throw response ?? { kind: "transport", classification: "request-failed" }
  }
  return { provider, requests }
}

describe("one-request provider-to-packet pipeline", () => {
  it.each(["deepseek-v4-pro", "deepseek-v4-flash"] as const)("uses the compact non-reasoning contract exactly once for %s", async model => {
    const { provider, requests } = sequenceProvider([JSON.stringify(fileOrganizerBlueprint)])
    const stages: string[] = []
    const result = await generatePacket({ ...input, model, onProgress: stage => stages.push(stage) }, provider)

    expect(result.status).toBe("gate-clean")
    expect(result.issues).toEqual([])
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      model,
      apiUrl: DEFAULT_API_URL,
      maxOutputTokens: 16_384,
      reasoningEffort: "none",
      schema: providerJsonSchema,
    })
    expect(requests[0]).not.toHaveProperty("kind")
    expect(MAX_BLUEPRINT_OUTPUT_TOKENS).toBe(16_384)
    expect(requests[0]!.instructions).not.toContain(input.presetId)
    for (const mechanicalField of ["id", "documents", "files", "owners", "phases", "commands"]) expect(requests[0]!.schema.properties).not.toHaveProperty(mechanicalField)
    expect(stages).toEqual(["provider", "blueprint-validation", "local-normalization", "preset-compiler", "mechanical-audit", "agent-readiness-audit", "rendering", "export-gate"])
  })

  it.each([
    { kind: "transport", classification: "connect" },
    { kind: "timeout", classification: "request-timeout" },
    { kind: "http", classification: "http-error", httpStatus: 401, providerCode: "authentication_error" },
    { kind: "incomplete", classification: "incomplete-response", incompleteReason: "max_output_tokens" },
    { kind: "failed-response", classification: "provider-failed", providerCode: "server_error" },
    { kind: "invalid-wrapper", classification: "invalid-provider-wrapper" },
  ] satisfies ProviderFailure[])("blocks $kind before parsing with one request", async failure => {
    const { provider, requests } = sequenceProvider([failure])
    const stages: string[] = []
    let compileCalls = 0
    const result = await generatePacket(
      { ...input, onProgress: stage => stages.push(stage) },
      provider,
      async () => {
        compileCalls += 1
        throw new Error("compiler must not run")
      },
    )

    expect(result.status).toBe("provider-failure")
    expect(result.exportable).toBe(false)
    expect(result.packet).toBeUndefined()
    expect(result.issues).toEqual([expect.objectContaining({ path: "$provider", rule: `provider.${failure.classification}` })])
    expect(requests).toHaveLength(1)
    expect(stages).toEqual(["provider"])
    expect(compileCalls).toBe(0)
  })

  it("blocks invalid JSON without a second request or provider text", async () => {
    const { provider, requests } = sequenceProvider(['{"productName":"PRIVATE_PROVIDER_SENTINEL"'])
    const result = await generatePacket(input, provider)

    expect(result.status).toBe("blueprint-validation-failed")
    expect(result.failure).toEqual({ kind: "invalid-json", classification: "invalid-json" })
    expect(result.issues).toEqual([{ path: "$", rule: "provider.invalid-json", message: "The completed provider response looks truncated before it became valid JSON." }])
    expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_SENTINEL")
    expect(requests).toHaveLength(1)
  })

  it("blocks schema-invalid JSON without a second request", async () => {
    const invalid = structuredClone(fileOrganizerBlueprint) as Partial<typeof fileOrganizerBlueprint>
    delete invalid.summary
    const { provider, requests } = sequenceProvider([JSON.stringify(invalid)])
    const result = await generatePacket(input, provider)

    expect(result.status).toBe("blueprint-validation-failed")
    expect(result.exportable).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ path: "summary", rule: "schema.invalid_type" }))
    expect(requests).toHaveLength(1)
  })

  it("blocks actual secret material without exposing it or calling again", async () => {
    const secret = structuredClone(fileOrganizerBlueprint)
    secret.features[0]!.behavior = "Use sk-abcdefghijklmnopqrstuvwxyz012345 for the action."
    const { provider, requests } = sequenceProvider([JSON.stringify(secret)])
    const result = await generatePacket(input, provider)

    expect(result.status).toBe("blueprint-validation-failed")
    expect(result.issues).toEqual([{ path: "features[0].behavior", rule: "semantic.secret-material", message: "Secret material is not accepted in provider content." }])
    expect(JSON.stringify(result)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz012345")
    expect(requests).toHaveLength(1)
  })

  it("classifies local compiler and rendered-gate failures without another provider call", async () => {
    const first = sequenceProvider([JSON.stringify(fileOrganizerBlueprint)])
    const compilerFailure = await generatePacket(input, first.provider, async () => {
      throw new Error("PRIVATE_COMPILER_SENTINEL")
    })
    expect(compilerFailure.status).toBe("local-compiler-failure")
    expect(JSON.stringify(compilerFailure)).not.toContain("PRIVATE_COMPILER_SENTINEL")
    expect(first.requests).toHaveLength(1)

    const validPacket = await compilePacket(fileOrganizerBlueprint, input.presetId)
    const second = sequenceProvider([JSON.stringify(fileOrganizerBlueprint)])
    const lintFailure = await generatePacket(input, second.provider, async () => ({
      ...validPacket,
      exportable: false,
      failures: [{ rule: "trace.missing-reference", path: "ARD.md", message: "A required local reference is missing." }],
    }))
    expect(lintFailure.status).toBe("lint-failure")
    expect(lintFailure.exportable).toBe(false)
    expect(lintFailure.issues).toEqual([{ rule: "trace.missing-reference", path: "ARD.md", message: "A required local reference is missing." }])
    expect(second.requests).toHaveLength(1)
  })

  it("returns one actionable graph error before rendering", async () => {
    const { provider, requests } = sequenceProvider([JSON.stringify(fileOrganizerBlueprint)])
    const result = await generatePacket(input, provider, async () => {
      throw new GraphConstructionError({
        rule: "graph.cycles",
        path: "owners",
        message: "Owner dependency cycle prevents rendering. Remove one semantic dependency to make the graph acyclic.",
      })
    })

    expect(result.status).toBe("local-compiler-failure")
    expect(result.issues).toEqual([{
      rule: "graph.cycles",
      path: "owners",
      message: "Owner dependency cycle prevents rendering. Remove one semantic dependency to make the graph acyclic.",
    }])
    expect(requests).toHaveLength(1)
  })

  it("cancels during local compilation without accepting a packet", async () => {
    const controller = new AbortController()
    const { provider, requests } = sequenceProvider([JSON.stringify(fileOrganizerBlueprint)])
    const result = await generatePacket(
      { ...input, signal: controller.signal },
      provider,
      async (_blueprint, _presetId, onProgress) => {
        onProgress?.("preset-compiler")
        controller.abort()
        throw new Error("generation-cancelled")
      },
    )

    expect(result.status).toBe("cancelled")
    expect(result.exportable).toBe(false)
    expect(requests).toHaveLength(1)
  })

  it("cancels without compiling or issuing another provider request", async () => {
    const controller = new AbortController()
    let requests = 0
    let compileCalls = 0
    const provider: BlueprintProvider = async () => {
      requests += 1
      controller.abort()
      return JSON.stringify(fileOrganizerBlueprint)
    }
    const result = await generatePacket(
      { ...input, signal: controller.signal },
      provider,
      async () => {
        compileCalls += 1
        throw new Error("compiler must not run")
      },
    )

    expect(result.status).toBe("cancelled")
    expect(result.exportable).toBe(false)
    expect(requests).toBe(1)
    expect(compileCalls).toBe(0)
  })

  it("redacts arbitrary thrown values into one allowlisted diagnostic", () => {
    const safe = normalizeProviderFailure({
      kind: "totally-new-kind",
      classification: "RAW_CLASSIFICATION_SENTINEL",
      providerCode: "RAW_CODE_SENTINEL",
      message: "RAW_MESSAGE_SENTINEL",
      body: "RAW_BODY_SENTINEL",
      httpStatus: 799,
    })

    expect(safe).toEqual({ kind: "unknown", classification: "provider-failure" })
    expect(JSON.stringify(safe)).not.toMatch(/RAW_|message|body/)
  })
})

describe("recoverable UI state", () => {
  it("preserves every form field, keeps export locked, and exposes Retry for every hard failure", () => {
    const failureStatuses: AppStatus[] = ["provider-failure", "blueprint-validation-failed", "local-normalization-failed", "local-compiler-failure", "lint-failure", "cancelled"]
    for (const status of failureStatuses) {
      let state = createInitialState({ ...input })
      const formBefore = state.form
      state = reduceAppState(state, { type: "generation-started", requestId: input.requestId })
      state = reduceAppState(state, {
        type: "generation-failed",
        status: status as Exclude<typeof status, "empty" | "ready" | "generating" | "cancelling" | "gate-clean" | "export-success">,
        issues: [{ path: "features[0].behavior", rule: "semantic.test", message: "Safe fixed message." }],
      })
      expect(state.form).toEqual(formBefore)
      expect(state.form.apiKey).toBe(input.apiKey)
      expect(statusActionLabel(state)).toBe("Retry")
      expect(canExport(state)).toBe(false)
    }
  })

  it("shows every diagnostic issue without truncating the list", () => {
    let state = createInitialState({ ...input })
    state = reduceAppState(state, { type: "generation-started", requestId: input.requestId })
    state = reduceAppState(state, {
      type: "generation-failed",
      status: "blueprint-validation-failed",
      issues: Array.from({ length: 5 }, (_, index) => ({ path: `features[${index}]`, rule: `schema.rule-${index}`, message: "Safe fixed message." })),
    })

    expect(visibleIssues(state)).toHaveLength(5)
    expect(visibleIssues(state)[0]).toEqual({ path: "features[0]", rule: "schema.rule-0", message: "Safe fixed message." })
    expect(JSON.stringify(visibleIssues(state))).not.toMatch(/provider text|raw response/i)
  })

  it("preserves allowlisted wrapper output types from invalid-wrapper failures", () => {
    const safe = normalizeProviderFailure({
      kind: "invalid-wrapper",
      classification: "invalid-provider-wrapper",
      wrapperOutputTypes: ["reasoning", "message", "RAW_TYPE_SENTINEL"],
    })

    expect(safe).toEqual({
      kind: "invalid-wrapper",
      classification: "invalid-provider-wrapper",
      wrapperOutputTypes: ["reasoning", "message"],
    })
    expect(JSON.stringify(safe)).not.toContain("RAW_TYPE_SENTINEL")
  })

  it("maps invalid-request failures to an actionable classification", () => {
    const safe = normalizeProviderFailure({ kind: "invalid-request", classification: "invalid-request" })
    expect(safe).toEqual({ kind: "invalid-request", classification: "invalid-request" })
  })

  it("moves from ready through Gate Clean and clears only the memory-only key on success", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, input.presetId)
    let state = createInitialState({ ...input })
    expect(canGenerate(state)).toBe(true)
    state = reduceAppState(state, { type: "generation-started", requestId: input.requestId })
    state = reduceAppState(state, { type: "progressed", stage: "local-normalization" })
    expect(state.status).toBe("generating")
    state = reduceAppState(state, { type: "cancel-requested" })
    expect(state.status).toBe("cancelling")
    state = reduceAppState(state, { type: "generation-succeeded", packet })
    expect(state.status).toBe("gate-clean")
    expect(state.form.apiKey).toBe("")
    expect(state.form.idea).toBe(input.idea)
    expect(canExport(state)).toBe(true)
    state = reduceAppState(state, { type: "export-succeeded", path: "/tmp/harbor-sort" })
    expect(state.status).toBe("export-success")
  })
})
