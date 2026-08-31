import { ASTRO_DESIGN_TOKENS } from "./astroWeb"
import { DOCUMENT_NAMES, type DocumentName, type DocumentPacket, type GraphContract, type GraphFeature, type GraphTask, type ProjectGraph } from "./compiler"

function bullets(values: readonly string[]): string {
  return values.map(value => `- ${value}`).join("\n")
}

function numbered(values: readonly string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n")
}

function section(title: string, body: string): string {
  return `## ${title}\n\n${body.trim()}`
}

function transcriptionRoutingSection(graph: ProjectGraph, title: string): string[] {
  const routing = graph.blueprint.transcriptionRouting
  if (!routing) return []
  return [section(title, bullets([
    `${routing.liveProviderName} WebSocket streaming is exclusively for live microphone audio and never accepts imported audio files.`,
    `Imported audio-file transcription uses the configured batch/file-capable provider, ${routing.importedProviderName}.`,
    "Supported imported formats are wav, mp3, flac, m4a, ogg, webm, and aac.",
    "Files exceeding the locally locked maximum duration of 60 seconds or payload of 25 MB (25,000,000 bytes) are rejected locally with clear user guidance before any paid upload and create no provider request.",
    `Do not route imported audio files through the live ${routing.liveProviderName} microphone stream.`,
    "Do not split, chunk, transcode, or stitch long files unless a future preset explicitly defines that behavior.",
  ]))]
}

type TraceDetailLevel = "compact" | "full"

function featureTrace(graph: ProjectGraph, detail: TraceDetailLevel): string {
  const featureLines = graph.features.map(feature => {
    const requirements = graph.requirements.filter(requirement => requirement.featureId === feature.id)
    const acceptance = graph.acceptance.filter(item => item.featureIds.includes(feature.id))
    const contracts = graph.contracts.filter(contract => contract.featureIds.includes(feature.id))
    const owner = graph.owners.find(item => item.id === feature.ownerId)!
    const phase = graph.phases.find(item => item.id === owner.createPhaseId)!
    const task = phase.tasks.find(item => item.ownerIds.includes(owner.id))!
    if (detail === "compact") {
      return `${feature.id} — ${feature.name} — Requirement ${requirements.map(requirement => requirement.id).join(", ")} — Acceptance ${acceptance.map(item => item.id).join(", ")} — Owner ${owner.id} — Contracts ${contracts.map(contract => contract.id).join(", ") || "none"} — Files ${owner.implementationFile}; ${owner.focusedTestFile} — Phase ${phase.id} — Task ${task.id} depends on ${task.dependencies.join(", ") || "none"}`
    }
    const contractIds = (kind: GraphContract["kind"]) => contracts.filter(contract => contract.kind === kind).map(contract => contract.id).join(", ") || "none"
    return `${feature.id} — ${feature.name} — Requirement ${requirements.map(requirement => requirement.id).join(", ")} — Acceptance ${acceptance.map(item => `${item.id} (${item.kind}, owner ${item.ownerId}): ${item.criterion}`).join("; ")} — Owner ${owner.id} — Interface ${contractIds("interface")} — Data ${contractIds("data")} — Persistence ${contractIds("persistence")} — Recovery ${contractIds("recovery")} — All contracts ${contracts.map(contract => contract.id).join(", ")} — Files ${owner.implementationFile}; ${owner.focusedTestFile} — Phase ${phase.id} depends on ${phase.dependencies.join(", ") || "none"} — Task ${task.id} depends on ${task.dependencies.join(", ") || "none"} — Focused test command ${owner.focusedTestCommand} — Validation ${task.validationCommands.join("; ")} — Downstream instruction ${task.prompt}`
  })
  const requirementLines = graph.requirements.map(requirement => detail === "compact"
    ? `${requirement.id} — Feature ${requirement.featureId} — ${requirement.statement}`
    : `${requirement.id} — Feature ${requirement.featureId} — ${requirement.statement} — Acceptance ${requirement.acceptanceIds.join(", ")}: ${requirement.acceptanceCriteria.join("; ")}`)
  const acceptanceLines = graph.acceptance.map(item => detail === "compact"
    ? `${item.id} — ${item.kind} — Features ${item.featureIds.join(", ")} — Owner ${item.ownerId}`
    : `${item.id} — ${item.kind} acceptance — Features ${item.featureIds.join(", ")} — Owner ${item.ownerId} — Criterion ${item.criterion}`)
  const contractLines = graph.contracts.map(contract => detail === "compact"
    ? `${contract.id} — ${contract.name} (${contract.kind}) — Owner ${contract.ownerId} — Features ${contract.featureIds.join(", ") || "none"}`
    : `${contract.id} — ${contract.name} (${contract.kind}) — Features ${contract.featureIds.join(", ")} — Owner ${contract.ownerId} — Decision ${contract.decision} — Details ${contract.details.join("; ")} — Failure ${contract.failureBehavior} — Recovery ${contract.recovery.join("; ")}`)
  return `${bullets(featureLines)}\n${bullets(requirementLines)}\n${bullets(acceptanceLines)}\n${bullets(contractLines)}`
}

