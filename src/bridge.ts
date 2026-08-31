import { invoke } from "@tauri-apps/api/core"
import { packetForExport, verifyPacketHashes, type CompiledPacket } from "./compiler"
import type { ProviderRequest } from "./pipeline"

export type CommandInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>

const tauriInvoker: CommandInvoker = (command, args) => invoke(command, args)

export function invokeBlueprintProvider(
  request: ProviderRequest,
  invokeCommand: CommandInvoker = tauriInvoker,
): Promise<string> {
  return invokeCommand<string>("deepseek_complete", { request })
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
