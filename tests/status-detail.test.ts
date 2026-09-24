import { describe, expect, it } from "vitest"
import { statusDetailText } from "../src/app"
import { jevForeignStackIssue, jevUnverifiableAcceptanceIssue } from "../src/jev"
import { buildBlueprintInstructions } from "../src/schema"

describe("integrity status detail", () => {
  it("names the stack conflict only when Jev reported foreign-stack leakage", () => {
    expect(statusDetailText("blueprint-integrity-failed", [jevForeignStackIssue()])).toContain("technology-stack conflict")
  })

  it("names untestable acceptance signals instead of a stack conflict", () => {
    const perFeature = [{ path: "features[2].acceptanceSignals", rule: "jev.feature-unverifiable-acceptance", message: "x" }]
    for (const issues of [perFeature, [jevUnverifiableAcceptanceIssue()]]) {
      const detail = statusDetailText("blueprint-integrity-failed", issues)
      expect(detail).toContain("acceptance signals that automated tests cannot check")
      expect(detail).not.toContain("technology-stack")
    }
  })

  it("falls back to the generic integrity copy and leaves other statuses unchanged", () => {
    expect(statusDetailText("blueprint-integrity-failed", [])).toContain("integrity problem")
    expect(statusDetailText("gate-clean", [])).toContain("eligible for exact-five export")
  })
})

describe("provider instructions", () => {
  it("tells the provider to phrase operating-system features as checkable requests or state", () => {
    const instructions = buildBlueprintInstructions({ idea: "A reminder app." })
    expect(instructions).toContain("request the app makes or the app state a test can read")
  })
})