function astroDesignSystemSection(graph: ProjectGraph): string[] {
  if (graph.presetId !== "astro-web") return []
  const darkFirst = [...graph.blueprint.uxRequirements, ...graph.blueprint.operationalConstraints]
    .some(item => /\bdark[- ]first\b/i.test(item))
  const tokens = darkFirst
    ? ASTRO_DESIGN_TOKENS
    : ASTRO_DESIGN_TOKENS.map(token => token.replace("dark-first palette", "accessible light-first palette"))
  return [section("Design System", bullets(tokens))]
}

function astroRoutesSection(graph: ProjectGraph): string[] {
  if (graph.presetId !== "astro-web" || !graph.astroPlan) return []
  return [section("Information Architecture and Routes", bullets([
    ...graph.astroPlan.routeSummary,
    graph.astroPlan.usesContentCollections
      ? `Catalog data compiles from src/content/${graph.astroPlan.contentCollection}/ through src/content/config.ts; do not store catalog records in browser-side databases.`
      : "No build-time content collection is required for this graph.",
  ]))]
}

function contentSeedSection(graph: ProjectGraph): string[] {
  if (graph.presetId !== "astro-web" || !graph.astroPlan?.usesContentCollections || !graph.blueprint.domainData.length) return []
  const collection = graph.astroPlan.contentCollection
  const seedLines = graph.blueprint.domainData.map(item => `Seed at least two ${collection} entries covering ${item.name}: frontmatter title, slug, summary, status, tags, repoUrl when applicable, and body text that explains ${item.meaning}.`)
  return [section("Content Seed Requirements", bullets([
    ...seedLines,
    `Example seed file: src/content/${collection}/_seed.example.md`,
    "Replace example slugs with real product names from the idea; never publish invented release status or private repository data.",
  ]))]
}

function renderFeature(feature: GraphFeature): string {
  return [
    `### ${feature.id} — ${feature.name}`,
    "",
    `- Behavior: ${feature.behavior}`,
    `- Inputs: ${feature.inputs.join("; ")}`,
    `- Outputs: ${feature.outputs.join("; ")}`,
    `- Acceptance outcomes: ${feature.acceptanceOutcomes.join("; ")}`,
    `- Failure behavior: ${feature.failureBehavior}`,
    `- Recovery: ${feature.recoveryExpectations.join("; ")}`,
  ].join("\n")
}

function renderContract(contract: GraphContract): string {
  return [
    `### ${contract.id} — ${contract.name}`,
    "",
    `- Kind: ${contract.kind}`,
    `- Feature trace: ${contract.featureIds.join(", ") || "none"}`,
    `- Owner: ${contract.ownerId}`,
    `- Decision: ${contract.decision}`,
    ...contract.details.map(detail => `- ${detail}`),
    `- Failure behavior: ${contract.failureBehavior}`,
    `- Recovery: ${contract.recovery.join("; ")}`,
  ].join("\n")
}

