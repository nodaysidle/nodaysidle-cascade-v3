import { open } from "@tauri-apps/plugin-dialog"
import { cancelProviderRequest, exportPacketTo, invokeBlueprintProvider } from "./bridge"
import { DOCUMENT_NAMES, type DocumentName } from "./compiler"
import {
  generatePacket,
  PROVIDER_MODELS,
  type BlueprintProvider,
  type ProgressStage,
} from "./pipeline"
import { PRESET_IDS, PRESETS } from "./presets"
import {
  canExport,
  canGenerate,
  createInitialState,
  reduceAppState,
  statusActionLabel,
  visibleIssues,
  type AppAction,
  type AppState,
  type FormState,
} from "./state"

const progressStages: ReadonlyArray<{ id: ProgressStage; label: string }> = [
  { id: "provider", label: "Provider" },
  { id: "blueprint-validation", label: "Blueprint validation" },
  { id: "local-normalization", label: "Local normalization" },
  { id: "preset-compiler", label: "Preset compiler" },
  { id: "mechanical-audit", label: "Mechanical audit" },
  { id: "agent-readiness-audit", label: "Agent-readiness audit" },
  { id: "rendering", label: "Rendering" },
  { id: "export-gate", label: "Export gate" },
]

const statusCopy: Readonly<Record<AppState["status"], { label: string; detail: string; tone: string }>> = {
  empty: { label: "Waiting for input", detail: "Add an idea and memory-only API key to begin.", tone: "neutral" },
  ready: { label: "Ready", detail: "The selected preset will remain locked for this generation.", tone: "ready" },
  generating: { label: "Generating", detail: "Semantic meaning is being validated and compiled locally.", tone: "working" },
  cancelling: { label: "Cancelling", detail: "The active request is being stopped; export remains locked.", tone: "working" },
  "provider-failure": { label: "Provider failure", detail: "No packet was accepted. Review safe details and retry.", tone: "error" },
  "blueprint-validation-failed": { label: "Blueprint blocked", detail: "The completed response failed a hard schema or semantic rule. Export remains locked.", tone: "error" },
  "local-normalization-failed": { label: "Normalization blocked", detail: "Product meaning could not be converted safely. Export remains locked.", tone: "error" },
  "local-compiler-failure": { label: "Compiler failure", detail: "A local mechanical invariant failed. No provider retry was attempted.", tone: "error" },
  "lint-failure": { label: "Gate blocked", detail: "The packet failed a local readiness rule and cannot be exported.", tone: "error" },
  "gate-clean": { label: "Gate Clean", detail: "Preview bytes are hashed and eligible for exact-five export.", tone: "success" },
  "export-success": { label: "Export complete", detail: "Exactly five verified files were written to a new folder.", tone: "success" },
  cancelled: { label: "Cancelled", detail: "No packet was accepted and export remains locked.", tone: "neutral" },
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]!)
}

