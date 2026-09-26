import {
  compileNormalizedPacket,
  GraphConstructionError,
  normalizeBlueprint,
  NormalizationError,
  type CompiledPacket,
  type LocalCompileStage,
  type NormalizedBlueprint,
} from "./compiler"
import {
  jevFailureIssue,
  jevForeignStackIssue,
  jevIntakeRejectedIssue,
  jevUnverifiableAcceptanceIssue,
  runJevPostflight,
  runJevPreflight,
  type JevAtomicAuditDecision,
  type JevPresetMismatch,
  type JevProvider,
  type JevReport,
} from "./jev"
import type { PresetId } from "./presets"
import {
  auditIdeaCoverage,
  auditSemanticIntake,
  buildBlueprintInstructions,
  MAX_IDEA_SENTENCES,
  parseBlueprintJson,
  providerJsonSchema,
  redactSecretMaterial,
  splitIdeaSentences,
  type SemanticBlueprint,
  type SemanticIssue,
} from "./schema"

export const DEFAULT_API_URL = "https://api.deepseek.com/responses"
export const MAX_BLUEPRINT_OUTPUT_TOKENS = 16_384
export const MAX_IDEA_CHARS = 32_000
export const PROVIDER_MODELS = [
  { id: "deepseek-flash", label: "DeepSeek Flash — Fastest and cheapest (V4.1)" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro — Best quality" },
] as const
// The legacy "deepseek-v4-flash" transport alias stays accepted (state validation, the smoke
// fixture path, and the Rust provider all accept it) without joining the selectable list.
export type ProviderModel = (typeof PROVIDER_MODELS)[number]["id"] | "deepseek-v4-flash"
export type ProgressStage = "jev-preflight" | "provider" | "provider-repair" | "blueprint-validation" | "jev-integrity" | "local-normalization" | LocalCompileStage
export type ProviderFailureKind = "transport" | "timeout" | "http" | "incomplete" | "failed-response" | "invalid-wrapper" | "invalid-json" | "invalid-request" | "cancelled" | "unknown"

export interface ProviderFailure {
  readonly kind: ProviderFailureKind
  readonly classification: string
  readonly httpStatus?: number
  readonly providerCode?: string
  readonly incompleteReason?: string
  readonly wrapperOutputTypes?: readonly string[]
}

export interface ProviderRequest {
  readonly requestId: string
  readonly apiUrl: string
  readonly apiKey: string
  readonly model: ProviderModel
  readonly maxOutputTokens: number
  readonly reasoningEffort: "none"
  readonly schema: typeof providerJsonSchema
  readonly instructions: string
  readonly input: string
}

export type BlueprintProvider = (request: ProviderRequest) => Promise<string>
export type PacketCompiler = (
  blueprint: NormalizedBlueprint,
  presetId: PresetId,
  onProgress?: (stage: LocalCompileStage) => void,
) => Promise<CompiledPacket>

export interface GeneratePacketInput {
  readonly requestId: string
  readonly idea: string
  readonly presetId: PresetId
  readonly model: ProviderModel
  readonly apiUrl: string
  readonly apiKey: string
  readonly jevApiKey?: string
  readonly atomicAuditor?: boolean
  readonly signal?: AbortSignal
  readonly onProgress?: (stage: ProgressStage) => void
}

export type PipelineStatus = "gate-clean" | "provider-failure" | "blueprint-validation-failed" | "local-normalization-failed" | "local-compiler-failure" | "lint-failure" | "cancelled" | "intake-rejected" | "blueprint-integrity-failed" | "jev-failure"

export interface GeneratePacketResult {
  readonly status: PipelineStatus
  readonly exportable: boolean
  readonly packet?: CompiledPacket
  readonly failure?: ProviderFailure
  readonly issues: readonly SemanticIssue[]
  readonly jev?: JevReport
  // Present when the first provider response failed and one repair request was sent: the checks it failed.
  readonly repairedIssues?: readonly SemanticIssue[]
  // The validated provider blueprint that compiled (after any repair, before Jev healing), for export.
  readonly blueprint?: SemanticBlueprint
}

const failureKinds = new Set<ProviderFailureKind>(["transport", "timeout", "http", "incomplete", "failed-response", "invalid-wrapper", "invalid-json", "invalid-request", "cancelled", "unknown"])
const classifications = new Set([
  "connect",
  "dns",
  "tls",
  "request-failed",
  "request-timeout",
  "http-error",
  "incomplete-response",
  "provider-failed",
  "invalid-provider-wrapper",
  "invalid-request",
  "invalid-json",
  "cancelled",
  "provider-failure",
])
const providerCodes = new Set([
  "invalid_request_error",
  "authentication_error",
  "permission_denied",
  "not_found_error",
  "rate_limit_exceeded",
  "insufficient_balance",
  "server_error",
  "server_overloaded",
  "content_filter",
  "model_not_found",
])
const incompleteReasons = new Set(["max_output_tokens", "content_filter"])
const allowlistedWrapperOutputTypes = new Set([
  "message",
  "reasoning",
  "function_call",
  "function_call_output",
  "web_search_call",
  "file_search_call",
])
const PROVIDER_SETTINGS = {
  maxOutputTokens: MAX_BLUEPRINT_OUTPUT_TOKENS,
  reasoningEffort: "none",
  schema: providerJsonSchema,
} as const

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined
}

