import { invoke } from "@tauri-apps/api/core"
import { packetForExport, verifyPacketHashes, type CompiledPacket } from "./compiler"
import type { JevRequest } from "./jev"
import type { ProviderRequest } from "./pipeline"

export type CommandInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

const tauriInvoker: CommandInvoker = (command, args) => invoke(command, args)

export function invokeBlueprintProvider(
  request: ProviderRequest,
  invokeCommand: CommandInvoker = tauriInvoker,
): Promise<string> {
  return invokeCommand<string>("deepseek_complete", { request })
}

interface JevWireResponse {
  readonly model: string
  readonly answers: Readonly<Record<string, unknown>>
}

function jevQuestions(request: JevRequest): Readonly<Record<string, unknown>> {
  return Object.fromEntries(request.nouls.map(noul => [
    noul.id,
    noul.kind === "boolean"
      ? { type: "noul", instructions: noul.question }
      : {
          type: "choice",
          instructions: noul.question,
          criteria: Object.fromEntries(noul.options.map(option => [option, noul.descriptions?.[option] ?? null])),
        },
  ]))
}

function jevOutcomes(request: JevRequest, response: JevWireResponse): string {
  const answers = response && typeof response === "object" && response.answers && typeof response.answers === "object"
    ? response.answers
    : {}
  const outcomes: Array<Record<string, unknown>> = []
  for (const noul of request.nouls) {
    const answer = answers[noul.id]
    if (!answer || typeof answer !== "object") continue
    const record = answer as Record<string, unknown>
    if (noul.kind === "boolean" && record.type === "noul") {
      outcomes.push({ kind: "boolean", id: noul.id, pTrue: record.noul })
      continue
    }
    if (noul.kind === "choice" && record.type === "choice") {
      outcomes.push({
        kind: "choice",
        id: noul.id,
        choice: record.choice,
        confidence: record.confidence,
        ...(noul.keepProbabilities && record.probabilities && typeof record.probabilities === "object" ? { probabilities: record.probabilities } : {}),
      })
    }
  }
  return JSON.stringify({ outcomes })
}

export async function invokeJevDecision(
  request: JevRequest,
  invokeCommand: CommandInvoker = tauriInvoker,
): Promise<string> {
  const response = await invokeCommand<JevWireResponse>("jev_decide", {
    request: {
      requestId: request.requestId,
      apiKey: request.apiKey,
      state: request.state,
      questions: jevQuestions(request),
    },
  })
  return jevOutcomes(request, response)
}

export function cancelProviderRequest(
  requestId: string,
  invokeCommand: CommandInvoker = tauriInvoker,
): Promise<boolean> {
  return invokeCommand<boolean>("cancel_generation", { requestId })
}

export async function exportPacketTo(
  parent: string,
  packet: CompiledPacket,
  invokeCommand: CommandInvoker = tauriInvoker,
): Promise<string> {
  if (!packet.exportable || !(await verifyPacketHashes(packet))) {
    throw { kind: "invalid-packet", classification: "preview-hash-mismatch" }
  }
  return invokeCommand<string>("export_packet", {
    parent,
    slug: packet.projectSlug,
    files: packetForExport(packet),
  })
}