function options(values: readonly string[], label: (value: string) => string): string {
  return values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(label(value))}</option>`).join("")
}

function appMarkup(): string {
  return `
    <div class="app-shell" data-state="empty">
      <aside class="control-panel" aria-label="Generation controls">
        <header class="brand-block">
          <div class="brand-row">
            <span class="cascade-mark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
            <div>
              <p class="eyebrow">NODAYSIDLE</p>
              <h1>Cascade <span>V3</span></h1>
            </div>
          </div>
          <p class="brand-copy">One semantic blueprint. Five locked execution documents.</p>
        </header>

        <form id="generator-form" novalidate>
          <div class="field-group">
            <label for="preset">Technology preset</label>
            <select id="preset" name="preset">${options(PRESET_IDS, id => PRESETS[id as keyof typeof PRESETS].label)}</select>
            <p class="field-help">Preset rules are local, deterministic, and isolated.</p>
          </div>

          <div class="field-group">
            <label for="model">DeepSeek model</label>
            <select id="model" name="model">${options(PROVIDER_MODELS.map(model => model.id), id => PROVIDER_MODELS.find(model => model.id === id)!.label)}</select>
          </div>

          <div class="field-group">
            <label for="api-url">Responses API URL</label>
            <input id="api-url" name="api-url" type="url" inputmode="url" autocomplete="off" spellcheck="false" />
          </div>

          <div class="field-group">
            <div class="field-label-row">
              <label for="api-key">DeepSeek API key</label>
              <span class="memory-chip">MEMORY ONLY</span>
            </div>
            <input id="api-key" name="api-key" type="password" autocomplete="off" spellcheck="false" aria-describedby="api-key-help" />
            <p id="api-key-help" class="field-help">Never saved, logged, exported, or placed in the request body.</p>
          </div>

          <div class="field-group idea-field">
            <label for="idea">Software idea</label>
            <textarea id="idea" name="idea" rows="8" spellcheck="true" placeholder="Describe the product, users, behavior, constraints, privacy, recovery, and desired outcome."></textarea>
          </div>

          <div class="action-row">
            <button id="generate" class="button button-primary" type="submit" disabled>Generate</button>
            <button id="cancel" class="button button-secondary" type="button" disabled>Cancel</button>
          </div>
        </form>

        <section class="progress-card" aria-labelledby="progress-heading">
          <div class="section-heading-row">
            <h2 id="progress-heading">Pipeline</h2>
            <span id="progress-count">0 / ${progressStages.length}</span>
          </div>
          <ol id="progress-list" class="progress-list">
            ${progressStages.map((stage, index) => `<li data-stage="${stage.id}"><span>${String(index + 1).padStart(2, "0")}</span><b>${stage.label}</b></li>`).join("")}
          </ol>
        </section>
      </aside>

      <section class="workspace" aria-label="Compiled packet">
        <header class="workspace-header">
          <div>
            <p class="eyebrow light">EXECUTION CONTRACT</p>
            <h2 id="packet-title">Five-document packet</h2>
          </div>
          <div id="status-badge" class="status-badge" data-tone="neutral" aria-live="polite">
            <span class="status-dot" aria-hidden="true"></span>
            <strong id="status-label">Waiting for input</strong>
          </div>
        </header>

        <div class="status-strip">
          <p id="status-detail">Add an idea and memory-only API key to begin.</p>
          <details id="technical-details">
            <summary>Technical details</summary>
            <dl id="technical-list"></dl>
          </details>
        </div>

        <div class="document-bar">
          <div id="document-tabs" class="document-tabs" role="tablist" aria-label="Packet documents">
            ${DOCUMENT_NAMES.map((name, index) => `<button id="tab-${name.replace(".md", "").toLowerCase()}" type="button" role="tab" aria-selected="${index === 0}" aria-controls="document-preview" tabindex="${index === 0 ? 0 : -1}" data-document="${name}">${name.replace(".md", "")}</button>`).join("")}
          </div>
          <div class="document-actions">
            <button id="copy-document" class="button button-quiet" type="button" disabled>Copy current</button>
            <button id="export-packet" class="button button-accent" type="button" disabled>Export packet</button>
          </div>
        </div>

        <article id="document-preview" class="document-preview" role="tabpanel" aria-labelledby="tab-prd" tabindex="0">
          <pre><code id="preview-content">Generate a gate-clean packet to inspect its immutable Markdown bytes.</code></pre>
        </article>

        <section class="validation-panel" aria-labelledby="validation-heading">
          <div class="section-heading-row dark">
            <div>
              <p class="eyebrow light">LOCAL PROOF</p>
              <h2 id="validation-heading">Validation ledger</h2>
            </div>
            <span id="validation-count">0 checks</span>
          </div>
          <ul id="validation-ledger" class="validation-ledger">
            <li class="ledger-empty">The ledger appears after local compilation.</li>
          </ul>
        </section>

        <div id="notice" class="notice" role="status" aria-live="polite"></div>
      </section>
    </div>
  `
}

function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`Missing application element: ${selector}`)
  return element
}

export function mountApp(provider: BlueprintProvider = invokeBlueprintProvider) {
  const root = requiredElement<HTMLElement>(document, "#app")
  root.innerHTML = appMarkup()

  const shell = requiredElement<HTMLElement>(root, ".app-shell")
  const form = requiredElement<HTMLFormElement>(root, "#generator-form")
  const preset = requiredElement<HTMLSelectElement>(root, "#preset")
  const model = requiredElement<HTMLSelectElement>(root, "#model")
  const apiUrl = requiredElement<HTMLInputElement>(root, "#api-url")
  const apiKey = requiredElement<HTMLInputElement>(root, "#api-key")
  const idea = requiredElement<HTMLTextAreaElement>(root, "#idea")
  const generateButton = requiredElement<HTMLButtonElement>(root, "#generate")
  const cancelButton = requiredElement<HTMLButtonElement>(root, "#cancel")
  const copyButton = requiredElement<HTMLButtonElement>(root, "#copy-document")
  const exportButton = requiredElement<HTMLButtonElement>(root, "#export-packet")
  const statusBadge = requiredElement<HTMLElement>(root, "#status-badge")
  const statusLabel = requiredElement<HTMLElement>(root, "#status-label")
  const statusDetail = requiredElement<HTMLElement>(root, "#status-detail")
  const technicalList = requiredElement<HTMLElement>(root, "#technical-list")
  const packetTitle = requiredElement<HTMLElement>(root, "#packet-title")
  const preview = requiredElement<HTMLElement>(root, "#document-preview")
  const previewContent = requiredElement<HTMLElement>(root, "#preview-content")
  const ledger = requiredElement<HTMLElement>(root, "#validation-ledger")
  const validationCount = requiredElement<HTMLElement>(root, "#validation-count")
  const progressCount = requiredElement<HTMLElement>(root, "#progress-count")
  const notice = requiredElement<HTMLElement>(root, "#notice")
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[role=tab]")]

  const controls: Readonly<Record<keyof FormState, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>> = {
    presetId: preset,
    model,
    apiUrl,
    apiKey,
    idea,
  }
  let state = createInitialState()
  let activeDocument: DocumentName = "PRD.md"
  let abortController: AbortController | undefined
  let generation: Promise<AppState> | undefined
  let noticeTimer: number | undefined

  function announce(message: string, tone: "neutral" | "success" | "error" = "neutral"): void {
    notice.textContent = message
    notice.dataset.tone = tone
    notice.classList.toggle("visible", Boolean(message))
    if (noticeTimer !== undefined) window.clearTimeout(noticeTimer)
    if (message) noticeTimer = window.setTimeout(() => notice.classList.remove("visible"), 4_500)
  }

  function dispatch(action: AppAction): void {
    state = reduceAppState(state, action)
    updateView()
  }

  function syncControls(): void {
    preset.value = state.form.presetId
    model.value = state.form.model
    apiUrl.value = state.form.apiUrl
    apiKey.value = state.form.apiKey
    idea.value = state.form.idea
  }

  function updateProgress(): void {
    const currentIndex = state.progress ? progressStages.findIndex(stage => stage.id === state.progress) : -1
    const completeAll = state.status === "gate-clean" || state.status === "export-success"
    const completed = completeAll ? progressStages.length : Math.max(currentIndex, 0)
    progressCount.textContent = `${completed} / ${progressStages.length}`
    for (const [index, stage] of progressStages.entries()) {
      const item = requiredElement<HTMLElement>(root, `[data-stage="${stage.id}"]`)
      item.classList.toggle("complete", completeAll || index < currentIndex)
      item.classList.toggle("current", index === currentIndex && !completeAll)
      item.setAttribute("aria-current", index === currentIndex && !completeAll ? "step" : "false")
    }
  }

  function updateTechnicalDetails(): void {
    const details: Array<[string, string]> = visibleIssues(state).flatMap((issue, index): Array<[string, string]> => [
      [`Issue ${index + 1} path`, issue.path],
      [`Issue ${index + 1} rule`, issue.rule],
      [`Issue ${index + 1} message`, issue.message],
    ])
    if (!details.length) details.push(["State", state.status], ["Preset", state.form.presetId], ["Model", state.form.model])
    if (!state.issues.length && state.progress) details.push(["Stage", state.progress])
    if (state.failure?.wrapperOutputTypes?.length) {
      details.push(["Wrapper output types", state.failure.wrapperOutputTypes.join(", ")])
    }
    if (state.packet) {
      details.push(["Project", state.packet.graph.identity.projectName])
      details.push(["Preview hash", state.packet.hashes[activeDocument]])
    }
    if (state.exportPath) details.push(["Export", state.exportPath])
    technicalList.innerHTML = details.map(([term, value]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")
  }

  function updateTabs(): void {
    for (const tab of tabs) {
      const selected = tab.dataset.document === activeDocument
      tab.setAttribute("aria-selected", String(selected))
      tab.tabIndex = selected ? 0 : -1
    }
    const selectedTab = tabs.find(tab => tab.dataset.document === activeDocument)
    if (selectedTab) preview.setAttribute("aria-labelledby", selectedTab.id)
    preview.dataset.document = activeDocument
    previewContent.textContent = state.packet?.documents[activeDocument]
      ?? "Generate a gate-clean packet to inspect its immutable Markdown bytes."
  }

  function updateLedger(): void {
    validationCount.textContent = `${state.ledger.length} ${state.ledger.length === 1 ? "check" : "checks"}`
    if (!state.ledger.length) {
      ledger.innerHTML = '<li class="ledger-empty">The ledger appears after local compilation.</li>'
      return
    }
    ledger.innerHTML = state.ledger.map(entry => `
      <li data-result="${entry.status}">
        <span aria-hidden="true">${entry.status === "pass" ? "✓" : "!"}</span>
        <div><strong>${escapeHtml(entry.label)}</strong><p>${escapeHtml(entry.detail)}</p></div>
      </li>
    `).join("")
  }

  function updateView(): void {
    const copy = statusCopy[state.status]
    const busy = ["generating", "cancelling"].includes(state.status)
    shell.dataset.state = state.status
    statusBadge.dataset.tone = copy.tone
    statusLabel.textContent = copy.label
    statusDetail.textContent = copy.detail
    generateButton.textContent = statusActionLabel(state)
    generateButton.disabled = !canGenerate(state)
    cancelButton.disabled = state.status !== "generating"
    copyButton.disabled = !state.packet
    exportButton.disabled = !canExport(state)
    for (const control of Object.values(controls)) control.disabled = busy
    packetTitle.textContent = state.packet ? state.packet.graph.identity.projectName : "Five-document packet"
    updateProgress()
    updateTabs()
    updateLedger()
    updateTechnicalDetails()
  }

  function changeField(field: keyof FormState, value: string): void {
    dispatch({ type: "form-changed", field, value })
  }

  for (const [field, control] of Object.entries(controls) as Array<[keyof FormState, typeof controls[keyof FormState]]>) {
    const event = control instanceof HTMLSelectElement ? "change" : "input"
    control.addEventListener(event, () => changeField(field, control.value))
  }

  function generate(): Promise<AppState> {
    if (generation) return generation
    if (!canGenerate(state)) return Promise.resolve(state)
    const input = state.form
    const requestId = crypto.randomUUID()
    abortController = new AbortController()
    dispatch({ type: "generation-started", requestId })

    generation = generatePacket({
      ...input,
      requestId,
      signal: abortController.signal,
      onProgress: stage => dispatch({ type: "progressed", stage }),
    }, provider).then(result => {
      if (result.status === "gate-clean" && result.packet) {
        dispatch({ type: "generation-succeeded", packet: result.packet })
        syncControls()
      } else {
        const status = result.status === "gate-clean" ? "local-compiler-failure" : result.status
        dispatch({ type: "generation-failed", status, failure: result.failure, issues: result.issues })
      }
      return state
    }).catch(() => {
      dispatch({ type: "generation-failed", status: "local-compiler-failure", issues: [{ path: "$compiler", rule: "compiler.failure", message: "The deterministic local compiler could not produce a packet." }] })
      return state
    }).finally(() => {
      abortController = undefined
      generation = undefined
    })
    return generation
  }

  async function cancel(): Promise<void> {
    if (!state.activeRequestId || !abortController) return
    const requestId = state.activeRequestId
    abortController.abort()
    dispatch({ type: "cancel-requested" })
    try {
      await cancelProviderRequest(requestId)
    } catch {
      // The local AbortSignal remains authoritative even if the request already completed.
    }
  }

  function selectDocument(name: DocumentName, focus = false): void {
    activeDocument = name
    updateTabs()
    updateTechnicalDetails()
    if (focus) tabs.find(tab => tab.dataset.document === name)?.focus()
  }

  function documentIndexForKey(key: string): number {
    const index = DOCUMENT_NAMES.indexOf(activeDocument)
    switch (key) {
      case "Home": return 0
      case "End": return DOCUMENT_NAMES.length - 1
      case "ArrowLeft": return (index - 1 + DOCUMENT_NAMES.length) % DOCUMENT_NAMES.length
      case "ArrowRight": return (index + 1) % DOCUMENT_NAMES.length
      default: return -1
    }
  }

  async function exportTo(parent: string): Promise<string> {
    if (!state.packet || !canExport(state)) throw { kind: "invalid-packet", classification: "export-locked" }
    const path = await exportPacketTo(parent, state.packet)
    dispatch({ type: "export-succeeded", path })
    announce("Exact-five packet exported.", "success")
    return path
  }

  form.addEventListener("submit", event => {
    event.preventDefault()
    void generate()
  })
  cancelButton.addEventListener("click", () => void cancel())
  copyButton.addEventListener("click", async () => {
    const content = state.packet?.documents[activeDocument]
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      announce(`${activeDocument} copied.`, "success")
    } catch {
      const fallback = document.createElement("textarea")
      fallback.value = content
      fallback.setAttribute("readonly", "")
      fallback.className = "clipboard-fallback"
      document.body.append(fallback)
      fallback.select()
      const copied = document.execCommand("copy")
      fallback.remove()
      if (copied) announce(`${activeDocument} copied.`, "success")
      else announce("Copy failed. Select the preview text manually.", "error")
    }
  })
  exportButton.addEventListener("click", async () => {
    try {
      const selection = await open({ directory: true, multiple: false, title: "Choose a parent folder for the new packet" })
      if (typeof selection === "string") await exportTo(selection)
    } catch {
      announce("Export failed. Choose a writable parent without an existing project folder.", "error")
    }
  })
  for (const tab of tabs) {
    tab.addEventListener("click", () => selectDocument(tab.dataset.document as DocumentName))
    tab.addEventListener("keydown", event => {
      const keyIndex = documentIndexForKey(event.key)
      if (keyIndex >= 0) {
        event.preventDefault()
        selectDocument(DOCUMENT_NAMES[keyIndex]!, true)
      }
    })
  }

  syncControls()
  updateView()

  return {
    setFormField(field: keyof FormState, value: string): void {
      changeField(field, value)
      controls[field].value = value
    },
    generate,
    cancel,
    selectDocument,
    exportTo,
    getState: (): AppState => state,
    getPreviewText: (): string => previewContent.textContent ?? "",
    isExportEnabled: (): boolean => !exportButton.disabled,
  }
}

export type CascadeApp = ReturnType<typeof mountApp>