function defaultClassification(kind: ProviderFailureKind): string {
  switch (kind) {
    case "transport": return "request-failed"
    case "timeout": return "request-timeout"
    case "http": return "http-error"
    case "incomplete": return "incomplete-response"
    case "failed-response": return "provider-failed"
    case "invalid-wrapper": return "invalid-provider-wrapper"
    case "invalid-json": return "invalid-json"
    case "invalid-request": return "invalid-request"
    case "cancelled": return "cancelled"
    case "unknown": return "provider-failure"
  }
}

export function normalizeProviderFailure(value: unknown): ProviderFailure {
  const source = record(value)
  const candidateKind = typeof source?.kind === "string" ? source.kind as ProviderFailureKind : "unknown"
  const kind = failureKinds.has(candidateKind) ? candidateKind : "unknown"
  const candidateClassification = typeof source?.classification === "string" ? source.classification : ""
  const classification = classifications.has(candidateClassification) ? candidateClassification : defaultClassification(kind)
  const safe: {
    kind: ProviderFailureKind
    classification: string
    httpStatus?: number
    providerCode?: string
    incompleteReason?: string
    wrapperOutputTypes?: readonly string[]
  } = { kind, classification }

  if (kind === "http" && Number.isInteger(source?.httpStatus) && Number(source!.httpStatus) >= 100 && Number(source!.httpStatus) <= 599) {
    safe.httpStatus = Number(source!.httpStatus)
  }
  if ((kind === "http" || kind === "failed-response") && typeof source?.providerCode === "string" && providerCodes.has(source.providerCode)) {
    safe.providerCode = source.providerCode
  }
  if (kind === "incomplete" && typeof source?.incompleteReason === "string" && incompleteReasons.has(source.incompleteReason)) {
    safe.incompleteReason = source.incompleteReason
  }
  if (kind === "invalid-wrapper" && Array.isArray(source?.wrapperOutputTypes)) {
    const wrapperOutputTypes = source.wrapperOutputTypes.filter((item): item is string => typeof item === "string" && allowlistedWrapperOutputTypes.has(item))
    if (wrapperOutputTypes.length) safe.wrapperOutputTypes = wrapperOutputTypes
  }
  return safe
}

export function isSafeProviderUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && url.pathname.replace(/\/+$/, "") === "/responses"
  } catch {
    return false
  }
}

interface RepairContext {
  readonly previousText: string
  readonly issues: readonly SemanticIssue[]
}

export const BLUEPRINT_INPUT = "Return the compact semantic JSON value for the supplied software idea."

export function buildRepairInput(repair: RepairContext): string {
  return [
    "Your previous response failed the deterministic checks listed below. Return one complete corrected JSON value for the same software idea. Fix every listed issue, keep every part that no issue names unchanged, and follow every rule in the instructions.",
    `Failed checks:\n${repair.issues.map(issue => `- ${issue.path} (${issue.rule}): ${issue.message}`).join("\n")}`,
    `Previous response:\n${redactSecretMaterial(repair.previousText)}`,
  ].join("\n\n")
}

function providerRequest(input: GeneratePacketInput, repair?: RepairContext): ProviderRequest {
  return {
    requestId: input.requestId,
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    model: input.model,
    ...PROVIDER_SETTINGS,
    instructions: buildBlueprintInstructions({ idea: input.idea }),
    input: repair ? buildRepairInput(repair) : BLUEPRINT_INPUT,
  }
}

function cancelled(input: GeneratePacketInput): boolean {
  return input.signal?.aborted === true
}

