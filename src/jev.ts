import { PRESET_IDS, isPresetId, type PresetId } from "./presets"
import type { PlatformNeed, SemanticBlueprint, SemanticIssue } from "./schema"

/**
 * Jev decision boundary.
 *
 * Jev is remote structured decision inference: two bounded phases run against an injected
 * JevProvider (production: the `jev_decide` Tauri command; tests: local fixtures).
 *
 * - Preflight runs before the DeepSeek blueprint request. Its state carries only the idea
 *   text and the selected preset, and it asks one viability noul plus one preset choice
 *   noul over exactly PRESET_IDS.
 * - Postflight runs after blueprint validation. Its state carries the selected preset and
 *   the parsed SemanticBlueprint, and it asks seven platform-need nouls plus one
 *   foreign-stack leakage noul.
 *
 * Jev can only produce booleans, probabilities, one closed-set preset choice, and (through
 * add-only healing of platformNeeds) appended platform needs. It never produces IDs, files,
 * Markdown, prose, commands, or architecture, and every diagnostic it can surface is a
 * fixed local string that never echoes the idea, provider content, or keys.
 */

export const JEV_VIABILITY_THRESHOLD = 0.65
export const JEV_PRESET_MISMATCH_CONFIDENCE = 0.60
export const JEV_INTEGRITY_THRESHOLD = 0.70
export const JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD = 0.65

/** The seven platform needs Jev may infer, in the canonical append order. */
export const JEV_PLATFORM_NEEDS = [
  "audio-input",
  "camera",
  "clipboard",
  "global-hotkey",
  "accessibility-control",
  "notifications",
  "filesystem",
] as const satisfies readonly PlatformNeed[]

export type JevPlatformNeed = (typeof JEV_PLATFORM_NEEDS)[number]

export const JEV_VIABILITY_NOUL_ID = "viability"
export const JEV_PRESET_SELECTION_NOUL_ID = "preset-selection"
export const JEV_FOREIGN_STACK_NOUL_ID = "foreign-stack"
export const JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID = "acceptance-verifiability"
export const JEV_INTAKE_CLARITY_NOUL_ID = "clarity"
export const JEV_CLARITY_LEVELS = ["vague", "basic", "clear", "comprehensive"] as const
export type JevClarityLevel = (typeof JEV_CLARITY_LEVELS)[number]
export const JEV_PLATFORM_NEED_NOUL_PREFIX = "platform-need:"

export const JEV_STORAGE_TIERS = [
  "keychain",
  "sqlite",
  "userdefaults",
  "ephemeral",
  "filesystem",
] as const
export type JevStorageTier = (typeof JEV_STORAGE_TIERS)[number]

export const JEV_CAPABILITY_OPTIONS = [
  "none",
  ...JEV_PLATFORM_NEEDS,
] as const
export type JevCapabilityOption = (typeof JEV_CAPABILITY_OPTIONS)[number]

export function jevPlatformNeedNoulId(need: JevPlatformNeed): string {
  return `${JEV_PLATFORM_NEED_NOUL_PREFIX}${need}`
}

// Advisory only: calibrated against Jev jev-1.13, P(faithful) separated wrong features from correct
// ones too unreliably to block export, so low-scoring features are listed for the user to review.
export const JEV_IDEA_FIDELITY_REVIEW_THRESHOLD = 0.65
export const JEV_IDEA_FIDELITY_LEVELS = ["faithful", "questionable", "wrong"] as const
const JEV_IDEA_FIDELITY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  faithful: "every rule is faithful to the idea or is neutral extra detail",
  questionable: "rules are faithful but one is questionable",
  wrong: "at least one rule gives a result the idea's owner would call wrong",
}

export function jevFeatureIdeaFidelityNoulId(index: number): string {
  return `feat_${index}_idea_fidelity`
}

export function jevFeatureVerifiableNoulId(index: number): string {
  return `feat_${index}_verifiable`
}

export function jevFeatureCapabilityNoulId(index: number): string {
  return `feat_${index}_capability`
}

