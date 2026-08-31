import { z } from "zod"

const shortMeaning = z.string().trim().min(1).max(120)
const compactMeaning = z.string().trim().min(1).max(480)
const meaning = z.string().trim().min(4).max(1_200)
const meaningList = z.array(compactMeaning).max(8)
const requiredMeaningList = meaningList.min(1)

const FeatureSchema = z.strictObject({
  name: shortMeaning,
  userOutcome: compactMeaning,
  trigger: compactMeaning,
  behavior: meaning,
  failureOutcome: compactMeaning,
  acceptanceSignals: requiredMeaningList,
})

const DataObjectSchema = z.strictObject({
  name: shortMeaning,
  purpose: compactMeaning,
  sensitivity: z.enum(["public", "internal", "personal", "sensitive"]),
  retentionIntent: compactMeaning,
})

const ExternalServiceSchema = z.strictObject({
  name: shortMeaning,
  purpose: compactMeaning,
  dataSent: meaningList,
  credentialRequired: z.boolean(),
})

export const PlatformNeedSchema = z.enum([
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
])

export const SemanticBlueprintSchema = z.strictObject({
  productName: z.string().trim().min(1).max(80),
  summary: meaning,
  targetUsers: requiredMeaningList,
  goals: requiredMeaningList,
  nonGoals: meaningList,
  features: z.array(FeatureSchema).min(1).max(12),
  dataObjects: z.array(DataObjectSchema).max(8),
  externalServices: z.array(ExternalServiceSchema).max(8),
  platformNeeds: z.array(PlatformNeedSchema),
  qualityRequirements: meaningList,
  productConstraints: meaningList,
})

export type SemanticBlueprint = z.infer<typeof SemanticBlueprintSchema>
export type PlatformNeed = z.infer<typeof PlatformNeedSchema>

export const SUPPORTED_IMPORTED_AUDIO_FORMATS = ["wav", "mp3", "flac", "m4a", "ogg", "webm", "aac"] as const

export const TranscriptionRoutingSchema = z.strictObject({
  liveFeatureNames: z.array(shortMeaning).min(1),
  importedFeatureNames: z.array(shortMeaning).min(1),
  liveProviderName: shortMeaning,
  importedProviderName: shortMeaning,
  supportedImportedFormats: z.tuple(SUPPORTED_IMPORTED_AUDIO_FORMATS.map(format => z.literal(format)) as [z.ZodLiteral<"wav">, z.ZodLiteral<"mp3">, z.ZodLiteral<"flac">, z.ZodLiteral<"m4a">, z.ZodLiteral<"ogg">, z.ZodLiteral<"webm">, z.ZodLiteral<"aac">]),
  maxImportedDurationSeconds: z.literal(60),
  maxImportedPayloadBytes: z.literal(25_000_000),
  overLimitBehavior: z.literal("reject-before-paid-upload"),
  audioRewriteBehavior: z.literal("forbidden"),
})

export type TranscriptionRouting = z.infer<typeof TranscriptionRoutingSchema>

interface ClosedJsonSchema {
  readonly type?: string
  readonly properties?: Readonly<Record<string, unknown>>
  readonly required?: readonly string[]
  readonly additionalProperties?: boolean
  readonly [key: string]: unknown
}

export const providerJsonSchema = z.toJSONSchema(SemanticBlueprintSchema, {
  target: "draft-7",
}) as ClosedJsonSchema

export interface SemanticIssue {
  readonly path: string
  readonly rule: string
  readonly message: string
}

export type BlueprintParseResult =
  | { readonly ok: true; readonly blueprint: SemanticBlueprint }
  | {
      readonly ok: false
      readonly failure:
        | { readonly kind: "invalid-json"; readonly issues: readonly SemanticIssue[] }
        | { readonly kind: "schema-invalid"; readonly issues: readonly SemanticIssue[] }
    }

export interface BlueprintInstructionInput {
  readonly idea: string
}

function issuePath(path: PropertyKey[]): string {
  const result = path.reduce<string>((current, part) => typeof part === "number"
    ? `${current}[${part}]`
    : current ? `${current}.${String(part)}` : String(part), "")
  return result || "$"
}

function sliceBalancedJsonObject(text: string, start: number): string {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === "\"") inString = false
      continue
    }
    if (char === "\"") {
      inString = true
      continue
    }
    if (char === "{") depth += 1
    else if (char === "}") {
      depth -= 1
      if (depth === 0) return text.slice(start, index + 1)
    }
  }
  return text.slice(start)
}

