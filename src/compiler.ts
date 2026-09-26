import { auditAgentReadinessGraph, auditMechanicalGraph, auditPacket, auditProjectGraph, buildValidationLedger, type AuditEntry, type AuditFailure } from "./audit"
import { ASTRO_CONTENT_COLLECTION_PERSISTENCE, ASTRO_FOUNDATION_SCRIPT_REQUIREMENTS, planAstroWeb, type AstroRoutePlan } from "./astroWeb"
import { PRESETS, USER_SELECTED_FILE_PLACEMENT, type OwnerKind, type PermissionCapability, type PresetContract, type PresetId, type PresetRuntimeMode, type ProjectIdentity } from "./presets"
import { renderPacket } from "./renderers"
import { featureDataUses, featureReferenceIssues, referenceKey, type DataStorage, type DataWriteMode, type FeatureRecovery, type FeatureSurface, type PlatformNeed, type SemanticBlueprint, type SemanticIssue } from "./schema"
import { kitProjectPaths, nativeUsageDescriptions, presetKit } from "./kits"
import { buildTaskAcceptanceCriteria } from "./taskAcceptance"
import type { JevAtomicAuditDecision } from "./jev"

export const DOCUMENT_NAMES = ["PRD.md", "ARD.md", "TRD.md", "TASKS.md", "AGENTS.md"] as const
export type DocumentName = (typeof DOCUMENT_NAMES)[number]
export type ContractKind = "interface" | "data" | "integration" | "lifecycle" | "persistence" | "credential" | "permission" | "recovery" | "security" | "packaging"

export interface NormalizedBlueprint {
  readonly projectName: string
  readonly productDefinition: string
  readonly problemStatement: string
  readonly targetUsers: readonly string[]
  readonly goals: readonly string[]
  readonly nonGoals: readonly string[]
  readonly primaryUserJourneys: readonly {
    readonly name: string
    readonly actor: string
    readonly steps: readonly string[]
    readonly outcome: string
  }[]
  readonly features: readonly {
    readonly name: string
    readonly behavior: string
    readonly inputs: readonly string[]
    readonly outputs: readonly string[]
    readonly acceptanceOutcomes: readonly string[]
    readonly failureBehavior: string
    readonly recoveryExpectations: readonly string[]
    readonly providedCapabilities: readonly string[]
    readonly requiredCapabilities: readonly string[]
    readonly resourceIds: readonly string[]
    readonly choices: readonly string[]
    readonly surface: FeatureSurface
  }[]
  readonly externalServices: readonly {
    readonly name: string
    readonly purpose: string
    readonly dataSent: readonly string[]
    readonly credentialRequirement: "none" | "api-key"
    readonly failureBehavior: string
    readonly recovery: string
  }[]
  readonly domainData: readonly {
    readonly name: string
    readonly meaning: string
    readonly retention: string
    readonly sensitivity: "public" | "internal" | "personal" | "sensitive"
    readonly storage: DataStorage
    readonly writeMode: DataWriteMode
  }[]
  readonly privacySecurityRequirements: readonly string[]
  readonly permissionNeeds: readonly {
    readonly capability: PermissionCapability
    readonly purpose: string
    readonly deniedBehavior: string
  }[]
  readonly persistenceNeeds: readonly {
    readonly data: string
    readonly purpose: string
    readonly retention: string
    readonly deletionBehavior: string
    readonly sensitivity: "public" | "internal" | "personal" | "sensitive"
    readonly storage: Exclude<DataStorage, "secret">
    readonly writeMode: DataWriteMode
    readonly temporary: boolean
  }[]
  readonly lifecycleRequirements: readonly {
    readonly event: string
    readonly behavior: string
    readonly cleanup: string
  }[]
  readonly uxRequirements: readonly string[]
  readonly operationalConstraints: readonly string[]
  readonly successCriteria: readonly string[]
  readonly assumptions: readonly string[]
  readonly platformNeeds: readonly PlatformNeed[]
}

export class NormalizationError extends Error {
  constructor(readonly issues: readonly SemanticIssue[]) {
    super("Semantic input could not be normalized safely.")
  }
}

export class GraphConstructionError extends Error {
  constructor(readonly failure: AuditFailure) {
    super(failure.message)
    this.name = "GraphConstructionError"
  }
}

export interface GraphFeature {
  readonly id: string
  readonly name: string
  readonly ownerId: string
  readonly behavior: string
  readonly inputs: readonly string[]
  readonly outputs: readonly string[]
  readonly acceptanceOutcomes: readonly string[]
  readonly failureBehavior: string
  readonly recoveryExpectations: readonly string[]
  readonly providedCapabilities: readonly string[]
  readonly requiredCapabilities: readonly string[]
  readonly resourceIds: readonly string[]
  readonly requiredOwnerIds: readonly string[]
  readonly choices: readonly string[]
  readonly surface: FeatureSurface
}

export interface GraphAcceptance {
  readonly id: string
  readonly kind: "feature" | "integration"
  readonly criterion: string
  readonly featureIds: readonly string[]
  readonly ownerId: string
}

export interface GraphRequirement {
  readonly id: string
  readonly featureId: string
  readonly statement: string
  readonly acceptanceIds: readonly string[]
  readonly acceptanceCriteria: readonly string[]
}

export interface GraphContract {
  readonly id: string
  readonly kind: ContractKind
  readonly name: string
  readonly featureIds: readonly string[]
  readonly ownerId: string
  readonly decision: string
  readonly details: readonly string[]
  readonly failureBehavior: string
  readonly recovery: readonly string[]
}

export interface GraphOwner {
  readonly id: string
  readonly name: string
  readonly kind: OwnerKind
  readonly featureIds: readonly string[]
  readonly contractIds: readonly string[]
  readonly implementationFile: string
  readonly focusedTestFile: string
  readonly focusedTestCommand: string
  readonly createPhaseId: string
  modifyPhaseIds: string[]
}

export interface GraphTask {
  readonly id: string
  readonly title: string
  readonly ownerIds: readonly string[]
  readonly featureIds: readonly string[]
  readonly requirementIds: readonly string[]
  readonly contractIds: readonly string[]
  readonly dependencies: readonly string[]
  readonly filesToCreate: readonly string[]
  readonly filesToModify: readonly string[]
  readonly focusedTests: readonly string[]
  readonly acceptanceIds: readonly string[]
  readonly acceptanceCriteria: readonly string[]
  readonly prompt: string
  readonly validationCommands: readonly string[]
}

export interface GraphPhase {
  readonly id: string
  readonly title: string
  readonly dependencies: readonly string[]
  readonly tasks: readonly GraphTask[]
}

export interface ProjectGraph {
  readonly blueprint: NormalizedBlueprint
  readonly presetId: PresetId
  readonly presetLabel: string
  readonly identity: ProjectIdentity
  readonly runtimeMode: PresetRuntimeMode
  readonly features: readonly GraphFeature[]
  readonly acceptance: readonly GraphAcceptance[]
  readonly requirements: readonly GraphRequirement[]
  readonly contracts: readonly GraphContract[]
  readonly owners: GraphOwner[]
  readonly phases: readonly GraphPhase[]
  readonly foundationFiles: readonly string[]
  // Project paths the preset's starter kit provides (empty when the preset has no kit).
  readonly kitPaths: readonly string[]
  readonly lockedStack: readonly string[]
  readonly forbiddenTechnologies: readonly string[]
  readonly testFramework: string
  readonly persistence: {
    readonly enabled: boolean
    readonly decision: string
    readonly settingsPlacement: string
    readonly recordsPlacement: string
    readonly appFilesPlacement?: string
  }
  readonly signingDecision: string
  readonly installationDecision: string
  readonly validationCommands: readonly string[]
  readonly packagingRules: readonly string[]
  readonly lifecycleRules: readonly string[]
  readonly accessibilityRules: readonly string[]
  readonly runtimeArchitecture: readonly string[]
  readonly integrationBoundary: string
  readonly recoveryRules: readonly string[]
  readonly outputArtifact: string
  readonly artifactPath: string
  readonly completionEvidence: readonly string[]
  readonly astroPlan?: AstroRoutePlan
}

export type DocumentPacket = Readonly<Record<DocumentName, string>>
export type DocumentHashes = Readonly<Record<DocumentName, string>>

export interface CompiledPacket {
  readonly presetId: PresetId
  readonly projectSlug: string
  readonly graph: ProjectGraph
  readonly documents: DocumentPacket
  readonly hashes: DocumentHashes
  // Starter-kit files exported under kit/, rendered from templates and hashed like the documents.
  readonly kit: readonly KitExportFile[]
  readonly ledger: readonly AuditEntry[]
  readonly failures: readonly AuditFailure[]
  readonly exportable: boolean
}

export interface KitExportFile {
  readonly name: string
  readonly content: string
  readonly sha256: string
}

export interface ExportFile {
  readonly name: string
  readonly content: string
  readonly sha256: string
}

interface OwnerDraft {
  readonly id: string
  readonly name: string
  readonly kind: OwnerKind
  readonly dependencyIds: readonly string[]
}

export function slug(value: string): string {
  const ascii = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  const normalized = ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return normalized || `project-${fnv1a(value).toString(16).padStart(8, "0")}`
}

function camelWords(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}

// Split camelCase and acronym boundaries first so "ExchangeRateAPI" becomes ExchangeRateApi, not Exchangerateapi.
function pascal(value: string): string {
  const result = slug(camelWords(value)).split("-").filter(Boolean).map(part => part[0]!.toUpperCase() + part.slice(1)).join("")
  return /^[A-Za-z]/.test(result) ? result : `Project${result}`
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function semanticKey(value: string): string {
  const key = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "")
  const trimmed = value.trim()
  return key || (trimmed ? `u${fnv1a(trimmed).toString(16)}` : "")
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ")
    const key = semanticKey(normalized)
    if (key && !seen.has(key)) {
      seen.add(key)
      result.push(normalized)
    }
  }
  return result
}