export function jevDataStorageTierNoulId(index: number): string {
  return `data_${index}_storage_tier`
}

/* ------------------------------------------------------------------ request types */

export interface JevBooleanNoul {
  readonly kind: "boolean"
  readonly id: string
  readonly question: string
}

export interface JevChoiceNoul {
  readonly kind: "choice"
  readonly id: string
  readonly question: string
  readonly options: readonly string[]
  readonly descriptions?: Readonly<Record<string, string>>
  readonly keepProbabilities?: boolean
}

export type JevNoul = JevBooleanNoul | JevChoiceNoul

export interface JevPreflightState {
  readonly phase: "preflight"
  readonly idea: string
  readonly presetId: PresetId
}

export interface JevPostflightState {
  readonly phase: "postflight"
  readonly presetId: PresetId
  readonly blueprint: SemanticBlueprint
}

export interface JevIntakeState {
  readonly phase: "intake"
  readonly idea: string
  readonly presetId?: PresetId
}

export interface JevAtomicAuditState {
  readonly phase: "atomic-audit"
  readonly presetId: PresetId
  readonly blueprint: SemanticBlueprint
  readonly idea?: string
}

export type JevRequestState = JevPreflightState | JevPostflightState | JevIntakeState | JevAtomicAuditState

export interface JevRequest {
  readonly requestId: string
  readonly apiKey: string
  readonly state: JevRequestState
  readonly nouls: readonly JevNoul[]
}

export type JevProvider = (request: JevRequest) => Promise<string>

/* ----------------------------------------------------------------- response types */

export interface JevBooleanOutcome {
  readonly kind: "boolean"
  readonly id: string
  readonly pTrue: number
}

export interface JevChoiceOutcome {
  readonly kind: "choice"
  readonly id: string
  readonly choice: string
  readonly confidence: number
  readonly probabilities?: Readonly<Record<string, number>>
}

export type JevOutcome = JevBooleanOutcome | JevChoiceOutcome

/* ------------------------------------------------------------------------- failures */

export type JevFailureKind = "transport" | "invalid-response"

export interface JevFailure {
  readonly kind: JevFailureKind
  readonly classification: string
}

const jevFailureClassifications: Readonly<Record<JevFailureKind, string>> = {
  transport: "jev-transport-failure",
  "invalid-response": "jev-invalid-response",
}

const jevFailureMessages: Readonly<Record<JevFailureKind, string>> = {
  transport: "The Jev decision request could not establish a safe connection.",
  "invalid-response": "The Jev decision response was not a closed, valid decision document.",
}

export function jevFailure(kind: JevFailureKind): JevFailure {
  return { kind, classification: jevFailureClassifications[kind] }
}

export function jevFailureIssue(failure: JevFailure): SemanticIssue {
  return { path: "$jev", rule: `jev.${failure.kind}`, message: jevFailureMessages[failure.kind] }
}

export function jevIntakeRejectedIssue(): SemanticIssue {
  return {
    path: "$jev",
    rule: "jev.intake-rejected",
    message: "Jev did not confirm this idea as viable, so no provider request was made.",
  }
}

export function jevForeignStackIssue(): SemanticIssue {
  return {
    path: "$jev",
    rule: "jev.foreign-stack-leakage",
    message: "Jev detected implementation instructions for a technology stack that conflicts with the selected preset.",
  }
}

export function jevUnverifiableAcceptanceIssue(): SemanticIssue {
  return {
    path: "$jev",
    rule: "jev.unverifiable-acceptance",
    message: "Jev detected feature acceptance signals that are not mechanically verifiable through tests or observable state changes.",
  }
}

/* ------------------------------------------------------------------------ decisions */

export interface JevPresetMismatch {
  readonly inferredPresetId: PresetId
  readonly confidence: number
}

export interface JevPreflightDecision {
  readonly viable: boolean
  readonly presetMismatch?: JevPresetMismatch
}

