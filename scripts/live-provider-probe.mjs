#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const result = spawnSync(
  "npm",
  ["test", "--", "tests/live-provider-probe.test.ts"],
  { cwd: root, stdio: "inherit", env: process.env },
)

process.exit(result.status ?? 1)
