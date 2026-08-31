import { auditAgentReadinessGraph, auditMechanicalGraph, auditPacket, auditProjectGraph, buildValidationLedger, type AuditEntry, type AuditFailure } from "./audit"
import { ASTRO_CONTENT_COLLECTION_PERSISTENCE, ASTRO_FOUNDATION_SCRIPT_REQUIREMENTS, planAstroWeb, type AstroRoutePlan } from "./astroWeb"
import { PRESETS, type OwnerKind, type PermissionCapability, type PresetContract, type PresetId, type PresetRuntimeMode, type ProjectIdentity } from "./presets"
import { renderPacket } from "./renderers"
import { SUPPORTED_IMPORTED_AUDIO_FORMATS, TranscriptionRoutingSchema, type PlatformNeed, type SemanticBlueprint, type SemanticIssue, type TranscriptionRouting } from "./schema"
import { buildTaskAcceptanceCriteria } from "./taskAcceptance"

export const DOCUMENT_NAMES = ["PRD.md", "ARD.md", "TRD.md", "TASKS.md", "AGENTS.md"] as const
export type DocumentName = (typeof DOCUMENT_NAMES)[number]
export type ContractKind = "interface" | "data" | "integration" | "lifecycle" | "persistence" | "credential" | "permission" | "recovery" | "security" | "packaging"

export interface DeepgramLiveMicrophoneContract {
  readonly providerName: string
  readonly contractId: string
  readonly endpoint: string
  readonly model: string
  readonly authorizationScheme: string
  readonly encoding: string
  readonly sampleRateHz: number
  readonly channels: number
  readonly frameFormat: string
  readonly transport: string
  readonly connectionTimeoutSeconds: number
  readonly resourceTimeoutMinutes: number
  readonly clientMessages: readonly string[]
  readonly serverEvents: readonly string[]
  readonly finalityField: string
  readonly failureMapping: "privacy-safe"
  readonly cancellation: "discard-late-events"
  readonly recoveryActions: readonly string[]
  readonly automaticPaidRetry: false
}

export interface TemporaryAudioLifecycle {
  readonly scope: "active-request-only"
  readonly recoverableRetention: "await-explicit-retry-or-provider-switch"
  readonly deletionTriggers: readonly string[]
  readonly savedRecording: "explicit-user-action-only"
  readonly completedOutput: "accepted-success-only"
}

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
  }[]
  readonly externalServices: readonly {
    readonly name: string
    readonly purpose: string
    readonly dataSent: readonly string[]
    readonly credentialRequirement: "none" | "api-key"
    readonly failureBehavior: string
    readonly recovery: string
  }[]
  readonly transcriptionRouting?: TranscriptionRouting
  readonly deepgramLiveContract?: DeepgramLiveMicrophoneContract
  readonly temporaryAudioLifecycle?: TemporaryAudioLifecycle
  readonly domainData: readonly {
    readonly name: string
    readonly meaning: string
    readonly retention: string
    readonly sensitivity: "public" | "internal" | "personal" | "sensitive"
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
  readonly lockedStack: readonly string[]
  readonly forbiddenTechnologies: readonly string[]
  readonly testFramework: string
  readonly persistence: {
    readonly enabled: boolean
    readonly decision: string
    readonly settingsPlacement: string
    readonly recordsPlacement: string
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
  readonly ledger: readonly AuditEntry[]
  readonly failures: readonly AuditFailure[]
  readonly exportable: boolean
}

export interface ExportFile {
  readonly name: DocumentName
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

function pascal(value: string): string {
  const result = slug(value).split("-").filter(Boolean).map(part => part[0]!.toUpperCase() + part.slice(1)).join("")
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
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "")
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
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^\s*[:;,.-]+\s*|\s*[:;,-]+\s*$/g, "")
    .trim()
}

function cleanList(values: readonly string[]): string[] {
  return uniqueStrings(values.map(cleanMeaning).filter(Boolean))
}

function isCredentialData(value: string): boolean {
  return /\b(?:api[- ]?keys?|credentials?|secrets?|access tokens?)\b/i.test(value.replace(/\bnon[- ]secret\b/gi, ""))
}

const NATIVE_INSERTION_CAPABILITY = "CAP-NATIVE-INSERTION"

function providesNativeInsertion(name: string, behavior: string): boolean {
  return /\b(?:paste-back|auto-paste|insertion|insert(?:ion)? behavior|clipboard handling)\b/i.test(name)
    || (/\b(?:insert|paste)\b/i.test(behavior) && /\b(?:target application|focused application|clipboard|preview mode)\b/i.test(behavior))
}

function requiresNativeInsertion(value: string): boolean {
  return /\b(?:insert(?:ed|ion)?|paste(?:d|back)?|target application|target text field)\b/i.test(value)
}

function transcriptionLike(value: string): boolean {
  return /\b(?:transcri(?:be|bes|bed|bing|ption)|speech[- ]to[- ]text|dictat(?:e|es|ed|ing|ion))\b/i.test(value)
}

function importedAudioTranscriptionLike(value: string): boolean {
  return transcriptionLike(value) && /\b(?:audio|recorded)\b[^.\n]{0,80}\bfiles?\b|\bfiles?\b[^.\n]{0,80}\b(?:audio|recorded)\b/i.test(value)
}

function liveTranscriptionLike(value: string): boolean {
  return transcriptionLike(value)
    && !importedAudioTranscriptionLike(value)
    && /\b(?:live|stream(?:ing)?)\b/i.test(value)
    && /\b(?:microphone|capture[sd]?|record(?:s|ed|ing)?)\b/i.test(value)
}

function streamingTranscriptionServiceLike(value: string): boolean {
  return transcriptionLike(value) && /\b(?:live|stream(?:ing)?|microphone)\b/i.test(value)
}

function batchTranscriptionServiceLike(value: string): boolean {
  return transcriptionLike(value) && !streamingTranscriptionServiceLike(value) && /\b(?:audio|batch|file|finalized|speech[- ]to[- ]text)\b/i.test(value)
}

function providerLabel(name: string): string {
  if (/\bdeepgram\b/i.test(name)) return "Deepgram"
  if (/\bopenrouter\b/i.test(name)) return "OpenRouter"
  return name
}

const nativeInsertionBehavior = "After one successful final transcription and optional successful refinement, choose exactly one complete insertion candidate and apply the configured auto-paste, copy-only, or preview mode through the deterministic native macOS insertion contract; never insert partial, empty, failed, cancelled, or unapproved text."

const nativeInsertionAcceptance = [
  "Direct Accessibility insertion writes one approved complete candidate without touching the clipboard",
  "Command-V fallback restores the clipboard only when its app-owned changeCount is unchanged",
  "A newer external clipboard value is never overwritten",
  "Preview mode requires explicit approval and cancellation inserts nothing",
  "Copy-only mode leaves the complete transcript on the clipboard without restoration",
  "Partial, empty, failed, cancelled, and unapproved text is never inserted",
]

export const DEEPGRAM_LIVE_MICROPHONE_CONTRACT: DeepgramLiveMicrophoneContract = Object.freeze({
  providerName: "Deepgram Nova streaming transcription",
  contractId: "CON-INTEGRATION-DEEPGRAM-NOVA-STREAMING-TRANSCRIPTION",
  endpoint: "wss://api.deepgram.com/v1/listen",
  model: "nova-3",
  authorizationScheme: "Token",
  encoding: "linear16",
  sampleRateHz: 16_000,
  channels: 1,
  frameFormat: "raw binary WebSocket frames",
  transport: "URLSessionWebSocketTask",
  connectionTimeoutSeconds: 15,
  resourceTimeoutMinutes: 30,
  clientMessages: Object.freeze(["KeepAlive", "Finalize", "CloseStream"]),
  serverEvents: Object.freeze(["Results", "SpeechStarted", "UtteranceEnd", "Metadata"]),
  finalityField: "is_final",
  failureMapping: "privacy-safe",
  cancellation: "discard-late-events",
  recoveryActions: Object.freeze(["explicit retry", "explicit provider switch"]),
  automaticPaidRetry: false,
})

export const TEMPORARY_AUDIO_LIFECYCLE: TemporaryAudioLifecycle = Object.freeze({
  scope: "active-request-only",
  recoverableRetention: "await-explicit-retry-or-provider-switch",
  deletionTriggers: Object.freeze(["accepted success", "explicit discard", "cancellation", "unrecoverable malformed audio", "exhausted recovery"]),
  savedRecording: "explicit-user-action-only",
  completedOutput: "accepted-success-only",
})

