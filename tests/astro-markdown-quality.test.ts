import { describe, expect, it } from "vitest"
import { astroFeaturePlacement } from "../src/astroWeb"
import { compilePacket, compileProjectGraph, normalizeBlueprint } from "../src/compiler"
import { auditProjectGraph } from "../src/audit"
import { docsPortalBlueprint, landingPageBlueprint } from "./fixtures/blueprints"
import type { SemanticBlueprint } from "../src/schema"

const portfolioBlueprint: SemanticBlueprint = {
  productName: "Copper Kite",
  summary: "A dark-first public portfolio catalog for nodaysidle software projects with filterable project cards, detail pages, and an about page.",
  targetUsers: ["Developers evaluating nodaysidle open-source tools"],
  goals: ["Show every public project with repo links and summaries", "Filter and sort the catalog without client-side databases", "Keep detail pages shareable by direct URL"],
  nonGoals: ["User accounts", "Private repository access"],
  features: [
    {
      name: "Project catalog grid",
      userOutcome: "Compare projects quickly from one scannable home page.",
      trigger: "A visitor opens the home page.",
      behavior: "Render a filterable and sortable grid of project cards sourced from build-time content.",
      failureOutcome: "An empty or invalid collection shows an honest empty state.",
      acceptanceSignals: ["Every published project appears once", "Filters and sort controls update the visible cards"],
    },
    {
      name: "Project detail page",
      userOutcome: "Read one project's summary, links, and README excerpt on a dedicated URL.",
      trigger: "A visitor opens a project card or direct project URL.",
      behavior: "Render a project detail page from the matching content collection entry with canonical metadata and outbound repo links.",
      failureOutcome: "Unknown slugs render the documented not-found route.",
      acceptanceSignals: ["Each project has a stable direct URL", "Detail pages expose repo and summary metadata"],
    },
    {
      name: "About page",
      userOutcome: "Understand who maintains the portfolio and how projects are selected.",
      trigger: "A visitor opens the about page.",
      behavior: "Publish maintainer context, selection criteria, and contact guidance on a dedicated about page.",
      failureOutcome: "Missing about content blocks deployment with a visible validation failure.",
      acceptanceSignals: ["About page is reachable from primary navigation"],
    },
  ],
  dataObjects: [
    { name: "Project catalog entry", purpose: "Describe one public repository with summary, tags, status, and outbound links.", sensitivity: "public", retentionIntent: "Published in the repository as markdown until removed." },
  ],
  externalServices: [
    { name: "GitHub", purpose: "Link to public nodaysidle repositories.", dataSent: [], credentialRequired: false },
  ],
  platformNeeds: [],
  qualityRequirements: ["Dark-first, high-contrast presentation.", "Keyboard-operable filters and navigation.", "Meet WCAG 2.2 AA."],
  productConstraints: ["Publish no secret, credential, or private repository data.", "Do not invent release status."],
}

describe("astro markdown quality improvements", () => {
  it("separates product definition from problem statement", async () => {
    const packet = await compilePacket(landingPageBlueprint, "astro-web")
    expect(packet.documents["PRD.md"]).toContain("## Product Definition")
    expect(packet.documents["PRD.md"]).toContain("## Problem Statement")
    expect(packet.graph.blueprint.problemStatement).not.toBe(packet.graph.blueprint.productDefinition)
  })

  it("avoids lifecycle coordinator boilerplate on static landing pages", async () => {
    const packet = await compilePacket(landingPageBlueprint, "astro-web")
    const text = Object.values(packet.documents).join("\n")
    expect(text).not.toContain("OWN-LIFECYCLE-COORDINATOR")
    expect(text).not.toContain("LifecycleCoordinator")
    expect(packet.exportable).toBe(true)
  })

  it("uses content collections, routes, seed guidance, and npm scripts for portfolio catalogs", async () => {
    const packet = await compilePacket(portfolioBlueprint, "astro-web")
    const text = Object.values(packet.documents).join("\n")

    expect(packet.graph.astroPlan?.usesContentCollections).toBe(true)
    expect(text).toContain("src/content/config.ts")
    expect(text).toContain("src/content/projects/")
    expect(text).toContain("src/pages/projects/[slug].astro")
    expect(text).toContain("src/pages/about.astro")
    expect(text).toContain("Content Seed Requirements")
    expect(text).toContain("Design System")
    expect(text).toContain("npm run check")
    expect(text).toContain("npm run test:a11y")
    expect(text).toContain("npm run audit:performance")
    expect(text).toContain("getCollection")
    expect(text).not.toMatch(/browser records use IndexedDB/i)
    expect(text).toContain("src/lib/github.ts")
    expect(auditProjectGraph(packet.graph)).toEqual([])
    expect(packet.exportable).toBe(true)
  })

  it("does not assign home-page catalog grids to the shared dynamic route", () => {
    const gridPlacement = astroFeaturePlacement({
      id: "FEAT-GRID",
      name: "Project catalog grid",
      behavior: "Render a filterable and sortable grid of project cards sourced from build-time content on the home page.",
      ownerId: "OWN-PROJECT-CATALOG-GRID",
      inputs: [],
      outputs: [],
      acceptanceOutcomes: [],
      failureBehavior: "Show empty state.",
      recoveryExpectations: [],
      providedCapabilities: [],
      requiredCapabilities: [],
      resourceIds: [],
      requiredOwnerIds: [],
    }, "projects")
    expect(gridPlacement).toEqual({ kind: "component", registrationFile: "src/pages/index.astro" })
  })

  it("orders shared dynamic route registrants after the route owner", () => {
    const graph = compileProjectGraph(normalizeBlueprint(portfolioBlueprint, "astro-web"), "astro-web")
    const routeOwnerFeatureId = graph.astroPlan?.sharedDynamicRouteOwnerFeatureId
    const routeOwnerId = graph.features.find(feature => feature.id === routeOwnerFeatureId)?.ownerId
    expect(routeOwnerId).toBeTruthy()
    expect(auditProjectGraph(graph)).toEqual([])
  })

  it("creates guide routes and content collection paths for documentation portals", async () => {
    const packet = await compilePacket(docsPortalBlueprint, "astro-web")
    const text = Object.values(packet.documents).join("\n")

    expect(text).toContain("src/content/guides/")
    expect(text).toContain("src/pages/guides/[slug].astro")
    expect(text).toContain("Information Architecture and Routes")
    expect(packet.exportable).toBe(true)
  })

  it("keeps compact trace indexes in PRD and AGENTS while preserving full contract prose in TRD", async () => {
    const packet = await compilePacket(portfolioBlueprint, "astro-web")
    const contract = packet.graph.contracts.find(item => item.kind === "interface")!

    expect(packet.documents["PRD.md"]).toContain(`${contract.id} —`)
    expect(packet.documents["PRD.md"]).not.toContain(`Decision ${contract.decision}`)
    expect(packet.documents["TRD.md"]).toContain(contract.decision)
    expect(packet.documents["TASKS.md"]).toContain(`Contract ${contract.id}: implement the full decision`)
  })
})