export function extractProviderJsonText(text: string): string {
  let candidate = text.replace(/^\uFEFF/, "").trim()
  if (!candidate) return candidate

  const fullFence = candidate.match(/^```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i)
  if (fullFence?.[1]) candidate = fullFence[1].trim()

  if (!candidate.startsWith("{")) {
    const inlineFence = candidate.match(/```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```/i)
    if (inlineFence?.[1]) candidate = inlineFence[1].trim()
  }

  if (!candidate.startsWith("{")) {
    const start = candidate.indexOf("{")
    if (start >= 0) candidate = sliceBalancedJsonObject(candidate, start)
  }

  return candidate.trim()
}

function invalidJsonIssue(text: string): SemanticIssue {
  const trimmed = text.trim()
  const looksTruncated = trimmed.startsWith("{") && !trimmed.endsWith("}")
  return {
    path: "$",
    rule: "provider.invalid-json",
    message: looksTruncated
      ? "The completed provider response looks truncated before it became valid JSON."
      : "The completed provider response is not valid JSON.",
  }
}

function parseJsonValue(text: string): unknown {
  const candidates = [text]
  const extracted = extractProviderJsonText(text)
  if (extracted && extracted !== text) candidates.push(extracted)

  for (const candidate of candidates) {
    if (!candidate.trim()) continue
    try {
      let value: unknown = JSON.parse(candidate)
      if (typeof value === "string") {
        const inner = extractProviderJsonText(value)
        value = JSON.parse(inner)
      }
      return value
    } catch {
      continue
    }
  }

  throw new Error("invalid-json")
}

export function parseBlueprintJson(text: string): BlueprintParseResult {
  let value: unknown
  try {
    value = parseJsonValue(text)
  } catch {
    return {
      ok: false,
      failure: {
        kind: "invalid-json",
        issues: [invalidJsonIssue(text)],
      },
    }
  }

  const parsed = SemanticBlueprintSchema.safeParse(value)
  if (parsed.success) return { ok: true, blueprint: parsed.data }

  return {
    ok: false,
    failure: {
      kind: "schema-invalid",
      issues: parsed.error.issues.map(issue => ({
        path: issuePath(issue.path),
        rule: `schema.${issue.code}`,
        message: "The completed provider response does not match the compact semantic schema.",
      })),
    },
  }
}

function semanticStrings(value: unknown, path = ""): Array<{ path: string; value: string }> {
  if (typeof value === "string") return [{ path: path || "$", value }]
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => semanticStrings(item, `${path}[${index}]`))
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => semanticStrings(item, path ? `${path}.${key}` : key))
  }
  return []
}

const unusableMeaning = /^\s*(?:tbd|todo|n\/?a|unknown|\?+|placeholder(?: text)?)\s*[.!]?\s*$/i
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9._~-]{16,}/i,
]

export function auditSemanticIntake(blueprint: SemanticBlueprint): SemanticIssue[] {
  const issues: SemanticIssue[] = []
  if (unusableMeaning.test(blueprint.productName)) {
    issues.push({ path: "productName", rule: "semantic.unusable-product", message: "The product name does not contain usable product meaning." })
  }
  if (unusableMeaning.test(blueprint.summary)) {
    issues.push({ path: "summary", rule: "semantic.unusable-summary", message: "The product summary does not contain usable product meaning." })
  }
  if (!blueprint.features.some(feature => semanticStrings(feature).some(field => !unusableMeaning.test(field.value)))) {
    issues.push({ path: "features", rule: "semantic.no-meaningful-features", message: "At least one feature must contain usable product behavior." })
  }

  for (const field of semanticStrings(blueprint)) {
    if (secretPatterns.some(pattern => pattern.test(field.value))) {
      issues.push({ path: field.path, rule: "semantic.secret-material", message: "Secret material is not accepted in provider content." })
    }
  }
  return issues
}

export function buildBlueprintInstructions(input: BlueprintInstructionInput): string {
  return [
    "Return exactly one complete JSON value conforming to the strict semantic_blueprint json_schema supplied in the request text.format.",
    "Provide product meaning only: users, outcomes, triggers, behavior, failure outcomes, acceptance signals, data meaning, service meaning, platform needs, quality, and constraints.",
    "Do not provide IDs, file paths, test paths, commands, framework APIs, package names, module ownership, architecture layers, task phases, credential storage mechanics, build instructions, signing instructions, Markdown, or final documents.",
    "Do not choose or recommend a technology stack. The selected local preset is authoritative.",
    "Use no more than twelve features and no more than eight values in each prose list. Include every applicable platform need from the closed enum.",
    `Software idea: ${input.idea.trim()}`,
  ].join("\n\n")
}