function providerIssue(failure: ProviderFailure): SemanticIssue {
  const messages: Readonly<Record<ProviderFailureKind, string>> = {
    transport: "The provider request could not establish a safe connection.",
    timeout: "The provider request did not complete before the model-aware timeout.",
    http: "The provider rejected the request with a safe HTTP failure classification.",
    incomplete: "The provider stopped before completing the structured response.",
    "failed-response": "The provider returned a failed completion wrapper.",
    "invalid-wrapper": "The provider completion wrapper was not safely usable.",
    "invalid-json": "The completed provider response is not valid JSON.",
    "invalid-request": "The provider request was rejected before it reached the network.",
    cancelled: "The provider request was cancelled before compilation.",
    unknown: "The provider request failed with an unknown safe classification.",
  }
  return { path: "$provider", rule: `provider.${failure.classification}`, message: messages[failure.kind] }
}

function failureResult(
  status: Exclude<PipelineStatus, "gate-clean">,
  issues: readonly SemanticIssue[],
  failure?: ProviderFailure,
  jev?: JevReport,
): GeneratePacketResult {
  return { status, exportable: false, issues, ...(failure ? { failure } : {}), ...(jev ? { jev } : {}) }
}

export async function generatePacket(
  input: GeneratePacketInput,
  provider: BlueprintProvider,
  compiler: PacketCompiler = compileNormalizedPacket,
  jevProvider?: JevProvider,
): Promise<GeneratePacketResult> {
  if (cancelled(input)) {
    const failure = { kind: "cancelled", classification: "cancelled" } as const
    return failureResult("cancelled", [providerIssue(failure)], failure)
  }
  if (input.idea.length > MAX_IDEA_CHARS) {
    const failure = { kind: "invalid-request", classification: "invalid-request" } as const
    return failureResult("provider-failure", [{ path: "$idea", rule: "provider.idea-too-long", message: "The software idea exceeds the 32,000 character request limit." }], failure)
  }
  if (splitIdeaSentences(input.idea).length > MAX_IDEA_SENTENCES) {
    const failure = { kind: "invalid-request", classification: "invalid-request" } as const
    return failureResult("provider-failure", [{ path: "$idea", rule: "provider.idea-too-many-sentences", message: `The software idea has more than ${MAX_IDEA_SENTENCES} sentences; shorten or merge sentences.` }], failure)
  }
  if (!isSafeProviderUrl(input.apiUrl)) {
    const failure = { kind: "invalid-request", classification: "invalid-request" } as const
    return failureResult("provider-failure", [{ path: "$provider.url", rule: "provider.invalid-url", message: "The provider URL must be an HTTPS Responses endpoint without embedded data." }], failure)
  }

  let presetMismatch: JevPresetMismatch | undefined
  if (jevProvider) {
    input.onProgress?.("jev-preflight")
    if (cancelled(input)) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }
    const preflight = await runJevPreflight({
      requestId: input.requestId,
      apiKey: input.jevApiKey ?? "",
      idea: input.idea,
      presetId: input.presetId,
    }, jevProvider)
    if (cancelled(input)) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }
    if (!preflight.ok) return failureResult("jev-failure", [jevFailureIssue(preflight.failure)])
    if (!preflight.decision.viable) return failureResult("intake-rejected", [jevIntakeRejectedIssue()])
    presetMismatch = preflight.decision.presetMismatch
  }

  let repair: RepairContext | undefined
  let repairedIssues: readonly SemanticIssue[] | undefined
  for (let attempt = 0; attempt < 2; attempt += 1) {
    input.onProgress?.(repair ? "provider-repair" : "provider")
    let providerText: string
    try {
      providerText = await provider(providerRequest(input, repair))
    } catch (error) {
      const failure = cancelled(input)
        ? { kind: "cancelled", classification: "cancelled" } as const
        : normalizeProviderFailure(error)
      return withRepair(failureResult(failure.kind === "cancelled" ? "cancelled" : "provider-failure", [providerIssue(failure)], failure), repairedIssues)
    }
    if (cancelled(input)) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }

    const result = await compileProviderText(providerText, input, compiler, jevProvider, presetMismatch)
    if (result.status === "gate-clean" || !REPAIRABLE_STATUSES.has(result.status) || repair) {
      return withRepair(result, repairedIssues)
    }
    // One bounded repair: the provider sees exactly which deterministic checks its response failed.
    repair = { previousText: providerText, issues: result.issues }
    repairedIssues = result.issues
  }
  throw new Error("unreachable: the repair loop always returns")
}

// Statuses caused by the provider's content, which a single targeted repair request can fix.
// Transport, cancellation, Jev service, and local compiler failures are never sent back.
const REPAIRABLE_STATUSES = new Set<PipelineStatus>(["blueprint-validation-failed", "blueprint-integrity-failed", "local-normalization-failed", "lint-failure"])

