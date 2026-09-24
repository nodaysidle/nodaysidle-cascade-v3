import { z } from "zod"

const shortMeaning = z.string().trim().min(1).max(120)
const compactMeaning = z.string().trim().min(1).max(480)
const meaning = z.string().trim().min(4).max(1_200)
const meaningList = z.array(compactMeaning).max(8)
const requiredMeaningList = meaningList.min(1)

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

export const FeatureRecoverySchema = z.enum(["retry", "fallback", "exit"])
export const FeatureSurfaceSchema = z.enum(["main", "item-page", "about-page", "not-found-page"])

const FeatureSchema = z.strictObject({
  name: shortMeaning,
  userOutcome: compactMeaning,
  trigger: compactMeaning,
  behavior: meaning,
  failureOutcome: compactMeaning,
  failureRecovery: FeatureRecoverySchema,
  surface: FeatureSurfaceSchema,
  acceptanceSignals: requiredMeaningList,
  usesPlatformNeeds: z.array(PlatformNeedSchema).max(12),
  usesData: z.array(shortMeaning).max(8),
  usesServices: z.array(shortMeaning).max(8),
})

export const DataStorageSchema = z.enum(["settings", "records", "document", "secret", "temporary", "session"])
export const DataWriteModeSchema = z.enum(["direct", "atomic-replace"])

const DataObjectSchema = z.strictObject({
  name: shortMeaning,
  purpose: compactMeaning,
  sensitivity: z.enum(["public", "internal", "personal", "sensitive"]),
  retentionIntent: compactMeaning,
  storage: DataStorageSchema,
  writeMode: DataWriteModeSchema,
})

const ExternalServiceSchema = z.strictObject({
  name: shortMeaning,
  purpose: compactMeaning,
  dataSent: meaningList,
  credentialRequired: z.boolean(),
})

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
export type DataStorage = z.infer<typeof DataStorageSchema>
export type DataWriteMode = z.infer<typeof DataWriteModeSchema>
export type FeatureRecovery = z.infer<typeof FeatureRecoverySchema>
export type FeatureSurface = z.infer<typeof FeatureSurfaceSchema>

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

export function referenceKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/[.]+$/, "").toLocaleLowerCase("en-US")
}

// A temporary atomic-replace data object is the in-progress copy of atomic saves, so it belongs to
// every feature that uses a stored atomic-replace data object. Declared fields decide this, never wording.
export function featureDataUses(blueprint: SemanticBlueprint, feature: SemanticBlueprint["features"][number]): string[] {
  const byKey = new Map(blueprint.dataObjects.map(item => [referenceKey(item.name), item]))
  const writesAtomicData = feature.usesData.some(name => {
    const item = byKey.get(referenceKey(name))
    return item?.writeMode === "atomic-replace" && item.storage !== "temporary"
  })
  if (!writesAtomicData) return [...feature.usesData]
  const scratch = blueprint.dataObjects.filter(item => item.storage === "temporary" && item.writeMode === "atomic-replace").map(item => item.name)
  const listed = new Set(feature.usesData.map(referenceKey))
  return [...feature.usesData, ...scratch.filter(name => !listed.has(referenceKey(name)))]
}

export function featureReferenceIssues(blueprint: SemanticBlueprint): SemanticIssue[] {
  const issues: SemanticIssue[] = []
  const dataKeys = new Set(blueprint.dataObjects.map(item => referenceKey(item.name)))
  const serviceKeys = new Set(blueprint.externalServices.map(item => referenceKey(item.name)))
  const usedData = new Set<string>()
  const usedServices = new Set<string>()
  blueprint.features.forEach((feature, featureIndex) => {
    feature.usesData.forEach((name, index) => {
      if (dataKeys.has(referenceKey(name))) usedData.add(referenceKey(name))
      else issues.push({ path: `features[${featureIndex}].usesData[${index}]`, rule: "semantic.unknown-data-reference", message: `Feature '${feature.name}' references data '${name}', which is not a declared dataObject.` })
    })
    feature.usesServices.forEach((name, index) => {
      if (serviceKeys.has(referenceKey(name))) usedServices.add(referenceKey(name))
      else issues.push({ path: `features[${featureIndex}].usesServices[${index}]`, rule: "semantic.unknown-service-reference", message: `Feature '${feature.name}' references service '${name}', which is not a declared externalService.` })
    })
  })
  blueprint.features.forEach(feature => featureDataUses(blueprint, feature).forEach(name => usedData.add(referenceKey(name))))
  blueprint.dataObjects.forEach((item, index) => {
    if (!usedData.has(referenceKey(item.name))) issues.push({ path: `dataObjects[${index}]`, rule: "semantic.unused-data-object", message: `No feature lists '${item.name}' in usesData, so no feature owns it.` })
  })
  blueprint.externalServices.forEach((item, index) => {
    if (!usedServices.has(referenceKey(item.name))) issues.push({ path: `externalServices[${index}]`, rule: "semantic.unused-external-service", message: `No feature lists '${item.name}' in usesServices, so no feature calls it.` })
  })
  return issues
}

