import { invoke } from "@tauri-apps/api/core"
import type { CascadeApp } from "./app"
import { DOCUMENT_NAMES, compilePacket } from "./compiler"
import {
  JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID,
  JEV_FOREIGN_STACK_NOUL_ID,
  JEV_INTAKE_CLARITY_NOUL_ID,
  JEV_PLATFORM_NEEDS,
  JEV_PRESET_SELECTION_NOUL_ID,
  JEV_VIABILITY_NOUL_ID,
  jevDataStorageTierNoulId,
  jevFeatureCapabilityNoulId,
  jevFeatureVerifiableNoulId,
  jevPlatformNeedNoulId,
  type JevProvider,
} from "./jev"
import { DEFAULT_API_URL, type ProviderRequest } from "./pipeline"
import type { PresetId } from "./presets"
import type { SemanticBlueprint } from "./schema"
import {
  fileOrganizerBlueprint,
  habitTrackerBlueprint,
  knowledgeManagerBlueprint,
  landingPageBlueprint,
} from "../tests/fixtures/blueprints"
import { observedAcceptanceOwnershipVoiceBlueprint } from "../tests/fixtures/voice-v3-export"

const marker = "CASCADE_V3_FIXTURE_SMOKE"
export const smokeCases: ReadonlyArray<{ presetId: PresetId; blueprint: SemanticBlueprint }> = [
  { presetId: "native-macos-swiftui-desktop", blueprint: fileOrganizerBlueprint },
  { presetId: "native-macos-swiftui-menubar", blueprint: observedAcceptanceOwnershipVoiceBlueprint() },
  { presetId: "tauri2-rust-typescript-desktop", blueprint: knowledgeManagerBlueprint },
  { presetId: "astro-web", blueprint: landingPageBlueprint },
  { presetId: "android-kotlin-compose", blueprint: habitTrackerBlueprint },
]

export async function fixtureProvider(request: ProviderRequest): Promise<string> {
  const selected = smokeCases.find(item => request.instructions.includes(`Software idea: ${item.blueprint.productName}`))
  if (!selected) throw { kind: "invalid-wrapper", classification: "invalid-provider-wrapper" }
  return JSON.stringify(selected.blueprint)
}

/**
 * Deterministic Jev fixture for the fixture-smoke path: it confirms viability, echoes the
 * selected preset, reports exactly the platform needs the blueprint already declares, and
 * reports no foreign-stack leakage. Every smoke case therefore reaches gate-clean with the
 * same packet bytes as an unhealed compile and without any network call.
 */
export const fixtureJevProvider: JevProvider = async request => {
  if (request.state.phase === "atomic-audit") {
    const declared = new Set(request.state.blueprint.platformNeeds)
    return JSON.stringify({
      outcomes: [
        ...JEV_PLATFORM_NEEDS.map(need => ({ kind: "boolean", id: jevPlatformNeedNoulId(need), pTrue: declared.has(need) ? 1 : 0 })),
        { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0 },
        { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 1 },
        ...request.state.blueprint.features.flatMap((_, index) => [
          { kind: "boolean", id: jevFeatureVerifiableNoulId(index), pTrue: 1 },
          { kind: "choice", id: jevFeatureCapabilityNoulId(index), choice: "none", confidence: 1 },
        ]),
        ...request.state.blueprint.dataObjects.map((item, index) => {
          const tier = item.sensitivity === "sensitive" && /\b(?:api|key|token|credential)\b/i.test(item.name)
            ? "keychain"
            : /\b(?:history|records?|logs?)\b/i.test(item.name)
              ? "sqlite"
              : "userdefaults"
          return { kind: "choice", id: jevDataStorageTierNoulId(index), choice: tier, confidence: 1 }
        }),
      ],
    })
  }
  if (request.state.phase === "intake") {
    return JSON.stringify({
      outcomes: [
        { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 1 },
        { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: request.state.presetId ?? "native-macos-swiftui-desktop", confidence: 1 },
        { kind: "choice", id: JEV_INTAKE_CLARITY_NOUL_ID, choice: "clear", confidence: 0.95 },
        ...JEV_PLATFORM_NEEDS.map(need => ({ kind: "boolean", id: jevPlatformNeedNoulId(need), pTrue: 0 })),
      ],
    })
  }
  if (request.state.phase === "preflight") {
    return JSON.stringify({
      outcomes: [
        { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: 1 },
        { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: request.state.presetId, confidence: 1 },
      ],
    })
  }
  const declared = new Set(request.state.blueprint.platformNeeds)
  return JSON.stringify({
    outcomes: [
      ...JEV_PLATFORM_NEEDS.map(need => ({ kind: "boolean", id: jevPlatformNeedNoulId(need), pTrue: declared.has(need) ? 1 : 0 })),
      { kind: "boolean", id: JEV_FOREIGN_STACK_NOUL_ID, pTrue: 0 },
      { kind: "boolean", id: JEV_ACCEPTANCE_VERIFIABILITY_NOUL_ID, pTrue: 1 },
    ],
  })
}

async function record(root: string, passed: boolean, payload: unknown): Promise<void> {
  const receipt = JSON.stringify({
    marker: `${marker}_${passed ? "OK" : "FAIL"}`,
    ...payload as Record<string, unknown>,
  }, null, 2)
  await invoke("record_fixture_smoke", { parent: root, passed, receipt })
}

export async function runFixtureSmoke(app: CascadeApp): Promise<void> {
  const root = import.meta.env.VITE_CASCADE_SMOKE_ROOT
  if (!root) return
  // The smoke entry mounts with the blueprint fixture only; install the Jev fixture here so
  // the smoke run never reaches the jev_decide bridge command or the network.
  app.setJevProvider(fixtureJevProvider)
  const results: Array<Record<string, unknown>> = []

  try {
    for (const [index, testCase] of smokeCases.entries()) {
      app.setFormField("presetId", testCase.presetId)
      app.setFormField("model", index % 2 === 0 ? "deepseek-v4-pro" : "deepseek-v4-flash")
      app.setFormField("apiUrl", DEFAULT_API_URL)
      app.setFormField("apiKey", "fixture-smoke-memory-only-key")
      app.setFormField("jevApiKey", "fixture-smoke-memory-only-jev-key")
      app.setFormField("idea", testCase.blueprint.productName)

      const expected = await compilePacket(testCase.blueprint, testCase.presetId)
      const state = await app.generate()
      if (state.status !== "gate-clean" || !state.packet || !app.isExportEnabled()) {
        throw new Error("gate-clean assertion failed")
      }

      for (const name of DOCUMENT_NAMES) {
        app.selectDocument(name)
        if (app.getPreviewText() !== expected.documents[name]) throw new Error("preview byte assertion failed")
      }
      const path = await app.exportTo(root)
      results.push({
        presetId: testCase.presetId,
        project: testCase.blueprint.productName,
        model: state.form.model,
        documents: DOCUMENT_NAMES,
        hashes: state.packet.hashes,
        exportPath: path,
        previewBytesMatch: true,
      })
    }

    await record(root, true, { cases: results, exactFive: true, allTabsInspected: true })
  } catch {
    await record(root, false, { completedCases: results.length })
  }
}