const implementationSuggestion = /\b(?:build|built|implement|implemented|implementation|use|using|written|powered|with)\s+(?:in\s+|on\s+)?(?:React Native|Jetpack Compose|SwiftUI|AppKit|Flutter|Electron|Tauri(?:\s*2)?|Astro|Next\.js|Kotlin|Rust|TypeScript|Swift(?:\s*6)?|React|Vue|Svelte)\b/gi
const genericIdentity = /\b(?:com|org)\.example(?:\.[a-z0-9-]+)+\b|\bexample\.com\b|\byour[-. ](?:company|bundle)\b/gi
const providerId = /\b(?:FEAT|REQ|TASK|PHASE|CONTRACT|CON|CTR|OWN)-[A-Z0-9-]+\b/gi
const sourcePath = /(^|[\s("'`])(?:~\/|\.{0,2}\/|\/(?:Users|Volumes|Applications)\/|(?:src|tests?|Sources|Tests|app\/src|src-tauri)\/)[A-Za-z0-9_./ -]+/gim
const command = /(?:\.\/gradlew|npm|pnpm|yarn|cargo|swift|xcodebuild|adb)\s+(?:run\s+)?[A-Za-z0-9:._-]+(?:\s+--?[A-Za-z0-9:._="'/-]+)*/gi
const documentName = /\b(?:PRD|ARD|TRD|TASKS|AGENTS)\.md\b/gi
// Short lowercase format tokens such as "rates from <date>" become {date}: angle brackets vanish as
// HTML in Markdown viewers. Capitalized or filler tokens such as <Your App Name> stay for the gate.
const formatToken = /<([a-z][a-z0-9]*(?:[ _-][a-z0-9]+){0,2})>/g
const fillerToken = /\b(?:your|insert|placeholder|todo|tbd|example|here)\b/

function cleanMeaning(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/(^|\s)#{1,6}\s+/g, "$1")
    .replace(implementationSuggestion, "under the selected preset")
    .replace(genericIdentity, "the application identity")
    .replace(sourcePath, "$1the local implementation")
    .replace(command, "the local validation command")
    .replace(providerId, "")
    .replace(documentName, "the applicable contract document")
    .replace(formatToken, (token, name: string) => fillerToken.test(name) ? token : `{${name}}`)
    .replace(/\beither\s+/gi, "")
    .replace(/\breject\s+or\s+(?:explicitly\s+)?split\b/gi, "reject")
    .replace(/\bchoose (?:one|between)\b/gi, "select")
    .replace(/\bdecide whether\b/gi, "determine whether")
    .replace(/\s+([,;:!?])/g, "$1")
    .replace(/\s+\.(?![A-Za-z0-9])/g, ".")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^\s*[:;,.-]+\s*|\s*[:;,-]+\s*$/g, "")
    .trim()
}

function cleanList(values: readonly string[]): string[] {
  return uniqueStrings(values.map(cleanMeaning).filter(Boolean))
}

function uniqueByName<T extends { readonly name: string }>(values: readonly T[]): T[] {
  const seen = new Set<string>()
  return values.filter(value => {
    const key = semanticKey(value.name)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const permissionByNeed: Partial<Record<PlatformNeed, PermissionCapability>> = {
  "audio-input": "microphone",
  camera: "camera",
  clipboard: "clipboard",
  "global-hotkey": "global-input",
  "accessibility-control": "accessibility",
  notifications: "notifications",
  filesystem: "filesystem",
  network: "network",
  "background-execution": "background-execution",
  "launch-at-login": "background-startup",
  location: "location",
}

const needPurpose: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Capture audio only during an explicit user-initiated recording action.",
  accessibility: "Control or insert content into another application only after explicit authorization.",
  notifications: "Deliver user-enabled status or reminder notifications.",
  filesystem: "Access only user-selected files and folders required by a feature.",
  network: "Contact only the external services declared by the product meaning.",
  camera: "Capture images or video only during an explicit user action.",
  location: "Use foreground location only for the declared user outcome.",
  "global-input": "Receive the explicitly configured system-wide action without broad input capture.",
  clipboard: "Read or write clipboard content only in the features that declare it, and preserve the user's prior clipboard only when the PRD promises it.",
  "background-startup": "Start at login only after the user enables it.",
  "background-execution": "Keep running after the main window closes only while a declared background feature needs it.",
}

const deniedBehavior: Readonly<Record<PermissionCapability, string>> = {
  microphone: "Block capture, create no empty record, and keep non-recording features available.",
  accessibility: "Skip privileged control and provide a manual, non-destructive fallback.",
  notifications: "Keep the product usable with in-app status and no repeated prompt.",
  filesystem: "Leave existing state unchanged and allow another explicit selection.",
  network: "Keep local state usable and offer a bounded explicit retry.",
  camera: "Skip capture and keep non-camera features available.",
  location: "Use manual input or non-location behavior without fabricating a position.",
  "global-input": "Keep in-app controls available and explain the permission recovery path.",
  clipboard: "Stop the denied clipboard access, keep saved data unchanged, and show the user how to allow clipboard access again.",
  "background-startup": "Keep manual launch and foreground behavior available.",
  "background-execution": "Keep foreground behavior available and state that background work stops when the app closes.",
}

function permissionResourceId(capability: PermissionCapability): string {
  return `permission:${capability}`
}

function featureRecovery(name: string, recovery: FeatureRecovery): string {
  switch (recovery) {
    case "exit":
      return `Release partial resources before exiting so a relaunch of ${name} starts from a clean state.`
    case "fallback":
      return `Apply the stated fallback automatically, keep ${name} usable, and require no user retry.`
    case "retry":
      return `Preserve the last valid state, explain the failure, and allow an explicit retry of ${name}.`
  }
}

function dataResourceIds(name: string): string[] {
  return [`data:${slug(name)}`]
}

function serviceResourceIds(name: string): string[] {
  return [`service:${slug(name)}`]
}

function featureResourceIds(usesPlatformNeeds: readonly PlatformNeed[], usesData: readonly string[], usesServices: readonly string[]): string[] {
  return unique([
    ...usesPlatformNeeds.flatMap(need => permissionByNeed[need] ? [permissionResourceId(permissionByNeed[need]!)] : []),
    ...usesData.flatMap(dataResourceIds),
    ...usesServices.flatMap(serviceResourceIds),
  ])
}

function deriveProblemStatement(targetUsers: readonly string[], goals: readonly string[], nonGoals: readonly string[]): string {
  const audience = targetUsers[0] ?? "Users"
  const primaryGoal = goals[0] ?? "achieve the documented outcomes"
  const avoided = nonGoals[0] ?? "unnecessary scope expansion"
  const goalText = primaryGoal.replace(/\.$/, "")
  const avoidText = avoided.replace(/\.$/, "").replace(/^(?:no|never|not|without)\s+/i, "")
  const verb = /^(?:a|an|one|each|every)\b/i.test(audience) ? "needs" : "need"
  // Lowercase only a capitalized ordinary word; acronyms such as OCR or API keep their case.
  const lowerFirst = (text: string) => /^[A-Z][a-z]/.test(text) ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text
  // A goal that already has a "without" clause gets the avoided scope as a separate trailing clause.
  const joiner = /\bwithout\b/i.test(goalText) ? ", without" : " without"
  return `${audience} ${verb} a focused way to ${lowerFirst(goalText)}${joiner} ${lowerFirst(avoidText)}.`
}

function astroContentSiteSemantics(source: SemanticBlueprint, presetId: PresetId): boolean {
  if (presetId !== "astro-web") return false
  const runtimeWouldBeStatic = !source.externalServices.some(service => service.credentialRequired)
  if (!runtimeWouldBeStatic) return false
  if (source.dataObjects.some(item => item.sensitivity === "public" || item.sensitivity === "internal")) return true
  return source.features.some(feature => feature.surface === "item-page")
}

function normalizationIssue(path: string): never {
  throw new NormalizationError([{ path, rule: "normalization.unusable-meaning", message: "Provider mechanics left no usable product meaning at this path." }])
}

export function normalizeBlueprint(source: SemanticBlueprint, presetId: PresetId, atomicAudits?: JevAtomicAuditDecision): NormalizedBlueprint {
  if (!PRESETS[presetId]) throw new NormalizationError([{ path: "$preset", rule: "normalization.unknown-preset", message: "The selected preset is not available." }])
  const projectName = source.productName.normalize("NFKC").trim().replace(/\s+/g, " ")
  const summary = cleanMeaning(source.summary)
  if (!projectName) normalizationIssue("productName")
  if (!summary) normalizationIssue("summary")

  const targetUsers = cleanList(source.targetUsers)
  const goals = cleanList(source.goals)
  if (!targetUsers.length) normalizationIssue("targetUsers")
  if (!goals.length) normalizationIssue("goals")
  const referenceIssues = featureReferenceIssues(source)
  if (referenceIssues.length) throw new NormalizationError(referenceIssues)
  const dataNameByKey = new Map(source.dataObjects.map(item => [referenceKey(item.name), cleanMeaning(item.name)]))
  const serviceNameByKey = new Map(source.externalServices.map(item => [referenceKey(item.name), cleanMeaning(item.name)]))

  const baseFeatures = uniqueByName(source.features.map((feature, index) => {
    const name = cleanMeaning(feature.name)
    const behavior = cleanMeaning(feature.behavior)
    const userOutcome = cleanMeaning(feature.userOutcome)
    if (!name) normalizationIssue(`features[${index}].name`)
    if (!behavior) normalizationIssue(`features[${index}].behavior`)
    if (!userOutcome) normalizationIssue(`features[${index}].userOutcome`)
    const trigger = cleanMeaning(feature.trigger) || `The user initiates ${name}.`
    const failure = cleanMeaning(feature.failureOutcome) || "The operation stops without losing the last valid state."
    const acceptance = cleanList(feature.acceptanceSignals)
    return {
      name,
      behavior,
      inputs: [trigger],
      outputs: [userOutcome],
      acceptanceOutcomes: acceptance.length ? acceptance : [`${name} produces the documented user outcome.`],
      failureBehavior: failure,
      recoveryExpectations: [featureRecovery(name, feature.failureRecovery)],
      providedCapabilities: [],
      requiredCapabilities: [],
      resourceIds: [],
      usesPlatformNeeds: unique(feature.usesPlatformNeeds),
      usesData: unique(featureDataUses(source, feature).map(name => dataNameByKey.get(referenceKey(name))!)),
      usesServices: unique(feature.usesServices.map(name => serviceNameByKey.get(referenceKey(name))!)),
      userFileAccess: feature.userFileAccess,
      choices: feature.choiceLists.map(list => `${cleanMeaning(list.name)}: ${cleanList(list.options).join(", ")}; initially ${cleanMeaning(list.initial)}`),
      surface: feature.surface,
    }
  }))
  if (!baseFeatures.length) normalizationIssue("features")

  const dataObjects = uniqueByName(source.dataObjects.map(item => {
    const name = cleanMeaning(item.name)
    const purpose = cleanMeaning(item.purpose)
    return {
      name,
      purpose,
      sensitivity: item.sensitivity,
      retentionIntent: cleanMeaning(item.retentionIntent),
      storage: item.storage,
      writeMode: item.writeMode,
    }
  }).filter(item => item.name && item.purpose && item.retentionIntent))
  const externalServices = uniqueByName(source.externalServices.map(item => {
    const purpose = cleanMeaning(item.purpose)
    return {
      name: cleanMeaning(item.name),
      purpose,
      dataSent: cleanList(item.dataSent),
      credentialRequirement: item.credentialRequired ? "api-key" as const : "none" as const,
      failureBehavior: "Return a privacy-safe authentication, rate, transport, timeout, filtered, or provider failure without raw response content.",
      recovery: "Preserve recoverable local input and allow only an explicit retry or explicit service change.",
    }
  }).filter(item => item.name && item.purpose))
  // File access is declared per feature by userFileAccess (the feature shows an Open or Save panel or
  // accepts drops); a feature that reopens a declared document by saved path gets it too.
  const documentNames = new Set(dataObjects.filter(item => item.storage === "document").map(item => item.name))
  const features = baseFeatures.map(({ usesPlatformNeeds, usesData, usesServices, userFileAccess, ...feature }) => ({
    ...feature,
    resourceIds: featureResourceIds(
      [...usesPlatformNeeds, ...(userFileAccess !== "none" || usesData.some(name => documentNames.has(name)) ? ["filesystem" as const] : [])],
      usesData,
      usesServices,
    ),
  }))
  // File access is derived per feature, so it counts as a product need whenever a feature links it,
  // even when the provider's product-level list omits it.
  const rawPlatformNeeds = unique([
    ...source.platformNeeds,
    ...baseFeatures.flatMap(feature => feature.usesPlatformNeeds),
    ...(features.some(feature => feature.resourceIds.includes(permissionResourceId("filesystem"))) ? ["filesystem" as const] : []),
    ...(atomicAudits?.addedPlatformNeeds ?? []),
  ])
  const permissionCapabilities = unique(rawPlatformNeeds.flatMap(need => permissionByNeed[need] ? [permissionByNeed[need]!] : []))
    .filter(capability => features.some(f => f.resourceIds.includes(permissionResourceId(capability))))
  const platformNeeds = rawPlatformNeeds
  const permissionNeeds = permissionCapabilities.map(capability => ({ capability, purpose: needPurpose[capability], deniedBehavior: deniedBehavior[capability] }))
  const contentSite = astroContentSiteSemantics(source, presetId)
  const persistenceRequired = platformNeeds.includes("local-storage") || contentSite
  const persistenceNeeds = dataObjects
    .flatMap(item => item.storage === "secret" ? [] : [{ ...item, storage: item.storage }])
    .filter(item => persistenceRequired || item.storage !== "session")
    .map(item => ({
      data: item.name,
      purpose: item.purpose,
      retention: item.retentionIntent,
      deletionBehavior: item.storage === "temporary"
        ? `Delete ${item.name} automatically at its stated retention boundary without waiting for a user action, verify it is absent, and report a cleanup failure honestly.`
        : item.storage === "session"
          ? `${item.name} is never written to disk and is discarded when the session ends; verify no file for it exists.`
          : `Delete ${item.name} only through an explicit user action or the stated retention boundary, and report deletion failure honestly.`,
      sensitivity: item.sensitivity,
      storage: item.storage,
      writeMode: item.writeMode,
      temporary: item.storage === "temporary",
    }))
  const privacySecurityRequirements = uniqueStrings([
    "Minimize collected data and keep it inside the preset-defined owner, storage, and integration boundaries.",
    ...dataObjects.filter(item => item.sensitivity !== "public").map(item => `Protect ${item.name} as ${item.sensitivity} data and never expose it through logs or diagnostics.`),
    ...externalServices.map(item => item.dataSent.length
      ? `Send only ${item.dataSent.join("; ")} to ${item.name} for ${item.purpose}`
      : `Send no product data to ${item.name} beyond the explicit request needed for ${item.purpose}`),
    ...(externalServices.some(item => item.credentialRequirement !== "none")
      ? ["Keep external service credentials out of logs, files, UI state, product records, and rendered documents."]
      : []),
  ])
  const lifecycleRequirements = [
    {
      event: "Application launch",
      // A declared background need means some feature must run from launch, such as clipboard recording.
      behavior: platformNeeds.includes("background-execution")
        ? "Initialize preset-owned state and services and start the declared background features; start no other capture, remote request, or destructive work automatically."
        : "Initialize preset-owned state and services without starting privileged capture, remote requests, or destructive work automatically.",
      cleanup: "Rollback partial initialization and keep a safe retry or manual launch path.",
    },
    {
      event: "Application termination",
      behavior: "Stop new work, cancel active operations, and preserve only state covered by the persistence contracts.",
      cleanup: features.some(feature => feature.resourceIds.includes(permissionResourceId("clipboard")))
        ? "Release permissions, listeners, handles, tasks, clipboard watchers and snapshots, and temporary resources before termination completes."
        : "Release permissions, listeners, handles, tasks, and temporary resources before termination completes.",
    },
    ...(platformNeeds.includes("audio-input") ? [{
      event: "Audio capture termination",
      behavior: "Finalize or cancel the one active capture and make its recovery state explicit.",
      cleanup: "Release microphone resources after success, explicit discard, cancellation, or exhausted recovery.",
    }] : []),
  ]
  const nonGoals = cleanList(source.nonGoals)
  const qualityRequirements = cleanList(source.qualityRequirements)
  const productConstraints = cleanList(source.productConstraints)

  return {
    projectName,
    productDefinition: summary,
    problemStatement: deriveProblemStatement(targetUsers, goals, nonGoals),
    targetUsers,
    goals,
    nonGoals: nonGoals.length ? nonGoals : ["No outcomes beyond the declared features and goals are included."],
    primaryUserJourneys: features.map(feature => ({
      name: `${feature.name} outcome`,
      actor: targetUsers[0]!,
      steps: [feature.inputs[0]!, feature.behavior],
      outcome: feature.outputs[0]!,
    })),
    features,
    externalServices,
    domainData: dataObjects.map(item => ({ name: item.name, meaning: item.purpose, retention: item.retentionIntent, sensitivity: item.sensitivity, storage: item.storage, writeMode: item.writeMode })),
    privacySecurityRequirements,
    permissionNeeds,
    persistenceNeeds,
    lifecycleRequirements,
    uxRequirements: qualityRequirements.length ? qualityRequirements : ["Provide accessible, keyboard-operable, visible product states."],
    operationalConstraints: productConstraints.length ? productConstraints : ["Preserve the last valid state when an operation fails."],
    successCriteria: uniqueStrings([...goals, ...features.flatMap(feature => feature.acceptanceOutcomes)]),
    assumptions: ["The selected preset is authoritative for every technology and mechanical decision.", "Omitted mechanics use the conservative preset-defined contract without another provider request."],
    platformNeeds,
  }
}

function bundleSegment(part: string, fallback: string): string {
  const segment = part || fallback
  return /^[a-z]/.test(segment) ? segment : `p${segment}`
}

function projectIdentity(projectName: string): ProjectIdentity {
  const projectSlug = slug(projectName)
  // Split camelCase for the bundle identity only, and never fall back to a trailing ".app":
  // macOS tooling rejects identifiers that end with the bundle extension.
  const parts = slug(camelWords(projectName)).split("-")
  const vendor = bundleSegment(parts[0] ?? "", "project")
  const product = bundleSegment(parts.slice(1).join(""), vendor)
  const packageName = `com.${vendor}.${product}`
  return {
    projectName,
    slug: projectSlug,
    pascalName: pascal(projectName),
    moduleName: pascal(projectName),
    bundleId: packageName,
    packageName,
    packagePath: packageName.replaceAll(".", "/"),
  }
}

function allocateStableIds(prefix: string, names: readonly string[]): string[] {
  const counts = new Map<string, number>()
  return names.map(name => {
    const base = `${prefix}-${slug(name).toUpperCase()}`
    const count = (counts.get(base) ?? 0) + 1
    counts.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  })
}

function graphFailure(rule: string, path: string, message: string): GraphConstructionError {
  return new GraphConstructionError({ rule, path, message })
}

function resolveRequiredOwners(features: readonly GraphFeature[]): GraphFeature[] {
  const providers = new Map<string, Set<string>>()
  for (const feature of features) {
    for (const capability of feature.providedCapabilities) {
      const owners = providers.get(capability) ?? new Set<string>()
      owners.add(feature.ownerId)
      providers.set(capability, owners)
    }
  }

  return features.map(feature => {
    const requiredOwnerIds: string[] = []
    for (const capability of feature.requiredCapabilities) {
      const ownerIds = [...(providers.get(capability) ?? [])].sort((left, right) => left.localeCompare(right))
      if (!ownerIds.length) {
        throw graphFailure("graph.references", feature.id, `${feature.id} requires capability ${capability}, but no implementation owner provides it. Add one provider or remove the requirement before rendering.`)
      }
      if (ownerIds.length > 1) {
        throw graphFailure("graph.ownership", feature.id, `${feature.id} requires capability ${capability}, but multiple implementation owners provide it: ${ownerIds.join(", ")}. Select one owner before rendering.`)
      }
      if (ownerIds[0] !== feature.ownerId) requiredOwnerIds.push(ownerIds[0]!)
    }
    return { ...feature, requiredOwnerIds: unique(requiredOwnerIds) }
  })
}

function lowerAcceptanceOwnership(sourceFeatures: readonly GraphFeature[]): {
  features: GraphFeature[]
  acceptance: GraphAcceptance[]
  requirements: GraphRequirement[]
} {
  const groups = new Map<string, { criteria: string[]; featureIds: string[] }>()
  for (const feature of sourceFeatures) {
    for (const criterion of feature.acceptanceOutcomes) {
      const key = semanticKey(criterion)
      if (!key) continue
      const group = groups.get(key) ?? { criteria: [], featureIds: [] }
      group.criteria.push(criterion)
      group.featureIds.push(feature.id)
      groups.set(key, group)
    }
  }

  const sharedKeys = new Set([...groups].filter(([, group]) => unique(group.featureIds).length > 1).map(([key]) => key))
  const directByFeature = new Map<string, string[]>()
  for (const feature of sourceFeatures) {
    const direct = uniqueStrings(feature.acceptanceOutcomes.filter(criterion => !sharedKeys.has(semanticKey(criterion))))
      .sort((left, right) => semanticKey(left).localeCompare(semanticKey(right)))
    directByFeature.set(feature.id, direct.length ? direct : [`${feature.name} produces its declared output without claiming another feature's behavior.`])
  }

  const acceptance: GraphAcceptance[] = []
  for (const feature of [...sourceFeatures].sort((left, right) => left.id.localeCompare(right.id))) {
    for (const [index, criterion] of directByFeature.get(feature.id)!.entries()) {
      acceptance.push({
        id: `ACC-${feature.id.replace(/^FEAT-/, "")}-${String(index + 1).padStart(2, "0")}`,
        kind: "feature",
        criterion,
        featureIds: [feature.id],
        ownerId: feature.ownerId,
      })
    }
  }
  const shared = [...groups]
    .filter(([key]) => sharedKeys.has(key))
    .sort(([left], [right]) => left.localeCompare(right))
  for (const [index, [key, group]] of shared.entries()) {
    acceptance.push({
      id: `ACC-INTEGRATION-${String(index + 1).padStart(2, "0")}-${fnv1a(key).toString(16).padStart(8, "0").toUpperCase()}`,
      kind: "integration",
      criterion: [...group.criteria].sort((left, right) => left.localeCompare(right))[0]!,
      featureIds: unique(group.featureIds).sort((left, right) => left.localeCompare(right)),
      ownerId: "OWN-PACKAGING",
    })
  }

  const features = sourceFeatures.map(feature => ({ ...feature, acceptanceOutcomes: directByFeature.get(feature.id)! }))
  const requirements = features.map(feature => {
    const ownedAcceptance = acceptance.filter(item => item.kind === "feature" && item.featureIds[0] === feature.id)
    const behaviorText = feature.behavior.trim()
    // A behavior that is already a full sentence stays verbatim; only a bare lowercase predicate
    // gets a subject.
    const statement = /^(?:must\s+|shall\s+)/i.test(behaviorText)
      ? `The product ${behaviorText.charAt(0).toLowerCase()}${behaviorText.slice(1)}`
      : /^[A-Z]/.test(behaviorText) || /^(?:the\s+|this\s+|if\s+|when\s+|after\s+|before\s+|while\s+|during\s+|once\s+|unless\s+|a\s+|an\s+)/i.test(behaviorText)
      ? behaviorText
      : `The product must ${behaviorText}`
    return {
      id: feature.id.replace(/^FEAT-/, "REQ-"),
      featureId: feature.id,
      statement,
      acceptanceIds: ownedAcceptance.map(item => item.id),
      acceptanceCriteria: ownedAcceptance.map(item => item.criterion),
    }
  })
  return { features, acceptance, requirements }
}

function featureIdsForResources(resourceIds: readonly string[], features: readonly GraphFeature[]): string[] {
  const required = new Set(resourceIds)
  return features.filter(feature => feature.resourceIds.some(resourceId => required.has(resourceId))).map(feature => feature.id)
}

function integrationFeatureIds(
  service: NormalizedBlueprint["externalServices"][number],
  features: readonly GraphFeature[],
): string[] {
  const related = featureIdsForResources(serviceResourceIds(service.name), features)
  return related
}

function permissionFeatureIds(
  item: NormalizedBlueprint["permissionNeeds"][number],
  features: readonly GraphFeature[],
): string[] {
  return featureIdsForResources([permissionResourceId(item.capability)], features)
}

function dataFeatureIds(name: string, features: readonly GraphFeature[]): string[] {
  return featureIdsForResources(dataResourceIds(name), features)
}

function lifecycleFeatureIds(event: string, features: readonly GraphFeature[]): string[] {
  return event === "Audio capture termination"
    ? featureIdsForResources([permissionResourceId("microphone")], features)
    : []
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)]
}

function isNativeMacPreset(presetId: PresetId): boolean {
  return presetId === "native-macos-swiftui-desktop" || presetId === "native-macos-swiftui-menubar"
}

function compilerIntegrationServices(
  blueprint: NormalizedBlueprint,
): NormalizedBlueprint["externalServices"] {
  return blueprint.externalServices
}

function credentialDetails(presetId: PresetId, identity: ProjectIdentity, serviceName: string, kind: string): string[] {
  const serviceSlug = slug(serviceName)
  if (isNativeMacPreset(presetId)) {
    return [
      "API key placement: macOS Keychain only; never UserDefaults, SQLite, files, logs, UI state, diagnostics, or generated output.",
      `Keychain service: ${identity.bundleId}.credentials`,
      `Keychain account: ${serviceSlug}-${kind}`,
      "Keychain item: a kSecClassGenericPassword in the login keychain, without kSecUseDataProtectionKeychain, which needs a team-signed keychain entitlement the ad-hoc local build lacks (errSecMissingEntitlement).",
    ]
  }
  if (presetId === "astro-web") {
    return [`Server environment variable: ${serviceSlug.replaceAll("-", "_").toUpperCase()}_${kind.replaceAll("-", "_").toUpperCase()}`, "The value never enters browser assets or rendered HTML."]
  }
  if (presetId === "android-kotlin-compose") {
    return [`Android Keystore alias: ${identity.bundleId}.${serviceSlug}.credential`, "Decrypted values remain inside the service boundary and never enter Compose state."]
  }
  return [`Credential vault service: ${identity.bundleId}.credentials`, `Credential account: ${serviceSlug}-${kind}`, "The frontend receives only configured or missing state."]
}

// "Exchange Rate API" + " API key" would read "Exchange Rate API API key".
function credentialLabel(serviceName: string): string {
  return /API$/.test(serviceName) || /\bapi$/i.test(serviceName) ? `${serviceName} key` : `${serviceName} API key`
}

function credentialEntryDetail(presetId: PresetId, serviceName: string): string {
  const blocked = `every ${serviceName} action stays blocked with a prompt to add the key until it is configured.`
  if (presetId === "astro-web") {
    return `Credential entry: the operator sets the ${serviceName} key as a server environment variable before deploy; a missing value makes the server route return a configuration error instead of calling ${serviceName}.`
  }
  return `Credential entry: the user pastes the ${credentialLabel(serviceName)} into a masked settings field; the key goes straight to the placement above, the UI shows only configured or missing state, and ${blocked}`
}

const ATOMIC_WRITE_SENTENCE = "Every write replaces the destination by renaming a temporary file in the same directory; a failed write leaves the previous file intact."
const ATOMIC_TRANSACTION_SENTENCE = "Every write commits in one SQLite transaction; a failed write rolls back and leaves the previous rows intact."

// The atomic guarantee follows the concrete store: files are swapped by rename, SQLite commits
// transactionally, and stores that are already atomic per value need no extra rule.
function atomicWriteDetail(placement: string): string | undefined {
  if (/\bSQLite\b/.test(placement)) return ATOMIC_TRANSACTION_SENTENCE
  if (/\bJSON\b|filesystem|\bfile\b/i.test(placement)) return ATOMIC_WRITE_SENTENCE
  return undefined
}

function documentWriteDetail(storage: string, placement: string, preset: PresetContract): string | undefined {
  if (storage === "document" && preset.persistence.documentAtomicWrite) return preset.persistence.documentAtomicWrite
  return atomicWriteDetail(placement)
}

const SESSION_MEMORY_PLACEMENT = "Held in memory for the session and not written to disk."
const ATOMIC_RENAME_SCRATCH_PLACEMENT = "A temporary file in the destination file's own directory, renamed over the destination on success and removed on failure; never in temporaryDirectory or Application Support."

function persistencePlacement(
  item: NormalizedBlueprint["persistenceNeeds"][number],
  preset: PresetContract,
  identity: ProjectIdentity,
  astroPlan?: AstroRoutePlan,
  hasCredentials = false,
): string {
  const userDefaultsPlacement = hasCredentials
    ? "UserDefaults with versioned lightweight keys; API keys are forbidden."
    : "UserDefaults with versioned lightweight keys."
  if (preset.id === "astro-web" && astroPlan?.usesContentCollections) {
    return `src/content/${astroPlan.contentCollection}/ as build-time markdown or MDX compiled through src/content/config.ts.`
  }
  if (preset.id === "astro-web" && astroPlan?.browserPersistence) return preset.persistence.recordsPlacement
  if (item.storage === "session") return SESSION_MEMORY_PLACEMENT
  if (item.storage === "app-files") return preset.persistence.appFilesPlacement(identity)
  if (!isNativeMacPreset(preset.id)) {
    if (item.storage === "temporary") return preset.persistence.temporaryPlacement
    if (item.storage === "document") return preset.persistence.documentPlacement
    return item.storage === "settings" ? preset.persistence.settingsPlacement : preset.persistence.recordsPlacement
  }
  switch (item.storage) {
    case "temporary":
      return item.writeMode === "atomic-replace"
        ? ATOMIC_RENAME_SCRATCH_PLACEMENT
        : `FileManager.default.temporaryDirectory/${identity.bundleId}/ for ephemeral runtime scratch files.`
    case "document":
      return preset.persistence.documentPlacement
    case "settings":
      return userDefaultsPlacement
    case "records":
      return `SQLite at Application Support/${identity.bundleId}/${identity.slug}.sqlite3 under the matching record schema; PRAGMA user_version stores the schema version, and the data store's focused test asserts it after opening the database.`
  }
}

// Names only the native stores the blueprint declares, in a fixed order, so the summary never
// claims a store (SQLite, user-selected files) that no persistence contract uses.
function nativePersistenceStores(declared: ReadonlySet<string>): string[] {
  return [
    declared.has("settings") ? "UserDefaults for lightweight settings" : undefined,
    declared.has("records") ? "SQLite for durable record collections in Application Support" : undefined,
    declared.has("document") ? "local filesystem at user-selected paths for document storage" : undefined,
    declared.has("app-files") ? "app-owned files in Application Support" : undefined,
  ].filter((store): store is string => store !== undefined)
}

function joinWithAnd(items: readonly string[]): string {
  if (items.length < 3) return items.join(" and ")
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function nativePackagingDetails(preset: PresetContract, identity: ProjectIdentity, platformNeeds: readonly string[] = []): string[] {
  const micDeclaration = nativeUsageDescriptions(identity, platformNeeds).map(([key, text]) => `, ${key} = "${text}"`).join("")
  return [
    `Bundle identity: CFBundleIdentifier = ${identity.bundleId}; CFBundleName = ${identity.projectName}; CFBundleExecutable = ${identity.moduleName}; CFBundleIconFile = AppIcon; CFBundlePackageType = APPL; CFBundleShortVersionString = 1.0.0; CFBundleVersion = 1.`,
    `Info.plist ownership: Resources/Info.plist declares CFBundleIdentifier, CFBundleExecutable, CFBundleIconFile, LSMinimumSystemVersion = 14.0 (matching Package.swift platforms: [.macOS(.v14)], the floor for @Observable), NSHighResolutionCapable = true${micDeclaration}, and LSUIElement = ${preset.id === "native-macos-swiftui-menubar" ? "true" : "false"}.`,
    "Entitlements ownership: Resources/App.entitlements is the only entitlements source and is an XML plist with an empty dictionary for the local unsandboxed build; com.apple.security.app-sandbox and broad file or automation entitlements are absent, and signing passes this reviewed file explicitly.",
    "Icon ownership: Resources/AppIcon.icns is the single source icon copied to Contents/Resources/AppIcon.icns and referenced by CFBundleIconFile.",
    `Architecture: Scripts/package_app.sh runs swift build -c release --arch arm64, rejects a non-arm64 Mach-O executable, and copies .build/arm64-apple-macosx/release/${identity.moduleName}.`,
    `App assembly: create dist/${identity.projectName}.app/Contents/MacOS and Contents/Resources, copy the executable to Contents/MacOS/${identity.moduleName}, copy Info.plist to Contents/Info.plist, copy AppIcon.icns to Contents/Resources, and write no competing Packaging.swift implementation.`,
    "Signing: Scripts/package_app.sh signs the assembled bundle once with the selected local or distribution identity and Resources/App.entitlements, then runs codesign --verify --deep --strict and rejects any failure before DMG or install.",
    `Launch: after the verified rollback and app copy, register the exact bundle with LaunchServices and launch it with open -b ${identity.bundleId}; verify that running bundle identity rather than a path lookalike.`,
  ]
}

function contract(
  id: string,
  kind: ContractKind,
  name: string,
  featureIds: readonly string[],
  ownerId: string,
  decision: string,
  details: readonly string[],
  failureBehavior: string,
  recovery: readonly string[],
): GraphContract {
  return { id, kind, name, featureIds: unique(featureIds), ownerId, decision, details, failureBehavior, recovery: unique(recovery) }
}

function buildOwnersAndContracts(
  blueprint: NormalizedBlueprint,
  preset: PresetContract,
  identity: ProjectIdentity,
  features: readonly GraphFeature[],
  astroPlan?: AstroRoutePlan,
  integrationServices: NormalizedBlueprint["externalServices"] = compilerIntegrationServices(blueprint),
): { ownerDrafts: OwnerDraft[]; contracts: GraphContract[] } {
  const runtimeMode = preset.runtimeMode(blueprint)
  const staticAstroMinimal = preset.id === "astro-web"
    && runtimeMode === "static"
    && !blueprint.persistenceNeeds.length
    && !blueprint.permissionNeeds.length
    && !integrationServices.some(service => service.credentialRequirement !== "none")
  const lifecycleOwnerId = staticAstroMinimal ? "OWN-PACKAGING" : "OWN-LIFECYCLE-COORDINATOR"
  const integrationDrafts: OwnerDraft[] = integrationServices.map(service => ({
    id: `OWN-INTEGRATION-${slug(service.name).toUpperCase()}`,
    name: `${pascal(service.name)}Integration`,
    kind: "integration",
    dependencyIds: [],
  }))
  const featureDrafts = [...new Map(features.map(feature => [feature.ownerId, {
    id: feature.ownerId,
    name: preset.id === "astro-web"
      ? pascal(feature.name)
      : `${pascal(feature.name)}Feature`,
    kind: "feature" as const,
    dependencyIds: [],
  }])).values()]

  const credentialServices = integrationServices.filter(service => service.credentialRequirement !== "none")
  const credentialOwnerFeatureIds = unique(credentialServices.flatMap(service => integrationFeatureIds(service, features)))
  const hasCredentialDomainData = blueprint.domainData.some(item => item.storage === "secret")
  const coreDrafts: OwnerDraft[] = []
  if (credentialServices.length || hasCredentialDomainData) {
    coreDrafts.push({ id: "OWN-CREDENTIAL-VAULT", name: "CredentialVault", kind: "credential", dependencyIds: [] })
  }
  if (blueprint.domainData.length || blueprint.persistenceNeeds.length) {
    coreDrafts.push({
      id: "OWN-DATA-STORE",
      name: preset.id === "astro-web" && astroPlan?.usesContentCollections ? "ContentCatalog" : "DataStore",
      kind: "data",
      dependencyIds: [],
    })
  }
  if (blueprint.permissionNeeds.length) {
    coreDrafts.push({
      id: "OWN-PERMISSION-COORDINATOR",
      name: "PermissionCoordinator",
      kind: "permission",
      dependencyIds: [],
    })
  }
  if (!staticAstroMinimal) {
    coreDrafts.push({
      id: "OWN-LIFECYCLE-COORDINATOR",
      name: "LifecycleCoordinator",
      kind: "lifecycle",
      dependencyIds: [],
    })
  }

  const contracts: GraphContract[] = []
  for (const feature of features) {
    const key = feature.id.replace(/^FEAT-/, "")
    const interfaceDetails = [`Inputs: ${feature.inputs.join("; ")}`, `Outputs: ${feature.outputs.join("; ")}`, ...feature.choices.map(choice => `Choices: ${choice}`)]
    contracts.push(contract(
      `CON-${key}-INTERFACE`,
      "interface",
      `${feature.name} interface`,
      [feature.id],
      feature.ownerId,
      feature.behavior,
      interfaceDetails,
      feature.failureBehavior,
      feature.recoveryExpectations,
    ))
    contracts.push(contract(
      `CON-${key}-RECOVERY`,
      "recovery",
      `${feature.name} recovery`,
      [feature.id],
      feature.ownerId,
      `Treat failure as a terminal or recoverable state exactly as the semantic contract describes. ${preset.recoveryRules.join(" ")}`,
      preset.recoveryRules,
      feature.failureBehavior,
      feature.recoveryExpectations,
    ))
  }

  const dataOwnerId = blueprint.domainData.length || blueprint.persistenceNeeds.length ? "OWN-DATA-STORE" : lifecycleOwnerId
  for (const item of blueprint.domainData) {
    const credentialData = item.storage === "secret"
    const inMemoryData = item.storage === "session"
    const ownerId = credentialData ? "OWN-CREDENTIAL-VAULT" : dataOwnerId
    const credentialDataDetails = credentialData
      ? (credentialServices.length
        ? unique(credentialServices.flatMap(service => credentialDetails(preset.id, identity, service.name, service.credentialRequirement)))
        : credentialDetails(preset.id, identity, item.name, "credential"))
      : [`Retention: ${item.retention}`, `Sensitivity: ${item.sensitivity}`]
    contracts.push(contract(
      `CON-DATA-${slug(item.name).toUpperCase()}`,
      "data",
      item.name,
      credentialData
        ? [...dataFeatureIds(item.name, features), ...credentialOwnerFeatureIds]
        : dataFeatureIds(item.name, features),
      ownerId,
      credentialData ? `${preset.credentialPlacement} CredentialVault exclusively owns credential storage, retrieval, replacement, and deletion; DataStore receives no secret value.` : item.meaning,
      credentialData ? [...credentialDataDetails, `Retention: ${item.retention}`, `Sensitivity: ${item.sensitivity}`] : credentialDataDetails,
      credentialData ? "Missing, rejected, unreadable, replacement-failed, or deletion-failed credentials block only the affected provider action without exposing or copying a secret." : inMemoryData ? "A failed update leaves the last in-memory state valid." : "Reject invalid or incomplete records without replacing the last valid state.",
      credentialData ? ["Preserve the prior stored credential after failed replacement, report deletion only after the credential store confirms it, and expose an explicit replacement or provider-selection action."] : inMemoryData ? ["Keep the last in-memory value and rebuild it from its source on the next explicit action."] : ["Preserve the last valid record and expose a bounded correction or rebuild path."],
    ))
  }

  for (const service of integrationServices) {
    const ownerId = `OWN-INTEGRATION-${slug(service.name).toUpperCase()}`
    contracts.push(contract(
      `CON-INTEGRATION-${slug(service.name).toUpperCase()}`,
      "integration",
      `${service.name} integration`,
      integrationFeatureIds(service, features),
      ownerId,
      `${service.purpose} ${preset.integrationBoundary}`,
      [`Data sent: ${service.dataSent.join("; ") || "No product data beyond the explicit request."}`, `Credential requirement: ${service.credentialRequirement}`, `Preset boundary: ${preset.platform}`, `Framework boundary: ${preset.integrationBoundary}`],
      service.failureBehavior,
      [service.recovery],
    ))
  }

  for (const item of blueprint.lifecycleRequirements) {
    contracts.push(contract(
      `CON-LIFECYCLE-${slug(item.event).toUpperCase()}`,
      "lifecycle",
      item.event,
      lifecycleFeatureIds(item.event, features),
      lifecycleOwnerId,
      item.behavior,
      [`Cleanup: ${item.cleanup}`],
      "An interrupted lifecycle transition must not be reported as complete.",
      [item.cleanup],
    ))
  }

  contracts.push(contract(
    "CON-LIFECYCLE-PRESET",
    "lifecycle",
    `${preset.label} lifecycle`,
    features.map(feature => feature.id),
    lifecycleOwnerId,
    preset.lifecycleRules.join(" "),
    preset.lifecycleRules,
    "A preset lifecycle invariant failure blocks completion and leaves the last safe state active.",
    ["Restore the last safe lifecycle state, release partial resources, and rerun the focused lifecycle checks."],
  ))

  if (blueprint.persistenceNeeds.length) {
    for (const item of blueprint.persistenceNeeds) {
      const placement = persistencePlacement(
        item,
        preset,
        identity,
        astroPlan,
        blueprint.externalServices.some(service => service.credentialRequirement !== "none")
          || blueprint.domainData.some(data => data.storage === "secret"),
      )
      const memoryResident = /not written to disk/i.test(placement)
      const persistenceDecision = preset.id === "astro-web" && astroPlan?.usesContentCollections
        ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.enabledDecision
        : preset.id === "astro-web" && astroPlan?.browserPersistence
          ? preset.persistence.enabledDecision
          : memoryResident
            ? "Kept in memory for the session and not written to disk."
            : item.storage === "app-files"
            ? "Persistence: app-owned files kept in the app's own data folder."
            : item.storage === "document" && !isNativeMacPreset(preset.id)
            ? "Persistence: the document location the user chooses; the app keeps no copy."
            : /\bSQLite\b/.test(placement)
              ? preset.persistence.enabledDecision
              : /\bUserDefaults\b/.test(placement)
                ? "Persistence: lightweight settings in UserDefaults with versioned keys."
                : /open\/save panels|local filesystem/i.test(placement)
                  ? "Persistence: local filesystem at user-selected paths via native open and save panels."
                  : placement === ATOMIC_RENAME_SCRATCH_PLACEMENT
                    ? "Persistence: temporary same-directory write file for atomic replacement."
                    : item.temporary ? "Temporary recovery storage is enabled." : preset.persistence.enabledDecision
      contracts.push(contract(
        `CON-PERSISTENCE-${slug(item.data).toUpperCase()}`,
        "persistence",
        `${item.data} persistence`,
        dataFeatureIds(item.data, features),
        "OWN-DATA-STORE",
        `${persistenceDecision} ${item.purpose}`,
        [
          `Placement: ${placement}`,
          ...(item.writeMode === "atomic-replace" && !item.temporary && !memoryResident && documentWriteDetail(item.storage, placement, preset) ? [`Write mode: ${documentWriteDetail(item.storage, placement, preset)}`] : []),
          `Retention: ${item.retention}`,
          `Deletion: ${item.deletionBehavior}`,
          `Sensitivity: ${item.sensitivity}`,
        ],
        memoryResident ? "A failed update leaves the last in-memory state valid." : "A failed write leaves the prior durable state valid and the new state visibly unsaved.",
        memoryResident
          ? ["Keep the last in-memory value and allow an explicit retry.", item.deletionBehavior]
          : ["Retry through the same atomic boundary without duplicating the record.", item.deletionBehavior],
      ))
    }
  } else {
    contracts.push(contract(
      "CON-PERSISTENCE-DISABLED",
      "persistence",
      "Persistence disabled",
      features.map(feature => feature.id),
      lifecycleOwnerId,
      preset.persistence.disabledDecision,
      ["No application record repository is created."],
      "Unexpected persistence is a contract violation.",
      ["Remove the write path and rerun the persistence-disabled tests."],
    ))
  }

  for (const service of credentialServices) {
    contracts.push(contract(
      `CON-CREDENTIAL-${slug(service.name).toUpperCase()}`,
      "credential",
      `${service.name} credential`,
      integrationFeatureIds(service, features),
      "OWN-CREDENTIAL-VAULT",
      preset.credentialPlacement,
      [...credentialDetails(preset.id, identity, service.name, service.credentialRequirement), credentialEntryDetail(preset.id, service.name)],
      "Missing or rejected credentials block only the provider action and never expose stored values.",
      ["Accept a replacement credential through the same protected input boundary or select a configured service."],
    ))
  }

  for (const item of blueprint.permissionNeeds) {
    contracts.push(contract(
      `CON-PERMISSION-${slug(item.capability).toUpperCase()}`,
      "permission",
      `${item.capability} permission`,
      permissionFeatureIds(item, features),
      "OWN-PERMISSION-COORDINATOR",
      preset.permissionPatterns[item.capability],
      [`Purpose: ${item.purpose}`, `Denied behavior: ${item.deniedBehavior}`],
      item.deniedBehavior,
      ["Recheck authorization only after an explicit user action and preserve the documented denied path."],
    ))
  }

  contracts.push(contract(
    "CON-SECURITY-BOUNDARY",
    "security",
    "Privacy and security boundary",
    features.map(feature => feature.id),
    "OWN-PACKAGING",
    blueprint.privacySecurityRequirements.join(" "),
    blueprint.privacySecurityRequirements,
    "A privacy or security invariant failure stops the affected operation before data crosses the boundary.",
    ["Restore the last safe state and require explicit user action before retrying."],
  ))

  contracts.push(contract(
    "CON-PACKAGING-RELEASE",
    "packaging",
    `${preset.label} packaging`,
    features.map(feature => feature.id),
    "OWN-PACKAGING",
    preset.packagingRules.join(" "),
    [...preset.packagingRules, ...(isNativeMacPreset(preset.id) ? nativePackagingDetails(preset, identity, blueprint.platformNeeds) : []), `Installation: ${preset.installationDecision(identity)}`, `Output artifact: ${preset.outputArtifact}`],
    "A failed build, signature, package, install, or launch check blocks completion.",
    ["Fix the first failing validation command, rebuild the artifact, and rerun every later release gate."],
  ))

  contracts.push(contract(
    "CON-RUNTIME-WIRING",
    "packaging",
    "Runtime wiring",
    features.map(feature => feature.id),
    "OWN-PACKAGING",
    "The shipped app calls the real owners named in the contracts; test doubles never reach a production entry point.",
    preset.wiringRules,
    "A production entry point that uses a test double, or a platform owner the running app never calls, blocks completion.",
    ["Replace the stand-in with the concrete owner, rerun the packaging focused test, and repeat the launch check."],
  ))

  const beforePackaging = [...coreDrafts, ...integrationDrafts, ...featureDrafts]
  const dependencyIds = new Map(beforePackaging.map(draft => [draft.id, new Set(draft.dependencyIds)]))
  const addDependency = (ownerId: string, dependencyId: string) => {
    if (ownerId !== dependencyId && dependencyIds.has(ownerId) && dependencyIds.has(dependencyId)) dependencyIds.get(ownerId)!.add(dependencyId)
  }

  for (const feature of features) {
    for (const dependencyId of feature.requiredOwnerIds) addDependency(feature.ownerId, dependencyId)
  }
  for (const item of contracts) {
    if (["interface", "recovery", "security", "packaging"].includes(item.kind) || item.ownerId === "OWN-PACKAGING") continue
    for (const featureId of item.featureIds) {
      const featureOwnerId = features.find(feature => feature.id === featureId)?.ownerId
      if (featureOwnerId) addDependency(featureOwnerId, item.ownerId)
    }
  }
  for (const integration of contracts.filter(item => item.kind === "integration")) {
    const supportingOwners = contracts
      .filter(item => (item.kind === "credential" || item.kind === "permission") && item.featureIds.some(featureId => integration.featureIds.includes(featureId)))
      .map(item => item.ownerId)
    for (const ownerId of supportingOwners) addDependency(integration.ownerId, ownerId)
  }
  if (astroPlan?.sharedDynamicRoute && astroPlan.sharedDynamicRouteOwnerFeatureId) {
    const routeOwnerId = features.find(feature => feature.id === astroPlan.sharedDynamicRouteOwnerFeatureId)?.ownerId
    if (routeOwnerId) {
      for (const feature of features) {
        const placement = astroPlan.featurePlacements[feature.id]
        if (placement?.kind === "component" && placement.registrationFile === astroPlan.sharedDynamicRoute) {
          addDependency(feature.ownerId, routeOwnerId)
        }
      }
    }
  }

  const prepared = beforePackaging.map(draft => ({
    ...draft,
    dependencyIds: [...dependencyIds.get(draft.id)!].sort((left, right) => left.localeCompare(right)),
  }))
  const packagingDraft: OwnerDraft = {
    id: "OWN-PACKAGING",
    name: "Packaging",
    kind: "packaging",
    dependencyIds: prepared.map(draft => draft.id).sort((left, right) => left.localeCompare(right)),
  }
  return { ownerDrafts: [...prepared, packagingDraft], contracts }
}

function topologicalOwnerDrafts(drafts: readonly OwnerDraft[]): OwnerDraft[] {
  const ids = new Set(drafts.map(draft => draft.id))
  if (ids.size !== drafts.length) {
    throw graphFailure("graph.ids", "owners", "Owner IDs are not unique. Rename the conflicting semantic feature before rendering.")
  }
  for (const draft of drafts) {
    for (const dependencyId of draft.dependencyIds) {
      if (!ids.has(dependencyId)) {
        throw graphFailure("graph.references", draft.id, `Owner ${draft.id} references unknown dependency ${dependencyId}. Define the dependency owner before rendering.`)
      }
    }
  }
  const ordered: OwnerDraft[] = []
  const emitted = new Set<string>()
  while (ordered.length < drafts.length) {
    const next = drafts
      .filter(draft => !emitted.has(draft.id) && draft.dependencyIds.every(dependencyId => emitted.has(dependencyId)))
      .sort((left, right) => left.id.localeCompare(right.id))[0]
    if (!next) {
      const unresolved = drafts.filter(draft => !emitted.has(draft.id)).map(draft => draft.id).sort((left, right) => left.localeCompare(right)).join(", ")
      throw graphFailure("graph.cycles", "owners", `Owner dependency cycle prevents rendering: ${unresolved}. Remove one semantic capability or contract dependency to make the graph acyclic.`)
    }
    ordered.push(next)
    emitted.add(next.id)
  }
  return ordered
}

function buildPhases(
  preset: PresetContract,
  identity: ProjectIdentity,
  ownerDrafts: readonly OwnerDraft[],
  contracts: readonly GraphContract[],
  features: readonly GraphFeature[],
  requirements: readonly GraphRequirement[],
  acceptance: readonly GraphAcceptance[],
  astroPlan?: AstroRoutePlan,
  integrationServices: NormalizedBlueprint["externalServices"] = [],
  kitFoundationFiles: readonly string[] = [],
): { owners: GraphOwner[]; phases: GraphPhase[] } {
  const foundationFiles = unique([
    ...preset.sourceLayout(identity),
    ...kitFoundationFiles,
    ...(astroPlan?.foundationExtras ?? []),
    ...(astroPlan?.seedContentPaths ?? []),
  ])
  const foundationTest = foundationFiles.find(file => /(?:Tests|tests|test)\//.test(file) || /ContractTest/.test(file)) ?? foundationFiles[0]!
  const foundationCriteria = [
    "Every foundation file exists at the exact listed path.",
    `The locked identity is ${identity.bundleId}.`,
    `The implementation marker is ${preset.implementationMarker}.`,
    ...(preset.id === "astro-web" ? ASTRO_FOUNDATION_SCRIPT_REQUIREMENTS.map(script => `package.json defines npm run ${script}.`) : []),
  ]
  const foundationTask: GraphTask = {
    id: "TASK-01-FOUNDATION",
    title: "Create the locked project foundation",
    ownerIds: [],
    featureIds: [],
    requirementIds: [],
    contractIds: [],
    dependencies: [],
    filesToCreate: foundationFiles,
    filesToModify: [],
    focusedTests: [foundationTest],
    acceptanceIds: [],
    acceptanceCriteria: foundationCriteria,
    prompt: `Create the ${preset.label} foundation with identity ${identity.bundleId}. Use only the locked stack and create every listed file before any later task modifies it.${isNativeMacPreset(preset.id) ? ` ${identity.moduleName}App.swift must strictly declare the @main App scene entry and delegate all application state and commands to AppState.swift.` : ""}${preset.id === "astro-web" ? " package.json must define npm run check, test, test:a11y, build, and audit:performance before any later validation gate." : ""} Add a contract test that fails on stack or identity drift.`,
    validationCommands: [preset.validationCommands[0]!(identity)],
  }
  const phases: GraphPhase[] = [{ id: "PHASE-01-FOUNDATION", title: "Locked foundation", dependencies: [], tasks: [foundationTask] }]
  const owners: GraphOwner[] = []
  const orderedDrafts = topologicalOwnerDrafts(ownerDrafts)
  const coordinates = new Map(orderedDrafts.map((draft, index) => {
    const sequence = index + 2
    const suffix = draft.id.replace(/^OWN-/, "")
    return [draft.id, {
      phaseId: `PHASE-${String(sequence).padStart(2, "0")}-${suffix}`,
      taskId: `TASK-${String(sequence).padStart(2, "0")}-${suffix}`,
    }] as const
  }))

  orderedDrafts.forEach(draft => {
    const { phaseId, taskId } = coordinates.get(draft.id)!
    const ownerSlug = draft.kind === "integration"
      ? slug(draft.id.replace(/^OWN-INTEGRATION-/, ""))
      : slug(draft.name)
    const ownedFeature = features.find(feature => feature.ownerId === draft.id)
    const placement = ownedFeature && astroPlan ? astroPlan.featurePlacements[ownedFeature.id] : undefined
    const integrationService = draft.kind === "integration"
      ? integrationServices.find(service => `OWN-INTEGRATION-${slug(service.name).toUpperCase()}` === draft.id)
      : undefined
    const files = preset.ownerFiles({
      kind: draft.kind,
      slug: ownerSlug,
      pascalName: draft.name,
      identity,
      serverIntegration: integrationService?.credentialRequirement !== "none",
      pageFile: placement?.kind === "page" ? placement.pageFile : undefined,
    })
    const ownedContracts = contracts.filter(item => item.ownerId === draft.id)
    const contractIds = ownedContracts.map(item => item.id)
    const ownedFeatures = features.filter(feature => feature.ownerId === draft.id)
    const ownedFeatureIds = ownedFeatures.map(feature => feature.id)
    const ownedAcceptance = acceptance.filter(item => item.ownerId === draft.id)
    const routeExtras = placement?.kind === "page" && placement.pageFile !== files.implementationFile ? [placement.pageFile] : []
    const filesToCreate = unique([
      files.implementationFile,
      files.focusedTestFile,
      ...routeExtras,
      ...(draft.kind === "packaging" ? preset.packagingFiles(identity) : []),
    ])
    const registrationTarget = placement?.registrationFile ?? preset.registrationFile(draft.kind, identity)
    // The packaging task verifies runtime wiring, so it may fix the composition roots it checks.
    const filesToModify = draft.kind === "packaging"
      ? unique([preset.registrationFile("feature", identity), preset.registrationFile("integration", identity), ...(preset.wiringManifestFiles ?? [])])
      : [registrationTarget]
    const acceptanceCriteria = buildTaskAcceptanceCriteria(ownedAcceptance, ownedContracts, [files.focusedTestFile])
    const task: GraphTask = {
      id: taskId,
      title: `Implement ${draft.name}`,
      ownerIds: [draft.id],
      featureIds: ownedFeatureIds,
      requirementIds: requirements.filter(requirement => ownedFeatureIds.includes(requirement.featureId)).map(requirement => requirement.id),
      contractIds,
      dependencies: unique([foundationTask.id, ...draft.dependencyIds.map(dependencyId => coordinates.get(dependencyId)!.taskId)]),
      filesToCreate,
      filesToModify,
      focusedTests: [files.focusedTestFile],
      acceptanceIds: ownedAcceptance.map(item => item.id),
      acceptanceCriteria,
      prompt: `Implement owner ${draft.id} (${draft.name}) in ${files.implementationFile} and its real focused checks in ${files.focusedTestFile}. Cover direct features ${ownedFeatureIds.join(", ") || "none"} and owned contracts ${contractIds.join(", ")}. Depend only on ${draft.dependencyIds.join(", ") || "the locked foundation"}; implement every documented decision, failure, cancellation, cleanup, and recovery branch. Create only ${filesToCreate.join("; ")}${filesToModify.length ? ` and modify only ${filesToModify.join("; ")} after its foundation creation` : " and modify no pre-existing source file"}.`,
      validationCommands: [files.focusedTestCommand, ...preset.validationCommands.slice(0, 2).map(command => command(identity))],
    }
    phases.push({ id: phaseId, title: draft.name, dependencies: unique(["PHASE-01-FOUNDATION", ...draft.dependencyIds.map(dependencyId => coordinates.get(dependencyId)!.phaseId)]), tasks: [task] })
    owners.push({
      ...draft,
      featureIds: ownedFeatureIds,
      contractIds,
      implementationFile: files.implementationFile,
      focusedTestFile: files.focusedTestFile,
      focusedTestCommand: files.focusedTestCommand,
      createPhaseId: phaseId,
      modifyPhaseIds: [],
    })
  })

  return { owners, phases }
}

function deriveLockedStack(
  preset: PresetContract,
  blueprint: NormalizedBlueprint,
  credentialServices: readonly NormalizedBlueprint["externalServices"][number][],
  contracts: readonly GraphContract[],
): readonly string[] {
  if (!isNativeMacPreset(preset.id)) return preset.allowedTechnologies
  const hasCredentials = credentialServices.length > 0 || blueprint.domainData.some(d => d.storage === "secret")
  const hasSqlite = blueprint.persistenceNeeds.some(p => p.storage === "records")
  const hasLogin = blueprint.platformNeeds.includes("launch-at-login") || blueprint.platformNeeds.includes("background-execution")
  const usesApplicationSupport = hasSqlite || contracts.some(item => item.kind === "persistence" && item.details.some(detail => /Application Support/.test(detail.replace(/never in [^.;]*Application Support/g, ""))))
  return preset.allowedTechnologies.filter(tech => {
    if (tech === "Keychain" && !hasCredentials) return false
    if (tech === "SQLite3" && !hasSqlite) return false
    if (tech === "SMAppService" && !hasLogin) return false
    if (tech === "Application Support" && !usesApplicationSupport) return false
    return true
  })
}

export function compileProjectGraph(blueprint: NormalizedBlueprint, presetId: PresetId): ProjectGraph {
  const preset = PRESETS[presetId]
  if (!preset) throw new Error(`Unknown preset: ${String(presetId)}`)
  const identity = projectIdentity(blueprint.projectName)
  const featureIds = allocateStableIds("FEAT", blueprint.features.map(feature => feature.name))
  const resolvedFeatures = resolveRequiredOwners(blueprint.features.map((feature, index): GraphFeature => {
    const rawOwnerId = `OWN-${featureIds[index]!.replace(/^FEAT-/, "")}`
    const reservedOwners = new Set([
      "OWN-CREDENTIAL-VAULT",
      "OWN-DATA-STORE",
      "OWN-PERMISSION-COORDINATOR",
      "OWN-LIFECYCLE-COORDINATOR",
      "OWN-PACKAGING",
    ])
    const ownerId = reservedOwners.has(rawOwnerId) || rawOwnerId.startsWith("OWN-INTEGRATION-")
      ? `${rawOwnerId}-FEATURE`
      : rawOwnerId
    return {
      id: featureIds[index]!,
      name: feature.name,
      ownerId,
      behavior: feature.behavior,
      inputs: feature.inputs,
      outputs: feature.outputs,
      acceptanceOutcomes: feature.acceptanceOutcomes,
      failureBehavior: feature.failureBehavior,
      recoveryExpectations: feature.recoveryExpectations,
      providedCapabilities: feature.providedCapabilities,
      requiredCapabilities: feature.requiredCapabilities,
      resourceIds: feature.resourceIds,
      requiredOwnerIds: [],
      choices: feature.choices,
      surface: feature.surface,
    }
  }))
  const { features, acceptance, requirements } = lowerAcceptanceOwnership(resolvedFeatures)
  const mode = preset.runtimeMode(blueprint)
  const astroPlan = presetId === "astro-web" ? planAstroWeb(blueprint, features, mode) : undefined

  const integrationServices = compilerIntegrationServices(blueprint)
  const { ownerDrafts, contracts } = buildOwnersAndContracts(blueprint, preset, identity, features, astroPlan, integrationServices)
  // Kit files no other owner claims belong to the foundation, so the "create only" lists stay exact.
  const kitPaths = kitProjectPaths(presetKit(presetId, identity, blueprint))
  const packagingOwned = new Set(["Scripts/package_app.sh", ...preset.packagingFiles(identity)])
  const kitFoundationFiles = kitPaths.filter(path => !preset.sourceLayout(identity).includes(path) && !packagingOwned.has(path))
  const { owners, phases } = buildPhases(preset, identity, ownerDrafts, contracts, features, requirements, acceptance, astroPlan, integrationServices, kitFoundationFiles)
  const persistenceEnabled = blueprint.persistenceNeeds.length > 0
  const declaredStorage = new Set(blueprint.persistenceNeeds.map(p => p.storage))
  const isDocNativeMac = isNativeMacPreset(presetId) && !declaredStorage.has("records")
  const nativeStores = isNativeMacPreset(presetId) ? nativePersistenceStores(declaredStorage) : []
  const persistenceDecision = persistenceEnabled
    ? astroPlan?.usesContentCollections
      ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.enabledDecision
      : astroPlan?.browserPersistence
        ? preset.persistence.enabledDecision
        : nativeStores.length
          ? `Persistence: enabled with ${joinWithAnd(nativeStores)}.`
          : isDocNativeMac
          ? "Persistence: enabled with UserDefaults for lightweight settings and local filesystem at user-selected paths for document storage."
          : preset.persistence.enabledDecision
    : preset.persistence.disabledDecision
  const persistenceSettings = astroPlan?.usesContentCollections
    ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.settingsPlacement
    : preset.persistence.settingsPlacement
  const persistenceRecords = astroPlan?.usesContentCollections
    ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.recordsPlacement.replace("{collection}", astroPlan.contentCollection)
    : isDocNativeMac
      ? declaredStorage.has("document") || !declaredStorage.has("app-files")
        ? USER_SELECTED_FILE_PLACEMENT
        : "No record collection is declared."
      : preset.persistence.recordsPlacement
  // Read back from the rendered contract so the summary always matches the per-object placement.
  const appFilesData = blueprint.persistenceNeeds.find(p => p.storage === "app-files")?.data
  const appFilesPlacement = appFilesData
    ? contracts.find(item => item.kind === "persistence" && item.name === `${appFilesData} persistence`)?.details.find(detail => detail.startsWith("Placement: "))?.slice("Placement: ".length)
    : undefined

  const effectiveIntegrationBoundary = integrationServices.length === 0 && !blueprint.platformNeeds.includes("network")
    ? "Standalone local application: no remote network endpoints, cloud credentials, or third-party web services are used."
    : preset.integrationBoundary

  const graph: ProjectGraph = {
    blueprint,
    presetId,
    presetLabel: preset.label,
    identity,
    runtimeMode: mode,
    features,
    acceptance,
    requirements,
    contracts,
    owners,
    phases,
    foundationFiles: unique([...preset.sourceLayout(identity), ...kitFoundationFiles, ...(astroPlan?.foundationExtras ?? []), ...(astroPlan?.seedContentPaths ?? [])]),
    kitPaths,
    lockedStack: deriveLockedStack(preset, blueprint, integrationServices.filter(s => s.credentialRequirement !== "none"), contracts),
    forbiddenTechnologies: preset.forbiddenTechnologies,
    testFramework: preset.testFramework,
    persistence: {
      enabled: persistenceEnabled,
      decision: persistenceDecision,
      settingsPlacement: persistenceSettings,
      recordsPlacement: persistenceRecords,
      ...(appFilesPlacement ? { appFilesPlacement } : {}),
    },
    signingDecision: preset.signingDecision(identity),
    installationDecision: preset.installationDecision(identity),
    validationCommands: preset.validationCommands.map(command => command(identity)),
    packagingRules: preset.packagingRules,
    lifecycleRules: preset.lifecycleRules,
    accessibilityRules: preset.accessibilityRules,
    runtimeArchitecture: preset.runtimeArchitecture,
    integrationBoundary: effectiveIntegrationBoundary,
    recoveryRules: preset.recoveryRules,
    outputArtifact: preset.outputArtifact,
    artifactPath: preset.artifactPath(identity),
    completionEvidence: preset.completionEvidence,
    astroPlan,
  }
  assertGraphReadyForRendering(graph)
  return graph
}

export function assertGraphReadyForRendering(graph: ProjectGraph): void {
  const firstFailure = auditProjectGraph(graph)[0]
  if (firstFailure) throw new GraphConstructionError(firstFailure)
}

async function sha256(content: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(content))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("")
}

async function hashDocuments(documents: DocumentPacket): Promise<DocumentHashes> {
  const entries = await Promise.all(DOCUMENT_NAMES.map(async name => [name, await sha256(documents[name])] as const))
  return Object.fromEntries(entries) as Record<DocumentName, string>
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  }
  return value
}

export type LocalCompileStage = "preset-compiler" | "mechanical-audit" | "agent-readiness-audit" | "rendering" | "export-gate"

export async function compileNormalizedPacket(
  blueprint: NormalizedBlueprint,
  presetId: PresetId,
  onProgress?: (stage: LocalCompileStage) => void,
): Promise<CompiledPacket> {
  onProgress?.("preset-compiler")
  const graph = compileProjectGraph(blueprint, presetId)
  onProgress?.("mechanical-audit")
  const mechanicalIssues = auditMechanicalGraph(graph)
  onProgress?.("agent-readiness-audit")
  const readinessIssues = auditAgentReadinessGraph(graph)
  onProgress?.("rendering")
  const documents = renderPacket(graph)
  const repeatedDocuments = renderPacket(graph)
  onProgress?.("export-gate")
  const packetIssues = auditPacket(graph, documents, PRESETS[presetId])
  const renderIssues: AuditFailure[] = DOCUMENT_NAMES
    .filter(name => repeatedDocuments[name] !== documents[name])
    .map(name => ({ rule: "render.deterministic", path: name, message: `${name} changed across repeated local rendering.` }))
  const hashes = await hashDocuments(documents)
  const kit = await Promise.all(presetKit(presetId, graph.identity, graph.blueprint)
    .map(async file => ({ name: `kit/${file.path}`, content: file.content, sha256: await sha256(file.content) })))
  const failures = [...mechanicalIssues, ...readinessIssues, ...renderIssues, ...packetIssues]
  const ledger = buildValidationLedger(failures)
  return deepFreeze({
    presetId,
    projectSlug: graph.identity.slug,
    graph,
    documents,
    hashes,
    kit,
    ledger,
    failures,
    exportable: failures.length === 0,
  })
}

export function compilePacket(blueprint: SemanticBlueprint, presetId: PresetId): Promise<CompiledPacket> {
  return compileNormalizedPacket(normalizeBlueprint(blueprint, presetId), presetId)
}

export function packetForExport(packet: CompiledPacket): readonly ExportFile[] {
  if (!packet.exportable) return []
  return [
    ...DOCUMENT_NAMES.map(name => ({ name, content: packet.documents[name], sha256: packet.hashes[name] })),
    ...packet.kit,
  ]
}

// The validated provider blueprint, exported as blueprint.json so audits see exactly what was declared.
export async function blueprintExportFile(blueprint: SemanticBlueprint): Promise<ExportFile> {
  const content = `${JSON.stringify(blueprint, null, 2)}\n`
  return { name: BLUEPRINT_FILE_NAME, content, sha256: await sha256(content) }
}

export const BLUEPRINT_FILE_NAME = "blueprint.json"

export async function verifyPacketHashes(packet: CompiledPacket): Promise<boolean> {
  const current = await hashDocuments(packet.documents)
  const kitHashes = await Promise.all(packet.kit.map(file => sha256(file.content)))
  return DOCUMENT_NAMES.every(name => current[name] === packet.hashes[name])
    && packet.kit.every((file, index) => kitHashes[index] === file.sha256)
}
