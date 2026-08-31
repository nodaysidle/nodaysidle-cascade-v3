import {
  DEEPGRAM_LIVE_MICROPHONE_CONTRACT,
  DOCUMENT_NAMES,
  TEMPORARY_AUDIO_LIFECYCLE,
  deepgramIntegrationValues,
  temporaryAudioLifecycleContractValues,
  type ContractKind,
  type DocumentName,
  type GraphContract,
  type ProjectGraph,
} from "./compiler"
import { PRESET_IDS, PRESETS, type PresetContract } from "./presets"
import { buildTaskAcceptanceCriteria } from "./taskAcceptance"

export interface AuditFailure {
  readonly rule: string
  readonly path: string
  readonly message: string
}

export interface AuditEntry {
  readonly rule: string
  readonly label: string
  readonly status: "pass" | "fail"
  readonly detail: string
}

const ledgerRules = [
  ["graph.ids", "Stable IDs are unique"],
  ["graph.references", "Graph references resolve"],
  ["graph.cycles", "Dependency graph is acyclic"],
  ["graph.dependencies", "Shared contract owners precede dependent features"],
  ["graph.task-scope", "Tasks claim only directly owned feature scope"],
  ["graph.acceptance-ownership", "Task acceptance belongs only to its direct owner or the final gate"],
  ["graph.focused-test-ownership", "Focused tests claim no future-owner behavior"],
  ["graph.ownership", "Owner, file, and test mappings are conflict-free"],
  ["graph.create-before-modify", "Every file is created before modification"],
  ["graph.coverage", "Features and contracts have tasks and focused tests"],
  ["render.deterministic", "Repeated local rendering is byte-identical"],
  ["packet.exact-five", "Packet contains exactly five canonical files"],
  ["packet.non-empty", "Every document is non-empty"],
  ["markdown.valid", "Markdown structure is normalized"],
  ["content.unfinished", "No unfinished or filler content remains"],
  ["content.identity", "Project identities are concrete"],
  ["content.secret-shaped", "No secret-shaped values are present"],
  ["trace.missing-reference", "Every feature and contract traces through all documents"],
  ["stack.leakage", "Selected preset implementation is isolated"],
  ["contract.decisions", "Cross-cutting decisions are complete"],
  ["contract.transcription-routing", "Live and imported transcription routes are deterministic"],
  ["contract.provider-wire", "Known provider wire contracts are exact"],
  ["contract.persistence", "Persistence placement and recovery are concrete"],
  ["contract.persistence-ownership", "Credential and data ownership is consistent"],
  ["contract.persistence-placement", "Each data contract has one valid placement"],
  ["contract.paste", "Paste workflow and branch tests are complete"],
  ["contract.packaging", "Packaging has one dependency-safe authority"],
  ["validation.commands", "Validation and completion commands are present"],
  ["preset.contracts", "Preset lifecycle and accessibility rules are rendered"],
] as const

function failure(rule: string, path: string, message: string): AuditFailure {
  return { rule, path, message }
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicate = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value)
    seen.add(value)
  }
  return [...duplicate]
}

function acceptanceKey(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "")
}

function hasDependencyCycle(nodes: readonly { readonly id: string; readonly dependencies: readonly string[] }[]): boolean {
  const known = new Set(nodes.map(node => node.id))
  const state = new Map<string, "visiting" | "visited">()
  const visit = (id: string): boolean => {
    const current = state.get(id)
    if (current === "visiting") return true
    if (current === "visited") return false
    state.set(id, "visiting")
    const node = nodes.find(item => item.id === id)
    if (node?.dependencies.some(dependency => known.has(dependency) && visit(dependency))) return true
    state.set(id, "visited")
    return false
  }
  return nodes.some(node => visit(node.id))
}

function contractText(graph: ProjectGraph, id: string): string {
  const item = graph.contracts.find(contract => contract.id === id)
  return item ? [item.decision, ...item.details, item.failureBehavior, ...item.recovery].join("\n") : ""
}

function missingMarkers(text: string, markers: readonly string[]): string[] {
  const normalized = text.toLowerCase()
  return markers.filter(marker => !normalized.includes(marker.toLowerCase()))
}

function sameContractValues(
  actual: GraphContract | undefined,
  expected: Pick<GraphContract, "decision" | "details" | "failureBehavior" | "recovery">,
): boolean {
  return actual?.decision === expected.decision
    && actual.failureBehavior === expected.failureBehavior
    && JSON.stringify(actual.details) === JSON.stringify(expected.details)
    && JSON.stringify(actual.recovery) === JSON.stringify(expected.recovery)
}