function withRepair(result: GeneratePacketResult, repairedIssues: readonly SemanticIssue[] | undefined): GeneratePacketResult {
  return repairedIssues ? { ...result, repairedIssues } : result
}

async function compileProviderText(
  providerText: string,
  input: GeneratePacketInput,
  compiler: PacketCompiler,
  jevProvider: JevProvider | undefined,
  presetMismatch: JevPresetMismatch | undefined,
): Promise<GeneratePacketResult> {
  input.onProgress?.("blueprint-validation")
  const parsed = parseBlueprintJson(providerText)
  if (!parsed.ok) {
    const failure = parsed.failure.kind === "invalid-json"
      ? { kind: "invalid-json", classification: "invalid-json" } as const
      : undefined
    return failureResult("blueprint-validation-failed", parsed.failure.issues, failure)
  }
  const intakeIssues = [...auditSemanticIntake(parsed.blueprint), ...auditIdeaCoverage(parsed.blueprint, input.idea)]
  if (intakeIssues.length) return failureResult("blueprint-validation-failed", intakeIssues)

  let blueprint = parsed.blueprint
  let jevReport: JevReport | undefined
  let atomicAudits: JevAtomicAuditDecision | undefined
  if (jevProvider) {
    input.onProgress?.("jev-integrity")
    if (cancelled(input)) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }
    const postflight = await runJevPostflight({
      requestId: input.requestId,
      apiKey: input.jevApiKey ?? "",
      presetId: input.presetId,
      blueprint,
      atomicAuditor: input.atomicAuditor,
      idea: input.idea,
    }, jevProvider)
    if (cancelled(input)) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }
    if (!postflight.ok) return failureResult("jev-failure", [jevFailureIssue(postflight.failure)])
    if (postflight.decision.foreignStackLeakage) return failureResult("blueprint-integrity-failed", [jevForeignStackIssue()])
    if (postflight.decision.atomicAudits) {
      if (postflight.decision.atomicAudits.featureIssues.length > 0) {
        return failureResult("blueprint-integrity-failed", postflight.decision.atomicAudits.featureIssues)
      }
    } else if (postflight.decision.unverifiableAcceptance) {
      return failureResult("blueprint-integrity-failed", [jevUnverifiableAcceptanceIssue()])
    }
    blueprint = postflight.decision.blueprint
    atomicAudits = postflight.decision.atomicAudits
    jevReport = {
      ...(presetMismatch ? { presetMismatch } : {}),
      addedPlatformNeeds: postflight.decision.addedPlatformNeeds,
      ...(atomicAudits ? { atomicAudits } : {}),
    }
  }

  input.onProgress?.("local-normalization")
  let normalized: NormalizedBlueprint
  try {
    normalized = normalizeBlueprint(blueprint, input.presetId, atomicAudits)
  } catch (error) {
    const issues = error instanceof NormalizationError
      ? error.issues
      : [{ path: "$normalization", rule: "normalization.failure", message: "Local normalization could not produce a safe semantic model." }]
    return failureResult("local-normalization-failed", issues, undefined, jevReport)
  }
  if (cancelled(input)) {
    const failure = { kind: "cancelled", classification: "cancelled" } as const
    return failureResult("cancelled", [providerIssue(failure)], failure)
  }

  let packet: CompiledPacket
  try {
    packet = await compiler(normalized, input.presetId, stage => {
      if (cancelled(input)) throw new Error("generation-cancelled")
      input.onProgress?.(stage)
    })
  } catch (error) {
    if (cancelled(input) || (error instanceof Error && error.message === "generation-cancelled")) {
      const failure = { kind: "cancelled", classification: "cancelled" } as const
      return failureResult("cancelled", [providerIssue(failure)], failure)
    }
    const issues = error instanceof GraphConstructionError
      ? [error.failure]
      : [{ path: "$compiler", rule: "compiler.failure", message: "The deterministic local compiler could not produce a packet." }]
    return failureResult("local-compiler-failure", issues, undefined, jevReport)
  }
  if (cancelled(input)) {
    const failure = { kind: "cancelled", classification: "cancelled" } as const
    return failureResult("cancelled", [providerIssue(failure)], failure)
  }
  if (!packet.exportable) {
    const issues = packet.failures?.map(item => ({ path: item.path, rule: item.rule, message: item.message }))
      ?? [{ path: "$packet", rule: "packet.gate-failure", message: "The rendered packet did not pass the local readiness gate." }]
    return failureResult("lint-failure", issues, undefined, jevReport)
  }
  return { status: "gate-clean", exportable: true, issues: [], packet, blueprint: parsed.blueprint, ...(jevReport ? { jev: jevReport } : {}) }
}
