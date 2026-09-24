import type { GraphFeature, NormalizedBlueprint } from "./compiler"
import type { PresetRuntimeMode } from "./presets"
import type { FeatureSurface } from "./schema"

export type AstroFeaturePlacement =
  | { readonly kind: "component"; readonly registrationFile: string }
  | { readonly kind: "page"; readonly pageFile: string; readonly registrationFile: string }

export interface AstroRoutePlan {
  readonly usesContentCollections: boolean
  readonly contentCollection: string
  readonly foundationExtras: readonly string[]
  readonly seedContentPaths: readonly string[]
  readonly featurePlacements: Readonly<Record<string, AstroFeaturePlacement>>
  readonly routeSummary: readonly string[]
  readonly browserPersistence: boolean
  readonly sharedDynamicRoute?: string
  readonly sharedDynamicRouteOwnerFeatureId?: string
}

type SurfaceFeature = { readonly surface: FeatureSurface }

function hasSurface(features: readonly SurfaceFeature[], surface: FeatureSurface): boolean {
  return features.some(feature => feature.surface === surface)
}

// The collection is named after the declared content data, never guessed from feature prose.
function contentCollectionName(blueprint: NormalizedBlueprint): string {
  const source = blueprint.domainData.find(item => item.sensitivity === "public" || item.sensitivity === "internal") ?? blueprint.domainData[0]
  const name = source?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return name || "entries"
}

function wantsDetailRoutes(blueprint: NormalizedBlueprint): boolean {
  return blueprint.domainData.length > 0 || hasSurface(blueprint.features, "item-page")
}

export function astroUsesContentCollections(
  blueprint: NormalizedBlueprint,
  runtimeMode: PresetRuntimeMode,
): boolean {
  if (runtimeMode !== "static") return false
  if (blueprint.domainData.some(item => item.sensitivity === "public" || item.sensitivity === "internal")) return true
  return wantsDetailRoutes(blueprint)
}

export function astroBrowserPersistence(
  blueprint: NormalizedBlueprint,
  runtimeMode: PresetRuntimeMode,
): boolean {
  return runtimeMode === "static"
    && blueprint.platformNeeds.includes("local-storage")
    && !astroUsesContentCollections(blueprint, runtimeMode)
}

export function astroFeaturePlacement(
  feature: GraphFeature,
  collection: string,
): AstroFeaturePlacement {
  switch (feature.surface) {
    case "not-found-page":
      return { kind: "page", pageFile: "src/pages/404.astro", registrationFile: "src/pages/404.astro" }
    case "about-page":
      return { kind: "page", pageFile: "src/pages/about.astro", registrationFile: "src/pages/about.astro" }
    case "item-page": {
      const pageFile = `src/pages/${collection}/[slug].astro`
      return { kind: "page", pageFile, registrationFile: pageFile }
    }
    case "main":
      return { kind: "component", registrationFile: "src/pages/index.astro" }
  }
}

