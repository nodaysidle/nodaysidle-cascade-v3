import { describe, expect, it, vi } from "vitest"
import { mountApp } from "../src/app"
import {
  buildJevIntakeRequest,
  evaluateJevIntake,
  JEV_CLARITY_LEVELS,
  JEV_INTAKE_CLARITY_NOUL_ID,
  JEV_PLATFORM_NEEDS,
  JEV_PRESET_SELECTION_NOUL_ID,
  JEV_VIABILITY_NOUL_ID,
  jevPlatformNeedNoulId,
  parseJevResponse,
  runJevIntake,
  type JevProvider,
} from "../src/jev"
import { PRESET_IDS } from "../src/presets"

function makeIntakeResponseJson(options: {
  viability?: number
  preset?: string
  confidence?: number
  clarity?: string
  clarityConfidence?: number
  capabilities?: Record<string, number>
}): string {
  const viability = options.viability ?? 0.92
  const preset = options.preset ?? "native-macos-swiftui-menubar"
  const confidence = options.confidence ?? 0.95
  const clarity = options.clarity ?? "clear"
  const clarityConfidence = options.clarityConfidence ?? 0.88
  const caps = options.capabilities ?? {}

  return JSON.stringify({
    outcomes: [
      { kind: "boolean", id: JEV_VIABILITY_NOUL_ID, pTrue: viability },
      { kind: "choice", id: JEV_PRESET_SELECTION_NOUL_ID, choice: preset, confidence },
      { kind: "choice", id: JEV_INTAKE_CLARITY_NOUL_ID, choice: clarity, confidence: clarityConfidence },
      ...JEV_PLATFORM_NEEDS.map(need => ({
        kind: "boolean",
        id: jevPlatformNeedNoulId(need),
        pTrue: caps[need] ?? 0.05,
      })),
    ],
  })
}

class MockElement {
  id = ""
  className = ""
  hidden = false
  textContent = ""
  innerHTML = ""
  value = ""
  disabled = false
  dataset: Record<string, string> = {}
  title = ""
  tabIndex = 0
  listeners: Record<string, Array<(event: unknown) => void>> = {}

  classList = {
    toggle: (cls: string, force?: boolean) => {
      const classes = new Set(this.className.split(" ").filter(Boolean))
      const add = force !== undefined ? force : !classes.has(cls)
      if (add) classes.add(cls)
      else classes.delete(cls)
      this.className = [...classes].join(" ")
      return add
    },
    remove: (cls: string) => {
      this.className = this.className.split(" ").filter(c => c !== cls).join(" ")
    },
    add: (cls: string) => {
      const classes = new Set(this.className.split(" ").filter(Boolean))
      classes.add(cls)
      this.className = [...classes].join(" ")
    },
    contains: (cls: string) => this.className.split(" ").includes(cls),
  }

  addEventListener(event: string, handler: (e: unknown) => void) {
    this.listeners[event] = this.listeners[event] ?? []
    this.listeners[event].push(handler)
  }

  dispatchEvent(event: { type: string }) {
    for (const h of this.listeners[event.type] ?? []) h(event)
  }

  click() {
    this.dispatchEvent({ type: "click" })
  }

  setAttribute(name: string, value: string) {
    this.dataset[name] = value
  }

  querySelectorAll(_selector: string): MockElement[] {
    return []
  }

  querySelector(_selector: string): MockElement | null {
    return null
  }
}

class MockSelectElement extends MockElement {}
;(globalThis as unknown as { HTMLSelectElement: unknown }).HTMLSelectElement = MockSelectElement
;(globalThis as unknown as { window: unknown }).window = globalThis

function setupMockDom() {
  const elements = new Map<string, MockElement>()

  function getOrCreate(key: string): MockElement {
    if (!elements.has(key)) {
      const el = (key === "#preset" || key === "#model") ? new MockSelectElement() : new MockElement()
      if (key.startsWith("#")) el.id = key.slice(1)
      if (key.startsWith(".")) el.className = key.slice(1)
      elements.set(key, el)
    }
    return elements.get(key)!
  }

  const meterSteps = [new MockElement(), new MockElement(), new MockElement(), new MockElement()]
  for (const s of meterSteps) s.className = "meter-step"

  getOrCreate("#intake-evaluating").hidden = true
  getOrCreate("#intake-feedback").hidden = true
  getOrCreate("#intake-apply-preset").hidden = true
  getOrCreate("#intake-capabilities").hidden = true

  const root = getOrCreate("#app")
  root.querySelector = (sel: string) => getOrCreate(sel)
  root.querySelectorAll = (sel: string) => {
    if (sel === "[role=tab]") return []
    if (sel === ".meter-step") return meterSteps
    return []
  }

  const meter = getOrCreate("#intake-clarity-meter")
  meter.querySelectorAll = (sel: string) => {
    if (sel === ".meter-step") return meterSteps
    return []
  }

  ;(globalThis as unknown as { document: unknown }).document = {
    querySelector: (sel: string) => {
      if (sel === "#app") return root
      return getOrCreate(sel)
    },
  }

  return { root, elements, meterSteps, getOrCreate }
}