export interface JevAtomicFeatureAudit {
  readonly featureIndex: number
  readonly featureName: string
  readonly verifiable: boolean
  readonly verifiabilityScore: number
  readonly requiredCapability: JevCapabilityOption
  readonly capabilityConfidence: number
  readonly ideaFidelity?: number
}

export interface JevAtomicDataAudit {
  readonly dataIndex: number
  readonly dataName: string
  readonly storageTier: JevStorageTier
  readonly tierConfidence: number
}

export interface JevAtomicAuditDecision {
  readonly blueprint: SemanticBlueprint
  readonly addedPlatformNeeds: readonly JevPlatformNeed[]
  readonly foreignStackLeakage: boolean
  readonly unverifiableAcceptance: boolean
  readonly featureAudits: readonly JevAtomicFeatureAudit[]
  readonly dataAudits: readonly JevAtomicDataAudit[]
  readonly unverifiableFeatures: readonly JevAtomicFeatureAudit[]
  readonly featureIssues: readonly SemanticIssue[]
  readonly ideaReviewFeatures: readonly JevAtomicFeatureAudit[]
}

export interface JevPostflightDecision {
  readonly blueprint: SemanticBlueprint
  readonly addedPlatformNeeds: readonly JevPlatformNeed[]
  readonly foreignStackLeakage: boolean
  readonly unverifiableAcceptance: boolean
  readonly atomicAudits?: JevAtomicAuditDecision
}

export interface JevReport {
  readonly presetMismatch?: JevPresetMismatch
  readonly addedPlatformNeeds: readonly JevPlatformNeed[]
  readonly atomicAudits?: JevAtomicAuditDecision
}

export interface JevIntakeDecision {
  readonly viable: boolean
  readonly viabilityScore: number
  readonly recommendedPreset: PresetId
  readonly presetConfidence: number
  readonly clarity: JevClarityLevel
  readonly clarityScore: number
  readonly clarityConfidence: number
  readonly detectedCapabilities: readonly JevPlatformNeed[]
}

/* ------------------------------------------------------------------------- builders */

const viabilityQuestion = "Does the supplied idea describe a viable software product that can be implemented as one coherent application?"
const presetSelectionQuestion = "Which one of the supplied technology presets best matches the supplied idea? Choose exactly one of the supplied options."
const clarityQuestion = "How clearly and completely is this product described? Choose the best matching level."
const foreignStackQuestion = "Does the parsed blueprint contain implementation instructions for a technology stack that conflicts with the selected preset?"
const acceptanceVerifiabilityQuestion = "Are all feature acceptance signals in the parsed blueprint mechanically verifiable through automated unit/integration tests or concrete observable state changes rather than subjective human impression?"

function platformNeedQuestion(need: JevPlatformNeed): string {
  return `Does the parsed blueprint explicitly require the ${need} platform capability?`
}

export interface JevPreflightRequestInput {
  readonly requestId: string
  readonly apiKey: string
  readonly idea: string
  readonly presetId: PresetId
}

export interface JevPostflightRequestInput {
  readonly requestId: string
  readonly apiKey: string
  readonly presetId: PresetId
  readonly blueprint: SemanticBlueprint
  readonly atomicAuditor?: boolean
  readonly idea?: string
}

export interface JevAtomicAuditRequestInput {
  readonly requestId: string
  readonly apiKey: string
  readonly presetId: PresetId
  readonly blueprint: SemanticBlueprint
  readonly idea?: string
}

