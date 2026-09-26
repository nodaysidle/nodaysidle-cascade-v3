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

// File access is never a feature platform need: it comes only from a declared document data object,
// so the provider has no second place to state it and the two can never disagree.
export const FeaturePlatformNeedSchema = PlatformNeedSchema.exclude(["filesystem"])

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
  usesPlatformNeeds: z.array(FeaturePlatformNeedSchema).max(12),
  usesData: z.array(shortMeaning).max(8),
  usesServices: z.array(shortMeaning).max(8),
  userFileAccess: z.enum(["none", "opens", "saves", "opens-and-saves"]),
})

export const DataStorageSchema = z.enum(["settings", "records", "document", "app-files", "secret", "temporary", "session"])
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

export const MAX_IDEA_SENTENCES = 60

// One entry per numbered sentence of the user's idea, so a dropped requirement or an unrequested
// feature is a structural fact the pipeline can check instead of prose it has to trust.
const IdeaCoverageSchema = z.strictObject({
  sentence: z.number().int().min(1).max(MAX_IDEA_SENTENCES),
  features: z.array(shortMeaning).max(12),
  outsideFeatures: z.enum(["none", "product", "non-goal", "constraint"]),
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
  ideaCoverage: z.array(IdeaCoverageSchema).min(1).max(MAX_IDEA_SENTENCES),
})

export type SemanticBlueprint = z.infer<typeof SemanticBlueprintSchema>
export type PlatformNeed = z.infer<typeof PlatformNeedSchema>
export type FeaturePlatformNeed = z.infer<typeof FeaturePlatformNeedSchema>
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