describe("Jev Intake Boundary (Opportunity 1)", () => {
  it("builds a closed intake request with all 10 nouls", () => {
    const request = buildJevIntakeRequest({
      requestId: "test-intake-1",
      apiKey: "test-jev-key",
      idea: "A menu bar utility that monitors network ping and shows notifications.",
      presetId: "native-macos-swiftui-menubar",
    })

    expect(request.requestId).toBe("test-intake-1")
    expect(request.apiKey).toBe("test-jev-key")
    expect(request.state).toEqual({
      phase: "intake",
      idea: "A menu bar utility that monitors network ping and shows notifications.",
      presetId: "native-macos-swiftui-menubar",
    })

    expect(request.nouls).toHaveLength(10)
    const viabilityNoul = request.nouls.find(n => n.id === JEV_VIABILITY_NOUL_ID)
    expect(viabilityNoul?.kind).toBe("boolean")

    const presetNoul = request.nouls.find(n => n.id === JEV_PRESET_SELECTION_NOUL_ID)
    expect(presetNoul?.kind).toBe("choice")
    if (presetNoul?.kind === "choice") {
      expect(presetNoul.options).toEqual(PRESET_IDS)
    }

    const clarityNoul = request.nouls.find(n => n.id === JEV_INTAKE_CLARITY_NOUL_ID)
    expect(clarityNoul?.kind).toBe("choice")
    if (clarityNoul?.kind === "choice") {
      expect(clarityNoul.options).toEqual(JEV_CLARITY_LEVELS)
    }

    for (const need of JEV_PLATFORM_NEEDS) {
      const needNoul = request.nouls.find(n => n.id === jevPlatformNeedNoulId(need))
      expect(needNoul?.kind).toBe("boolean")
    }
  })

  it("parses and validates closed intake response", () => {
    const request = buildJevIntakeRequest({
      requestId: "test-intake-2",
      apiKey: "test-jev-key",
      idea: "A screen recording app with global shortcuts.",
    })

    const rawJson = makeIntakeResponseJson({
      viability: 0.95,
      preset: "native-macos-swiftui-desktop",
      clarity: "comprehensive",
      capabilities: {
        camera: 0.9,
        "global-hotkey": 0.85,
      },
    })

    const parsed = parseJevResponse(rawJson, request.nouls)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const decision = evaluateJevIntake(parsed.response.outcomes)
    expect(decision.viable).toBe(true)
    expect(decision.viabilityScore).toBe(0.95)
    expect(decision.recommendedPreset).toBe("native-macos-swiftui-desktop")
    expect(decision.presetConfidence).toBe(0.95)
    expect(decision.clarity).toBe("comprehensive")
    expect(decision.clarityScore).toBe(3)
    expect(decision.detectedCapabilities).toEqual(["camera", "global-hotkey"])
  })

  it("handles low viability and vague clarity", () => {
    const request = buildJevIntakeRequest({
      requestId: "test-intake-3",
      apiKey: "test-jev-key",
      idea: "An app that is cool.",
    })

    const rawJson = makeIntakeResponseJson({
      viability: 0.35,
      preset: "astro-web",
      confidence: 0.5,
      clarity: "vague",
      clarityConfidence: 0.9,
    })

    const parsed = parseJevResponse(rawJson, request.nouls)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    const decision = evaluateJevIntake(parsed.response.outcomes)
    expect(decision.viable).toBe(false)
    expect(decision.viabilityScore).toBe(0.35)
    expect(decision.clarity).toBe("vague")
    expect(decision.clarityScore).toBe(0)
    expect(decision.detectedCapabilities).toEqual([])
  })

  it("fails closed on transport error or invalid payload", async () => {
    const failingProvider: JevProvider = async () => {
      throw new Error("network disconnect")
    }

    const runFail = await runJevIntake(
      { requestId: "fail-1", apiKey: "key", idea: "Valid idea text" },
      failingProvider,
    )
    expect(runFail.ok).toBe(false)
    if (!runFail.ok) {
      expect(runFail.failure.kind).toBe("transport")
    }

    const badJsonProvider: JevProvider = async () => '{"outcomes": "not-an-array"}'
    const runBad = await runJevIntake(
      { requestId: "fail-2", apiKey: "key", idea: "Valid idea text" },
      badJsonProvider,
    )
    expect(runBad.ok).toBe(false)
    if (!runBad.ok) {
      expect(runBad.failure.kind).toBe("invalid-response")
    }
  })
})