export function temporaryAudioLifecycleStatements(lifecycle: TemporaryAudioLifecycle = TEMPORARY_AUDIO_LIFECYCLE): readonly string[] {
  const deletionTriggers = lifecycle.deletionTriggers
    .map((trigger, index) => index === lifecycle.deletionTriggers.length - 1 ? `or ${trigger}` : trigger)
    .join(", ")
  return [
    lifecycle.scope === "active-request-only" ? "Audio exists only for the active request." : "",
    lifecycle.recoverableRetention === "await-explicit-retry-or-provider-switch" ? "After a recoverable provider failure, temporary audio may be retained only while awaiting an explicit retry or explicit provider switch." : "",
    `${deletionTriggers[0]?.toUpperCase() ?? ""}${deletionTriggers.slice(1)} deletes temporary audio and verifies absence.`,
    lifecycle.savedRecording === "explicit-user-action-only" ? "Saved recordings survive only after explicit user action." : "",
    lifecycle.completedOutput === "accepted-success-only" ? "Incomplete, failed, cancelled, or partial text is never pasted or persisted as completed output." : "",
  ]
}

function temporaryAudioLifecycleText(lifecycle: TemporaryAudioLifecycle = TEMPORARY_AUDIO_LIFECYCLE): string {
  return temporaryAudioLifecycleStatements(lifecycle).join(" ")
}

export function temporaryAudioLifecycleContractValues(
  audio: TemporaryAudioLifecycle = TEMPORARY_AUDIO_LIFECYCLE,
): Pick<GraphContract, "decision" | "details" | "failureBehavior" | "recovery"> {
  const statements = temporaryAudioLifecycleStatements(audio)
  return {
    decision: statements[0]!,
    details: statements.slice(1),
    failureBehavior: "A cleanup failure keeps the operation incomplete, exposes a privacy-safe local error, and never claims that temporary audio or incomplete text was removed or completed.",
    recovery: ["Retry cleanup explicitly, verify absence before reporting success, and retain no audio beyond the canonical active-request lifecycle."],
  }
}

function temporaryAudioSubject(value: string): boolean {
  return /\b(?:audio|recording)\b/i.test(value)
    && /\b(?:temporary|temporarily|active request|current request|recoverable|retry|provider switch|sav(?:e|es|ed|ing))\b/i.test(value)
}

function temporaryAudioLifecycleClaim(value: string): boolean {
  return temporaryAudioSubject(value)
    && /\b(?:retain|retained|preserv(?:e|ed)|delet(?:e|ed)|discard|cancel|completion|success|failure|recovery|save|saved)\b/i.test(value)
}