function renderPRD(graph: ProjectGraph): string {
  const blueprint = graph.blueprint
  const sharedAcceptance = graph.acceptance
    .filter(item => item.kind === "integration")
    .map(item => `${item.id} — Owner ${item.ownerId} — Features ${item.featureIds.join(", ")} — ${item.criterion}`)
  const journeys = blueprint.primaryUserJourneys.map(journey => [
    `### ${journey.name}`,
    "",
    `- Actor: ${journey.actor}`,
    `- Steps: ${journey.steps.join(" → ")}`,
    `- Outcome: ${journey.outcome}`,
  ].join("\n")).join("\n\n")
  const problemSection = blueprint.problemStatement.trim() === blueprint.productDefinition.trim()
    ? []
    : [section("Problem Statement", blueprint.problemStatement)]

  return [
    `# Product Requirements Document — ${blueprint.projectName}`,
    section("Document Purpose", "Define the product boundary, users, problems, goals, journeys, feature outcomes, success criteria, and explicit scope without implementation invention."),
    section("Product Definition", blueprint.productDefinition),
    ...problemSection,
    section("Target Users", bullets(blueprint.targetUsers)),
    section("Goals", bullets(blueprint.goals)),
    section("Non-Goals", bullets(blueprint.nonGoals)),
    section("Primary User Journeys", journeys),
    ...transcriptionRoutingSection(graph, "Audio Transcription Routing"),
    ...astroRoutesSection(graph),
    ...contentSeedSection(graph),
    ...astroDesignSystemSection(graph),
    section("Feature Contracts", graph.features.map(renderFeature).join("\n\n")),
    section("Requirement Contracts", bullets(graph.requirements.map(requirement => `${requirement.id} — ${requirement.statement} Acceptance ${requirement.acceptanceIds.join(", ")}: ${requirement.acceptanceCriteria.join("; ")}`))),
    section("Shared End-to-End Acceptance", bullets(sharedAcceptance.length ? sharedAcceptance : ["No shared acceptance criterion requires the final integration and packaging gate."])),
    section("UX Requirements", bullets(blueprint.uxRequirements)),
    section("Privacy and Security Requirements", bullets(blueprint.privacySecurityRequirements)),
    section("Operational Constraints", bullets(blueprint.operationalConstraints)),
    section("Success Criteria", bullets(blueprint.successCriteria)),
    section("Explicit Assumptions", bullets(blueprint.assumptions)),
    section("Scope Boundaries", bullets([`Included features: ${graph.features.map(feature => feature.name).join("; ")}`, `Excluded outcomes: ${blueprint.nonGoals.join("; ")}`, `Locked delivery preset: ${graph.presetId}`])),
    section("Traceability Index", featureTrace(graph, "compact")),
  ].join("\n\n") + "\n"
}

function renderARD(graph: ProjectGraph): string {
  const ownerLines = graph.owners.map(owner => `${owner.id} — ${owner.name} owns ${owner.implementationFile}; focused test ${owner.focusedTestFile}; create phase ${owner.createPhaseId}; modify phases ${owner.modifyPhaseIds.join(", ") || "none"}`)
  const journeys = graph.blueprint.primaryUserJourneys.map(journey => `${journey.name}: ${journey.steps.join(" → ")} → ${journey.outcome}`)
  const lifecycle = graph.contracts.filter(contract => contract.kind === "lifecycle").map(contract => `${contract.id}: ${contract.decision} Cleanup: ${contract.recovery.join("; ")}`)
  const integrations = graph.contracts.filter(contract => contract.kind === "integration").map(contract => `${contract.id}: ${contract.decision} Failure: ${contract.failureBehavior} Recovery: ${contract.recovery.join("; ")}`)

  return [
    `# Architecture Requirements Document — ${graph.blueprint.projectName}`,
    section("Document Purpose", "Lock architecture boundaries, component ownership, runtime flows, state placement, platform lifecycle, persistence, security, integrations, and trade-offs without changing product scope."),
    section("Architecture Summary", `${graph.blueprint.productDefinition} The implementation uses the ${graph.presetLabel} contract in ${graph.runtimeMode} runtime mode.`),
    section("Architectural Style", bullets([`Preset-owned ${graph.presetLabel} architecture`, ...graph.runtimeArchitecture, "Vertical feature owners with explicit platform-boundary owners", "One-way feature and contract dependencies following the phase graph", "Local-first state unless product semantics explicitly require a remote service"])),
    ...astroRoutesSection(graph),
    section("Runtime Boundaries", bullets(graph.features.map(feature => `${feature.id} — ${feature.name}: ${feature.behavior}`))),
    section("Component and Ownership Map", bullets(ownerLines)),
    section("Runtime Flows", numbered(journeys)),
    ...transcriptionRoutingSection(graph, "Audio Transcription Routing"),
    section("State Ownership", bullets([
      `${graph.persistence.decision}`,
      `Settings placement: ${graph.persistence.settingsPlacement}`,
      `Record placement: ${graph.persistence.recordsPlacement}`,
      ...graph.owners.map(owner => `${owner.id} owns state mutated through ${owner.implementationFile}.`),
    ])),
    section("Platform Lifecycle", bullets([...graph.lifecycleRules, ...graph.contracts.filter(contract => contract.kind === "lifecycle").map(contract => contract.decision), ...lifecycle, ...graph.blueprint.lifecycleRequirements.map(item => `${item.event}: ${item.behavior} Cleanup: ${item.cleanup}`)])),
    section("Persistence Placement", bullets([graph.persistence.decision, `Settings: ${graph.persistence.settingsPlacement}`, `Records: ${graph.persistence.recordsPlacement}`])),
    section("Security Boundaries", bullets(graph.blueprint.privacySecurityRequirements.concat(graph.contracts.filter(contract => contract.kind === "credential" || contract.kind === "permission" || contract.kind === "security").map(contract => `${contract.id}: ${contract.decision}`)))),
    section("Accessibility Boundary", bullets(graph.accessibilityRules)),
    section("External Integration Placement", integrations.length ? bullets([graph.integrationBoundary, ...integrations]) : bullets([graph.integrationBoundary, "No external service is activated by this product contract."])),
    section("Recovery Architecture", bullets(graph.recoveryRules)),
    section("Packaging and Installation", bullets([...graph.packagingRules, graph.installationDecision, `Output artifact: ${graph.outputArtifact}`, `Artifact path: ${graph.artifactPath}`])),
    section("Architectural Trade-offs", bullets([
      "Preset fidelity is favored over cross-stack reuse.",
      "Deterministic owner and file mappings are favored over runtime plugin discovery.",
      `${graph.persistence.enabled ? "Durable local recovery is favored over transient simplicity." : "No product persistence is favored over an unused storage layer."}`,
      `${graph.runtimeMode === "server" ? "Server rendering is enabled only to protect required service credentials." : "No server runtime is introduced."}`,
    ])),
    section("Architecture Review Checklist", bullets(["Every feature has one owner and one focused test.", "Every contract resolves to known features and one owner.", "Every modified file is created in an earlier phase.", "Persistence, permissions, credentials, lifecycle, recovery, packaging, and signing are explicit.", "No forbidden technology appears in an implementation decision."])),
    section("Traceability Index", featureTrace(graph, "compact")),
  ].join("\n\n") + "\n"
}