describe("Live Intake Co-Pilot UI Integration", () => {
  it("renders live intake feedback, displays clarity meter, and applies preset suggestion on click", async () => {
    const { meterSteps, getOrCreate } = setupMockDom()

    const mockJevProvider: JevProvider = vi.fn(async request => {
      if (request.state.phase === "intake") {
        return makeIntakeResponseJson({
          viability: 0.94,
          preset: "native-macos-swiftui-menubar",
          confidence: 0.96,
          clarity: "clear",
          clarityConfidence: 0.85,
          capabilities: {
            "accessibility-control": 0.88,
            "global-hotkey": 0.92,
          },
        })
      }
      return '{"outcomes":[]}'
    })

    const mockBlueprintProvider = vi.fn(async () => "{}")

    const app = mountApp(mockBlueprintProvider, mockJevProvider)

    const feedbackEl = getOrCreate("#intake-feedback")
    const viabilityEl = getOrCreate("#intake-viability")
    const clarityEl = getOrCreate("#intake-clarity")
    const presetLabelEl = getOrCreate("#intake-preset-label")
    const applyButton = getOrCreate("#intake-apply-preset")
    const capabilitiesEl = getOrCreate("#intake-capabilities")
    const capabilitiesList = getOrCreate("#intake-capabilities-list")
    const presetSelect = getOrCreate("#preset")

    // Initially hidden
    expect(feedbackEl.hidden).toBe(true)

    // Typing does not call Jev. Evaluation runs on blur or an explicit check.
    app.setFormField("jevApiKey", "test-jev-api-key")
    app.setFormField("idea", "Short idea")
    await app.triggerIntakeEvaluation()
    expect(mockJevProvider).not.toHaveBeenCalled()
    expect(feedbackEl.hidden).toBe(true)

    app.setFormField("idea", "A menu bar utility that lets users trigger quick text expansion via global hotkey.")
    expect(mockJevProvider).not.toHaveBeenCalled()
    await app.triggerIntakeEvaluation()

    expect(mockJevProvider).toHaveBeenCalled()
    expect(feedbackEl.hidden).toBe(false)
    expect(viabilityEl.textContent).toContain("Viable (94%)")
    expect(clarityEl.textContent).toContain("Clarity: Clear (3/4)")

    // Clarity meter: score 2 = indices 0, 1, 2 active
    expect(meterSteps[0]!.classList.contains("active")).toBe(true)
    expect(meterSteps[1]!.classList.contains("active")).toBe(true)
    expect(meterSteps[2]!.classList.contains("active")).toBe(true)
    expect(meterSteps[3]!.classList.contains("active")).toBe(false)

    // Preset recommendation
    expect(presetLabelEl.textContent).toContain("Recommended: Native macOS SwiftUI Menu Bar (96% match)")
    expect(applyButton.hidden).toBe(false)
    expect(applyButton.textContent).toContain("Switch to Native macOS SwiftUI Menu Bar")

    // Detected capabilities
    expect(capabilitiesEl.hidden).toBe(false)
    expect(capabilitiesList.innerHTML).toContain("accessibility-control")
    expect(capabilitiesList.innerHTML).toContain("global-hotkey")

    // Click Apply Preset button
    applyButton.click()
    expect(presetSelect.value).toBe("native-macos-swiftui-menubar")
    expect(app.getState().form.presetId).toBe("native-macos-swiftui-menubar")
    expect(presetLabelEl.textContent).toContain("✓ Preset match: Native macOS SwiftUI Menu Bar")
    expect(applyButton.hidden).toBe(true)
  })
})
