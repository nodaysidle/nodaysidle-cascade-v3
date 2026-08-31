import { describe, expect, it } from "vitest"
import { DEFAULT_API_URL, generatePacket, type BlueprintProvider } from "../src/pipeline"
import { buildBlueprintInstructions, providerJsonSchema } from "../src/schema"

const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
const describeLive = apiKey ? describe : describe.skip

describeLive("live DeepSeek provider probe", () => {
  it("completes one Responses request and reaches gate-clean for a simple idea", async () => {
    const provider: BlueprintProvider = async request => {
      const response = await fetch(request.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          instructions: request.instructions,
          input: request.input,
          max_output_tokens: request.maxOutputTokens,
          reasoning: { effort: request.reasoningEffort },
          temperature: 0,
          top_p: 1,
          text: {
            format: {
              type: "json_schema",
              name: "semantic_blueprint",
              strict: true,
              schema: request.schema,
            },
          },
          stream: false,
          store: false,
        }),
      })

      const body = await response.text()
      if (!response.ok) {
        throw {
          kind: "http",
          classification: "http-error",
          httpStatus: response.status,
        }
      }

      const wrapper = JSON.parse(body) as {
        status?: string
        output?: Array<{ type?: string; role?: string; status?: string; content?: Array<{ type?: string; text?: string }> }>
        incomplete_details?: { reason?: string }
        error?: { code?: string }
      }

      if (wrapper.status === "incomplete") {
        throw {
          kind: "incomplete",
          classification: "incomplete-response",
          incompleteReason: wrapper.incomplete_details?.reason,
        }
      }
      if (wrapper.status === "failed") {
        throw {
          kind: "failed-response",
          classification: "provider-failed",
          providerCode: wrapper.error?.code,
        }
      }
      if (wrapper.status !== "completed" || !Array.isArray(wrapper.output)) {
        throw {
          kind: "invalid-wrapper",
          classification: "invalid-provider-wrapper",
          wrapperOutputTypes: wrapper.output?.map(item => item.type).filter((type): type is string => typeof type === "string"),
        }
      }

      const messages = wrapper.output.filter(item => item.type === "message" && item.role === "assistant" && item.status === "completed")
      const text = messages.flatMap(message => message.content ?? [])
        .filter(part => part.type === "output_text")
        .map(part => part.text ?? "")
        .find(value => value.trim().length > 0)

      if (!text) {
        throw {
          kind: "invalid-wrapper",
          classification: "invalid-provider-wrapper",
          wrapperOutputTypes: wrapper.output.map(item => item.type).filter((type): type is string => typeof type === "string"),
        }
      }

      return text
    }

    const idea = [
      "Harbor Sort helps people organize downloads into named folders.",
      "Users preview a file before moving it, undo the last move, and search by filename.",
      "The app should stay responsive, keep actions local, and recover cleanly after restart.",
    ].join(" ")

    expect(buildBlueprintInstructions({ idea })).not.toContain(JSON.stringify(providerJsonSchema))

    const result = await generatePacket({
      requestId: "live-probe-1",
      idea,
      presetId: "native-macos-swiftui-desktop",
      model: process.env.CASCADE_MODEL === "deepseek-v4-flash" ? "deepseek-v4-flash" : "deepseek-v4-pro",
      apiUrl: process.env.CASCADE_API_URL?.trim() || DEFAULT_API_URL,
      apiKey: apiKey!,
    }, provider)

    expect(["gate-clean", "blueprint-validation-failed", "local-normalization-failed", "local-compiler-failure", "lint-failure", "provider-failure"]).toContain(result.status)

    if (result.status !== "gate-clean") {
      console.log(JSON.stringify({
        status: result.status,
        failure: result.failure,
        issues: result.issues,
      }, null, 2))
    }

    if (result.status === "provider-failure" && result.failure?.kind === "invalid-wrapper") {
      expect(result.failure.wrapperOutputTypes?.length).toBeGreaterThan(0)
    }

    expect(result.status).toBe("gate-clean")
    expect(result.exportable).toBe(true)
    expect(result.packet?.documents["PRD.md"].length).toBeGreaterThan(100)
  }, 660_000)
})
