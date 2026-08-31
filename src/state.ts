import type { AuditEntry } from "./audit"
import type { CompiledPacket } from "./compiler"
import { DEFAULT_API_URL, isSafeProviderUrl, type ProgressStage, type ProviderFailure, type ProviderModel } from "./pipeline"
import { PRESET_IDS, type PresetId } from "./presets"
import type { SemanticIssue } from "./schema"

export type AppStatus = "empty" | "ready" | "generating" | "cancelling" | "provider-failure" | "blueprint-validation-failed" | "local-normalization-failed" | "local-compiler-failure" | "lint-failure" | "gate-clean" | "export-success" | "cancelled"

export interface FormState {
  readonly presetId: PresetId
  readonly model: ProviderModel
  readonly apiUrl: string
  readonly apiKey: string
  readonly idea: string
}

export interface AppState {
  readonly form: FormState
  readonly status: AppStatus
  readonly progress?: ProgressStage
  readonly activeRequestId?: string
  readonly packet?: CompiledPacket
  readonly ledger: readonly AuditEntry[]
  readonly failure?: ProviderFailure
  readonly issues: readonly SemanticIssue[]
  readonly exportPath?: string
}

export type AppAction =
  | { readonly type: "form-changed"; readonly field: keyof FormState; readonly value: string }
  | { readonly type: "generation-started"; readonly requestId: string }
  | { readonly type: "progressed"; readonly stage: ProgressStage }
  | { readonly type: "cancel-requested" }
  | { readonly type: "generation-failed"; readonly status: Extract<AppStatus, "provider-failure" | "blueprint-validation-failed" | "local-normalization-failed" | "local-compiler-failure" | "lint-failure" | "cancelled">; readonly failure?: ProviderFailure; readonly issues: readonly SemanticIssue[] }
  | { readonly type: "generation-succeeded"; readonly packet: CompiledPacket }
  | { readonly type: "export-succeeded"; readonly path: string }

const defaultForm: FormState = {
  presetId: "native-macos-swiftui-desktop",
  model: "deepseek-v4-pro",
  apiUrl: DEFAULT_API_URL,
  apiKey: "",
  idea: "",
}

function validModel(value: string): value is ProviderModel {
  return value === "deepseek-v4-pro" || value === "deepseek-v4-flash"
}

function validPreset(value: string): value is PresetId {
  return (PRESET_IDS as readonly string[]).includes(value)
}

export function createInitialState(initial: Partial<FormState> = {}): AppState {
  const form = { ...defaultForm, ...initial }
  const state: AppState = { form, status: "empty", ledger: [], issues: [] }
  return { ...state, status: canGenerate(state) ? "ready" : "empty" }
}

export function canGenerate(state: AppState): boolean {
  return state.form.idea.trim().length > 0
    && state.form.apiKey.length > 0
    && isSafeProviderUrl(state.form.apiUrl)
    && validPreset(state.form.presetId)
    && validModel(state.form.model)
    && !["generating", "cancelling"].includes(state.status)
}

export function canExport(state: AppState): boolean {
  return (state.status === "gate-clean" || state.status === "export-success") && state.packet?.exportable === true
}

export function visibleIssues(state: AppState): readonly SemanticIssue[] {
  return state.issues
}

export function statusActionLabel(state: AppState): "Generate" | "Retry" {
  return ["provider-failure", "blueprint-validation-failed", "local-normalization-failed", "local-compiler-failure", "lint-failure", "cancelled"].includes(state.status) ? "Retry" : "Generate"
}

export function reduceAppState(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "form-changed": {
      const form = { ...state.form, [action.field]: action.value } as FormState
      const next = { ...state, form, packet: undefined, ledger: [], issues: [], failure: undefined, exportPath: undefined }
      return { ...next, status: canGenerate(next) ? "ready" : "empty" }
    }
    case "generation-started":
      return { ...state, status: "generating", progress: "provider", activeRequestId: action.requestId, packet: undefined, ledger: [], issues: [], failure: undefined, exportPath: undefined }
    case "progressed":
      return { ...state, status: "generating", progress: action.stage }
    case "cancel-requested":
      return { ...state, status: "cancelling" }
    case "generation-failed":
      return { ...state, status: action.status, activeRequestId: undefined, packet: undefined, ledger: [], issues: action.issues, failure: action.failure }
    case "generation-succeeded":
      return { ...state, form: { ...state.form, apiKey: "" }, status: "gate-clean", progress: "export-gate", activeRequestId: undefined, packet: action.packet, ledger: action.packet.ledger, issues: [], failure: undefined }
    case "export-succeeded":
      return { ...state, status: "export-success", exportPath: action.path }
  }
}