function contractsOfKind(graph: ProjectGraph, ...kinds: GraphContract["kind"][]): string {
  const contracts = graph.contracts.filter(contract => kinds.includes(contract.kind))
  return contracts.length ? contracts.map(renderContract).join("\n\n") : "- None. The project graph contains no applicable contract of this kind."
}

function renderTRD(graph: ProjectGraph): string {
  return [
    `# Technical Requirements Document — ${graph.blueprint.projectName}`,
    section("Document Purpose", "Lock the stack, project layout, interfaces, data, integrations, lifecycle, persistence, credentials, permissions, recovery, tests, packaging, signing, validation, and completion proof."),
    section("Locked Identity", bullets([`Project name: ${graph.identity.projectName}`, `Project slug: ${graph.identity.slug}`, `Bundle or application ID: ${graph.identity.bundleId}`, `Runtime mode: ${graph.runtimeMode === "static" ? "static output" : graph.runtimeMode}`, `Output artifact: ${graph.outputArtifact}`, `Artifact path: ${graph.artifactPath}`])),
    section("Locked Stack", bullets(graph.lockedStack)),
    section("Runtime Architecture Contracts", bullets(graph.runtimeArchitecture)),
    section("Forbidden Technologies", bullets(graph.forbiddenTechnologies.map(item => `Forbidden: ${item}`))),
    ...astroRoutesSection(graph),
    ...contentSeedSection(graph),
    ...astroDesignSystemSection(graph),
    section("Project Layout", bullets([...new Set(graph.phases.flatMap(phase => phase.tasks.flatMap(task => task.filesToCreate)))])),
    section("Owner-to-File and Focused-Test Map", bullets(graph.owners.map(owner => `${owner.id} — ${owner.name} — implementation ${owner.implementationFile} — focused test ${owner.focusedTestFile} — command ${owner.focusedTestCommand}`))),
    section("Interface Contracts", contractsOfKind(graph, "interface")),
    ...transcriptionRoutingSection(graph, "Audio Transcription Routing Contract"),
    section("Data Contracts", contractsOfKind(graph, "data")),
    section("External Integration Contracts", `${bullets([graph.integrationBoundary])}\n\n${contractsOfKind(graph, "integration")}`),
    section("Lifecycle Contracts", contractsOfKind(graph, "lifecycle")),
    section("Persistence Contracts", `${graph.persistence.decision}\n\n${contractsOfKind(graph, "persistence")}`),
    section("Credential Contracts", contractsOfKind(graph, "credential")),
    section("Permission Contracts", contractsOfKind(graph, "permission")),
    section("Errors and Recovery Contracts", `${bullets(graph.recoveryRules)}\n\n${contractsOfKind(graph, "recovery")}`),
    section("Security Contract", contractsOfKind(graph, "security")),
    section("Accessibility Contracts", bullets(graph.accessibilityRules)),
    section("Testing Contract", bullets([`Framework: ${graph.testFramework}`, ...graph.owners.map(owner => `${owner.focusedTestFile}: cover ${owner.featureIds.join(", ") || "no direct features"} and contracts ${owner.contractIds.join(", ")}.`), "Run focused tests before shared suites and package checks."])),
    section("Packaging Contract", contractsOfKind(graph, "packaging")),
    section("Signing Contract", graph.signingDecision),
    section("Installation Contract", graph.installationDecision),
    section("Validation Commands", numbered(graph.validationCommands.map(command => `\`${command}\``))),
    section("Completion Evidence", bullets(graph.completionEvidence)),
    section("Traceability Index", featureTrace(graph, "full")),
  ].join("\n\n") + "\n"
}

