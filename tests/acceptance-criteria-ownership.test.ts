import { describe, expect, it } from "vitest"
import { auditProjectGraph } from "../src/audit"
import { compilePacket, type GraphTask, type ProjectGraph } from "../src/compiler"
import type { SemanticBlueprint } from "../src/schema"
import { docsPortalBlueprint } from "./fixtures/blueprints"
import { observedAcceptanceOwnershipVoiceBlueprint } from "./fixtures/voice-v3-export"

const deploymentOutcome = "Local builds and the Vercel deployment workflow publish the same verified routes"

export function astroOwnershipBlueprint(
  featureNames: readonly [security: string, deployment: string] = ["Custom 404 and security headers", "Documented local and Vercel deployment workflow"],
): SemanticBlueprint {
  return {
    productName: "Northstar Catalogue",
    summary: "A static project catalogue with resilient routing, secure responses, and a documented local and production deployment workflow.",
    targetUsers: ["Visitors comparing published software projects"],
    goals: ["Keep every public route secure and reproducible from local development through production deployment"],
    nonGoals: ["User accounts", "Online payments"],
    features: [
      {
        name: featureNames[0],
        userOutcome: "Unknown routes remain useful and every response carries the documented security headers.",
        trigger: "A visitor requests any known or unknown project route.",
        behavior: `Render the custom not-found route and configure the security headers while preserving this release invariant: ${deploymentOutcome}.`,
        failureOutcome: "A routing or header validation failure blocks deployment without replacing the last verified release.",
        acceptanceSignals: ["Unknown routes show the custom 404 page", "Production responses include the configured security headers"],
      },
      {
        name: featureNames[1],
        userOutcome: "A maintainer can reproduce the same verified site locally and on Vercel.",
        trigger: "A maintainer follows the documented development or deployment commands.",
        behavior: "Document exact install, local build, preview, Vercel deployment, and post-deployment verification commands.",
        failureOutcome: "A failed build or deployment keeps the last verified release active and identifies the first failed command.",
        acceptanceSignals: [deploymentOutcome],
      },
    ],
    dataObjects: [],
    externalServices: [],
    platformNeeds: [],
    qualityRequirements: ["Use semantic HTML, keyboard navigation, and WCAG 2.2 AA contrast."],
    productConstraints: ["Publish no secret, credential, private repository data, or invented release status."],
  }
}

function taskForOwner(graph: ProjectGraph, ownerId: string): GraphTask {
  return graph.phases.flatMap(phase => phase.tasks).find(task => task.ownerIds.includes(ownerId))!
}

function replaceTask(graph: ProjectGraph, taskId: string, update: (task: GraphTask) => GraphTask): ProjectGraph {
  return {
    ...graph,
    phases: graph.phases.map(phase => ({
      ...phase,
      tasks: phase.tasks.map(task => task.id === taskId ? update(task) : task),
    })),
  }
}

function insertBeforeContracts(criteria: readonly string[], criterion: string): string[] {
  const contractIndex = criteria.findIndex(item => item.startsWith("Decision "))
  const index = contractIndex < 0 ? criteria.length - 1 : contractIndex
  return [...criteria.slice(0, index), criterion, ...criteria.slice(index)]
}

function expectAcceptanceReconstructionFailure(graph: ProjectGraph, taskId: string): void {
  expect(auditProjectGraph(graph)).toContainEqual({
    rule: "graph.acceptance-ownership",
    path: taskId,
    message: `${taskId} acceptance criteria do not exactly match its authoritative acceptance IDs, contract IDs, and focused tests.`,
  })
}