export function buildJevAtomicAuditRequest(input: JevAtomicAuditRequestInput): JevRequest {
  const nouls: JevNoul[] = [
    ...JEV_PLATFORM_NEEDS.map((need): JevBooleanNoul => ({
      kind: "boolean",
      id: jevPlatformNeedNoulId(need),
      question: platformNeedQuestion(need),
    })),
    { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, question: foreignStackQuestion },
    { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, question: acceptanceVerifiabilityQuestion },
  ]

  input.blueprint.features.forEach((feature, index) => {
    nouls.push({
      kind: "boolean",
      id: jevFeatureVerifiableNoulId(index),
      // Point Jev at the exact signals and allow OS test doubles; naming the feature alone made it
      // judge OS features by their names and block checkable notification or login signals.
      question: `Judge only the strings in \`blueprint.features[${index}].acceptanceSignals\`. Can an automated test assert every one of them by checking concrete values, app state, files, or the requests the app sends to operating-system APIs (a test double may stand in for the OS)? Answer false if any signal depends on a person's opinion or feeling.`,
    })
    if (input.idea) {
      nouls.push({
        kind: "choice",
        id: jevFeatureIdeaFidelityNoulId(index),
        question: `How faithfully do the rules in \`blueprint.features[${index}]\` follow what \`idea\` says or clearly means?`,
        options: JEV_IDEA_FIDELITY_LEVELS,
        descriptions: JEV_IDEA_FIDELITY_DESCRIPTIONS,
        keepProbabilities: true,
      })
    }
    nouls.push({
      kind: "choice",
      id: jevFeatureCapabilityNoulId(index),
      question: `Which OS platform capability does feature '${feature.name}' directly require? Choose 'none' if it only requires standard application logic.`,
      options: JEV_CAPABILITY_OPTIONS,
    })
  })

  input.blueprint.dataObjects.forEach((dataObject, index) => {
    nouls.push({
      kind: "choice",
      id: jevDataStorageTierNoulId(index),
      question: `What is the canonical persistence placement tier for data object '${dataObject.name}' (${dataObject.purpose})?`,
      options: JEV_STORAGE_TIERS,
    })
  })

  return {
    requestId: input.requestId,
    apiKey: input.apiKey,
    state: { phase: "atomic-audit", presetId: input.presetId, blueprint: input.blueprint, ...(input.idea ? { idea: input.idea } : {}) },
    nouls,
  }
}

export interface JevIntakeRequestInput {
  readonly requestId: string
  readonly apiKey: string
  readonly idea: string
  readonly presetId?: PresetId
}

export function buildJevIntakeRequest(input: JevIntakeRequestInput): JevRequest {
  return {
    requestId: input.requestId,
    apiKey: input.apiKey,
    state: { phase: "intake", idea: input.idea, ...(input.presetId ? { presetId: input.presetId } : {}) },
    nouls: [
      { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, question: viabilityQuestion },
      { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, question: presetSelectionQuestion, options: PRESET_IDS },
      { kind: "choice", id: JEV_INTAKE_CLARITY_NOUL_ID, question: clarityQuestion, options: JEV_CLARITY_LEVELS },
      ...JEV_PLATFORM_NEEDS.map((need): JevBooleanNoul => ({
        kind: "boolean",
        id: jevPlatformNeedNoulId(need),
        question: `Does this software product require the ${need} platform capability?`,
      })),
    ],
  }
}

export function buildJevPreflightRequest(input: JevPreflightRequestInput): JevRequest {
  return {
    requestId: input.requestId,
    apiKey: input.apiKey,
    state: { phase: "preflight", idea: input.idea, presetId: input.presetId },
    nouls: [
      { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, question: viabilityQuestion },
      { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, question: presetSelectionQuestion, options: PRESET_IDS },
    ],
  }
}

export function buildJevPostflightRequest(input: JevPostflightRequestInput): JevRequest {
  return {
    requestId: input.requestId,
    apiKey: input.apiKey,
    state: { phase: "postflight", presetId: input.presetId, blueprint: input.blueprint },
    nouls: [
      ...JEV_PLATFORM_NEEDS.map((need): JevBooleanNoul => ({
        kind: "boolean",
        id: jevPlatformNeedNoulId(need),
        question: platformNeedQuestion(need),
      })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, question: foreignStackQuestion },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, question: acceptanceVerifiabilityQuestion },
    ],
  }
}

/* ----------------------------------------------------------------------- validation */

export interface JevParsedResponse {
  readonly outcomes: readonly JevOutcome[]
}

export type JevResponseParseResult =
  | { readonly ok: true; readonly response: JevParsedResponse }
  | { readonly ok: false }

function plainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(source: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(source)
  return actual.length === keys.length && keys.every(key => Object.hasOwn(source, key))
}

function validProbability(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1
}

/**
 * Closed validation of a raw Jev response string against the nouls that were requested.
 * Any deviation (invalid JSON, missing/extra/duplicate outcomes, wrong kinds, ids outside
 * the requested set, probabilities outside [0, 1], or choice values outside the requested
 * options) fails closed.
 */
export function parseJevResponse(text: unknown, nouls: readonly JevNoul[]): JevResponseParseResult {
  if (typeof text !== "string") return { ok: false }

  let value: unknown
  try {
    value = JSON.parse(text.trim())
  } catch {
    return { ok: false }
  }
  if (!plainRecord(value) || !hasExactKeys(value, ["outcomes"])) return { ok: false }

  const rawOutcomes = value.outcomes
  if (!Array.isArray(rawOutcomes) || rawOutcomes.length !== nouls.length) return { ok: false }

  const expected = new Map<string, JevNoul>()
  for (const noul of nouls) {
    if (expected.has(noul.id)) return { ok: false }
    expected.set(noul.id, noul)
  }

  const outcomes: JevOutcome[] = []
  const seen = new Set<string>()
  for (const raw of rawOutcomes) {
    if (!plainRecord(raw)) return { ok: false }
    const { kind, id } = raw
    if (typeof kind !== "string" || typeof id !== "string" || seen.has(id)) return { ok: false }
    const noul = expected.get(id)
    if (!noul) return { ok: false }

    if (kind === "boolean") {
      if (noul.kind !== "boolean" || !hasExactKeys(raw, ["kind", "id", "pTrue"]) || !validProbability(raw.pTrue)) return { ok: false }
      outcomes.push({ kind: "boolean", id, pTrue: raw.pTrue })
    } else if (kind === "choice") {
      const withProbabilities = hasExactKeys(raw, ["kind", "id", "choice", "confidence", "probabilities"])
      if (noul.kind !== "choice" || !(withProbabilities || hasExactKeys(raw, ["kind", "id", "choice", "confidence"]))) return { ok: false }
      const { choice, confidence, probabilities } = raw
      if (typeof choice !== "string" || !noul.options.includes(choice) || !validProbability(confidence)) return { ok: false }
      if (!withProbabilities) {
        outcomes.push({ kind: "choice", id, choice, confidence })
      } else {
        if (!plainRecord(probabilities) || !Object.entries(probabilities).every(([option, value]) => noul.options.includes(option) && validProbability(value))) return { ok: false }
        outcomes.push({ kind: "choice", id, choice, confidence, probabilities: probabilities as Record<string, number> })
      }
    } else {
      return { ok: false }
    }
    seen.add(id)
  }

  return { ok: true, response: { outcomes } }
}

/* ----------------------------------------------------------------------- evaluation */

function probabilityOf(outcomes: readonly JevOutcome[], id: string): number {
  const outcome = outcomes.find((item): item is JevBooleanOutcome => item.kind === "boolean" && item.id === id)
  return outcome?.pTrue ?? 0
}

function choiceOf(outcomes: readonly JevOutcome[], id: string): JevChoiceOutcome | undefined {
  return outcomes.find((item): item is JevChoiceOutcome => item.kind === "choice" && item.id === id)
}

export function evaluateJevPreflight(outcomes: readonly JevOutcome[], selectedPresetId: PresetId): JevPreflightDecision {
  const viable = probabilityOf(outcomes, JEV_VIABILITY_NOUL_ID) >= JEV_VIABILITY_THRESHOLD
  const selection = choiceOf(outcomes, JEV_PRESET_SELECTION_NOUL_ID)
  const presetMismatch = selection !== undefined
    && isPresetId(selection.choice)
    && selection.choice !== selectedPresetId
    && selection.confidence >= JEV_PRESET_MISMATCH_CONFIDENCE
      ? { inferredPresetId: selection.choice, confidence: selection.confidence }
      : undefined
  return { viable, ...(presetMismatch ? { presetMismatch } : {}) }
}