// Replaces anything that looks like a credential before provider text is sent anywhere again.
export function redactSecretMaterial(text: string): string {
  return secretPatterns.reduce((value, pattern) => value.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`), "[removed secret]"), text)
}

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

// A saved file needs a declared document so its placement and atomic-write rule come from a field.
function savedFileDocumentIssues(blueprint: SemanticBlueprint): SemanticIssue[] {
  const documents = new Set(blueprint.dataObjects.filter(item => item.storage === "document").map(item => referenceKey(item.name)))
  return blueprint.features.flatMap((feature, index) =>
    (feature.userFileAccess === "saves" || feature.userFileAccess === "opens-and-saves") && !feature.usesData.some(name => documents.has(referenceKey(name)))
      ? [{
        path: `features[${index}].usesData`,
        rule: "semantic.saved-file-without-document",
        message: `Feature '${feature.name}' saves a file the user chooses but lists no document dataObject for it.`,
      }]
      : [])
}

export function auditSemanticIntake(blueprint: SemanticBlueprint): SemanticIssue[] {
  const issues: SemanticIssue[] = [...featureReferenceIssues(blueprint), ...savedFileDocumentIssues(blueprint)]
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

// Deterministic sentence split: a break after ., !, ? or ; followed by whitespace. Clauses joined by a
// semicolon become separate sentences so each requirement is mapped on its own.
export function splitIdeaSentences(idea: string): string[] {
  return idea.replace(/\s+/g, " ").trim().split(/(?<=[.!?;])\s+/).map(item => item.trim()).filter(Boolean)
}

export function auditIdeaCoverage(blueprint: SemanticBlueprint, idea: string): SemanticIssue[] {
  const sentences = splitIdeaSentences(idea)
  const featureNames = new Map(blueprint.features.map(feature => [referenceKey(feature.name), feature.name]))
  const covered = new Set<string>()
  const seen = new Set<number>()
  const issues: SemanticIssue[] = []
  blueprint.ideaCoverage.forEach((entry, index) => {
    const path = `ideaCoverage[${index}]`
    if (entry.sentence > sentences.length) {
      issues.push({ path, rule: "semantic.coverage-unknown-sentence", message: `Idea sentence ${entry.sentence} does not exist; the idea has ${sentences.length} numbered sentences.` })
      return
    }
    if (seen.has(entry.sentence)) issues.push({ path, rule: "semantic.coverage-duplicate-sentence", message: `Idea sentence ${entry.sentence} has more than one ideaCoverage entry.` })
    seen.add(entry.sentence)
    entry.features.forEach((name, featureIndex) => {
      const key = referenceKey(name)
      if (featureNames.has(key)) covered.add(key)
      else issues.push({ path: `${path}.features[${featureIndex}]`, rule: "semantic.coverage-unknown-feature", message: `Idea sentence ${entry.sentence} names '${name}', which is not a declared feature.` })
    })
    if (!entry.features.length && entry.outsideFeatures === "none") {
      issues.push({ path, rule: "semantic.coverage-no-feature", message: `Idea sentence ${entry.sentence} ("${sentences[entry.sentence - 1]}") is covered by no feature.` })
    }
    if (entry.outsideFeatures === "non-goal" && !blueprint.nonGoals.length) {
      issues.push({ path, rule: "semantic.coverage-missing-non-goal", message: `Idea sentence ${entry.sentence} is marked non-goal but nonGoals is empty.` })
    }
    if (entry.outsideFeatures === "constraint" && !blueprint.productConstraints.length && !blueprint.qualityRequirements.length) {
      issues.push({ path, rule: "semantic.coverage-missing-constraint", message: `Idea sentence ${entry.sentence} is marked constraint but productConstraints and qualityRequirements are empty.` })
    }
  })
  sentences.forEach((sentence, index) => {
    if (!seen.has(index + 1)) issues.push({ path: "ideaCoverage", rule: "semantic.coverage-missing-sentence", message: `Idea sentence ${index + 1} ("${sentence}") has no ideaCoverage entry.` })
  })
  blueprint.features.forEach((feature, index) => {
    if (!covered.has(referenceKey(feature.name))) {
      issues.push({ path: `features[${index}]`, rule: "semantic.feature-not-requested", message: `Feature '${feature.name}' is listed by no idea sentence; map it to the sentence that asks for it or remove it.` })
    }
  })
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
    "For features that depend on the operating system or device (notifications, reminders, tray or menu bar presence, background operation, permissions, hardware access, launch at login), write acceptance signals as the request the app makes or the app state a test can read, never as what the user sees or notices, and name the concrete request, value, or state.",
    "When a behavior, failure outcome, or acceptance signal depends on a default, interval, or limit, state its concrete value (for example a font family and point size, or a duration in milliseconds). Never write 'documented defaults' or an interval without its value.",
    "When a feature offers a fixed set of choices, such as currencies, units, or levels, list every choice and state which one is selected initially. Never write 'a fixed list' or 'supported values' without the values.",
    "When one feature's behavior sets or changes what another feature's records contain, such as a default applied when a record is created, state the same rule in both features. Never let two features describe the same record field differently.",
    "State one decided behavior for every rule. Never leave a choice between two behaviors for the builder to make (for example 'retries or skips'); pick one. Options that the user chooses between, such as a list of billing cycles, are fine. Give every scheduled or repeated action an exact time or interval and state how it avoids acting twice for the same item.",
    "Use no more than twelve features and no more than eight values in each prose list. List a platform need only when a stated feature uses it. Do not add features, settings, or platform needs that the idea does not ask for.",
    "Every acceptance signal checks only the behavior of its own feature. Never repeat a behavior that another feature owns.",
    "For every feature, list in usesPlatformNeeds each platform need that feature itself exercises (file access is not a platform need; userFileAccess states it), in usesData the exact names of the dataObjects it reads or writes, and in usesServices the exact names of the externalServices it calls. Use empty arrays when a feature uses none. Every name must match a declared dataObject or externalService exactly. Declare a dataObject or externalService only when at least one feature lists it: every dataObject must appear in some feature's usesData and every externalService in some feature's usesServices, or the blueprint is rejected.",
    "For every feature, set userFileAccess to opens when the feature itself asks the user to choose a file or folder in an Open panel or to drop one on the window, saves when it asks the user to choose where to save a file in a Save panel, opens-and-saves when it does both, and none otherwise. Working with the app's own settings, records, app-files, or already loaded content is none.",
    "Declare a document dataObject for every file the user chooses where to save, such as an export, and list it in the usesData of the feature that saves it; a feature whose userFileAccess is saves or opens-and-saves is rejected without one. A file or folder the user opens, imports, or reopens later may also be declared as a document and listed by every feature that opens or reopens it. A feature that only works on loaded content lists a session dataObject for that content instead. Set its writeMode to atomic-replace when a failed write must leave an existing file at that location unchanged.",
    "For every dataObject, set storage to settings for small user preferences, records for structured app-owned records or history, document for files or folders the user opens, imports, or saves at a location the user chooses, app-files for files the app itself copies or creates and keeps in its own folder (such as imported attachments, photos, or recordings), secret for API keys, tokens, or other credentials, temporary for short-lived files removed automatically, and session for values held in memory and never written to disk.",
    "For every feature, set failureRecovery to exit when its failure outcome ends the app or process; fallback only when the failure outcome itself names data or a default the app switches to automatically so the user does nothing (for example the last cached rates or the previous saved value); and retry when the operation is rejected, blocked, or shows an error the user must act on, and in every other case. Set surface to main unless the idea itself asks for that feature as its own page per item with a direct link (item-page), an about page (about-page), or a page for unknown links (not-found-page). Never add a feature only to use a surface value.",
    "For every dataObject, set writeMode to atomic-replace when a save must never leave a partially written copy (it is written to a temporary copy and swapped in whole), and direct otherwise. Do not declare that temporary copy as its own dataObject; writeMode atomic-replace on the stored dataObject already covers it.",
    "Return ideaCoverage with exactly one entry for every numbered idea sentence below. In features, list the exact names of every feature that implements what the sentence asks for. Set outsideFeatures to product when the sentence only names the product or its purpose, non-goal when it only rules something out and nonGoals states it, constraint when it only states a constraint or quality that productConstraints or qualityRequirements states, and none otherwise. A sentence that asks for any behavior lists at least one feature, and every feature is listed by at least one sentence.",
    `Software idea: ${input.idea.trim()}`,
    `Idea sentences:\n${splitIdeaSentences(input.idea).map((sentence, index) => `${index + 1}. ${sentence}`).join("\n")}`,
  ].join("\n\n")
}
