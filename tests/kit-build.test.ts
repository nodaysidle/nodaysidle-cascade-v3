import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { describe, expect, it } from "vitest"
import { compilePacket } from "../src/compiler"
import { habitTrackerBlueprint, scanDrawerBlueprint } from "./fixtures/blueprints"

// Builds and tests every rendered kit with the local Swift toolchain. It runs through
// npm run kit:check, which sets CASCADE_KIT_BUILD, so the default suite stays fast.
const describeBuild = process.env.CASCADE_KIT_BUILD ? describe : describe.skip

describeBuild("starter kits compile and pass their own tests", () => {
  it.each([
    ["records, app-files, and atomic documents", scanDrawerBlueprint],
    ["records only", habitTrackerBlueprint],
  ] as const)("native macOS desktop kit with %s", async (_label, blueprint) => {
    const packet = await compilePacket(blueprint, "native-macos-swiftui-desktop")
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