describe("authoritative task acceptance criteria", () => {
  it("accepts owned Astro contract prose that mentions another feature outcome", async () => {
    const packet = await compilePacket(astroOwnershipBlueprint(), "astro-web")
    const securityFeature = packet.graph.features.find(feature => feature.name === "Custom 404 and security headers")!
    const securityTask = packet.graph.phases.flatMap(phase => phase.tasks).find(task => task.ownerIds.includes(securityFeature.ownerId))!

    expect(securityTask.featureIds).toEqual([securityFeature.id])
    expect(securityTask.acceptanceIds.every(id => packet.graph.acceptance.find(item => item.id === id)?.ownerId === securityFeature.ownerId)).toBe(true)
    expect(securityTask.acceptanceCriteria.some(criterion => criterion.includes(deploymentOutcome)) || packet.documents["TRD.md"].includes(deploymentOutcome)).toBe(true)
    expect(packet.failures).toEqual([])
    expect(packet.exportable).toBe(true)
  })

  it("accepts arbitrary feature names and reversed provider feature ordering", async () => {
    const blueprint = astroOwnershipBlueprint(["Boundary Lantern", "Release Atlas"])
    blueprint.features.reverse()

    const packet = await compilePacket(blueprint, "astro-web")

    expect(packet.graph.features.map(feature => feature.name)).toContain("Boundary Lantern")
    expect(packet.graph.features.map(feature => feature.name)).toContain("Release Atlas")
    expect(packet.failures).toEqual([])
    expect(packet.exportable).toBe(true)
  })

  it.each([
    ["missing", (criteria: readonly string[]) => criteria.slice(1)],
    ["reordered", (criteria: readonly string[]) => [criteria[1]!, criteria[0]!, ...criteria.slice(2)]],
    ["duplicated", (criteria: readonly string[]) => [...criteria, criteria[0]!]],
  ])("rejects %s authoritative task acceptance criteria", async (_case, mutate) => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const mutated = replaceTask(graph, task.id, current => ({ ...current, acceptanceCriteria: mutate(current.acceptanceCriteria) }))

    expectAcceptanceReconstructionFailure(mutated, task.id)
  })

  it("rejects an extra foreign outcome appended to task acceptance criteria", async () => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const foreignOutcome = graph.features.find(feature => feature.ownerId !== task.ownerIds[0])!.acceptanceOutcomes[0]!
    const mutated = replaceTask(graph, task.id, current => ({ ...current, acceptanceCriteria: [...current.acceptanceCriteria, foreignOutcome] }))

    expectAcceptanceReconstructionFailure(mutated, task.id)
  })

  it("rejects a foreign feature ID", async () => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const foreignFeature = graph.features.find(feature => feature.ownerId !== task.ownerIds[0])!
    const mutated = replaceTask(graph, task.id, current => ({ ...current, featureIds: [...current.featureIds, foreignFeature.id] }))

    expect(auditProjectGraph(mutated)).toContainEqual(expect.objectContaining({ rule: "graph.task-scope", path: task.id }))
  })

  it("rejects a foreign requirement ID", async () => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const foreignRequirement = graph.requirements.find(requirement => !task.featureIds.includes(requirement.featureId))!
    const mutated = replaceTask(graph, task.id, current => ({ ...current, requirementIds: [...current.requirementIds, foreignRequirement.id] }))

    expect(auditProjectGraph(mutated)).toContainEqual(expect.objectContaining({ rule: "graph.task-scope", path: task.id }))
  })

  it("rejects a contract ID owned by another task owner", async () => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const foreignContract = graph.contracts.find(contract => contract.ownerId !== task.ownerIds[0])!
    const foreignCriteria = [
      `Decision ${foreignContract.id}: ${foreignContract.decision}`,
      ...foreignContract.details,
      `Failure ${foreignContract.id}: ${foreignContract.failureBehavior}`,
      ...foreignContract.recovery.map(recovery => `Recovery ${foreignContract.id}: ${recovery}`),
    ]
    const mutated = replaceTask(graph, task.id, current => {
      const focusedTestIndex = current.acceptanceCriteria.findIndex(criterion => criterion.startsWith("Focused test "))
      return {
        ...current,
        contractIds: [...current.contractIds, foreignContract.id],
        acceptanceCriteria: [
          ...current.acceptanceCriteria.slice(0, focusedTestIndex),
          ...foreignCriteria,
          ...current.acceptanceCriteria.slice(focusedTestIndex),
        ],
      }
    })

    expect(auditProjectGraph(mutated)).toContainEqual(expect.objectContaining({
      rule: "graph.task-scope",
      path: task.id,
      message: expect.stringContaining(`claims contract ${foreignContract.id} owned by ${foreignContract.ownerId}`),
    }))
  })

  it("rejects an acceptance ID owned by another task owner", async () => {
    const graph = (await compilePacket(docsPortalBlueprint, "astro-web")).graph
    const task = taskForOwner(graph, graph.features[0]!.ownerId)
    const foreignAcceptance = graph.acceptance.find(item => item.ownerId !== task.ownerIds[0] && item.kind === "feature")!
    const mutated = replaceTask(graph, task.id, current => ({
      ...current,
      acceptanceIds: [...current.acceptanceIds, foreignAcceptance.id],
      acceptanceCriteria: insertBeforeContracts(current.acceptanceCriteria, foreignAcceptance.criterion),
    }))

    expect(auditProjectGraph(mutated)).toContainEqual(expect.objectContaining({
      rule: "graph.acceptance-ownership",
      path: task.id,
      message: expect.stringContaining(`claims ${foreignAcceptance.id} owned by ${foreignAcceptance.ownerId}`),
    }))
  })

  it("rejects shared integration acceptance outside OWN-PACKAGING", async () => {
    const graph = (await compilePacket(observedAcceptanceOwnershipVoiceBlueprint(), "native-macos-swiftui-menubar")).graph
    const sharedAcceptance = graph.acceptance.find(item => item.kind === "integration")!
    const task = graph.phases.flatMap(phase => phase.tasks).find(item => item.ownerIds.length === 1 && item.ownerIds[0] !== "OWN-PACKAGING")!
    const mutated = replaceTask(graph, task.id, current => ({
      ...current,
      acceptanceIds: [...current.acceptanceIds, sharedAcceptance.id],
      acceptanceCriteria: insertBeforeContracts(current.acceptanceCriteria, sharedAcceptance.criterion),
    }))

    expect(auditProjectGraph(mutated)).toContainEqual(expect.objectContaining({
      rule: "graph.acceptance-ownership",
      path: task.id,
      message: expect.stringContaining("claims shared end-to-end acceptance outside the final integration and packaging gate"),
    }))
  })
})