function renderTask(task: GraphTask): string {
  return [
    `### ${task.id} — ${task.title}`,
    "",
    `- Dependencies: ${task.dependencies.join(", ") || "none"}`,
    `- Owners: ${task.ownerIds.join(", ") || "foundation"}`,
    `- Features: ${task.featureIds.join(", ") || "none"}`,
    `- Requirements: ${task.requirementIds.join(", ") || "none"}`,
    `- Contracts: ${task.contractIds.join(", ") || "foundation identity and stack contract"}`,
    `- Acceptance IDs: ${task.acceptanceIds.join(", ") || "none"}`,
    `- Files to create: ${task.filesToCreate.join("; ")}`,
    `- Files to modify: ${task.filesToModify.join("; ") || "none"}`,
    `- Focused tests: ${task.focusedTests.join("; ")}`,
    `- Acceptance criteria: ${task.acceptanceCriteria.join("; ")}`,
    `- Task prompt: ${task.prompt}`,
    `- Validation commands: ${task.validationCommands.map(command => `\`${command}\``).join("; ")}`,
  ].join("\n")
}

function renderTASKS(graph: ProjectGraph): string {
  const phases = graph.phases.map(phase => [
    `## ${phase.id} — ${phase.title}`,
    "",
    `- Phase dependencies: ${phase.dependencies.join(", ") || "none"}`,
    "- Exit rule: all phase tasks and validation commands pass before the next phase starts.",
    "",
    ...phase.tasks.map(renderTask),
  ].join("\n")).join("\n\n")

  return [
    `# Implementation Tasks — ${graph.blueprint.projectName}`,
    section("Document Purpose", "Define dependency-safe phases, exact create and modify ownership, focused tests, acceptance criteria, complete task prompts, and root-level proof commands."),
    section("Working Rules", bullets(["Execute phases and tasks in listed order.", "Create every listed file before a later task modifies it.", "Use only the locked preset stack and exact owner map.", "Write the focused test before each non-trivial implementation and observe its intended failure.", "Stop on the first failing validation command and fix the root cause.", "Implement full contract decision, details, failure, and recovery prose from TRD.md for every listed contract ID."])),
    ...transcriptionRoutingSection(graph, "Audio Transcription Routing Tasks"),
    ...astroRoutesSection(graph),
    ...contentSeedSection(graph),
    phases,
    section("Packaging and Installation", bullets([...graph.packagingRules, graph.installationDecision])),
    section("Final Validation Commands", numbered(graph.validationCommands.map(command => `\`${command}\``))),
    section("Completion Evidence", bullets(graph.completionEvidence)),
    section("Traceability Index", featureTrace(graph, "full")),
  ].join("\n\n") + "\n"
}