/**
 * Add-only healing: the declared blueprint is cloned and every inferred need that is not
 * already declared is appended in the seven-value canonical order. Declared order is
 * preserved exactly and nothing is ever removed, reordered, or renamed.
 */
export function healBlueprintPlatformNeeds(
  blueprint: SemanticBlueprint,
  inferredNeeds: readonly JevPlatformNeed[],
): { readonly blueprint: SemanticBlueprint; readonly addedPlatformNeeds: readonly JevPlatformNeed[] } {
  const declared = new Set<PlatformNeed>(blueprint.platformNeeds)
  const inferred = new Set<JevPlatformNeed>(inferredNeeds)
  const addedPlatformNeeds = JEV_PLATFORM_NEEDS.filter(need => inferred.has(need) && !declared.has(need))
  return {
    blueprint: { ...blueprint, platformNeeds: [...blueprint.platformNeeds, ...addedPlatformNeeds] },
    addedPlatformNeeds,
  }
}

export function evaluateJevPostflight(outcomes: readonly JevOutcome[], blueprint: SemanticBlueprint): JevPostflightDecision {
  const inferredNeeds = JEV_PLATFORM_NEEDS.filter(need => probabilityOf(outcomes, jevPlatformNeedNoulId(need)) >= JEV_INTEGRITY_THRESHOLD)
  const foreignStackLeakage = probabilityOf(outcomes, JEV_FOREIGN_STACK_NOUL_ID) >= JEV_INTEGRITY_THRESHOLD
  const unverifiableAcceptance = probabilityOf(outcomes, JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID) < JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD
  const healed = healBlueprintPlatformNeeds(blueprint, inferredNeeds)
  return {
    blueprint: healed.blueprint,
    addedPlatformNeeds: healed.addedPlatformNeeds,
    foreignStackLeakage,
    unverifiableAcceptance,
  }
}

