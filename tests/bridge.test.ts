import { describe, expect, it } from "vitest"
import { cancelProviderRequest, exportPacketTo, invokeBlueprintProvider, invokeJevDecision, type CommandInvoker } from "../src/bridge"
import { compilePacket, packetForExport } from "../src/compiler"
import { buildJevPreflightRequest, type JevRequest } from "../src/jev"
import { DEFAULT_API_URL, type ProviderRequest } from "../src/pipeline"
import { providerJsonSchema } from "../src/schema"
import { fileOrganizerBlueprint } from "./fixtures/blueprints"

const request: ProviderRequest = {
  requestId: "request-bridge",
  apiUrl: DEFAULT_API_URL,
  apiKey: "memory-only-bridge-key",
  model: "deepseek-v4-pro",
  maxOutputTokens: 16_384,
  reasoningEffort: "none",
  schema: providerJsonSchema,
  instructions: "Return meaning only.",
  input: "Return the blueprint.",
}

describe("Tauri IPC bridge", () => {
  it("sends the selected provider request once and returns only completed text", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const invoke: CommandInvoker = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args })
      return "{\"productName\":\"Harbor Sort\"}" as T
    }

    await expect(invokeBlueprintProvider(request, invoke)).resolves.toBe('{"productName":"Harbor Sort"}')
    expect(calls).toEqual([{ command: "deepseek_complete", args: { request } }])
  })

  it("sends choice descriptions and keeps probabilities only for questions that ask for them", async () => {
    const jevRequest: JevRequest = {
      requestId: "request-bridge-fidelity",
      apiKey: "memory-only-jev-key",
      state: { phase: "intake", idea: "A file organizer." },
      nouls: [
        { kind: "choice", id: "scored", question: "How faithful?", options: ["faithful", "wrong"], descriptions: { faithful: "all rules fit", wrong: "a rule is wrong" }, keepProbabilities: true },
        { kind: "choice", id: "plain", question: "Which tier?", options: ["a", "b"] },
      ],
    }
    let sent: Record<string, unknown> | undefined
    const invoke: CommandInvoker = async <T>(_command: string, args?: Record<string, unknown>) => {
      sent = args
      const probabilities = { faithful: 0.4, wrong: 0.6 }
      return { model: "jev", answers: { scored: { type: "choice", choice: "wrong", confidence: 0.2, probabilities }, plain: { type: "choice", choice: "a", confidence: 0.9, probabilities: { a: 0.9, b: 0.1 } } } } as T
    }

    const outcomes = JSON.parse(await invokeJevDecision(jevRequest, invoke)).outcomes
    expect(JSON.stringify(sent)).toContain("\"faithful\":\"all rules fit\"")
    expect(outcomes[0]).toEqual({ kind: "choice", id: "scored", choice: "wrong", confidence: 0.2, probabilities: { faithful: 0.4, wrong: 0.6 } })
    expect(outcomes[1]).toEqual({ kind: "choice", id: "plain", choice: "a", confidence: 0.9 })
  })

  it("adapts the internal Jev request to the TypeSafe decisions command once", async () => {
    const jevRequest = buildJevPreflightRequest({
      requestId: "request-bridge-jev",
      apiKey: "memory-only-jev-key",
      idea: "Build a native file organizer with preview and exact undo.",
      presetId: "native-macos-swiftui-desktop",
    })
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const invoke: CommandInvoker = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args })
      return {
        model: "~typesafe/jev-latest",
        answers: {
          viability: { type: "noul", noul: 0.91 },
          "preset-selection": {
            type: "choice",
            choice: "native-macos-swiftui-desktop",
            confidence: 0.88,
            probabilities: { "native-macos-swiftui-desktop": 0.88 },
          },
        },
      } as T
    }

    await expect(invokeJevDecision(jevRequest, invoke)).resolves.toBe(JSON.stringify({
      outcomes: [
        { kind: "boolean", id: "viability", pTrue: 0.91 },
        { kind: "choice", id: "preset-selection", choice: "native-macos-swiftui-desktop", confidence: 0.88 },
      ],
    }))
    expect(calls).toHaveLength(1)
    expect(calls[0]?.command).toBe("jev_decide")
    const commandRequest = calls[0]?.args?.request as Record<string, unknown>
    expect(commandRequest).toEqual({
      requestId: jevRequest.requestId,
      apiKey: jevRequest.apiKey,
      state: jevRequest.state,
      questions: {
        viability: { type: "noul", instructions: jevRequest.nouls[0]?.question },
        "preset-selection": {
          type: "choice",
          instructions: jevRequest.nouls[1]?.question,
          criteria: Object.fromEntries(jevRequest.nouls[1]?.kind === "choice"
            ? jevRequest.nouls[1].options.map(option => [option, null])
            : []),
        },
      },
    })
    expect(commandRequest).not.toHaveProperty("nouls")
  })

  it("cancels only the active request identifier", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const invoke: CommandInvoker = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args })
      return true as T
    }

    await expect(cancelProviderRequest("request-bridge", invoke)).resolves.toBe(true)
    expect(calls).toEqual([{ command: "cancel_generation", args: { requestId: "request-bridge" } }])
  })

  it("revalidates packet bytes before exact-five export", async () => {
    const packet = await compilePacket(fileOrganizerBlueprint, "native-macos-swiftui-desktop")
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const invoke: CommandInvoker = async <T>(command: string, args?: Record<string, unknown>) => {
      calls.push({ command, args })
      return "/tmp/harbor-sort" as T
    }

    await expect(exportPacketTo("/tmp", packet, invoke)).resolves.toBe("/tmp/harbor-sort")
    expect(calls).toEqual([{ command: "export_packet", args: {
      parent: "/tmp",
      slug: packet.projectSlug,
      files: packetForExport(packet),
    } }])

    const changed = {
      ...packet,
      documents: { ...packet.documents, "PRD.md": `${packet.documents["PRD.md"]}\nchanged` },
    }
    await expect(exportPacketTo("/tmp", changed, invoke)).rejects.toEqual({
      kind: "invalid-packet",
      classification: "preview-hash-mismatch",
    })
    expect(calls).toHaveLength(1)
  })
})
