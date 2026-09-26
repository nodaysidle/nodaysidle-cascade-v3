import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import type { PresetId } from "../src/presets"
import type { SemanticBlueprint } from "../src/schema"
import { forecastGlanceBlueprint, habitTrackerBlueprint, networkMonitorBlueprint, scanDrawerBlueprint } from "./fixtures/blueprints"

const menuBarWithLogin: SemanticBlueprint = {
  ...networkMonitorBlueprint,
  platformNeeds: [...networkMonitorBlueprint.platformNeeds, "launch-at-login"],
  features: networkMonitorBlueprint.features.map((feature, index) => index === 0 ? { ...feature, usesPlatformNeeds: [...feature.usesPlatformNeeds, "launch-at-login"] } : feature),
}

// Builds and tests every rendered kit with the local Swift toolchain. It runs through
// npm run kit:check, which sets CASCADE_KIT_BUILD, so the default suite stays fast.
const describeBuild = process.env.CASCADE_KIT_BUILD ? describe : describe.skip

describeBuild("starter kits compile and pass their own tests", () => {
  it.each([
    ["desktop with records, app-files, and atomic documents", scanDrawerBlueprint, "native-macos-swiftui-desktop"],
    ["desktop with records only", habitTrackerBlueprint, "native-macos-swiftui-desktop"],
    ["desktop with a keyed service in the login keychain", forecastGlanceBlueprint, "native-macos-swiftui-desktop"],
    ["menu bar with records and a login item", menuBarWithLogin, "native-macos-swiftui-menubar"],
  ] as const satisfies ReadonlyArray<readonly [string, SemanticBlueprint, PresetId]>)("native macOS kit: %s", async (_label, blueprint, presetId) => {
    const packet = await compilePacket(blueprint, presetId)
    const root = mkdtempSync(join(tmpdir(), "cascade-kit-"))
    try {
      for (const file of packet.kit) {
        const path = join(root, file.name.replace(/^kit\//, ""))
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, file.content)
      }
      const syntax = spawnSync("bash", ["-n", "Scripts/package_app.sh"], { cwd: root, encoding: "utf8" })
      expect(syntax.status, syntax.stderr).toBe(0)
      const result = spawnSync("swift", ["test"], { cwd: root, encoding: "utf8" })
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(result.stdout + result.stderr).not.toMatch(/warning:/)
      // The packet requires a warning-free release build, so the kit must meet it too.
      const release = spawnSync("swift", ["build", "-c", "release", "-Xswiftc", "-warnings-as-errors"], { cwd: root, encoding: "utf8" })
      expect(release.status, `${release.stdout}\n${release.stderr}`).toBe(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 600_000)
})