function sameStructure(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function credentialLike(value: string): boolean {
  return /\b(?:api[- ]?keys?|credentials?|secrets?|access tokens?)\b/i.test(value.replace(/\bnon[- ]secret\b/gi, ""))
}

function pasteFeatureLike(value: string): boolean {
  return /\b(?:paste-back|auto-paste|flexible insertion|insertion options?|clipboard handling)\b/i.test(value)
}

const unresolvedDecisionPattern = /\breject\s+or\s+(?:explicitly\s+)?split\b|\beither\b[^.\n]{0,120}\bor\b|\bchoose (?:one|between)\b|\bdecide whether\b/i

function isRootValidationCommand(command: string): boolean {
  const trimmed = command.trim()
  const supportedStart = /^(?:npm|cargo|swift|codesign|open|adb)(?:\s|$)|^\.\/gradlew(?:\s|$)|^\.\/Scripts\/[A-Za-z0-9._-]+(?:\s|$)/
  return command === trimmed
    && supportedStart.test(command)
    && !/[\r\n;&|<>]/.test(command)
    && !/(?:^|\s)["']?(?:\/|~\/|\.\.\/)/.test(command)
}

function collectGraphFailures(graph: ProjectGraph): AuditFailure[] {
  const failures: AuditFailure[] = []
  const phaseOrder = new Map(graph.phases.map((phase, index) => [phase.id, index]))
  const taskOrder = new Map(graph.phases.flatMap((phase, phaseIndex) => phase.tasks.map(task => [task.id, phaseIndex] as const)))
  const ownerIds = new Set(graph.owners.map(owner => owner.id))
  const featureIds = new Set(graph.features.map(feature => feature.id))
  const requirementIds = new Set(graph.requirements.map(requirement => requirement.id))
  const contractIds = new Set(graph.contracts.map(contract => contract.id))
  const acceptanceIds = new Set(graph.acceptance.map(item => item.id))
  const allIds = [
    ...featureIds,
    ...acceptanceIds,
    ...requirementIds,
    ...contractIds,
    ...ownerIds,
    ...graph.phases.map(phase => phase.id),
    ...taskOrder.keys(),
  ]

  for (const id of duplicates(allIds)) failures.push(failure("graph.ids", id, `Duplicate graph ID: ${id}`))
  for (const file of duplicates(graph.owners.map(owner => owner.implementationFile))) failures.push(failure("graph.ownership", file, `Implementation file has conflicting owners: ${file}`))
  for (const file of duplicates(graph.owners.map(owner => owner.focusedTestFile))) failures.push(failure("graph.ownership", file, `Focused test has conflicting owners: ${file}`))
  if (hasDependencyCycle(graph.phases)) failures.push(failure("graph.cycles", "phases", "Phase dependency graph contains a cycle."))
  const allTasks = graph.phases.flatMap(phase => phase.tasks)
  if (hasDependencyCycle(allTasks)) failures.push(failure("graph.cycles", "tasks", "Task dependency graph contains a cycle."))

  for (const criterion of duplicates(graph.acceptance.map(item => acceptanceKey(item.criterion)))) {
    failures.push(failure("graph.acceptance-ownership", criterion, "An acceptance criterion has more than one authoritative graph owner."))
  }

  for (const feature of graph.features) {
    if (!ownerIds.has(feature.ownerId)) failures.push(failure("graph.references", feature.id, `Feature references unknown owner ${feature.ownerId}.`))
    if (!graph.contracts.some(contract => contract.featureIds.includes(feature.id))) failures.push(failure("graph.coverage", feature.id, "Feature has no contract."))
    const implementationTasks = graph.phases.flatMap(phase => phase.tasks).filter(task => task.featureIds.includes(feature.id))
    if (implementationTasks.length !== 1) failures.push(failure("graph.coverage", feature.id, `Feature must have exactly one implementation task; found ${implementationTasks.length}.`))
    if (!graph.requirements.some(requirement => requirement.featureId === feature.id)) failures.push(failure("graph.coverage", feature.id, "Feature has no requirement."))
    const ownedAcceptance = graph.acceptance.filter(item => item.kind === "feature" && item.featureIds.length === 1 && item.featureIds[0] === feature.id)
    if (!ownedAcceptance.length || !sameStructure(feature.acceptanceOutcomes, ownedAcceptance.map(item => item.criterion))) {
      failures.push(failure("graph.acceptance-ownership", feature.id, `${feature.id} must expose exactly its directly owned acceptance criteria.`))
    }
    for (const dependencyId of feature.requiredOwnerIds) {
      if (!ownerIds.has(dependencyId)) failures.push(failure("graph.references", feature.id, `${feature.id} requires unknown owner ${dependencyId}.`))
      if (dependencyId === feature.ownerId) failures.push(failure("graph.cycles", feature.id, `${feature.id} depends on its own owner ${dependencyId}.`))
    }
  }

  for (const requirement of graph.requirements) {
    if (!featureIds.has(requirement.featureId)) failures.push(failure("graph.references", requirement.id, `Requirement references unknown feature ${requirement.featureId}.`))
    if (!requirement.statement.trim() || !requirement.acceptanceCriteria.length || !requirement.acceptanceIds.length) failures.push(failure("graph.coverage", requirement.id, "Requirement lacks a statement or acceptance criteria."))
    const requirementTasks = graph.phases.flatMap(phase => phase.tasks).filter(task => task.requirementIds.includes(requirement.id))
    if (requirementTasks.length !== 1) failures.push(failure("graph.coverage", requirement.id, `Requirement must have exactly one implementation task; found ${requirementTasks.length}.`))
    for (const acceptanceId of requirement.acceptanceIds) {
      const item = graph.acceptance.find(candidate => candidate.id === acceptanceId)
      if (!item) failures.push(failure("graph.references", requirement.id, `Requirement references unknown acceptance ${acceptanceId}.`))
      else if (item.kind !== "feature" || item.featureIds.length !== 1 || item.featureIds[0] !== requirement.featureId) failures.push(failure("graph.acceptance-ownership", requirement.id, `${requirement.id} claims acceptance ${acceptanceId} outside its feature.`))
    }
    const criteria = requirement.acceptanceIds.flatMap(id => graph.acceptance.find(item => item.id === id)?.criterion ?? [])
    if (!sameStructure(requirement.acceptanceCriteria, criteria)) failures.push(failure("graph.acceptance-ownership", requirement.id, `${requirement.id} acceptance text does not match its authoritative acceptance IDs.`))
  }

  for (const item of graph.acceptance) {
    if (!item.criterion.trim()) failures.push(failure("graph.coverage", item.id, "Acceptance criterion is empty."))
    if (!ownerIds.has(item.ownerId)) failures.push(failure("graph.references", item.id, `Acceptance references unknown owner ${item.ownerId}.`))
    if (!item.featureIds.length) failures.push(failure("graph.coverage", item.id, "Acceptance references no feature."))
    for (const featureId of item.featureIds) if (!featureIds.has(featureId)) failures.push(failure("graph.references", item.id, `Acceptance references unknown feature ${featureId}.`))
    if (item.kind === "feature") {
      const feature = item.featureIds.length === 1 ? graph.features.find(candidate => candidate.id === item.featureIds[0]) : undefined
      if (!feature || item.ownerId !== feature.ownerId) failures.push(failure("graph.acceptance-ownership", item.id, `${item.id} must belong to exactly one feature implementation owner.`))
    } else if (item.ownerId !== "OWN-PACKAGING" || item.featureIds.length < 2) {
      failures.push(failure("graph.acceptance-ownership", item.id, `${item.id} must be a shared end-to-end criterion owned only by OWN-PACKAGING.`))
    }
    const claimingTasks = graph.phases.flatMap(phase => phase.tasks).filter(task => task.acceptanceIds.includes(item.id))
    if (claimingTasks.length !== 1) failures.push(failure("graph.acceptance-ownership", item.id, `${item.id} must be claimed by exactly one task; found ${claimingTasks.length}.`))
  }

  for (const contract of graph.contracts) {
    if (!ownerIds.has(contract.ownerId)) failures.push(failure("graph.references", contract.id, `Contract references unknown owner ${contract.ownerId}.`))
    for (const featureId of contract.featureIds) {
      if (!featureIds.has(featureId)) failures.push(failure("graph.references", contract.id, `Contract references unknown feature ${featureId}.`))
    }
    if (!graph.phases.some(phase => phase.tasks.some(task => task.contractIds.includes(contract.id)))) failures.push(failure("graph.coverage", contract.id, "Contract has no implementation task."))
  }

  for (const phase of graph.phases) {
    const current = phaseOrder.get(phase.id)!
    for (const dependency of phase.dependencies) {
      const dependencyIndex = phaseOrder.get(dependency)
      if (dependencyIndex === undefined || dependencyIndex >= current) failures.push(failure("graph.references", phase.id, `Phase dependency is missing or not earlier: ${dependency}`))
    }
    if (!phase.tasks.length) failures.push(failure("graph.coverage", phase.id, "Phase has no tasks."))
    for (const task of phase.tasks) {
      if (!task.focusedTests.length) failures.push(failure("graph.coverage", task.id, "Task has no focused test."))
      if (!task.validationCommands.length) failures.push(failure("validation.commands", task.id, "Task has no validation command."))
      for (const command of task.validationCommands) {
        if (!isRootValidationCommand(command)) failures.push(failure("validation.commands", command, "Validation command is not executable from the project root."))
      }
      if (!task.acceptanceCriteria.length || !task.prompt.trim()) failures.push(failure("graph.coverage", task.id, "Task lacks acceptance criteria or an executable prompt."))
      for (const ownerId of task.ownerIds) if (!ownerIds.has(ownerId)) failures.push(failure("graph.references", task.id, `Task references unknown owner ${ownerId}.`))
      for (const featureId of task.featureIds) if (!featureIds.has(featureId)) failures.push(failure("graph.references", task.id, `Task references unknown feature ${featureId}.`))
      for (const requirementId of task.requirementIds) if (!requirementIds.has(requirementId)) failures.push(failure("graph.references", task.id, `Task references unknown requirement ${requirementId}.`))
      for (const contractId of task.contractIds) if (!contractIds.has(contractId)) failures.push(failure("graph.references", task.id, `Task references unknown contract ${contractId}.`))
      for (const acceptanceId of task.acceptanceIds) if (!acceptanceIds.has(acceptanceId)) failures.push(failure("graph.references", task.id, `Task references unknown acceptance ${acceptanceId}.`))
      for (const references of [task.ownerIds, task.featureIds, task.requirementIds, task.contractIds, task.dependencies, task.acceptanceIds]) {
        if (duplicates(references).length) failures.push(failure("graph.references", task.id, `${task.id} contains duplicate graph references.`))
      }
      for (const dependency of task.dependencies) {
        const dependencyOrder = taskOrder.get(dependency)
        if (dependencyOrder === undefined || dependencyOrder >= current) failures.push(failure("graph.references", task.id, `Task dependency is missing or not earlier: ${dependency}`))
      }
    }
  }

  for (const task of allTasks) {
    if (!task.ownerIds.length) continue
    if (task.ownerIds.length !== 1) failures.push(failure("graph.ownership", task.id, `${task.id} must have exactly one implementation owner.`))
    const taskOwnerId = task.ownerIds[0]!
    const taskOwner = graph.owners.find(owner => owner.id === taskOwnerId)
    if (taskOwner && !sameStructure(task.focusedTests, [taskOwner.focusedTestFile])) {
      failures.push(failure("graph.focused-test-ownership", task.id, `${task.id} focused tests do not match ${taskOwnerId}'s authoritative focused test file.`))
    }
    if (taskOwnerId === "OWN-PACKAGING" && (task.featureIds.length || task.requirementIds.length)) {
      failures.push(failure("graph.task-scope", task.id, "The final integration and packaging gate may not claim implementation features or requirements."))
    }
    for (const featureId of task.featureIds) {
      const featureOwner = graph.features.find(feature => feature.id === featureId)?.ownerId
      if (!featureOwner || !task.ownerIds.includes(featureOwner)) failures.push(failure("graph.task-scope", task.id, `${task.id} claims feature ${featureId} owned by ${featureOwner ?? "an unknown owner"}.`))
    }
    for (const requirementId of task.requirementIds) {
      const featureId = graph.requirements.find(requirement => requirement.id === requirementId)?.featureId
      if (!featureId || !task.featureIds.includes(featureId)) failures.push(failure("graph.task-scope", task.id, `${task.id} claims requirement ${requirementId} without its directly owned feature.`))
    }
    for (const contractId of task.contractIds) {
      const contractOwnerId = graph.contracts.find(contract => contract.id === contractId)?.ownerId
      if (contractOwnerId && contractOwnerId !== taskOwnerId) failures.push(failure("graph.task-scope", task.id, `${task.id} claims contract ${contractId} owned by ${contractOwnerId}.`))
    }
    for (const acceptanceId of task.acceptanceIds) {
      const item = graph.acceptance.find(candidate => candidate.id === acceptanceId)
      if (!item) continue
      if (item.ownerId !== taskOwnerId) failures.push(failure("graph.acceptance-ownership", task.id, `${task.id} claims ${acceptanceId} owned by ${item.ownerId}.`))
      if (item.kind === "feature" && (item.featureIds.length !== 1 || !task.featureIds.includes(item.featureIds[0]!))) {
        failures.push(failure("graph.acceptance-ownership", task.id, `${task.id} claims ${acceptanceId} without its directly owned feature.`))
      }
      if (item.kind === "integration" && taskOwnerId !== "OWN-PACKAGING") failures.push(failure("graph.acceptance-ownership", task.id, `${task.id} claims shared end-to-end acceptance outside the final integration and packaging gate.`))
    }
    const expectedAcceptanceCriteria = buildTaskAcceptanceCriteria(
      task.acceptanceIds.flatMap(id => graph.acceptance.find(item => item.id === id) ?? []),
      task.contractIds.flatMap(id => graph.contracts.find(item => item.id === id) ?? []),
      task.focusedTests,
    )
    if (!sameStructure(task.acceptanceCriteria, expectedAcceptanceCriteria)) {
      failures.push(failure("graph.acceptance-ownership", task.id, `${task.id} acceptance criteria do not exactly match its authoritative acceptance IDs, contract IDs, and focused tests.`))
    }
  }

  const created = new Map<string, number>()
  for (const [phaseIndex, phase] of graph.phases.entries()) {
    for (const task of phase.tasks) {
      for (const file of task.filesToCreate) {
        if (created.has(file)) failures.push(failure("graph.ownership", file, `File is created more than once: ${file}`))
        else created.set(file, phaseIndex)
      }
      for (const file of task.filesToModify) {
        const createIndex = created.get(file)
        if (createIndex === undefined || createIndex > phaseIndex) failures.push(failure("graph.create-before-modify", file, `File is modified before an earlier create phase: ${file}`))
      }
    }
  }

  for (const owner of graph.owners) {
    const createIndex = phaseOrder.get(owner.createPhaseId)
    if (createIndex === undefined) failures.push(failure("graph.references", owner.id, `Owner create phase does not exist: ${owner.createPhaseId}`))
    const createTask = graph.phases.find(phase => phase.id === owner.createPhaseId)?.tasks.find(task => task.ownerIds.includes(owner.id))
    if (!createTask?.filesToCreate.includes(owner.implementationFile) || !createTask.filesToCreate.includes(owner.focusedTestFile)) {
      failures.push(failure("graph.ownership", owner.id, "Owner create task does not create its implementation and focused test files."))
    }
    const directFeatureIds = graph.features.filter(feature => feature.ownerId === owner.id).map(feature => feature.id)
    const ownedContractIds = graph.contracts.filter(contract => contract.ownerId === owner.id).map(contract => contract.id)
    if (!sameStructure(owner.featureIds, directFeatureIds)) failures.push(failure("graph.ownership", owner.id, `${owner.id} feature ownership differs from the authoritative feature graph.`))
    if (!sameStructure(owner.contractIds, ownedContractIds)) failures.push(failure("graph.ownership", owner.id, `${owner.id} contract ownership differs from the authoritative contract graph.`))
    for (const phaseId of owner.modifyPhaseIds) {
      const modifyIndex = phaseOrder.get(phaseId)
      if (createIndex === undefined || modifyIndex === undefined || modifyIndex <= createIndex) failures.push(failure("graph.create-before-modify", owner.id, `Owner modify phase is not later than create phase: ${phaseId}`))
    }
  }

  const ownerPhase = new Map(graph.owners.map(owner => [owner.id, phaseOrder.get(owner.createPhaseId)!]))
  const ownerTask = new Map(graph.owners.map(owner => [owner.id, graph.phases.flatMap(phase => phase.tasks).find(task => task.ownerIds.includes(owner.id))]))
  for (const feature of graph.features) {
    for (const dependencyOwnerId of feature.requiredOwnerIds) {
      const dependencyPhase = ownerPhase.get(dependencyOwnerId)
      const featurePhase = ownerPhase.get(feature.ownerId)
      const dependencyTaskId = ownerTask.get(dependencyOwnerId)?.id
      if (dependencyPhase === undefined || featurePhase === undefined || dependencyPhase >= featurePhase || !dependencyTaskId || !ownerTask.get(feature.ownerId)?.dependencies.includes(dependencyTaskId)) {
        failures.push(failure("graph.dependencies", feature.id, `${feature.ownerId} must depend on earlier capability owner ${dependencyOwnerId}.`))
      }
    }
  }
  for (const item of graph.contracts.filter(contract => contract.kind !== "interface" && contract.kind !== "recovery" && contract.kind !== "packaging" && contract.ownerId !== "OWN-PACKAGING")) {
    for (const featureId of item.featureIds) {
      const featureOwnerId = graph.features.find(feature => feature.id === featureId)?.ownerId
      if (!featureOwnerId || featureOwnerId === item.ownerId) continue
      const dependencyPhase = ownerPhase.get(item.ownerId)
      const featurePhase = ownerPhase.get(featureOwnerId)
      const dependencies = ownerTask.get(featureOwnerId)?.dependencies ?? []
      const dependencyTaskId = ownerTask.get(item.ownerId)?.id
      if (dependencyPhase === undefined || featurePhase === undefined || dependencyPhase >= featurePhase || !dependencyTaskId || !dependencies.includes(dependencyTaskId)) {
        failures.push(failure("graph.dependencies", featureId, `${featureOwnerId} must depend on earlier contract owner ${item.ownerId} for ${item.id}.`))
      }
    }
  }

  const kinds = new Set(graph.contracts.map(contract => contract.kind))
  const requiredKinds: ContractKind[] = ["interface", "recovery", "lifecycle", "persistence", "security", "packaging"]
  if (graph.blueprint.domainData.length) requiredKinds.push("data")
  if (graph.blueprint.externalServices.length) requiredKinds.push("integration")
  if (graph.blueprint.externalServices.some(service => service.credentialRequirement !== "none")) requiredKinds.push("credential")
  if (graph.blueprint.permissionNeeds.length) requiredKinds.push("permission")
  for (const kind of requiredKinds) if (!kinds.has(kind)) failures.push(failure("contract.decisions", kind, `Required ${kind} contract is missing.`))

  const routing = graph.blueprint.transcriptionRouting
  if (routing) {
    const liveFeatureIds = graph.features.filter(feature => routing.liveFeatureNames.includes(feature.name)).map(feature => feature.id)
    const importedFeatureIds = graph.features.filter(feature => routing.importedFeatureNames.includes(feature.name)).map(feature => feature.id)
    const liveContract = graph.contracts.find(item => item.kind === "integration" && item.name.toLowerCase().includes(routing.liveProviderName.toLowerCase()) && /\b(?:stream(?:ing)?|WebSocket)\b/i.test(contractText(graph, item.id)))
    const importedContract = graph.contracts.find(item => item.kind === "integration" && item.name.toLowerCase().includes(routing.importedProviderName.toLowerCase()) && /\btranscription\b/i.test(item.name) && /\b(?:batch|finalized audio|audio\/transcriptions|file-capable)\b/i.test(contractText(graph, item.id)))
    if (!liveFeatureIds.length || !importedFeatureIds.length || !liveContract || !importedContract
      || liveFeatureIds.some(id => !liveContract.featureIds.includes(id))
      || importedFeatureIds.some(id => liveContract.featureIds.includes(id))
      || importedFeatureIds.some(id => !importedContract.featureIds.includes(id))
      || liveFeatureIds.some(id => importedContract.featureIds.includes(id))) {
      failures.push(failure("contract.transcription-routing", "graph", "Live microphone and imported-audio features must resolve to separate streaming and batch integration contracts."))
    }

    const routingText = [
      ...graph.features.map(feature => feature.behavior),
      ...graph.contracts.flatMap(item => [item.decision, ...item.details, item.failureBehavior, ...item.recovery]),
      ...graph.phases.flatMap(phase => phase.tasks.flatMap(task => [...task.acceptanceCriteria, task.prompt, ...task.validationCommands])),
    ].join("\n")
    const missing = missingMarkers(routingText, [
      `${routing.liveProviderName} WebSocket streaming is exclusively for live microphone audio`,
      `Imported audio-file transcription uses the configured batch/file-capable provider, ${routing.importedProviderName}`,
      "wav, mp3, flac, m4a, ogg, webm, and aac",
      "60 seconds",
      "25 MB (25,000,000 bytes)",
      "before any paid upload",
      "create no provider request",
      "release local inspection resources",
      "Do not split, chunk, transcode, or stitch",
    ])
    if (missing.length) failures.push(failure("contract.transcription-routing", "graph", `Transcription routing and local preflight are incomplete: ${missing.join(", ")}.`))
    if (unresolvedDecisionPattern.test(routingText)) failures.push(failure("content.unresolved-decision", "graph", "The project graph contains an unresolved implementation alternative."))
  }

  const nativeMac = graph.presetId.startsWith("native-macos")
  const credentialContracts = graph.contracts.filter(contract => contract.kind === "credential" || (["data", "persistence"] as const).includes(contract.kind as "data" | "persistence") && credentialLike(`${contract.id} ${contract.name}`))
  for (const item of credentialContracts) {
    const text = contractText(graph, item.id)
    if (item.ownerId !== "OWN-CREDENTIAL-VAULT") {
      failures.push(failure("contract.persistence-ownership", item.id, `${item.id} must be owned by OWN-CREDENTIAL-VAULT, not ${item.ownerId}.`))
    }
    if (nativeMac) {
      const missing = missingMarkers(text, ["macOS Keychain only", `${graph.identity.bundleId}.credentials`])
      const positiveForbiddenPlacement = text.split("\n").some(line =>
        /\b(?:SQLite|UserDefaults|files?|logs?|generated output)\b/i.test(line)
        && /\b(?:store|persist|serialize|migrate|placement|write)\b/i.test(line)
        && !/\b(?:never|forbidden|must not|do not)\b/i.test(line))
      if (missing.length || positiveForbiddenPlacement) {
        failures.push(failure("contract.persistence-placement", item.id, `${item.id} must place credentials only in macOS Keychain and explicitly forbid every generic store.`))
      }
    }
  }

  for (const item of nativeMac ? graph.contracts.filter(contract => contract.kind === "persistence") : []) {
    const placement = item.details.find(detail => detail.startsWith("Placement:")) ?? ""
    const settings = /\b(?:settings?|preferences?|provider|hotkeys?|shortcuts?)\b/i.test(item.name)
    const records = /\b(?:history|modes?|vocabulary)\b/i.test(item.name)
    if (settings && !records && (!/\bUserDefaults\b/.test(placement) || /\bSQLite\b/.test(placement))) {
      failures.push(failure("contract.persistence-placement", item.id, `${item.id} must place lightweight settings only in UserDefaults.`))
    }
    if (records && !settings && (!/\bSQLite\b/.test(placement) || /\bUserDefaults\b/.test(placement))) {
      failures.push(failure("contract.persistence-placement", item.id, `${item.id} must place history, modes, and vocabulary only in SQLite.`))
    }
  }

  if (nativeMac && graph.blueprint.externalServices.some(service => /\bopenrouter\b/i.test(`${service.name} ${service.purpose}`))) {
    const transcription = contractText(graph, "CON-INTEGRATION-OPENROUTER-TRANSCRIPTION")
    const refinement = contractText(graph, "CON-INTEGRATION-OPENROUTER-REFINEMENT")
    const transcriptionMissing = missingMarkers(transcription, ["POST https://openrouter.ai/api/v1/audio/transcriptions", "openai/gpt-4o-transcribe", "input_audio", "usage.cost", "URLSessionTask.cancel()", "Retry-After", "Imported audio-file transcription uses the configured batch/file-capable provider, OpenRouter", "wav, mp3, flac, m4a, ogg, webm, and aac", "before reading audio bytes, base64 encoding, URLRequest construction, or URLSessionTask creation", "60 seconds", "25 MB (25,000,000 bytes)", "before any paid upload", "create no provider request", "release local inspection resources", "Do not split, chunk, transcode, or stitch"])
    const refinementMissing = missingMarkers(refinement, ["POST https://openrouter.ai/api/v1/chat/completions", "google/gemini-2.5-flash-lite", "temperature: 0.0", "reasoning: { effort: \"none\" }", "stream: false", "never invent speech", "usage.cost"])
    const openRouterCredentials = graph.contracts.filter(contract => contract.id.startsWith("CON-CREDENTIAL-OPENROUTER"))
    if (transcriptionMissing.length || transcription.includes("URLSessionWebSocketTask") || transcription.includes("streamed audio")) failures.push(failure("contract.provider-wire", "OpenRouter transcription", `OpenRouter transcription contract is incomplete or describes a batch request as live: ${transcriptionMissing.join(", ") || "forbidden live transport"}.`))
    if (refinementMissing.length) failures.push(failure("contract.provider-wire", "OpenRouter refinement", `OpenRouter refinement contract is incomplete: ${refinementMissing.join(", ")}.`))
    if (openRouterCredentials.length !== 1 || !openRouterCredentials[0]?.details.includes("Keychain account: openrouter-api-key")) failures.push(failure("contract.provider-wire", "OpenRouter credential", "Both OpenRouter roles must share exactly one deterministic Keychain account contract."))
  }

  if (nativeMac && graph.blueprint.externalServices.some(service => /\bdeepgram\b/i.test(`${service.name} ${service.purpose}`) && /\b(?:nova|streaming)\b/i.test(`${service.name} ${service.purpose}`))) {
    const wire = graph.blueprint.deepgramLiveContract
    const audio = graph.blueprint.temporaryAudioLifecycle
    const deepgram = graph.contracts.find(contract => contract.id === wire?.contractId)
    const expected = deepgramIntegrationValues(wire ?? DEEPGRAM_LIVE_MICROPHONE_CONTRACT, audio ?? TEMPORARY_AUDIO_LIFECYCLE)
    if (!sameStructure(wire, DEEPGRAM_LIVE_MICROPHONE_CONTRACT) || !sameContractValues(deepgram, expected)) {
      failures.push(failure("contract.provider-wire", "Deepgram Nova streaming", "Deepgram Nova streaming contract is incomplete."))
    }
  }

  if (nativeMac && graph.blueprint.temporaryAudioLifecycle) {
    const audio = graph.blueprint.temporaryAudioLifecycle
    const lifecycle = graph.contracts.find(contract => contract.id === "CON-LIFECYCLE-AUDIO-CAPTURE-TERMINATION")
    if (!sameStructure(audio, TEMPORARY_AUDIO_LIFECYCLE) || !sameContractValues(lifecycle, temporaryAudioLifecycleContractValues(audio))) {
      failures.push(failure("contract.persistence", "Temporary audio lifecycle", "The canonical temporary-audio lifecycle is incomplete."))
    }
  }

  const voiceData = graph.blueprint.domainData.map(item => item.name).join(" ")
  if (/history/i.test(voiceData) && /mode/i.test(voiceData) && /vocab/i.test(voiceData) && /(?:temporary|recording|audio)/i.test(voiceData) && graph.presetId.startsWith("native-macos")) {
    const persistence = contractText(graph, "CON-PERSISTENCE-VOICE-LOCAL-STORAGE")
    const missing = missingMarkers(persistence, ["macOS Keychain only", "UserDefaults", "SQLite", "PRAGMA user_version", "CREATE TABLE history", "CREATE TABLE modes", "CREATE TABLE vocabulary", "transactional migration", "FileManager.default.temporaryDirectory", "Saved recordings"])
    if (missing.length) failures.push(failure("contract.persistence", "CON-PERSISTENCE-VOICE-LOCAL-STORAGE", `Voice persistence contract is incomplete: ${missing.join(", ")}.`))
  }

  if (nativeMac && graph.features.some(feature => pasteFeatureLike(`${feature.name} ${feature.behavior}`))) {
    const paste = contractText(graph, "CON-PASTE-WORKFLOW")
    const missing = missingMarkers(paste, ["NSRunningApplication identity", "current Accessibility focused element", "exactly one insertion candidate", "never paste partial, empty, failed, cancelled, or unapproved text", "editable selected-text boundary", "every existing NSPasteboard item and representation", "original changeCount", "app-owned post-write changeCount", "became frontmost", "one Command-V through CGEvent", "750 ms", "never overwrite that newer clipboard content", "Preview mode never inserts before explicit approval", "Copy-only mode intentionally leaves the transcript on the clipboard", "direct Accessibility insertion", "captured application no longer available", "clipboard changed by another process", "insertion failure preserving the transcript"])
    if (missing.length) failures.push(failure("contract.paste", "CON-PASTE-WORKFLOW", `Paste workflow contract is incomplete: ${missing.join(", ")}.`))
  }

  if (graph.presetId.startsWith("native-macos")) {
    const packagingOwners = graph.owners.filter(owner => owner.id === "OWN-PACKAGING")
    const packagingTask = graph.phases.flatMap(phase => phase.tasks).find(task => task.ownerIds.includes("OWN-PACKAGING"))
    const packaging = contractText(graph, "CON-PACKAGING-RELEASE")
    const missing = missingMarkers(packaging, ["Scripts/package_app.sh", "Resources/Info.plist", "Resources/App.entitlements", "Resources/AppIcon.icns", "CFBundleIdentifier", "arm64", "Contents/MacOS", "codesign --verify --deep --strict", "LaunchServices"])
    if (packagingOwners.length !== 1 || packagingOwners[0]?.implementationFile !== "Scripts/package_app.sh" || graph.owners.some(owner => owner.implementationFile.endsWith("Packaging.swift")) || !packagingTask?.filesToCreate.includes("Resources/Info.plist") || missing.length) {
      failures.push(failure("contract.packaging", "OWN-PACKAGING", `Native packaging must have one package_app.sh authority and complete owned resources: ${missing.join(", ") || "ownership conflict"}.`))
    }
  }
  if (!graph.validationCommands.length) failures.push(failure("validation.commands", "graph", "Final validation commands are missing."))
  for (const command of graph.validationCommands) {
    if (!isRootValidationCommand(command)) failures.push(failure("validation.commands", command, "Validation command is not executable from the project root."))
  }

  return failures
}

const mechanicalGraphRules = new Set(["graph.ids", "graph.references", "graph.cycles", "graph.dependencies", "graph.ownership", "graph.create-before-modify"])

export function auditMechanicalGraph(graph: ProjectGraph): AuditFailure[] {
  return collectGraphFailures(graph).filter(item => mechanicalGraphRules.has(item.rule))
}

export function auditAgentReadinessGraph(graph: ProjectGraph): AuditFailure[] {
  return collectGraphFailures(graph).filter(item => !mechanicalGraphRules.has(item.rule))
}

export function auditProjectGraph(graph: ProjectGraph): AuditFailure[] {
  return collectGraphFailures(graph)
}

function stripSection(markdown: string, heading: RegExp): string {
  const lines = markdown.split("\n")
  const result: string[] = []
  let skipping = false
  for (const line of lines) {
    if (/^##\s+/.test(line)) skipping = heading.test(line)
    if (!skipping) result.push(line)
  }
  return result.join("\n")
}

export function implementationText(documents: Readonly<Record<string, string>>): string {
  return Object.values(documents).map(markdown => stripSection(markdown, /^##\s+Forbidden (?:Technologies|Substitutions)$/)).join("\n")
}

const requiredHeadings: Readonly<Record<DocumentName, readonly string[]>> = {
  "PRD.md": ["# Product Requirements Document", "## Product Definition", "## Problem Statement", "## Target Users", "## Goals", "## Non-Goals", "## Primary User Journeys", "## Feature Contracts", "## Requirement Contracts", "## Success Criteria", "## Traceability Index"],
  "ARD.md": ["# Architecture Requirements Document", "## Architecture Summary", "## Architectural Style", "## Runtime Boundaries", "## Component and Ownership Map", "## State Ownership", "## Platform Lifecycle", "## Persistence Placement", "## Security Boundaries", "## Accessibility Boundary", "## External Integration Placement", "## Recovery Architecture", "## Packaging and Installation", "## Traceability Index"],
  "TRD.md": ["# Technical Requirements Document", "## Locked Stack", "## Runtime Architecture Contracts", "## Project Layout", "## Interface Contracts", "## Data Contracts", "## External Integration Contracts", "## Lifecycle Contracts", "## Persistence Contracts", "## Credential Contracts", "## Permission Contracts", "## Errors and Recovery Contracts", "## Accessibility Contracts", "## Packaging Contract", "## Signing Contract", "## Installation Contract", "## Validation Commands", "## Traceability Index"],
  "TASKS.md": ["# Implementation Tasks", "## Working Rules", "## Packaging and Installation", "## Final Validation Commands", "## Traceability Index"],
  "AGENTS.md": ["# AGENTS.md", "## Required Reading Order", "## Authority Hierarchy", "## Locked Stack", "## Forbidden Substitutions", "## Installation Rule", "## Execution Rules", "## Runtime Architecture Rules", "## Integration Boundary", "## Recovery Rules", "## Lifecycle Rules", "## Accessibility Rules", "## Required Phase Order", "## Validation Gates", "## Stop Conditions", "## Completion Reporting", "## Traceability Index"],
}

const unfinishedPattern = /\b(?:TBD|TODO|FIXME|lorem ipsum|placeholder text|implement later|to be determined|or equivalent|as appropriate)\b/i
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bBearer\s+[A-Za-z0-9._~-]{16,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/,
]
const genericIdentityPattern = /\b(?:com\.example(?:\.[a-z0-9-]+)*|org\.example(?:\.[a-z0-9-]+)*|example\.com|your[-. ]company|your[-. ]bundle)\b/i

function markdownFailures(name: string, markdown: string): AuditFailure[] {
  const failures: AuditFailure[] = []
  if (!markdown.trim()) return [failure("packet.non-empty", name, `${name} is empty.`)]
  const h1Count = markdown.split("\n").filter(line => /^#\s+\S/.test(line)).length
  if (h1Count !== 1 || /[ \t]+$/m.test(markdown) || markdown.includes("\0") || (markdown.match(/```/g)?.length ?? 0) % 2 !== 0) {
    failures.push(failure("markdown.valid", name, `${name} has malformed Markdown structure.`))
  }
  for (const heading of requiredHeadings[name as DocumentName] ?? []) {
    if (!markdown.includes(heading)) failures.push(failure("markdown.valid", name, `${name} is missing required heading ${heading}.`))
  }
  if (unfinishedPattern.test(markdown) || /<[^>]+>|\[insert\s+[^\]]+\]/i.test(markdown)) failures.push(failure("content.unfinished", name, `${name} contains unfinished content.`))
  if (unresolvedDecisionPattern.test(markdown)) failures.push(failure("content.unresolved-decision", name, `${name} contains an unresolved implementation alternative.`))
  if (genericIdentityPattern.test(markdown)) failures.push(failure("content.identity", name, `${name} contains a generic identity.`))
  if (secretPatterns.some(pattern => pattern.test(markdown))) failures.push(failure("content.secret-shaped", name, `${name} contains a secret-shaped value.`))
  return failures
}

function contradictsTemporaryAudioLifecycle(markdown: string): boolean {
  return markdown.split(/[\n;]+|(?<=[.!?])\s+/).some(rawClause => {
    const clause = rawClause.replace(/[-_]/g, " ")
    if (!/\b(?:temporary|recoverable|raw)?\s*(?:audio|recording)\b/i.test(clause)) return false
    if (/\b(?:delete no recoverable audio|never delete|do not delete|must not delete|without deleting|retain no|never retain|do not retain|must not retain|without retaining)\b/i.test(clause)) return false

    const deletes = /\bdelet(?:e|ed|es|ing)\b/i.test(clause)
    if (deletes && /\bdelet(?:e|ed|es|ing)\s+after completion\b|\bcloud request\b[^.]*\bunless\b|\bprovider request\b[^.]*\bunless\b/i.test(clause)) return true
    if (/\bdelet(?:e|ed|es|ing)\b(?:\s+\S+){0,6}\s+(?:after (?:a )?recoverable provider failure|before (?:an? )?(?:explicit )?(?:retry|provider switch))\b/i.test(clause)) return true
    if (/\b(?:after (?:a )?recoverable provider failure|before (?:an? )?(?:explicit )?(?:retry|provider switch))\b(?:\s+\S+){0,6}\s+delet(?:e|ed|es|ing)\b/i.test(clause)) return true
    if (/\b(?:retain(?:ed|s|ing)?|preserv(?:e|ed|es|ing)|keep|kept|surviv(?:e|ed|es|ing))\b(?:\s+\S+){0,6}\s+(?:after (?:accepted )?success|after explicit discard|after cancellation|after unrecoverable malformed audio|after exhausted recovery|beyond the active request|between requests|indefinitely)\b/i.test(clause)) return true
    if (/\b(?:after (?:accepted )?success|after explicit discard|after cancellation|after unrecoverable malformed audio|after exhausted recovery|beyond the active request|between requests)\b(?:\s+\S+){0,6}\s+(?:retain(?:ed|s|ing)?|preserv(?:e|ed|es|ing)|keep|kept|surviv(?:e|ed|es|ing))\b/i.test(clause)) return true
    return false
  })
}

function markdownContractText(markdown: string, contractId: string): string {
  const sectionStart = markdown.indexOf(`### ${contractId} —`)
  if (sectionStart >= 0) {
    const next = markdown.indexOf("\n### ", sectionStart + 4)
    return next >= 0 ? markdown.slice(sectionStart, next) : markdown.slice(sectionStart)
  }
  return markdown.split("\n").find(line => line.startsWith(`- ${contractId} —`)) ?? ""
}

export function auditPacket(
  graph: ProjectGraph,
  documents: Readonly<Record<string, string>>,
  preset: PresetContract,
): AuditFailure[] {
  const failures: AuditFailure[] = []
  const names = Object.keys(documents)
  if (names.join("|") !== DOCUMENT_NAMES.join("|")) failures.push(failure("packet.exact-five", "packet", `Expected exactly ${DOCUMENT_NAMES.join(", ")}.`))

  for (const name of DOCUMENT_NAMES) {
    const markdown = documents[name]
    if (typeof markdown !== "string") failures.push(failure("packet.non-empty", name, `${name} is missing.`))
    else failures.push(...markdownFailures(name, markdown))
  }

  if (graph.blueprint.transcriptionRouting) {
    const routing = graph.blueprint.transcriptionRouting
    const markers = [
      `${routing.liveProviderName} WebSocket streaming is exclusively for live microphone audio`,
      `Imported audio-file transcription uses the configured batch/file-capable provider, ${routing.importedProviderName}`,
      "wav, mp3, flac, m4a, ogg, webm, and aac",
      "60 seconds",
      "25 MB (25,000,000 bytes)",
      "before any paid upload",
      "create no provider request",
      "release local inspection resources",
      "Do not split, chunk, transcode, or stitch",
    ]
    if (graph.presetId.startsWith("native-macos")) markers.push("before reading audio bytes, base64 encoding, URLRequest construction, or URLSessionTask creation")
    for (const name of ["TRD.md", "TASKS.md"] as const) {
      const missing = missingMarkers(documents[name] ?? "", markers)
      if (missing.length) failures.push(failure("contract.transcription-routing", name, `${name} omits transcription routing or preflight decisions: ${missing.join(", ")}.`))
    }
  }

  for (const item of [...graph.features, ...graph.acceptance, ...graph.requirements, ...graph.contracts]) {
    for (const name of DOCUMENT_NAMES) {
      if (!documents[name]?.includes(item.id)) failures.push(failure("trace.missing-reference", name, `${name} is missing ${item.id}.`))
    }
  }
  for (const item of graph.contracts) {
    const detailDocuments = ["TRD.md", "TASKS.md"] as const
    for (const detail of [item.decision, ...item.details, item.failureBehavior, ...item.recovery]) {
      for (const name of detailDocuments) {
        if (!documents[name]?.includes(detail)) failures.push(failure("trace.missing-reference", name, `${name} is missing the rendered decision for ${item.id}.`))
      }
    }
  }

  const packetCredentialContracts = graph.contracts.filter(contract => contract.kind === "credential" || (["data", "persistence"] as const).includes(contract.kind as "data" | "persistence") && credentialLike(`${contract.id} ${contract.name}`))
  const packetPersistenceContracts = graph.contracts.filter(contract => contract.kind === "persistence")
  const placementDocuments = ["TRD.md", "TASKS.md"] as const
  for (const name of DOCUMENT_NAMES) {
    const markdown = documents[name] ?? ""
    if (graph.presetId.startsWith("native-macos") && contradictsTemporaryAudioLifecycle(markdown)) {
      failures.push(failure("contract.persistence", name, `${name} contradicts the temporary-audio retry and deletion boundary.`))
    }
  }
  for (const name of placementDocuments) {
    const markdown = documents[name] ?? ""
    for (const item of packetCredentialContracts) {
      const credentialText = markdownContractText(markdown, item.id)
      if (!credentialText.includes("OWN-CREDENTIAL-VAULT")) failures.push(failure("contract.persistence-ownership", name, `${name} does not render ${item.id} as CredentialVault-owned.`))
      if (graph.presetId.startsWith("native-macos") && (!credentialText.includes("macOS Keychain only") || !credentialText.includes(`${graph.identity.bundleId}.credentials`))) {
        failures.push(failure("contract.persistence-placement", name, `${name} does not render ${item.id} as Keychain-only.`))
      }
    }
    for (const item of graph.presetId.startsWith("native-macos") ? packetPersistenceContracts : []) {
      const persistenceText = markdownContractText(markdown, item.id)
      const settings = /\b(?:settings?|preferences?|provider|hotkeys?|shortcuts?)\b/i.test(item.name)
      const records = /\b(?:history|modes?|vocabulary)\b/i.test(item.name)
      if (settings && !records && (!persistenceText.includes("Placement: UserDefaults") || persistenceText.includes("Placement: SQLite"))) {
        failures.push(failure("contract.persistence-placement", name, `${name} renders conflicting placement for ${item.id}.`))
      }
      if (records && !settings && (!persistenceText.includes("Placement: SQLite") || persistenceText.includes("Placement: UserDefaults"))) {
        failures.push(failure("contract.persistence-placement", name, `${name} renders conflicting placement for ${item.id}.`))
      }
    }
  }

  const decisions = implementationText(documents)
  if (!decisions.includes(preset.implementationMarker)) failures.push(failure("stack.leakage", "packet", `Selected implementation marker is missing: ${preset.implementationMarker}`))
  for (const presetId of PRESET_IDS) {
    const other = presetId === preset.id ? undefined : presetId
    if (other && decisions.includes(PRESETS[other].implementationMarker)) failures.push(failure("stack.leakage", "packet", `Implementation marker leaked from ${other}.`))
  }

  const kinds = new Set(graph.contracts.map(contract => contract.kind))
  for (const kind of ["persistence", "lifecycle", "recovery", "packaging"] as const) {
    if (!kinds.has(kind)) failures.push(failure("contract.decisions", kind, `${kind} decision is missing.`))
  }
  if (graph.blueprint.permissionNeeds.length && !kinds.has("permission")) failures.push(failure("contract.decisions", "permission", "Permission decisions are missing."))
  if (graph.blueprint.externalServices.some(service => service.credentialRequirement !== "none") && !kinds.has("credential")) failures.push(failure("contract.decisions", "credential", "Credential decisions are missing."))
  if (!graph.validationCommands.every(command => documents["TRD.md"]?.includes(command) && documents["TASKS.md"]?.includes(command) && documents["AGENTS.md"]?.includes(command))) {
    failures.push(failure("validation.commands", "packet", "One or more final validation commands are missing from TRD.md, TASKS.md, or AGENTS.md."))
  }
  for (const rule of [...preset.runtimeArchitecture, preset.integrationBoundary, ...preset.recoveryRules, ...preset.lifecycleRules, ...preset.accessibilityRules, preset.installationDecision(graph.identity)]) {
    if (!["ARD.md", "TRD.md", "AGENTS.md"].every(name => documents[name]?.includes(rule))) {
      failures.push(failure("preset.contracts", preset.id, "A preset lifecycle or accessibility rule is missing from the downstream contract."))
    }
  }

  return failures
}

export function buildValidationLedger(failures: readonly AuditFailure[]): AuditEntry[] {
  const covered = new Set<string>()
  const entries: AuditEntry[] = ledgerRules.map(([rule, label]) => {
    const matching = failures.filter(item => item.rule === rule)
    matching.forEach(item => covered.add(`${item.rule}\0${item.path}\0${item.message}`))
    return {
      rule,
      label,
      status: matching.length ? "fail" as const : "pass" as const,
      detail: matching.length ? matching.map(item => `${item.path}: ${item.message}`).join(" ") : "Verified.",
    }
  })
  for (const item of failures) {
    const key = `${item.rule}\0${item.path}\0${item.message}`
    if (!covered.has(key)) entries.push({ rule: item.rule, label: item.rule, status: "fail", detail: `${item.path}: ${item.message}` })
  }
  return entries
}
