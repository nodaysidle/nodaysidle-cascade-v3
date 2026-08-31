import { invoke } from "@tauri-apps/api/core"
import type { CascadeApp } from "./app"
import { DOCUMENT_NAMES, compilePacket } from "./compiler"
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
const smokeCases: ReadonlyArray<{ presetId: PresetId; blueprint: SemanticBlueprint }> = [
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
  const results: Array<Record<string, unknown>> = []

  try {
    for (const [index, testCase] of smokeCases.entries()) {
      app.setFormField("presetId", testCase.presetId)
      app.setFormField("model", index % 2 === 0 ? "deepseek-v4-pro" : "deepseek-v4-flash")
      app.setFormField("apiUrl", DEFAULT_API_URL)
      app.setFormField("apiKey", "fixture-smoke-memory-only-key")
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