function canonicalizeTemporaryAudioMeaning(value: string, lifecycle?: TemporaryAudioLifecycle): string {
  const cleaned = cleanMeaning(value)
  return lifecycle && temporaryAudioLifecycleClaim(cleaned) ? temporaryAudioLifecycleText(lifecycle) : cleaned
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

function deriveTranscriptionRouting(
  features: readonly NormalizedBlueprint["features"][number][],
  services: readonly NormalizedBlueprint["externalServices"][number][],
): TranscriptionRouting | undefined {
  const featureMeaning = (feature: NormalizedBlueprint["features"][number]) => [feature.name, feature.behavior, ...feature.inputs, ...feature.outputs].join(" ")
  const serviceMeaning = (service: NormalizedBlueprint["externalServices"][number]) => [service.name, service.purpose, ...service.dataSent].join(" ")
  const liveFeatures = features.filter(feature => liveTranscriptionLike(featureMeaning(feature)))
  const importedFeatures = features.filter(feature => importedAudioTranscriptionLike(featureMeaning(feature)))
  const liveService = services.find(service => streamingTranscriptionServiceLike(serviceMeaning(service)))
  const importedService = services.find(service => batchTranscriptionServiceLike(serviceMeaning(service)))
  if (!liveFeatures.length || !importedFeatures.length || !liveService || !importedService) return undefined

  return TranscriptionRoutingSchema.parse({
    liveFeatureNames: liveFeatures.map(feature => feature.name),
    importedFeatureNames: importedFeatures.map(feature => feature.name),
    liveProviderName: providerLabel(liveService.name),
    importedProviderName: providerLabel(importedService.name),
    supportedImportedFormats: [...SUPPORTED_IMPORTED_AUDIO_FORMATS],
    maxImportedDurationSeconds: 60,
    maxImportedPayloadBytes: 25_000_000,
    overLimitBehavior: "reject-before-paid-upload",
    audioRewriteBehavior: "forbidden",
  })
}

const supportedImportedAudioFormats = "wav, mp3, flac, m4a, ogg, webm, and aac"

function liveTranscriptionBehavior(routing: TranscriptionRouting): string {
  return `${routing.liveProviderName} WebSocket streaming is exclusively for live microphone audio; it accepts microphone PCM from the live capture path and never accepts imported audio files.`
}

function importedTranscriptionBehavior(routing: TranscriptionRouting): string {
  return `Imported audio-file transcription uses the configured batch/file-capable provider, ${routing.importedProviderName}. Supported imported formats are ${supportedImportedAudioFormats}. Inspect the format, duration, and payload size locally before loading the audio content or constructing a provider request. Reject unsupported files and files exceeding 60 seconds or 25 MB (25,000,000 bytes) before any paid upload with clear user guidance and create no provider request. Do not split, chunk, transcode, or stitch long files unless a future preset explicitly defines that behavior.`
}

function importedTranscriptionFailure(): string {
  return "Reject an unsupported, unreadable, longer-than-60-seconds, or larger-than-25-MB imported file locally with clear user guidance before any paid upload; create no provider request and leave existing transcripts unchanged."
}

function importedTranscriptionRecovery(): string {
  return "Release local inspection resources, preserve the last valid state, and let the user select a supported file within the locked duration and payload limits."
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
  "background-execution": "background-startup",
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
  clipboard: "Read or write clipboard content only for the explicit user action and preserve prior content when promised.",
  "background-startup": "Run bounded background or login behavior only after the user enables it.",
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
  clipboard: "Keep the result visible for manual copy or paste without replacing prior content.",
  "background-startup": "Keep manual launch and foreground behavior available.",
}

const permissionFeaturePatterns: Readonly<Record<PermissionCapability, RegExp>> = {
  microphone: /\b(?:microphone|audio capture|record(?:ing|ed)?|dictat(?:e|ion)|speech[- ]to[- ]text)\b/i,
  accessibility: /\b(?:accessibility|AXUIElement|focused application|target application|insert(?:ion|ed)?|auto-paste)\b/i,
  notifications: /\b(?:notification|alert|reminder)\b/i,
  filesystem: /\b(?:file|folder|filesystem|document|import|export)\b/i,
  network: /\b(?:network|provider|remote|cloud|request|stream(?:ing)?)\b/i,
  camera: /\b(?:camera|photo|video capture)\b/i,
  location: /\b(?:location|position|map|geolocation)\b/i,
  "global-input": /\b(?:global hotkey|system-wide shortcut|push-to-talk|toggle recording|input monitoring)\b/i,
  clipboard: /\b(?:clipboard|copy(?:-only)?|paste(?:-back|d)?|insert(?:ion|ed)?)\b/i,
  "background-startup": /\b(?:background|launch[- ]at[- ]login|login (?:item|preference|behavior|launch)|startup|scheduled)\b/i,
}

function permissionResourceId(capability: PermissionCapability): string {
  return `permission:${capability}`
}

const dataResourceCategories = [
  ["credential", /\b(?:api[- ]?keys?|credentials?|secrets?|access tokens?)\b/i],
  ["temporary-audio", /\b(?:temporary|recoverable|active request)\b[^.\n]{0,80}\b(?:audio|recording)\b|\b(?:audio|recording)\b[^.\n]{0,80}\b(?:temporary|recoverable|active request)\b/i],
  ["history", /\b(?:history|past transcriptions?|records?)\b/i],
  ["settings", /\b(?:settings?|preferences?|configuration|hotkeys?|shortcuts?|launch at login)\b/i],
  ["mode", /\b(?:dictation modes?|custom modes?|tone|formatting instructions)\b/i],
  ["vocabulary", /\b(?:vocabulary|replacement rules?|technical terms?)\b/i],
  ["usage", /\b(?:usage|cost|billing)\b/i],
] as const

function dataResourceIds(name: string, meaning: string): string[] {
  const text = `${name} ${meaning}`
  return unique([
    `data:${slug(name)}`,
    ...dataResourceCategories.filter(([, pattern]) => pattern.test(text)).map(([category]) => `data-category:${category}`),
  ])
}

function serviceResourceIds(name: string, purpose: string): string[] {
  const text = `${name} ${purpose}`
  if (/\bdeepgram\b/i.test(text)) return ["service:deepgram-live-transcription"]
  if (/\bopenrouter\b/i.test(text)) {
    const ids: string[] = []
    if (/\b(?:speech[- ]to[- ]text|transcri(?:be|ption)|audio)\b/i.test(text)) ids.push("service:openrouter-transcription")
    if (/\b(?:refin(?:e|ement)|language model|rewrite|formatting|translation)\b/i.test(text)) ids.push("service:openrouter-refinement")
    return ids.length ? ids : ["service:openrouter"]
  }
  return [`service:${slug(name)}`]
}

function deriveFeatureResourceIds(
  feature: NormalizedBlueprint["features"][number],
  sourceMeaning: string,
  dataObjects: readonly { readonly name: string; readonly purpose: string }[],
  services: readonly NormalizedBlueprint["externalServices"][number][],
  routing: TranscriptionRouting | undefined,
): string[] {
  const resources = Object.entries(permissionFeaturePatterns)
    .filter(([, pattern]) => pattern.test(sourceMeaning))
    .map(([capability]) => permissionResourceId(capability as PermissionCapability))

  for (const item of dataObjects) {
    const exactName = cleanMeaning(item.name).toLocaleLowerCase("en-US")
    const categories = dataResourceIds(item.name, item.purpose).filter(id => id.startsWith("data-category:"))
    if ((exactName && sourceMeaning.toLocaleLowerCase("en-US").includes(exactName))
      || categories.some(id => dataResourceCategories.find(([category]) => id === `data-category:${category}`)?.[1].test(sourceMeaning))) {
      resources.push(...dataResourceIds(item.name, item.purpose))
    }
  }

  for (const service of services) {
    const ids = serviceResourceIds(service.name, service.purpose)
    const exactProvider = providerLabel(service.name).toLocaleLowerCase("en-US")
    const routed = routing?.liveFeatureNames.includes(feature.name) && ids.includes("service:deepgram-live-transcription")
      || routing?.importedFeatureNames.includes(feature.name) && ids.includes("service:openrouter-transcription")
    const roleMatch = ids.includes("service:openrouter-refinement") && /\b(?:refin(?:e|ement)|rewrite|format|translate|language model)\b/i.test(sourceMeaning)
      || ids.includes("service:openrouter-transcription") && importedAudioTranscriptionLike(sourceMeaning)
      || ids.includes("service:deepgram-live-transcription") && liveTranscriptionLike(sourceMeaning)
    if (routed || roleMatch || (exactProvider && sourceMeaning.toLocaleLowerCase("en-US").includes(exactProvider))) resources.push(...ids)
  }

  return unique(resources)
}

function deriveProblemStatement(targetUsers: readonly string[], goals: readonly string[], nonGoals: readonly string[]): string {
  const audience = targetUsers[0] ?? "Users"
  const primaryGoal = goals[0] ?? "achieve the documented outcomes"
  const avoided = nonGoals[0] ?? "unnecessary scope expansion"
  const goalText = primaryGoal.endsWith(".") ? primaryGoal.slice(0, -1) : primaryGoal
  const avoidText = avoided.endsWith(".") ? avoided.slice(0, -1) : avoided
  return `${audience} need a focused way to ${goalText.charAt(0).toLowerCase()}${goalText.slice(1)} without ${avoidText.charAt(0).toLowerCase()}${avoidText.slice(1)}.`
}

function astroContentSiteSemantics(source: SemanticBlueprint, presetId: PresetId): boolean {
  if (presetId !== "astro-web") return false
  const runtimeWouldBeStatic = !source.externalServices.some(service => service.credentialRequired)
  if (!runtimeWouldBeStatic) return false
  if (source.dataObjects.some(item => item.sensitivity === "public" || item.sensitivity === "internal")) return true
  return source.features.some(feature => /\b(?:detail|project page|guide page|catalog|portfolio|versioned guide|direct url|permalink)\b/i.test(`${feature.name} ${feature.behavior}`))
    || /\b(?:catalog|catalogue|portfolio|documentation portal|project listing)\b/i.test(source.summary)
}

function normalizationIssue(path: string): never {
  throw new NormalizationError([{ path, rule: "normalization.unusable-meaning", message: "Provider mechanics left no usable product meaning at this path." }])
}

export function normalizeBlueprint(source: SemanticBlueprint, presetId: PresetId): NormalizedBlueprint {
  if (!PRESETS[presetId]) throw new NormalizationError([{ path: "$preset", rule: "normalization.unknown-preset", message: "The selected preset is not available." }])
  const projectName = source.productName.normalize("NFKC").trim().replace(/\s+/g, " ")
  const summary = cleanMeaning(source.summary)
  const hasTemporaryAudio = source.dataObjects.some(item => temporaryAudioSubject(`${item.name} ${item.purpose} ${item.retentionIntent}`))
    || source.externalServices.some(item => isDeepgramNovaStreaming(`${item.name} ${item.purpose}`))
  const temporaryAudioLifecycle = isNativeMacPreset(presetId) && hasTemporaryAudio
    ? TEMPORARY_AUDIO_LIFECYCLE
    : undefined
  if (!projectName) normalizationIssue("productName")
  if (!summary) normalizationIssue("summary")

  const targetUsers = cleanList(source.targetUsers)
  const goals = uniqueStrings(source.goals.map(goal => canonicalizeTemporaryAudioMeaning(goal, temporaryAudioLifecycle)).filter(Boolean))
  if (!targetUsers.length) normalizationIssue("targetUsers")
  if (!goals.length) normalizationIssue("goals")

  const baseFeatures = uniqueByName(source.features.map((feature, index) => {
    const name = cleanMeaning(feature.name)
    const semantic = `${feature.name} ${feature.behavior} ${feature.trigger} ${feature.userOutcome} ${feature.acceptanceSignals.join(" ")}`
    const nativePaste = isNativeMacPreset(presetId) && providesNativeInsertion(feature.name, feature.behavior)
    const behavior = nativePaste ? nativeInsertionBehavior : cleanMeaning(feature.behavior)
    const userOutcome = cleanMeaning(feature.userOutcome)
    if (!name) normalizationIssue(`features[${index}].name`)
    if (!behavior) normalizationIssue(`features[${index}].behavior`)
    if (!userOutcome) normalizationIssue(`features[${index}].userOutcome`)
    const trigger = cleanMeaning(feature.trigger) || `The user initiates ${name}.`
    const failure = canonicalizeTemporaryAudioMeaning(feature.failureOutcome, temporaryAudioLifecycle) || "The operation stops without losing the last valid state."
    const acceptance = nativePaste
      ? uniqueStrings([...nativeInsertionAcceptance, ...cleanList(feature.acceptanceSignals)])
      : cleanList(feature.acceptanceSignals)
    return {
      name,
      behavior,
      inputs: [trigger],
      outputs: [userOutcome],
      acceptanceOutcomes: acceptance.length ? acceptance : [`${name} produces the documented user outcome.`],
      failureBehavior: failure,
      recoveryExpectations: [`Preserve the last valid state, explain the failure, and allow an explicit retry of ${name}.`],
      providedCapabilities: nativePaste ? [NATIVE_INSERTION_CAPABILITY] : [],
      requiredCapabilities: isNativeMacPreset(presetId) && !nativePaste && requiresNativeInsertion(semantic) ? [NATIVE_INSERTION_CAPABILITY] : [],
      resourceIds: [],
      sourceMeaning: cleanMeaning(semantic),
    }
  }))
  if (!baseFeatures.length) normalizationIssue("features")

  const dataObjects = uniqueByName(source.dataObjects.map(item => {
    const name = cleanMeaning(item.name)
    const purpose = cleanMeaning(item.purpose)
    const nativeTemporaryAudio = temporaryAudioLifecycle !== undefined && temporaryAudioSubject(`${name} ${purpose} ${item.retentionIntent}`)
    return {
      name,
      purpose,
      sensitivity: item.sensitivity,
      retentionIntent: nativeTemporaryAudio ? temporaryAudioLifecycleText(temporaryAudioLifecycle) : cleanMeaning(item.retentionIntent),
    }
  }).filter(item => item.name && item.purpose && item.retentionIntent))
  const externalServices = uniqueByName(source.externalServices.map(item => {
    const purpose = cleanMeaning(item.purpose)
    const sourceMeaning = `${item.name} ${purpose}`
    return {
      name: isNativeMacPreset(presetId) && isDeepgramNovaStreaming(sourceMeaning) ? DEEPGRAM_LIVE_MICROPHONE_CONTRACT.providerName : cleanMeaning(item.name),
      purpose,
      dataSent: cleanList(item.dataSent),
      credentialRequirement: item.credentialRequired ? "api-key" as const : "none" as const,
      failureBehavior: "Return a privacy-safe authentication, rate, transport, timeout, filtered, or provider failure without raw response content.",
      recovery: "Preserve recoverable local input and allow only an explicit retry or explicit service change.",
    }
  }).filter(item => item.name && item.purpose))
  const deepgramLiveContract = isNativeMacPreset(presetId) && externalServices.some(service => service.name === DEEPGRAM_LIVE_MICROPHONE_CONTRACT.providerName)
    ? DEEPGRAM_LIVE_MICROPHONE_CONTRACT
    : undefined
  const transcriptionRouting = deriveTranscriptionRouting(baseFeatures, externalServices)
  const routedFeatures = transcriptionRouting ? baseFeatures.map(feature => {
    if (transcriptionRouting.liveFeatureNames.includes(feature.name)) {
      return { ...feature, behavior: liveTranscriptionBehavior(transcriptionRouting) }
    }
    if (transcriptionRouting.importedFeatureNames.includes(feature.name)) {
      return {
        ...feature,
        behavior: importedTranscriptionBehavior(transcriptionRouting),
        acceptanceOutcomes: [
          `Only ${supportedImportedAudioFormats} are accepted for imported audio`,
          "Files exceeding 60 seconds or 25 MB (25,000,000 bytes) are rejected locally before any paid upload and create no provider request",
          "Long imported files are never split, chunked, transcoded, or stitched",
        ],
        failureBehavior: importedTranscriptionFailure(),
        recoveryExpectations: [importedTranscriptionRecovery()],
      }
    }
    return feature
  }) : baseFeatures
  const features = routedFeatures.map(({ sourceMeaning, ...feature }) => ({
    ...feature,
    resourceIds: deriveFeatureResourceIds(feature, sourceMeaning, dataObjects, externalServices, transcriptionRouting),
  }))
  const platformNeeds = unique(source.platformNeeds)
  const permissionCapabilities = unique(platformNeeds.flatMap(need => permissionByNeed[need] ? [permissionByNeed[need]!] : []))
  const permissionNeeds = permissionCapabilities.map(capability => ({ capability, purpose: needPurpose[capability], deniedBehavior: deniedBehavior[capability] }))
  const contentSite = astroContentSiteSemantics(source, presetId)
  const persistenceRequired = platformNeeds.includes("local-storage") || contentSite
  const persistenceNeeds = dataObjects
    .filter(item => !isCredentialData(`${item.name} ${item.purpose}`))
    .filter(item => persistenceRequired || !/\b(?:do not retain|not retained|memory only|session only)\b/i.test(item.retentionIntent))
    .map(item => {
      const temporaryAudio = temporaryAudioLifecycle !== undefined && temporaryAudioSubject(`${item.name} ${item.purpose} ${item.retentionIntent}`)
      return {
        data: item.name,
        purpose: item.purpose,
        retention: item.retentionIntent,
        deletionBehavior: temporaryAudio
          ? temporaryAudioLifecycleStatements(temporaryAudioLifecycle)[2]!
          : `Delete ${item.name} only through an explicit user action or the stated retention boundary, and report deletion failure honestly.`,
        sensitivity: item.sensitivity,
        temporary: /\b(?:temporary|active recovery|retry decision|current request|current operation|session only)\b/i.test(`${item.name} ${item.purpose} ${item.retentionIntent}`),
      }
    })
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
      behavior: "Initialize preset-owned state and services without starting privileged capture, remote requests, or destructive work automatically.",
      cleanup: "Rollback partial initialization and keep a safe retry or manual launch path.",
    },
    {
      event: "Application termination",
      behavior: "Stop new work, cancel active operations, and preserve only state covered by the persistence contracts.",
      cleanup: "Release permissions, listeners, handles, tasks, clipboard snapshots, and temporary resources before termination completes.",
    },
    ...(platformNeeds.includes("audio-input") ? [{
      event: "Audio capture termination",
      behavior: "Finalize or cancel the one active capture and make its recovery state explicit.",
      cleanup: temporaryAudioLifecycle
        ? temporaryAudioLifecycleStatements(temporaryAudioLifecycle).join(" ")
        : "Release microphone resources after success, explicit discard, cancellation, or exhausted recovery.",
    }] : []),
  ]
  const nonGoals = uniqueStrings(source.nonGoals.map(item => canonicalizeTemporaryAudioMeaning(item, temporaryAudioLifecycle)).filter(Boolean))
  const hasNativePaste = isNativeMacPreset(presetId) && features.some(feature => feature.providedCapabilities.includes(NATIVE_INSERTION_CAPABILITY))
  const qualityRequirements = uniqueStrings(source.qualityRequirements.map(requirement => canonicalizeTemporaryAudioMeaning(requirement, temporaryAudioLifecycle)).filter(Boolean)).map(requirement => hasNativePaste
    ? requirement.replace(/\s+where practical\b/gi, " only when the current changeCount still equals the app-owned post-write changeCount")
    : requirement)
  const productConstraints = uniqueStrings(source.productConstraints.map(constraint => canonicalizeTemporaryAudioMeaning(constraint, temporaryAudioLifecycle)).filter(Boolean)).map(constraint => {
    if (transcriptionRouting && /(?:send|stream|route)[^.\n]{0,120}(?:selected|chosen) (?:transcription )?(?:provider|service)/i.test(constraint)) {
      return `Live microphone audio is sent only to ${transcriptionRouting.liveProviderName}; imported audio files are sent only to ${transcriptionRouting.importedProviderName}; disclose both cloud boundaries before enablement.`
    }
    return constraint
  })

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
    transcriptionRouting,
    deepgramLiveContract,
    temporaryAudioLifecycle,
    domainData: dataObjects.map(item => ({ name: item.name, meaning: item.purpose, retention: item.retentionIntent, sensitivity: item.sensitivity })),
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

