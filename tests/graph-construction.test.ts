import { describe, expect, it } from "vitest"
import {
  DOCUMENT_NAMES,
  GraphConstructionError,
  assertGraphReadyForRendering,
  compilePacket,
  type ProjectGraph,
} from "../src/compiler"
import type { PresetId } from "../src/presets"
import { sharedAcceptanceBlueprint, sharedOutcome } from "./fixtures/blueprints"

const PRESET: PresetId = "tauri2-rust-typescript-desktop"

function ownerTask(graph: ProjectGraph, ownerId: string) {
  return graph.phases.flatMap((phase, phaseIndex) => phase.tasks.map(task => ({ phaseIndex, task })))
    .find(item => item.task.ownerIds.includes(ownerId))!
}

function tasks(graph: ProjectGraph) {
  return graph.phases.flatMap((phase, phaseIndex) => phase.tasks.map(task => ({ phaseIndex, task })))
}

function expectGraphError(graph: ProjectGraph, rule: string): void {
  try {
    assertGraphReadyForRendering(graph)
    throw new Error("Expected graph construction to fail")
  } catch (error) {
    expect(error).toBeInstanceOf(GraphConstructionError)
    expect((error as GraphConstructionError).failure.rule).toBe(rule)
  }
}

describe("authoritative owner, task, and acceptance graph construction", () => {
  it("keeps a shared acceptance outcome out of both feature tasks", async () => {
    const packet = await compilePacket(sharedAcceptanceBlueprint(), PRESET)
    const acceptanceFailures = packet.failures.filter(failure => failure.rule === "graph.acceptance-ownership")

    expect(acceptanceFailures).toEqual([])
    for (const id of ["FEAT-NOTE-CAPTURE", "FEAT-PORTABLE-EXPORT"]) {
      const feature = packet.graph.features.find(item => item.id === id)!
      expect(ownerTask(packet.graph, feature.ownerId).task.featureIds).toEqual([feature.id])
    }
    expect(packet.exportable).toBe(true)
  })

  it("uses stable-ID topological ordering when provider feature order is reversed", async () => {
    const forward = await compilePacket(sharedAcceptanceBlueprint(), PRESET)
    const reversedBlueprint = sharedAcceptanceBlueprint()
    reversedBlueprint.features.reverse()
    const reversed = await compilePacket(reversedBlueprint, PRESET)

    expect(reversed.graph.owners.map(owner => owner.id)).toEqual(forward.graph.owners.map(owner => owner.id))
    expect(reversed.graph.phases.map(phase => phase.tasks[0]!.ownerIds[0] ?? "foundation"))
      .toEqual(forward.graph.phases.map(phase => phase.tasks[0]!.ownerIds[0] ?? "foundation"))
    expect(reversed.failures).toEqual([])
  })

  it("owns shared acceptance once in the final integration and packaging gate", async () => {
    const packet = await compilePacket(sharedAcceptanceBlueprint(), PRESET)
    const shared = packet.graph.acceptance.filter(item => item.criterion === sharedOutcome)

    expect(shared).toHaveLength(1)
    expect(shared[0]).toMatchObject({ kind: "integration", ownerId: "OWN-PACKAGING" })
    const claimingTasks = tasks(packet.graph).filter(({ task }) => task.acceptanceIds.includes(shared[0]!.id))
    expect(claimingTasks).toHaveLength(1)
    expect(claimingTasks[0]!.task.ownerIds).toEqual(["OWN-PACKAGING"])
    for (const { task } of tasks(packet.graph).filter(({ task }) => !task.ownerIds.includes("OWN-PACKAGING"))) {
      expect(task.acceptanceCriteria.join("\n")).not.toContain(shared[0]!.criterion)
    }
  })

  it("keeps each task on its directly owned feature when one feature refers to another", async () => {
    const blueprint = sharedAcceptanceBlueprint()
    const search = blueprint.features.find(feature => feature.name === "Offline search")!
    search.behavior = "Index titles and bodies locally, and pass each selected result to note capture for editing."
    const packet = await compilePacket(blueprint, PRESET)

    for (const id of ["FEAT-OFFLINE-SEARCH", "FEAT-NOTE-CAPTURE", "FEAT-PORTABLE-EXPORT"]) {
      const feature = packet.graph.features.find(item => item.id === id)!
      const task = ownerTask(packet.graph, feature.ownerId).task
      expect(task.featureIds).toEqual([feature.id])
      expect(task.acceptanceIds.every(acceptanceId => packet.graph.acceptance.find(item => item.id === acceptanceId)?.ownerId === feature.ownerId)).toBe(true)
    }
    expect(packet.exportable).toBe(true)
  })

  it("infers no feature-to-feature owner edges from domain vocabulary", async () => {
    const packet = await compilePacket(sharedAcceptanceBlueprint(), PRESET)

    for (const feature of packet.graph.features) expect(feature.requiredOwnerIds).toEqual([])
  })

  it("deduplicates every feature, contract, dependency, and acceptance reference", async () => {
    const blueprint = sharedAcceptanceBlueprint()
    blueprint.features[0]!.acceptanceSignals.push(blueprint.features[0]!.acceptanceSignals[0]!)
    const graph = (await compilePacket(blueprint, PRESET)).graph

    for (const contract of graph.contracts) expect(new Set(contract.featureIds).size).toBe(contract.featureIds.length)
    for (const { task } of tasks(graph)) {
      for (const references of [task.ownerIds, task.featureIds, task.requirementIds, task.contractIds, task.dependencies, task.acceptanceIds]) {
        expect(new Set(references).size).toBe(references.length)
      }
    }
    expect(new Set(graph.acceptance.map(item => item.id)).size).toBe(graph.acceptance.length)
  })

  it("rejects missing owners before any renderer can consume the graph", async () => {
    const graph = structuredClone((await compilePacket(sharedAcceptanceBlueprint(), PRESET)).graph) as ProjectGraph & { features: Array<ProjectGraph["features"][number]> }
    graph.features[0] = { ...graph.features[0]!, ownerId: "OWN-MISSING" }
    expectGraphError(graph, "graph.references")
  })

  it("rejects direct and transitive dependency cycles before rendering", async () => {
    const source = (await compilePacket(sharedAcceptanceBlueprint(), PRESET)).graph
    const direct = structuredClone(source) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    direct.phases[1] = { ...direct.phases[1]!, dependencies: [direct.phases[1]!.id] }
    expectGraphError(direct, "graph.cycles")

    const transitive = structuredClone(source) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    transitive.phases[1] = { ...transitive.phases[1]!, dependencies: [transitive.phases[3]!.id] }
    transitive.phases[2] = { ...transitive.phases[2]!, dependencies: [transitive.phases[1]!.id] }
    transitive.phases[3] = { ...transitive.phases[3]!, dependencies: [transitive.phases[2]!.id] }
    expectGraphError(transitive, "graph.cycles")
  })

  it("rejects create-before-modify violations before rendering", async () => {
    const source = (await compilePacket(sharedAcceptanceBlueprint(), PRESET)).graph
    const graph = structuredClone(source) as ProjectGraph & { phases: Array<ProjectGraph["phases"][number]> }
    const early = graph.phases[1]!
    const task = early.tasks[0]!
    const futureFile = graph.owners.at(-2)!.implementationFile
    graph.phases[1] = { ...early, tasks: [{ ...task, filesToModify: [...task.filesToModify, futureFile] }] }
    expectGraphError(graph, "graph.create-before-modify")
  })

  it("keeps task acceptance and dependencies structurally owned and backward-only", async () => {
    const packet = await compilePacket(sharedAcceptanceBlueprint(), PRESET)
    const graph = packet.graph
    const order = new Map(tasks(graph).map(({ phaseIndex, task }) => [task.id, phaseIndex]))

    for (const { phaseIndex, task } of tasks(graph)) {
      for (const dependency of task.dependencies) expect(order.get(dependency)!).toBeLessThan(phaseIndex)
      for (const acceptanceId of task.acceptanceIds) {
        const acceptance = graph.acceptance.find(item => item.id === acceptanceId)!
        expect(acceptance.ownerId).toBe(task.ownerIds[0])
        if (acceptance.kind === "feature") {
          expect(acceptance.featureIds).toHaveLength(1)
          expect(task.featureIds).toContain(acceptance.featureIds[0])
        } else {
          expect(task.ownerIds).toEqual(["OWN-PACKAGING"])
        }
      }
    }
  })

  it("renders one graph's owner, dependency, and acceptance IDs through all five documents", async () => {
    const packet = await compilePacket(sharedAcceptanceBlueprint(), PRESET)
    const feature = packet.graph.features.find(item => item.id === "FEAT-NOTE-CAPTURE")!
    const task = ownerTask(packet.graph, feature.ownerId).task
    const acceptanceIds = packet.graph.acceptance.filter(item => item.featureIds.includes(feature.id)).map(item => item.id)

    for (const name of DOCUMENT_NAMES) {
      const trace = packet.documents[name].split("\n").find(line => line.startsWith(`- ${feature.id} —`) && line.includes(" — Requirement "))!
      expect(trace).toContain(feature.ownerId)
      expect(trace).toContain(task.id)
      for (const dependency of task.dependencies) expect(trace).toContain(dependency)
      for (const acceptanceId of acceptanceIds) expect(packet.documents[name]).toContain(acceptanceId)
    }
  })
})