export function evaluateJevAtomicAudit(outcomes: readonly JevOutcome[], blueprint: SemanticBlueprint): JevAtomicAuditDecision {
  const foreignStackLeakage = probabilityOf(outcomes, JEV_FOREIGN_STACK_NOUL_ID) >= JEV_INTEGRITY_THRESHOLD
  const overallVerifiableProb = probabilityOf(outcomes, JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID)
  const overallVerifiable = overallVerifiableProb >= JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD

  const featureAudits: JevAtomicFeatureAudit[] = blueprint.features.map((feature, index) => {
    const verifiabilityScore = probabilityOf(outcomes, jevFeatureVerifiableNoulId(index))
    const verifiable = verifiabilityScore >= JEV_ACCEPTANCE_VERIFIABILITY_THRESHOLD
    const capOutcome = choiceOf(outcomes, jevFeatureCapabilityNoulId(index))
    const requiredCapability: JevCapabilityOption = capOutcome && (JEV_CAPABILITY_OPTIONS as readonly string[]).includes(capOutcome.choice)
      ? (capOutcome.choice as JevCapabilityOption)
      : "none"
    const capabilityConfidence = capOutcome?.confidence ?? 0
    const fidelityOutcome = choiceOf(outcomes, jevFeatureIdeaFidelityNoulId(index))
    const ideaFidelity = fidelityOutcome?.probabilities?.faithful
    return {
      featureIndex: index,
      featureName: feature.name,
      verifiable,
      verifiabilityScore,
      requiredCapability,
      capabilityConfidence,
      ...(ideaFidelity === undefined ? {} : { ideaFidelity }),
    }
  })

  const dataAudits: JevAtomicDataAudit[] = blueprint.dataObjects.map((dataObject, index) => {
    const tierOutcome = choiceOf(outcomes, jevDataStorageTierNoulId(index))
    const storageTier: JevStorageTier = tierOutcome && (JEV_STORAGE_TIERS as readonly string[]).includes(tierOutcome.choice)
      ? (tierOutcome.choice as JevStorageTier)
      : "userdefaults"
    const tierConfidence = tierOutcome?.confidence ?? 0
    return {
      dataIndex: index,
      dataName: dataObject.name,
      storageTier,
      tierConfidence,
    }
  })

  const directlyInferredNeeds = JEV_PLATFORM_NEEDS.filter(need => probabilityOf(outcomes, jevPlatformNeedNoulId(need)) >= JEV_INTEGRITY_THRESHOLD)
  const confidentFeatureNeeds = new Map(featureAudits
    .filter(f => f.requiredCapability !== "none" && f.capabilityConfidence >= JEV_INTEGRITY_THRESHOLD)
    .map(f => [f.featureIndex, f.requiredCapability as JevPlatformNeed]))
  const combinedInferredNeeds = Array.from(new Set([...directlyInferredNeeds, ...confidentFeatureNeeds.values()]))

  const healed = healBlueprintPlatformNeeds({
    ...blueprint,
    features: blueprint.features.map((feature, index) => {
      const need = confidentFeatureNeeds.get(index)
      // File access is granted only through declared documents, so it is never healed onto a feature.
      return need && need !== "filesystem" && !feature.usesPlatformNeeds.includes(need)
        ? { ...feature, usesPlatformNeeds: [...feature.usesPlatformNeeds, need] }
        : feature
    }),
  }, combinedInferredNeeds)

  const unverifiableFeatures = featureAudits.filter(f => !f.verifiable)
  const unverifiableAcceptance = featureAudits.length > 0
    ? unverifiableFeatures.length > 0
    : !overallVerifiable

  const featureIssues: SemanticIssue[] = unverifiableFeatures.map(f => ({
    path: `features[${f.featureIndex}].acceptanceSignals`,
    rule: "jev.feature-unverifiable-acceptance",
    message: `Jev detected feature acceptance signals for '${f.featureName}' that are not mechanically verifiable through tests or observable state changes.`,
  }))

  return {
    blueprint: healed.blueprint,
    addedPlatformNeeds: healed.addedPlatformNeeds,
    foreignStackLeakage,
    unverifiableAcceptance,
    featureAudits,
    dataAudits,
    unverifiableFeatures,
    featureIssues,
    ideaReviewFeatures: featureAudits.filter(f => f.ideaFidelity !== undefined && f.ideaFidelity < JEV_IDEA_FIDELITY_REVIEW_THRESHOLD),
  }
}

export function evaluateJevIntake(outcomes: readonly JevOutcome[]): JevIntakeDecision {
  const viabilityScore = probabilityOf(outcomes, JEV_VIABILITY_NOUL_ID)
  const viable = viabilityScore >= JEV_VIABILITY_THRESHOLD
  const selection = choiceOf(outcomes, JEV_PRESET_SELECTION_NOUL_ID)
  const recommendedPreset: PresetId = selection && isPresetId(selection.choice) ? selection.choice : "tauri2-rust-typescript-desktop"
  const presetConfidence = selection?.confidence ?? 0
  const clarityChoice = choiceOf(outcomes, JEV_INTAKE_CLARITY_NOUL_ID)
  const clarity: JevClarityLevel = clarityChoice && (JEV_CLARITY_LEVELS as readonly string[]).includes(clarityChoice.choice)
    ? (clarityChoice.choice as JevClarityLevel)
    : "vague"
  const clarityScore = JEV_CLARITY_LEVELS.indexOf(clarity)
  const clarityConfidence = clarityChoice?.confidence ?? 0
  const detectedCapabilities = JEV_PLATFORM_NEEDS.filter(need => probabilityOf(outcomes, jevPlatformNeedNoulId(need)) >= JEV_INTEGRITY_THRESHOLD)

  return {
    viable,
    viabilityScore,
    recommendedPreset,
    presetConfidence,
    clarity,
    clarityScore,
    clarityConfidence,
    detectedCapabilities,
  }
}

/* --------------------------------------------------------------------- phase runners */

export type JevIntakeRun =
  | { readonly ok: true; readonly decision: JevIntakeDecision }
  | { readonly ok: false; readonly failure: JevFailure }

