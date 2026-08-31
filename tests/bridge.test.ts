import { describe, expect, it } from "vitest"
import { cancelProviderRequest, exportPacketTo, invokeBlueprintProvider, type CommandInvoker } from "../src/bridge"
import { compilePacket, packetForExport } from "../src/compiler"
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
