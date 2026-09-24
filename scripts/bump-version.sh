#!/usr/bin/env bash
# Set the app version everywhere it is recorded, then print the diff. Doesn't commit or tag.
# Usage: scripts/bump-version.sh X.Y.Z
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

new="${1:-}"
if [[ ! "$new" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/bump-version.sh X.Y.Z" >&2
  exit 2
fi
old="$(node -p 'require("./package.json").version')"
if [[ "$new" == "$old" ]]; then
  echo "Version is already ${old}." >&2
  exit 1
fi

npm version "$new" --no-git-tag-version >/dev/null

OLD="$old" NEW="$new" node - <<'EOF'
const fs = require("fs")
const { OLD, NEW } = process.env
const edit = (path, pattern, replacement) => {
  const before = fs.readFileSync(path, "utf8")
  const after = before.replace(pattern, replacement)
  if (after === before) throw new Error(`No ${OLD} version found in ${path}`)
  fs.writeFileSync(path, after)
}
const escaped = OLD.replace(/\./g, "\\.")
edit("src-tauri/tauri.conf.json", `"version": "${OLD}"`, `"version": "${NEW}"`)
edit("src-tauri/Cargo.toml", new RegExp(`^version = "${escaped}"$`, "m"), `version = "${NEW}"`)
edit("README.md", new RegExp(`^.*NODAYSIDLE-Cascade-V3-${escaped}.*$`, "gm"), line => line.replaceAll(OLD, NEW))
EOF

cargo update --manifest-path src-tauri/Cargo.toml -p nodaysidle-cascade-v3 --offline

git --no-pager diff --stat
echo "Version ${old} -> ${new}. Review the diff, then commit and tag when ready."