export type JevAtomicAuditRun =
  | { readonly ok: true; readonly decision: JevAtomicAuditDecision }
  | { readonly ok: false; readonly failure: JevFailure }

export type JevPreflightRun =
  | { readonly ok: true; readonly decision: JevPreflightDecision }
  | { readonly ok: false; readonly failure: JevFailure }

export type JevPostflightRun =
  | { readonly ok: true; readonly decision: JevPostflightDecision }
  | { readonly ok: false; readonly failure: JevFailure }

export async function runJevIntake(input: JevIntakeRequestInput, provider: JevProvider): Promise<JevIntakeRun> {
  const request = buildJevIntakeRequest(input)
  let text: unknown
  try {
    text = await provider(request)
  } catch {
    return { ok: false, failure: jevFailure("transport") }
  }
  const parsed = parseJevResponse(text, request.nouls)
  if (!parsed.ok) return { ok: false, failure: jevFailure("invalid-response") }
  return { ok: true, decision: evaluateJevIntake(parsed.response.outcomes) }
}

export async function runJevAtomicAudit(input: JevAtomicAuditRequestInput, provider: JevProvider): Promise<JevAtomicAuditRun> {
  const request = buildJevAtomicAuditRequest(input)
  let text: unknown
  try {
    text = await provider(request)
  } catch {
    return { ok: false, failure: jevFailure("transport") }
  }
  const parsed = parseJevResponse(text, request.nouls)
  if (!parsed.ok) return { ok: false, failure: jevFailure("invalid-response") }
  return { ok: true, decision: evaluateJevAtomicAudit(parsed.response.outcomes, input.blueprint) }
}

export async function runJevPreflight(input: JevPreflightRequestInput, provider: JevProvider): Promise<JevPreflightRun> {
  const request = buildJevPreflightRequest(input)
  let text: unknown
  try {
    text = await provider(request)
  } catch {
    return { ok: false, failure: jevFailure("transport") }
  }
  const parsed = parseJevResponse(text, request.nouls)
  if (!parsed.ok) return { ok: false, failure: jevFailure("invalid-response") }
  return { ok: true, decision: evaluateJevPreflight(parsed.response.outcomes, input.presetId) }
}

export async function runJevPostflight(input: JevPostflightRequestInput, provider: JevProvider): Promise<JevPostflightRun> {
  if (input.atomicAuditor) {
    const auditRun = await runJevAtomicAudit({
      requestId: input.requestId,
      apiKey: input.apiKey,
      presetId: input.presetId,
      blueprint: input.blueprint,
      ...(input.idea ? { idea: input.idea } : {}),
    }, provider)
    if (!auditRun.ok) return auditRun
    return {
      ok: true,
      decision: {
        blueprint: auditRun.decision.blueprint,
        addedPlatformNeeds: auditRun.decision.addedPlatformNeeds,
        foreignStackLeakage: auditRun.decision.foreignStackLeakage,
        unverifiableAcceptance: auditRun.decision.unverifiableAcceptance,
        atomicAudits: auditRun.decision,
      },
    }
  }
  const request = buildJevPostflightRequest(input)
  let text: unknown
  try {
    text = await provider(request)
  } catch {
    return { ok: false, failure: jevFailure("transport") }
  }
  const parsed = parseJevResponse(text, request.nouls)
  if (!parsed.ok) return { ok: false, failure: jevFailure("invalid-response") }
  return { ok: true, decision: evaluateJevPostflight(parsed.response.outcomes, input.blueprint) }
}

/* ---------------------------------------------------------------------- diagnostics */

export function jevPresetMismatchDetail(mismatch: JevPresetMismatch): string {
  return `Jev inferred ${mismatch.inferredPresetId} at confidence ${mismatch.confidence.toFixed(2)}. The selected preset remains authoritative.`
}

export function jevHealedNeedsDetail(needs: readonly JevPlatformNeed[]): string {
  return `Jev added missing platform needs in canonical order: ${needs.join(", ")}.`
}