export function planAstroWeb(
  blueprint: NormalizedBlueprint,
  features: readonly GraphFeature[],
  runtimeMode: PresetRuntimeMode,
): AstroRoutePlan {
  const browserPersistence = astroBrowserPersistence(blueprint, runtimeMode)
  const usesContentCollections = astroUsesContentCollections(blueprint, runtimeMode)
  const contentCollection = contentCollectionName(blueprint)
  const featurePlacements: Record<string, AstroFeaturePlacement> = {}
  let dynamicRouteFile: string | undefined
  let dynamicRouteOwnerFeatureId: string | undefined
  let aboutRouteAssigned = false
  let notFoundRouteAssigned = false

  for (const feature of features) {
    const tentative = astroFeaturePlacement(feature, contentCollection)
    if (tentative.kind === "page" && tentative.pageFile.includes("[slug]")) {
      if (!dynamicRouteFile) {
        dynamicRouteFile = tentative.pageFile
        dynamicRouteOwnerFeatureId = feature.id
        featurePlacements[feature.id] = tentative
      } else {
        featurePlacements[feature.id] = { kind: "component", registrationFile: dynamicRouteFile }
      }
      continue
    }
    if (tentative.kind === "page" && tentative.pageFile === "src/pages/about.astro") {
      if (!aboutRouteAssigned) {
        aboutRouteAssigned = true
        featurePlacements[feature.id] = tentative
      } else {
        featurePlacements[feature.id] = { kind: "component", registrationFile: "src/pages/about.astro" }
      }
      continue
    }
    if (tentative.kind === "page" && tentative.pageFile === "src/pages/404.astro") {
      if (!notFoundRouteAssigned) {
        notFoundRouteAssigned = true
        featurePlacements[feature.id] = tentative
      } else {
        featurePlacements[feature.id] = { kind: "component", registrationFile: "src/pages/404.astro" }
      }
      continue
    }
    featurePlacements[feature.id] = tentative
  }

  const foundationExtras: string[] = []
  const seedContentPaths: string[] = []
  const routeSummary: string[] = ["/ — src/pages/index.astro"]

  if (usesContentCollections) {
    foundationExtras.push("src/content/config.ts", `src/content/${contentCollection}/`)
    seedContentPaths.push(`src/content/${contentCollection}/_seed.example.md`)
    if (dynamicRouteFile) routeSummary.push(`/${contentCollection}/[slug] — ${dynamicRouteFile} (build-time content collection)`)
  }
  for (const placement of Object.values(featurePlacements)) {
    if (placement.kind === "page" && !routeSummary.some(line => line.includes(placement.pageFile))) {
      routeSummary.push(`${placement.pageFile.replace("src/pages", "").replace(/\.astro$/, "").replace("/index", "/") || "/"} — ${placement.pageFile}`)
    }
  }

  return {
    usesContentCollections,
    contentCollection,
    foundationExtras: unique(foundationExtras),
    seedContentPaths,
    featurePlacements,
    routeSummary: unique(routeSummary),
    browserPersistence,
    sharedDynamicRoute: dynamicRouteFile,
    sharedDynamicRouteOwnerFeatureId: dynamicRouteOwnerFeatureId,
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

export const ASTRO_FOUNDATION_SCRIPT_REQUIREMENTS = [
  "check — astro check",
  "test — vitest run",
  "test:a11y — vitest run tests/accessibility.test.ts",
  "build — astro build",
  "audit:performance — run the locked production performance budget check against dist/",
] as const

export const ASTRO_CONTENT_COLLECTION_PERSISTENCE = {
  enabledDecision: "Persistence: enabled through Astro content collections compiled at build time; public catalog data lives in src/content/ as typed markdown or MDX with no browser IndexedDB for core content.",
  disabledDecision: "Persistence: disabled. No application data is retained between visits; static assets use ordinary HTTP caching only.",
  settingsPlacement: "Build-time content schema in src/content/config.ts; optional visitor preferences use minimal client islands only when semantics require them.",
  recordsPlacement: "Public records are markdown or MDX files under src/content/{collection}/; pages load them with getCollection() or getEntry() at build time.",
  temporaryPlacement: "Keep draft or preview values in memory inside client islands; do not mirror build-time catalog data into IndexedDB.",
} as const

export const ASTRO_DESIGN_TOKENS = [
  "Color: dark-first palette with --bg: #0B0F14 (Void Black), --surface, --text, --muted, --accent, and --border CSS custom properties in src/styles/global.css.",
  "Typography: fluid heading scale, 16px base body, 1.5 line-height, and system-ui stack with one optional display face documented in global.css.",
  "Spacing: 4px base grid (--space-1 through --space-8) for layout rhythm and component padding.",
  "Focus: visible :focus-visible rings on every interactive control; never remove outline without a replacement.",
  "Motion: honor prefers-reduced-motion; keep transitions under 200ms for UI state changes.",
] as const