function projectIdentity(projectName: string): ProjectIdentity {
  const projectSlug = slug(projectName)
  const parts = projectSlug.split("-")
  const vendor = parts[0] ?? "project"
  const product = parts.slice(1).join("") || "app"
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
    return {
      id: feature.id.replace(/^FEAT-/, "REQ-"),
      featureId: feature.id,
      statement: `The product must ${feature.behavior}`,
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
  blueprint: NormalizedBlueprint,
  features: readonly GraphFeature[],
): string[] {
  const related = featureIdsForResources(serviceResourceIds(service.name, service.purpose), features)
  const routing = blueprint.transcriptionRouting
  if (!routing) return related

  const liveIds = features.filter(feature => routing.liveFeatureNames.includes(feature.name)).map(feature => feature.id)
  const importedIds = features.filter(feature => routing.importedFeatureNames.includes(feature.name)).map(feature => feature.id)
  const meaning = `${service.name} ${service.purpose}`
  if (streamingTranscriptionServiceLike(meaning)) {
    return unique([...related.filter(id => !importedIds.includes(id)), ...liveIds])
  }
  if (batchTranscriptionServiceLike(meaning)) {
    return unique([...related.filter(id => !liveIds.includes(id)), ...importedIds])
  }
  return related
}

function permissionFeatureIds(
  item: NormalizedBlueprint["permissionNeeds"][number],
  features: readonly GraphFeature[],
): string[] {
  return featureIdsForResources([permissionResourceId(item.capability)], features)
}

function dataFeatureIds(name: string, meaning: string, features: readonly GraphFeature[]): string[] {
  return featureIdsForResources(dataResourceIds(name, meaning), features)
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

function isOpenRouter(value: string): boolean {
  return /\bopenrouter\b/i.test(value)
}

function isDeepgramNovaStreaming(value: string): boolean {
  return /\bdeepgram\b/i.test(value) && /\b(?:nova|streaming)\b/i.test(value)
}

function compilerIntegrationServices(blueprint: NormalizedBlueprint): NormalizedBlueprint["externalServices"] {
  const services: NormalizedBlueprint["externalServices"][number][] = []
  let emittedOpenRouter = false
  for (const service of blueprint.externalServices) {
    if (!isOpenRouter(`${service.name} ${service.purpose}`)) {
      services.push(service)
      continue
    }
    if (emittedOpenRouter) continue
    emittedOpenRouter = true
    services.push(
      {
        name: "OpenRouter transcription",
        purpose: "Transcribe one finalized audio input through the independent OpenRouter transcription role.",
        dataSent: ["Finalized audio bytes", "Audio format", "Selected language and transcription model"],
        credentialRequirement: "api-key",
        failureBehavior: service.failureBehavior,
        recovery: service.recovery,
      },
      {
        name: "OpenRouter refinement",
        purpose: "Refine one accepted raw transcript through the independent OpenRouter refinement role.",
        dataSent: ["Raw transcript", "Mode instructions", "Selected output language and refinement model"],
        credentialRequirement: "api-key",
        failureBehavior: service.failureBehavior,
        recovery: service.recovery,
      },
    )
  }
  return services
}

function credentialDetails(presetId: PresetId, identity: ProjectIdentity, serviceName: string, kind: string): string[] {
  const serviceSlug = slug(serviceName)
  if (isNativeMacPreset(presetId)) {
    if (isOpenRouter(serviceName)) {
      return [
        "API key placement: macOS Keychain only; never UserDefaults, SQLite, files, logs, UI state, diagnostics, or generated output.",
        `Keychain service: ${identity.bundleId}.credentials`,
        "Keychain account: openrouter-api-key",
        "Both OpenRouter model roles read the same account value into request-local memory and never persist a second copy.",
      ]
    }
    return [
      "API key placement: macOS Keychain only; never UserDefaults, SQLite, files, logs, UI state, diagnostics, or generated output.",
      `Keychain service: ${identity.bundleId}.credentials`,
      `Keychain account: ${serviceSlug}-${kind}`,
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

export function deepgramIntegrationValues(
  wire: DeepgramLiveMicrophoneContract = DEEPGRAM_LIVE_MICROPHONE_CONTRACT,
  audio: TemporaryAudioLifecycle = TEMPORARY_AUDIO_LIFECYCLE,
): Pick<GraphContract, "decision" | "details" | "failureBehavior" | "recovery"> {
  const [keepAlive, finalize, closeStream] = wire.clientMessages
  const [results, speechStarted, utteranceEnd, metadata] = wire.serverEvents
  return {
    decision: `Deepgram WebSocket streaming is exclusively for live microphone audio. Open exactly one GET WebSocket to ${wire.endpoint} with ${wire.transport} and model=${wire.model} for each user-started live transcription; use typed Codable messages and never start another stream as an automatic retry or automatic paid retry.`,
    details: [
      "Imported audio files never enter this microphone PCM stream and are never routed through the Deepgram WebSocket integration.",
      `Build the URL with URLComponents and the locked query model=${wire.model}&encoding=${wire.encoding}&sample_rate=${wire.sampleRateHz}&channels=${wire.channels}&interim_results=true&endpointing=300&utterance_end_ms=1000&vad_events=true&smart_format=true; add one validated supported language value only when the user selects it and add repeated keyterm values only from the validated custom vocabulary.`,
      `Authentication header: Authorization: ${wire.authorizationScheme} plus the request-local Deepgram API key loaded from macOS Keychain. Bearer is reserved for a documented temporary JWT and is not used for the stored API key.`,
      `Audio contract: convert microphone input to raw headerless ${wire.encoding}, 16-bit little-endian signed PCM at ${wire.sampleRateHz} Hz and one channel; send only non-empty Data aligned to two-byte samples as ${wire.frameFormat}, never as JSON, text, base64, a WAV container, or an empty binary frame.`,
      `Timeouts: require the WebSocket upgrade within a ${wire.connectionTimeoutSeconds}-second connection timeout and set a ${wire.resourceTimeoutMinutes}-minute resource timeout; the user stop, cancellation, app termination, and provider state machine may end the stream sooner.`,
      `${keepAlive}: after at least one real audio frame, send the text frame {"type":"${keepAlive}"} every 4 seconds only while no audio frame is being sent; Deepgram sends no ${keepAlive} response, its idle window is 10 seconds, and ${keepAlive} never substitutes for sending the first non-empty audio frame within that 10-second window.`,
      `Finalization: after capture stops, send the text frame {"type":"${finalize}"}, continue receiving, append every non-empty ${results} segment whose ${wire.finalityField} is true exactly once in channel order, and treat from_finalize as optional because Deepgram does not guarantee it when no buffered audio remains.`,
      `Normal close: after the final ${results} boundary, send the text frame {"type":"${closeStream}"}, receive the final ${metadata} summary and normal server close, then release ${wire.transport}, timers, adapters, and capture resources.`,
      `Decode a typed Codable event enum by type. ${results} fields are type, channel_index, duration, start, channel.alternatives with transcript, confidence, and words, metadata.request_id, metadata.model_info, metadata.model_uuid, ${wire.finalityField}, speech_final, and optional from_finalize; interim ${results} may update the HUD but never become insertion or persistence candidates.`,
      `When vad_events=true, decode ${speechStarted} with type, channel, and timestamp and use it only for visible recording state. When utterance_end_ms=1000 and interim_results=true, decode ${utteranceEnd} with type, channel, and last_word_end; neither event replaces ${wire.finalityField} ${results} accumulation or user-controlled stop and finalization.`,
      `Decode ${metadata} fields type, request_id, sha256, created, duration, channels, and deprecated transaction_key. The streaming socket has no documented usage object or cost field: retain request_id and provider-reported duration as request evidence and mark monetary usage unavailable rather than inventing it.`,
      `Failure mapping: classify failed upgrades and HTTP 400 malformed configuration, 401 authentication, 403 permission, 429 project concurrency or rate limits, 5xx provider failures, URLSession transport and TLS failures, the local connection or resource timeout, malformed or unknown typed messages, and empty final output through ${wire.failureMapping} categories without exposing raw response content.`,
      "Close-frame mapping: classify 1008 DATA-0000 as malformed or mismatched audio, 1011 NET-0000 as provider or insufficient-audio response timeout, NET-0001 as the client-to-server frame timeout, and NET-0002 as no_audio_timeout; retain privacy-safe dg-request-id correlation and never surface raw dg-error content.",
      `Cancellation: invalidate the operation generation before cancelling ${wire.transport}, stop audio and ${keepAlive} sends, ${wire.cancellation.replaceAll("-", " ")} and callbacks, and never insert, refine, persist, or report cancelled, partial, failed, malformed, or empty text as complete.`,
      ...temporaryAudioLifecycleStatements(audio),
      `Test connection: load only configured-or-missing credential state, open the same authenticated endpoint, verify the upgrade and dg-request-id, immediately send {"type":"${closeStream}"}, accept ${metadata} with zero duration, and close; it never opens the microphone, reads a temporary recording, or sends a binary frame, and it never sends recorded user audio.`,
    ],
    failureBehavior: `Authentication, rate, transport, provider, timeout, malformed-message, malformed-audio, cancellation, and empty-final failures are distinct ${wire.failureMapping} terminal states; no automatic provider retry, automatic paid retry, paid fallback, history record, refinement, or insertion may follow them.`,
    recovery: [`Preserve temporary audio only while awaiting ${wire.recoveryActions.join(" or ")} after a recoverable provider failure; keep completed transcript state visible and expose only copy, preview, or discard actions otherwise.`],
  }
}

function openRouterIntegrationValues(serviceName: string): Pick<GraphContract, "decision" | "details" | "failureBehavior" | "recovery"> {
  const commonErrors = "Decode OpenRouter's JSON error envelope error.code, error.message, and error.metadata.error_type for HTTP 400, 401, 402, 403, 408, 413, 422, 429, 500, 502, and 503; treat a top-level error in an HTTP 200 body, malformed JSON, or a missing accepted output as failure."
  const commonPrivacy = "OpenRouter states prompt and response logging is disabled by default unless the account opts in; request metadata is retained, and the selected upstream provider has its own data policy. Disclose that boundary before enabling cloud processing and send no optional X-OpenRouter-Metadata, HTTP-Referer, or X-Title headers."
  const commonRate = "OpenRouter rate limits are account, model, provider, and abuse-protection dependent: allow one in-flight request per recording and role, handle 429 without a numeric quota assumption, honor Retry-After and X-RateLimit-Limit/Remaining/Reset when supplied, and require explicit user action after the bounded retry state."
  if (serviceName === "OpenRouter transcription") {
    return {
      decision: "Imported audio-file transcription uses the configured batch/file-capable provider, OpenRouter. Use POST https://openrouter.ai/api/v1/audio/transcriptions for one finalized audio input with default model openai/gpt-4o-transcribe. This is a batch final-transcription contract and produces no live partial results.",
      details: [
        "Required headers: Authorization: Bearer plus the request-local macOS Keychain value; Content-Type: application/json. Do not send the key anywhere else.",
        `Supported imported formats are ${supportedImportedAudioFormats}. Encode the raw audio bytes as ordinary base64, not a data URI, in input_audio.data and send the matching lowercase input_audio.format.`,
        "Preflight the user-selected file's extension, media duration, and file size locally before reading audio bytes, base64 encoding, URLRequest construction, or URLSessionTask creation.",
        "Reject unsupported files and files exceeding the locally locked maximum duration of 60 seconds or payload of 25 MB (25,000,000 bytes) with clear user guidance before any paid upload; create no provider request and release local inspection resources.",
        "Do not split, chunk, transcode, or stitch long files unless a future preset explicitly defines that behavior.",
        "Request JSON fields: model: \"openai/gpt-4o-transcribe\"; input_audio: { data, format }; optional language as ISO-639-1; temperature: 0.0; optional provider routing only when the user explicitly configured it.",
        "Accept only a non-empty response text. Decode usage.seconds, usage.total_tokens, usage.input_tokens, usage.output_tokens, and usage.cost, and capture the X-Generation-Id response header for request correlation without transcript content.",
        "Cancellation: retain the URLSessionTask, call URLSessionTask.cancel(), discard late responses, delete no recoverable audio prematurely, and never insert or persist partial, cancelled, failed, or empty text.",
        "Timeout: set the request and resource timeout to 65 seconds after local preflight succeeds; never label this batch endpoint as live transcription.",
        commonRate,
        "Verified model price snapshot: USD $2.50 per million input tokens and $10.00 per million output tokens. Persist provider-returned usage.cost as authoritative and mark cost unavailable rather than estimating it.",
        commonErrors,
        commonPrivacy,
      ],
      failureBehavior: "Authentication, credit, permission, payload, timeout, rate, provider, decode, cancellation, and empty-transcript failures are distinct privacy-safe terminal states; none may create history or paste text.",
      recovery: ["Preserve the one finalized audio input only through the declared recovery decision, then allow an explicit retry or explicit provider change without an automatic paid fallback."],
    }
  }
  return {
    decision: "Use POST https://openrouter.ai/api/v1/chat/completions for optional non-live refinement with default model google/gemini-2.5-flash-lite, temperature: 0.0, reasoning: { effort: \"none\" }, and stream: false.",
    details: [
      "Required headers: Authorization: Bearer plus the same request-local macOS Keychain value used by the OpenRouter transcription role; Content-Type: application/json.",
      "Request JSON fields: model: \"google/gemini-2.5-flash-lite\"; messages with exactly one locked system instruction and one user payload containing the raw transcript plus selected mode instructions; temperature: 0.0; reasoning: { effort: \"none\" }; stream: false.",
      "Locked system instruction: Edit only the supplied transcript. Preserve meaning, names, code, and technical terms; never invent speech, facts, speakers, or omitted content; apply only the selected mode; return only the refined transcript.",
      "Accept only choices[0].message.content as a non-empty string with choices[0].finish_reason equal to stop; retain id, model, created, and provider-reported usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, usage.cost, and usage.cost_details without transcript logging.",
      "Cancellation: retain the URLSessionTask, call URLSessionTask.cancel(), discard late output, and keep the raw completed transcript unchanged and available.",
      "Timeout: set the request and resource timeout to 30 seconds; timeout is a refinement failure and never changes or hides the raw transcript.",
      commonRate,
      "Verified model price snapshot: USD $0.10 per million input tokens and $0.40 per million output tokens. Persist provider-returned usage.cost as authoritative and mark cost unavailable rather than estimating it.",
      commonErrors,
      commonPrivacy,
    ],
    failureBehavior: "Disabled, cancelled, timed-out, filtered, malformed, rate-limited, unauthenticated, empty, or non-stop refinement never replaces, deletes, or pastes over the accepted raw transcript.",
    recovery: ["Keep the raw transcript, expose an explicit refinement retry or use-raw action, and never make a second paid request automatically."],
  }
}

function hasVoicePersistence(blueprint: NormalizedBlueprint): boolean {
  const names = blueprint.domainData.map(item => item.name).join(" ")
  return /history/i.test(names) && /mode/i.test(names) && /vocab/i.test(names) && /(?:temporary|recording|audio)/i.test(names)
}

function nativeVoicePersistenceDetails(identity: ProjectIdentity, audio: TemporaryAudioLifecycle): string[] {
  const root = `Application Support/${identity.bundleId}`
  return [
    `CredentialVault exclusively owns API credential data in macOS Keychain service ${identity.bundleId}.credentials; DataStore never owns, serializes, migrates, or persists secret values and may retain only configured-or-missing provider state.`,
    `Lightweight settings only: UserDefaults with schemaVersion = 1 and versioned keys for provider IDs, transcription and refinement model IDs, hotkeys, paste behavior, history enabled, retention days, selected mode, per-application mode, and launch at login; API keys are forbidden.`,
    `Durable records: SQLite at ${root}/voice.sqlite3 with PRAGMA foreign_keys = ON, WAL journaling, busy timeout, and PRAGMA user_version = 1.`,
    "CREATE TABLE history (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, source_bundle_id TEXT, duration_ms INTEGER NOT NULL CHECK(duration_ms >= 0), provider TEXT NOT NULL, transcription_model TEXT NOT NULL, refinement_model TEXT, mode_id TEXT REFERENCES modes(id) ON DELETE SET NULL, raw_text TEXT NOT NULL, refined_text TEXT, outcome TEXT NOT NULL, usage_json TEXT, cost_usd REAL, is_favorite INTEGER NOT NULL DEFAULT 0 CHECK(is_favorite IN (0,1))).",
    "CREATE TABLE modes (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, instructions TEXT NOT NULL, output_language TEXT, application_bundle_id TEXT, sort_order INTEGER NOT NULL, updated_at TEXT NOT NULL).",
    "CREATE TABLE vocabulary (id TEXT PRIMARY KEY, spoken TEXT NOT NULL UNIQUE COLLATE NOCASE, replacement TEXT NOT NULL, sort_order INTEGER NOT NULL, updated_at TEXT NOT NULL).",
    "Migration ownership: DataStore reads PRAGMA user_version, creates a verified backup beside the database, runs each transactional migration with BEGIN IMMEDIATE and COMMIT, rolls back on the first error, leaves the prior database readable, and advances user_version only after validation.",
    "Retention ownership: DataStore deletes history older than the configured retention boundary in one transaction after launch and after a successful history write; disabled history writes no row, and favorites are retained only when the user-selected policy says so.",
    "Deletion ownership: DataStore performs explicit deletion of one history row, clear-history, mode, or vocabulary records transactionally; UI reports success only after COMMIT and preserves the last readable state after failure.",
    ...temporaryAudioLifecycleStatements(audio),
    `Temporary-audio placement: FileManager.default.temporaryDirectory/${identity.bundleId}/recordingUUID/audio.format is app-owned; cleanup executes delete after ${audio.deletionTriggers.join(", ")} and reports failure without claiming deletion.`,
    `Saved-recording placement: an explicit user action atomically moves the completed file to ${root}/Recordings/recordingUUID.format; DataStore owns naming, collision checks, later explicit deletion, and failed-move recovery.`,
    "Recovery ownership: corrupt or migration-failed SQLite never gets silently replaced; preserve the verified backup, open read-only recovery when possible, and require an explicit user decision before rebuild or restore.",
  ]
}

function persistencePlacement(item: NormalizedBlueprint["persistenceNeeds"][number], preset: PresetContract, identity: ProjectIdentity, astroPlan?: AstroRoutePlan): string {
  if (preset.id === "astro-web" && astroPlan?.usesContentCollections) {
    return `src/content/${astroPlan.contentCollection}/ as build-time markdown or MDX compiled through src/content/config.ts.`
  }
  if (preset.id === "astro-web" && astroPlan?.browserPersistence) return preset.persistence.recordsPlacement
  if (!isNativeMacPreset(preset.id)) return item.temporary ? preset.persistence.temporaryPlacement : preset.persistence.recordsPlacement
  if (item.temporary) {
    return `FileManager.default.temporaryDirectory/${identity.bundleId}/recordingUUID/audio.format, with Saved recordings moved to Application Support/${identity.bundleId}/Recordings only after explicit user action.`
  }
  const settings = /\b(?:provider|hotkey|preferences?|settings?|shortcut|launch)\b/i.test(item.data)
  const records = /\b(?:history|transcript|modes?|vocabulary|replacement)\b/i.test(item.data)
  if (settings && records) return `Split by value: lightweight provider, hotkey, preference, and launch settings in UserDefaults; history, modes, vocabulary, and replacements in SQLite at Application Support/${identity.bundleId}/voice.sqlite3.`
  if (settings) return "UserDefaults with versioned lightweight keys; API keys are forbidden."
  if (records) return `SQLite at Application Support/${identity.bundleId}/voice.sqlite3 under the matching history, modes, or vocabulary schema.`
  return preset.persistence.recordsPlacement
}

function pasteWorkflowContract(feature: GraphFeature): GraphContract {
  return contract(
    "CON-PASTE-WORKFLOW",
    "interface",
    "Deterministic paste workflow",
    [feature.id],
    feature.ownerId,
    "Use AppKit, ApplicationServices, NSPasteboard, and CGEvent through small injectable native adapters to execute one deterministic insertion workflow for exactly one approved complete candidate.",
    [
      "1. At recording start, capture the target NSRunningApplication identity, bundle identifier, process identifier, and current Accessibility focused element when available; never substitute the compiler, HUD, menu-bar popover, or a later-focused application.",
      "2. After successful final transcription and optional successful refinement, choose exactly one insertion candidate: the accepted refined text when refinement succeeded, otherwise the accepted final raw transcript.",
      "3. Never paste partial, empty, failed, cancelled, or unapproved text.",
      "4. Before insertion, verify Accessibility authorization and that the captured target NSRunningApplication and focused element remain valid for the captured process identifier.",
      "5. Prefer direct Accessibility insertion through the editable selected-text boundary by setting kAXSelectedTextAttribute; success performs no NSPasteboard access.",
      "6. If direct insertion is unavailable, capture every existing NSPasteboard item and representation plus the original changeCount before writing anything.",
      "7. Write the one insertion candidate to NSPasteboard and record the resulting app-owned post-write changeCount.",
      "8. Reactivate the captured NSRunningApplication and verify that it became frontmost; failed activation stops before any synthetic key event.",
      "9. Synthesize one Command-V through CGEvent only after successful activation.",
      "10. Wait a bounded documented interval of 750 ms for the target application to consume the paste.",
      "11. Restore the complete clipboard snapshot only if the current changeCount still equals the app-owned post-write changeCount.",
      "12. If another application or the user changed the clipboard, never overwrite that newer clipboard content.",
      "13. If activation, direct insertion, synthetic paste, or clipboard restoration fails, retain the completed transcript and expose copy, preview, and explicit retry actions with a privacy-safe failure category.",
      "14. Preview mode never inserts before explicit approval; preview cancellation inserts nothing and preserves the completed transcript.",
      "15. Copy-only mode intentionally leaves the transcript on the clipboard, synthesizes no Command-V, and performs no restoration.",
      "Invariant summary: capture the previously focused NSRunningApplication and editable AXUIElement; reactivate the captured target application; attempt Accessibility insertion first, using clipboard plus synthetic Command-V only as fallback; snapshot all NSPasteboard item representations and NSPasteboard.changeCount; restore only when the current changeCount equals the app-owned write changeCount; external clipboard mutation wins; never insert partial, failed, cancelled, or empty text; preserve the completed transcript after every insertion failure.",
      "Native adapter boundary: inject focused-target capture, Accessibility authorization and selected-text insertion, NSPasteboard snapshot/write/restore, NSRunningApplication activation/frontmost verification, CGEvent Command-V, and bounded waiting so tests use no live applications or clipboard.",
      "Focused tests: direct Accessibility insertion and AX success without clipboard access; Command-V fallback; captured application no longer available; activation failure and target reactivation failure; Accessibility denial and Accessibility denial manual path; non-editable AX target fallback; clipboard changed by another process and external clipboard mutation skips restoration; clipboard restoration and fallback paste and clipboard restoration; copy-only behavior; preview approval and cancellation; incomplete transcript rejection plus partial and failed text rejection; insertion failure preserving the transcript and synthetic paste failure preserves transcript.",
    ],
    "A stale target, Accessibility denial, activation failure, unsupported selected-text boundary, CGEvent failure, timeout, or restoration failure never discards the completed transcript or overwrites newer clipboard content.",
    ["Keep the completed transcript visible for copy and preview, report the exact insertion category, and allow an explicit retry that captures a fresh target rather than reusing a stale Accessibility element."],
  )
}

function nativePackagingDetails(preset: PresetContract, identity: ProjectIdentity): string[] {
  return [
    `Bundle identity: CFBundleIdentifier = ${identity.bundleId}; CFBundleName = ${identity.projectName}; CFBundleExecutable = ${identity.moduleName}; CFBundleIconFile = AppIcon; CFBundlePackageType = APPL; CFBundleShortVersionString = 1.0.0; CFBundleVersion = 1.`,
    `Info.plist ownership: Resources/Info.plist declares CFBundleIdentifier, CFBundleExecutable, CFBundleIconFile, LSMinimumSystemVersion = 13.0, NSHighResolutionCapable = true, NSMicrophoneUsageDescription = "${identity.projectName} uses the microphone only while you explicitly record dictation.", and LSUIElement = ${preset.id === "native-macos-swiftui-menubar" ? "true" : "false"}.`,
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
): { ownerDrafts: OwnerDraft[]; contracts: GraphContract[] } {
  const integrationServices = compilerIntegrationServices(blueprint)
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
    name: feature.ownerId === "OWN-PASTE-COORDINATOR"
      ? "PasteCoordinator"
      : preset.id === "astro-web"
        ? pascal(feature.name)
        : `${pascal(feature.name)}Feature`,
    kind: "feature" as const,
    dependencyIds: [],
  }])).values()]

  const credentialServices = integrationServices.filter(service => service.credentialRequirement !== "none")
  const credentialOwnerFeatureIds = unique(credentialServices.flatMap(service => integrationFeatureIds(service, blueprint, features)))
  const coreDrafts: OwnerDraft[] = []
  if (credentialServices.length) {
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
    const importedAudio = blueprint.transcriptionRouting?.importedFeatureNames.includes(feature.name) === true
    const interfaceDetails = importedAudio
      ? [
          `Inputs: ${feature.inputs.join("; ")}`,
          `Outputs: ${feature.outputs.join("; ")}`,
          `Supported imported formats are ${supportedImportedAudioFormats}.`,
          isNativeMacPreset(preset.id)
            ? "Preflight the user-selected file's extension, media duration, and file size locally before reading audio bytes, base64 encoding, URLRequest construction, or URLSessionTask creation."
            : "Preflight the user-selected file's format, media duration, and file size locally before loading audio content or constructing a provider request.",
          "Reject unsupported files and files exceeding 60 seconds or 25 MB (25,000,000 bytes) with clear user guidance before any paid upload; create no provider request.",
          "Do not split, chunk, transcode, or stitch long files unless a future preset explicitly defines that behavior.",
          "Cleanup: release local inspection resources on acceptance, rejection, cancellation, and failure.",
        ]
      : [`Inputs: ${feature.inputs.join("; ")}`, `Outputs: ${feature.outputs.join("; ")}`]
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
      [`Failure: ${feature.failureBehavior}`, ...preset.recoveryRules],
      feature.failureBehavior,
      feature.recoveryExpectations,
    ))
  }
  const pasteFeature = features.find(feature => feature.ownerId === "OWN-PASTE-COORDINATOR")
  if (pasteFeature && isNativeMacPreset(preset.id)) contracts.push(pasteWorkflowContract(pasteFeature))

  const dataOwnerId = blueprint.domainData.length || blueprint.persistenceNeeds.length ? "OWN-DATA-STORE" : lifecycleOwnerId
  for (const item of blueprint.domainData) {
    const credentialData = isCredentialData(`${item.name} ${item.meaning}`)
    const ownerId = credentialData ? "OWN-CREDENTIAL-VAULT" : dataOwnerId
    const credentialDataDetails = credentialData
      ? unique(credentialServices.flatMap(service => credentialDetails(preset.id, identity, service.name, service.credentialRequirement)))
      : [`Retention: ${item.retention}`, `Sensitivity: ${item.sensitivity}`]
    contracts.push(contract(
      `CON-DATA-${slug(item.name).toUpperCase()}`,
      "data",
      item.name,
      credentialData
        ? credentialOwnerFeatureIds
        : dataFeatureIds(item.name, item.meaning, features),
      ownerId,
      credentialData ? `${preset.credentialPlacement} CredentialVault exclusively owns credential storage, retrieval, replacement, and deletion; DataStore receives no secret value.` : item.meaning,
      credentialData ? [...credentialDataDetails, `Retention: ${item.retention}`, `Sensitivity: ${item.sensitivity}`] : credentialDataDetails,
      credentialData ? "Missing, rejected, unreadable, replacement-failed, or deletion-failed credentials block only the affected provider action without exposing or copying a secret." : "Reject invalid or incomplete records without replacing the last valid state.",
      credentialData ? ["Preserve the prior Keychain value after failed replacement, report deletion only after Keychain confirms it, and expose an explicit replacement or provider-selection action."] : ["Preserve the last valid record and expose a bounded correction or rebuild path."],
    ))
  }

  for (const service of integrationServices) {
    const ownerId = `OWN-INTEGRATION-${slug(service.name).toUpperCase()}`
    const specialized = isNativeMacPreset(preset.id)
      ? isOpenRouter(service.name)
        ? openRouterIntegrationValues(service.name)
        : isDeepgramNovaStreaming(`${service.name} ${service.purpose}`)
          ? deepgramIntegrationValues(blueprint.deepgramLiveContract ?? DEEPGRAM_LIVE_MICROPHONE_CONTRACT, blueprint.temporaryAudioLifecycle ?? TEMPORARY_AUDIO_LIFECYCLE)
          : undefined
      : undefined
    contracts.push(contract(
      `CON-INTEGRATION-${slug(service.name).toUpperCase()}`,
      "integration",
      `${service.name} integration`,
      integrationFeatureIds(service, blueprint, features),
      ownerId,
      specialized?.decision ?? `${service.purpose} ${preset.integrationBoundary}`,
      specialized?.details ?? [`Data sent: ${service.dataSent.join("; ") || "No product data beyond the explicit request."}`, `Credential requirement: ${service.credentialRequirement}`, `Preset boundary: ${preset.platform}`, `Framework boundary: ${preset.integrationBoundary}`],
      specialized?.failureBehavior ?? service.failureBehavior,
      specialized?.recovery ?? [service.recovery],
    ))
  }

  for (const item of blueprint.lifecycleRequirements) {
    const temporaryAudio = item.event === "Audio capture termination" && blueprint.temporaryAudioLifecycle
    const lifecycleValues = temporaryAudio ? temporaryAudioLifecycleContractValues(temporaryAudio) : undefined
    contracts.push(contract(
      `CON-LIFECYCLE-${slug(item.event).toUpperCase()}`,
      "lifecycle",
      item.event,
      lifecycleFeatureIds(item.event, features),
      lifecycleOwnerId,
      lifecycleValues?.decision ?? item.behavior,
      lifecycleValues?.details ?? [`Cleanup: ${item.cleanup}`],
      lifecycleValues?.failureBehavior ?? "An interrupted lifecycle transition must not be reported as complete.",
      lifecycleValues?.recovery ?? [item.cleanup],
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
      const placement = persistencePlacement(item, preset, identity, astroPlan)
      const persistenceDecision = preset.id === "astro-web" && astroPlan?.usesContentCollections
        ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.enabledDecision
        : preset.id === "astro-web" && astroPlan?.browserPersistence
          ? preset.persistence.enabledDecision
          : item.temporary ? "Temporary recovery storage is enabled." : preset.persistence.enabledDecision
      contracts.push(contract(
        `CON-PERSISTENCE-${slug(item.data).toUpperCase()}`,
        "persistence",
        `${item.data} persistence`,
        dataFeatureIds(item.data, item.purpose, features),
        "OWN-DATA-STORE",
        `${persistenceDecision} ${item.purpose}`,
        [`Placement: ${placement}`, `Retention: ${item.retention}`, `Deletion: ${item.deletionBehavior}`, `Sensitivity: ${item.sensitivity}`],
        "A failed write leaves the prior durable state valid and the new state visibly unsaved.",
        ["Retry through the same atomic boundary without duplicating the record.", item.deletionBehavior],
      ))
    }
    if (isNativeMacPreset(preset.id) && hasVoicePersistence(blueprint)) {
      contracts.push(contract(
        "CON-PERSISTENCE-VOICE-LOCAL-STORAGE",
        "persistence",
        "Voice local storage authority",
        unique(blueprint.persistenceNeeds.flatMap(item => dataFeatureIds(item.data, item.purpose, features))),
        "OWN-DATA-STORE",
        "Use one concrete local storage authority without taking credential ownership: CredentialVault exclusively owns API credential data in macOS Keychain only; DataStore owns lightweight non-secret settings in UserDefaults, history, modes and vocabulary in SQLite under Application Support, app-owned temporary audio with verified cleanup, and Saved recordings only after explicit user action.",
        nativeVoicePersistenceDetails(identity, blueprint.temporaryAudioLifecycle ?? TEMPORARY_AUDIO_LIFECYCLE),
        "A settings, SQLite, migration, retention, deletion, temporary-file, or saved-recording failure preserves the last valid readable state and is never reported as successful.",
        ["DataStore owns transactional rollback, verified database backup recovery, retry-safe writes, explicit deletion, retention execution, and temporary-file cleanup reporting."],
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

  const credentialGroups = credentialServices.filter(service => !isOpenRouter(service.name))
  if (credentialServices.some(service => isOpenRouter(service.name))) {
    credentialGroups.push({
      name: "OpenRouter",
      purpose: "Authenticate both independent OpenRouter model roles through one account.",
      dataSent: [],
      credentialRequirement: "api-key",
      failureBehavior: credentialServices.find(service => isOpenRouter(service.name))!.failureBehavior,
      recovery: credentialServices.find(service => isOpenRouter(service.name))!.recovery,
    })
  }
  for (const service of credentialGroups) {
    const credentialFeatures = isOpenRouter(service.name)
      ? unique(integrationServices.filter(item => isOpenRouter(item.name)).flatMap(item => integrationFeatureIds(item, blueprint, features)))
      : integrationFeatureIds(service, blueprint, features)
    contracts.push(contract(
      `CON-CREDENTIAL-${slug(service.name).toUpperCase()}`,
      "credential",
      `${service.name} credential`,
      credentialFeatures,
      "OWN-CREDENTIAL-VAULT",
      preset.credentialPlacement,
      credentialDetails(preset.id, identity, service.name, service.credentialRequirement),
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
    [...preset.packagingRules, ...(isNativeMacPreset(preset.id) ? nativePackagingDetails(preset, identity) : []), `Installation: ${preset.installationDecision(identity)}`, `Output artifact: ${preset.outputArtifact}`],
    "A failed build, signature, package, install, or launch check blocks completion.",
    ["Fix the first failing validation command, rebuild the artifact, and rerun every later release gate."],
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
): { owners: GraphOwner[]; phases: GraphPhase[] } {
  const foundationFiles = unique([
    ...preset.sourceLayout(identity),
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
    prompt: `Create the ${preset.label} foundation with identity ${identity.bundleId}. Use only the locked stack and create every listed file before any later task modifies it.${preset.id === "astro-web" ? " package.json must define npm run check, test, test:a11y, build, and audit:performance before any later validation gate." : ""} Add a contract test that fails on stack or identity drift.`,
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
    const filesToModify = draft.kind === "packaging" ? [] : [registrationTarget]
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

export function compileProjectGraph(blueprint: NormalizedBlueprint, presetId: PresetId): ProjectGraph {
  const preset = PRESETS[presetId]
  if (!preset) throw new Error(`Unknown preset: ${String(presetId)}`)
  const identity = projectIdentity(blueprint.projectName)
  const featureIds = allocateStableIds("FEAT", blueprint.features.map(feature => feature.name))
  const resolvedFeatures = resolveRequiredOwners(blueprint.features.map((feature, index): GraphFeature => ({
    id: featureIds[index]!,
    name: feature.name,
    ownerId: feature.providedCapabilities.includes(NATIVE_INSERTION_CAPABILITY) ? "OWN-PASTE-COORDINATOR" : `OWN-${featureIds[index]!.replace(/^FEAT-/, "")}`,
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
  })))
  const { features, acceptance, requirements } = lowerAcceptanceOwnership(resolvedFeatures)
  const mode = preset.runtimeMode(blueprint)
  const astroPlan = presetId === "astro-web" ? planAstroWeb(blueprint, features, mode) : undefined

  const { ownerDrafts, contracts } = buildOwnersAndContracts(blueprint, preset, identity, features, astroPlan)
  const { owners, phases } = buildPhases(preset, identity, ownerDrafts, contracts, features, requirements, acceptance, astroPlan, blueprint.externalServices)
  const persistenceEnabled = blueprint.persistenceNeeds.length > 0
  const persistenceDecision = persistenceEnabled
    ? astroPlan?.usesContentCollections
      ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.enabledDecision
      : astroPlan?.browserPersistence
        ? preset.persistence.enabledDecision
        : preset.persistence.enabledDecision
    : preset.persistence.disabledDecision
  const persistenceSettings = astroPlan?.usesContentCollections
    ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.settingsPlacement
    : preset.persistence.settingsPlacement
  const persistenceRecords = astroPlan?.usesContentCollections
    ? ASTRO_CONTENT_COLLECTION_PERSISTENCE.recordsPlacement.replace("{collection}", astroPlan.contentCollection)
    : preset.persistence.recordsPlacement

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
    foundationFiles: unique([...preset.sourceLayout(identity), ...(astroPlan?.foundationExtras ?? []), ...(astroPlan?.seedContentPaths ?? [])]),
    lockedStack: preset.allowedTechnologies,
    forbiddenTechnologies: preset.forbiddenTechnologies,
    testFramework: preset.testFramework,
    persistence: {
      enabled: persistenceEnabled,
      decision: persistenceDecision,
      settingsPlacement: persistenceSettings,
      recordsPlacement: persistenceRecords,
    },
    signingDecision: preset.signingDecision(identity),
    installationDecision: preset.installationDecision(identity),
    validationCommands: preset.validationCommands.map(command => command(identity)),
    packagingRules: preset.packagingRules,
    lifecycleRules: preset.lifecycleRules,
    accessibilityRules: preset.accessibilityRules,
    runtimeArchitecture: preset.runtimeArchitecture,
    integrationBoundary: preset.integrationBoundary,
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
  const failures = [...mechanicalIssues, ...readinessIssues, ...renderIssues, ...packetIssues]
  const ledger = buildValidationLedger(failures)
  return deepFreeze({
    presetId,
    projectSlug: graph.identity.slug,
    graph,
    documents,
    hashes,
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
  return DOCUMENT_NAMES.map(name => ({ name, content: packet.documents[name], sha256: packet.hashes[name] }))
}

export async function verifyPacketHashes(packet: CompiledPacket): Promise<boolean> {
  const current = await hashDocuments(packet.documents)
  return DOCUMENT_NAMES.every(name => current[name] === packet.hashes[name])
}
