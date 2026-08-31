import { describe, expect, it } from "vitest"
import { DEFAULT_API_URL, generatePacket, type BlueprintProvider } from "../src/pipeline"
import { canExport, createInitialState, reduceAppState, statusActionLabel } from "../src/state"

const form = {
  idea: "Build a native menu-bar release ledger.",
  presetId: "native-macos-swiftui-menubar" as const,
  model: "deepseek-v4-pro" as const,
  apiUrl: DEFAULT_API_URL,
  apiKey: "masked-memory-field",
}

describe("provider timeout regression", () => {
  it("fails once with safe diagnostics and preserved retry state", async () => {
    let requests = 0
    const provider: BlueprintProvider = async () => {
      requests += 1
      throw {
        kind: "timeout",
        classification: "request-timeout",
        secret: "PRIVATE_SECRET_SENTINEL",
        prompt: "PRIVATE_PROMPT_SENTINEL",
        schema: "PRIVATE_SCHEMA_SENTINEL",
        rawProviderResponse: "PRIVATE_RESPONSE_SENTINEL",
      }
    }

    const result = await generatePacket({ ...form, requestId: "timeout-regression" }, provider)

    expect(result).toMatchObject({
      status: "provider-failure",
      exportable: false,
      failure: { kind: "timeout", classification: "request-timeout" },
      issues: [{ path: "$provider", rule: "provider.request-timeout", message: "The provider request did not complete before the model-aware timeout." }],
    })
    expect(requests).toBe(1)
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|secret|prompt|schema|rawProviderResponse/)

    let state = createInitialState(form)
    const formBefore = state.form
    state = reduceAppState(state, { type: "generation-started", requestId: "timeout-regression" })
    state = reduceAppState(state, {
      type: "generation-failed",
      status: "provider-failure",
      failure: result.failure,
      issues: result.issues,
    })
    expect(state.form).toEqual(formBefore)
    expect(state.form.apiKey).toBe(form.apiKey)
    expect(statusActionLabel(state)).toBe("Retry")
    expect(canExport(state)).toBe(false)
  })

  it("lets user cancellation override a concurrent timeout failure", async () => {
    const controller = new AbortController()
    let requests = 0
    const provider: BlueprintProvider = async () => {
      requests += 1
      controller.abort()
      throw { kind: "timeout", classification: "request-timeout" }
    }

    const result = await generatePacket(
      { ...form, requestId: "cancel-regression", signal: controller.signal },
      provider,
    )

    expect(result).toMatchObject({
      status: "cancelled",
      exportable: false,
      failure: { kind: "cancelled", classification: "cancelled" },
    })
    expect(requests).toBe(1)
  })
})