function renderAGENTS(graph: ProjectGraph): string {
  const phaseOrder = graph.phases.map(phase => `${phase.id}: ${phase.title}; depends on ${phase.dependencies.join(", ") || "nothing"}; tasks ${phase.tasks.map(task => task.id).join(", ")}`)
  return [
    `# AGENTS.md — ${graph.blueprint.projectName}`,
    section("Document Purpose", "Provide the downstream coding agent with the exact authority, stack lock, execution order, validation gates, stop conditions, and honest completion vocabulary for this project."),
    section("Required Reading Order", numbered(["PRD.md for product scope and outcomes", "ARD.md for architecture and ownership", "TRD.md for locked technical contracts", "TASKS.md for execution order", "AGENTS.md for operating and completion rules"])),
    section("Authority Hierarchy", numbered(["The five-document packet as a single execution contract", "PRD.md for product meaning and scope", "ARD.md for architecture and ownership", "TRD.md for technical and release decisions", "TASKS.md for ordered implementation", "Existing source only after it is created by the declared task"])),
    section("Locked Stack", bullets(graph.lockedStack)),
    section("Forbidden Substitutions", bullets(graph.forbiddenTechnologies.map(item => `Forbidden: ${item}`))),
    section("Locked Identity and Output", bullets([`Identity: ${graph.identity.bundleId}`, `Preset: ${graph.presetId}`, `Runtime mode: ${graph.runtimeMode}`, `Artifact: ${graph.outputArtifact}`, `Artifact path: ${graph.artifactPath}`])),
    section("Installation Rule", graph.installationDecision),
    section("Execution Rules", bullets(["Do not reinterpret the idea, add scope, switch stacks, rename IDs, or invent owners.", "Use the exact owner, implementation file, focused test, feature, contract, task, and phase mappings.", "Create files only in the task that first owns them and modify them only after creation.", "Implement failure, denied, cancellation, cleanup, persistence, credential, permission, lifecycle, and recovery paths before declaring a feature complete.", "Keep secrets out of source, logs, tests, fixtures, examples, commands, and generated artifacts.", "Preserve unrelated user work and stop if an undeclared conflict prevents the exact task.", "For Astro static sites with content collections, never move catalog data into browser-side record storage."])),
    section("Runtime Architecture Rules", bullets(graph.runtimeArchitecture)),
    section("Integration Boundary", graph.integrationBoundary),
    ...transcriptionRoutingSection(graph, "Audio Transcription Routing Prohibitions"),
    ...astroRoutesSection(graph),
    section("Recovery Rules", bullets(graph.recoveryRules)),
    section("Lifecycle Rules", bullets(graph.lifecycleRules)),
    section("Accessibility Rules", bullets(graph.accessibilityRules)),
    section("Owner Map", bullets(graph.owners.map(owner => `${owner.id} — ${owner.name} — ${owner.implementationFile} — ${owner.focusedTestFile} — create ${owner.createPhaseId} — modify ${owner.modifyPhaseIds.join(", ") || "none"}`))),
    section("Required Phase Order", numbered(phaseOrder)),
    section("Validation Gates", numbered(graph.validationCommands.map(command => `Run \`${command}\` and require exit status zero.`))),
    section("Stop Conditions", bullets(["Stop when a requested implementation decision is absent from all five documents.", "Stop when an ID, owner, file, focused test, dependency, or command conflicts across documents.", "Stop when a task would modify a file before its create task.", "Stop when a forbidden technology or undeclared remote service is required.", "Stop when a relevant test, build, package, signing, install, or launch check fails after root-cause diagnosis.", "Report the exact blocker without claiming completion."])),
    section("Completion Reporting", bullets(["DONE: every declared feature and contract is implemented, every required command passed, the artifact was verified, and no required work remains.", "PARTIAL: safe implemented work is verified but a named external proof or user-controlled action remains; list it precisely.", "BLOCKED: an exact missing authority, unavailable dependency, unsafe conflict, or repeated external failure prevents further safe progress; include the failing command and next action."])),
    section("Review Checklist", bullets(["Product and non-goal boundaries match PRD.md.", "Architecture and state ownership match ARD.md.", "Stack, files, contracts, permissions, persistence, credentials, lifecycle, recovery, packaging, and signing match TRD.md.", "Task and phase ordering match TASKS.md.", "Focused tests and every final command passed with fresh output."])),
    section("Traceability Index", featureTrace(graph, "compact")),
  ].join("\n\n") + "\n"
}

export function renderPacket(graph: ProjectGraph): DocumentPacket {
  const documents: Record<DocumentName, string> = {
    "PRD.md": renderPRD(graph),
    "ARD.md": renderARD(graph),
    "TRD.md": renderTRD(graph),
    "TASKS.md": renderTASKS(graph),
    "AGENTS.md": renderAGENTS(graph),
  }
  if (Object.keys(documents).join("|") !== DOCUMENT_NAMES.join("|")) throw new Error("Renderer produced a non-canonical document set.")
  return documents
}