// Declared enums and references are not product meaning, so only prose decides whether a feature is usable.
function featureProse(feature: SemanticBlueprint["features"][number]): string[] {
  return [feature.name, feature.userOutcome, feature.trigger, feature.behavior, feature.failureOutcome, ...feature.acceptanceSignals]
}

export function auditSemanticIntake(blueprint: SemanticBlueprint): SemanticIssue[] {
  const issues: SemanticIssue[] = [...featureReferenceIssues(blueprint)]
  if (unusableMeaning.test(blueprint.productName)) {
    issues.push({ path: "productName", rule: "semantic.unusable-product", message: "The product name does not contain usable product meaning." })
  }
  if (unusableMeaning.test(blueprint.summary)) {
    issues.push({ path: "summary", rule: "semantic.unusable-summary", message: "The product summary does not contain usable product meaning." })
  }
  if (!blueprint.features.some(feature => featureProse(feature).some(value => !unusableMeaning.test(value)))) {
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
    "Define features strictly as functional capabilities and system interactions (e.g. text editing, file persistence, search, settings). Do not create features for pure visual themes, branding, or aesthetic styling; place visual styling requirements under qualityRequirements or productConstraints.",
    "Every feature acceptance signal must describe a concrete, mechanically verifiable condition (such as state transitions, UI element visibility, disk persistence, error code handling, or measured response under an explicit numerical threshold) that automated unit or integration tests can assert without human subjective impression. Never use subjective or hyperbolic phrases such as 'feels smooth', 'zero latency', 'instantaneous', or 'aesthetic appeal'.",
    "For features that depend on the operating system or device (notifications, reminders, tray or menu bar presence, background operation, permissions, hardware access, launch at login), write acceptance signals as the request the app makes or the app state a test can read, never as what the user sees or notices. For example: 'a notification request with the item's title is scheduled at the configured time', 'after the main window closes the process keeps running and the tray menu lists its actions', or 'when microphone permission is denied the record control is disabled and the denial message is shown'.",
    "When a behavior, failure outcome, or acceptance signal depends on a default, interval, or limit, state its concrete value (for example a font family and point size, or a duration in milliseconds). Never write 'documented defaults' or an interval without its value.",
    "Use no more than twelve features and no more than eight values in each prose list. Include every applicable platform need from the closed enum.",
    "For every feature, list in usesPlatformNeeds each platform need that feature itself exercises, in usesData the exact names of the dataObjects it reads or writes, and in usesServices the exact names of the externalServices it calls. Use empty arrays when a feature uses none. Every name must match a declared dataObject or externalService exactly. Declare a dataObject or externalService only when at least one feature lists it: every dataObject must appear in some feature's usesData and every externalService in some feature's usesServices, or the blueprint is rejected.",
    "For every dataObject, set storage to settings for small user preferences, records for structured app-owned records or history, document for files the user opens or saves, secret for API keys, tokens, or other credentials, temporary for short-lived files removed automatically, and session for values held in memory and never written to disk.",
    "For every feature, set failureRecovery to exit when its failure outcome ends the app or process; fallback only when the failure outcome itself names data or a default the app switches to automatically so the user does nothing (for example the last cached rates or the previous saved value); and retry when the operation is rejected, blocked, or shows an error the user must act on, and in every other case. Set surface to item-page when the feature is shown on its own page per item with a direct link, about-page when it is the product's about or background page, not-found-page when it handles unknown links, and main otherwise.",
    "For every dataObject, set writeMode to atomic-replace when a save must never leave a partially written copy (it is written to a temporary copy and swapped in whole), and direct otherwise. Do not declare that temporary copy as its own dataObject; writeMode atomic-replace on the stored dataObject already covers it.",
    `Software idea: ${input.idea.trim()}`,
  ].join("\n\n")
}
