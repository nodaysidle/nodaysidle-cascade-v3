import type { GraphFeature, NormalizedBlueprint } from "./compiler"
import type { PresetRuntimeMode } from "./presets"

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

const CATALOG_PATTERN = /\b(?:project|catalog|catalogue|portfolio|guide|documentation|article|entry|listing)\b/i
const DETAIL_PATTERN = /\b(?:detail|dedicated page|direct url|permalink|versioned guides?|project page|guide page|item page)\b/i
const ABOUT_PATTERN = /\babout\b/i
const NOT_FOUND_PATTERN = /\b(?:404|not[- ]found|unknown route)\b/i

type FeatureLike = { readonly name: string; readonly behavior: string; readonly outputs?: readonly string[] }

function featureLikeText(feature: FeatureLike): string {
  return `${feature.name} ${feature.behavior} ${(feature.outputs ?? []).join(" ")}`
}

function inferContentCollection(blueprint: NormalizedBlueprint): string {
  for (const item of blueprint.domainData) {
    const subject = `${item.name} ${item.meaning}`.toLowerCase()
    if (/\bproject/.test(subject)) return "projects"
    if (/\bguide/.test(subject)) return "guides"
    if (/\barticle/.test(subject)) return "articles"
    if (/\bdocument/.test(subject)) return "docs"
  }
  for (const feature of blueprint.features) {
    const subject = `${feature.name} ${feature.behavior}`.toLowerCase()
    if (/\bguide/.test(subject)) return "guides"
    if (/\bproject/.test(subject)) return "projects"
  }
  if (/\b(?:documentation|manual|portal)\b/i.test(blueprint.productDefinition)) return "guides"
  if (/\b(?:catalog|catalogue|portfolio)\b/i.test(blueprint.productDefinition)) return "projects"
  return "entries"
}

function wantsDetailRoutes(blueprint: NormalizedBlueprint, features: readonly GraphFeature[]): boolean {
  if (blueprint.domainData.length > 0) return true
  return features.some(feature => DETAIL_PATTERN.test(featureLikeText(feature)) || CATALOG_PATTERN.test(featureLikeText(feature)))
}

function wantsDetailRoutesFromBlueprint(blueprint: NormalizedBlueprint): boolean {
  if (blueprint.domainData.length > 0) return true
  return blueprint.features.some(feature => DETAIL_PATTERN.test(featureLikeText(feature)) || CATALOG_PATTERN.test(featureLikeText(feature)))
}

function wantsAboutPage(blueprint: NormalizedBlueprint, features: readonly GraphFeature[]): boolean {
  if (features.some(feature => ABOUT_PATTERN.test(featureLikeText(feature)))) return true
  return wantsDetailRoutes(blueprint, features) && /\b(?:studio|company|maintainer|developer|portfolio)\b/i.test(blueprint.productDefinition)
}

export function astroUsesContentCollections(
  blueprint: NormalizedBlueprint,
  runtimeMode: PresetRuntimeMode,
): boolean {
  if (runtimeMode !== "static") return false
  if (blueprint.domainData.some(item => item.sensitivity === "public" || item.sensitivity === "internal")) return true
  return wantsDetailRoutesFromBlueprint(blueprint)
}

export function astroBrowserPersistence(
  blueprint: NormalizedBlueprint,
  runtimeMode: PresetRuntimeMode,
): boolean {
  return runtimeMode === "static"
    && blueprint.platformNeeds.includes("local-storage")
    && !astroUsesContentCollections(blueprint, runtimeMode)
}

function wantsDetailPageRoute(text: string): boolean {
  if (DETAIL_PATTERN.test(text)) return true
  return CATALOG_PATTERN.test(text) && /\b(?:detail page|dedicated page|direct url|permalink|project page|guide page|item page|detail route|versioned guides?)\b/i.test(text)
}

export function astroFeaturePlacement(
  feature: GraphFeature,
  collection: string,
): AstroFeaturePlacement {
  const text = featureLikeText(feature)
  if (NOT_FOUND_PATTERN.test(text)) {
    const pageFile = "src/pages/404.astro"
    return { kind: "page", pageFile, registrationFile: pageFile }
  }
  if (ABOUT_PATTERN.test(text) && /\b(?:about page|dedicated about|about route)\b/i.test(text)) {
    const pageFile = "src/pages/about.astro"
    return { kind: "page", pageFile, registrationFile: pageFile }
  }
  if (wantsDetailPageRoute(text)) {
    const pageFile = `src/pages/${collection}/[slug].astro`
    return { kind: "page", pageFile, registrationFile: pageFile }
  }
  return { kind: "component", registrationFile: "src/pages/index.astro" }
}

export function planAstroWeb(
  blueprint: NormalizedBlueprint,
  features: readonly GraphFeature[],
  runtimeMode: PresetRuntimeMode,
): AstroRoutePlan {
  const browserPersistence = astroBrowserPersistence(blueprint, runtimeMode)
  const usesContentCollections = astroUsesContentCollections(blueprint, runtimeMode)
  const contentCollection = inferContentCollection(blueprint)
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
  if (wantsAboutPage(blueprint, features) && !aboutRouteAssigned) {
    foundationExtras.push("src/pages/about.astro")
    routeSummary.push("/about — src/pages/about.astro")
  }
  if (features.some(feature => NOT_FOUND_PATTERN.test(featureLikeText(feature))) && !notFoundRouteAssigned) {
    foundationExtras.push("src/pages/404.astro")
    routeSummary.push("/404 — src/pages/404.astro")
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
  "Color: dark-first palette with --bg, --surface, --text, --muted, --accent, and --border CSS custom properties in src/styles/global.css unless product semantics require light-first.",
  "Typography: fluid heading scale, 16px base body, 1.5 line-height, and system-ui stack with one optional display face documented in global.css.",
  "Spacing: 4px base grid (--space-1 through --space-8) for layout rhythm and component padding.",
  "Focus: visible :focus-visible rings on every interactive control; never remove outline without a replacement.",
  "Motion: honor prefers-reduced-motion; keep transitions under 200ms for UI state changes.",
] as const
