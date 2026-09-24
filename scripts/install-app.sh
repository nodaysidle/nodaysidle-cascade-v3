#!/usr/bin/env bash
# Build the app, replace the copy in /Applications, and verify it.
# Usage: scripts/install-app.sh [--clean]
#   --clean  remove dist/, src-tauri/gen/, and the Cargo target directory after a successful install.
# This deletes the installed app before copying the new one; run it only when an install is wanted.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

clean=false
for arg in "$@"; do
  case "$arg" in
    --clean) clean=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/nodaysidle-cascade-v3-target}"

app_name="$(node -p 'require("./src-tauri/tauri.conf.json").productName')"
bundle_id="$(node -p 'require("./src-tauri/tauri.conf.json").identifier')"
version="$(node -p 'require("./package.json").version')"
installed="/Applications/${app_name}.app"

if pgrep -f "${installed}/Contents/MacOS/" >/dev/null; then
  echo "Quitting running ${app_name}"
  osascript -e "tell application id \"${bundle_id}\" to quit" >/dev/null 2>&1 || true
  for _ in $(seq 1 20); do
    pgrep -f "${installed}/Contents/MacOS/" >/dev/null || break
    sleep 0.5
  done
  if pgrep -f "${installed}/Contents/MacOS/" >/dev/null; then
    echo "${app_name} is still running; quit it and retry." >&2
    exit 1
  fi
fi

npm run tauri -- build --bundles app

target_dir="$(cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).target_directory))')"
built="${target_dir}/release/bundle/macos/${app_name}.app"
if [[ ! -d "$built" ]]; then
  echo "Built bundle not found at ${built}" >&2
  exit 1
fi
codesign --verify --deep --strict "$built"

rm -rf "$installed"
ditto "$built" "$installed"
codesign --verify --deep --strict "$installed"

installed_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "${installed}/Contents/Info.plist")"
executable="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "${installed}/Contents/Info.plist")"
echo "Installed ${installed}"
echo "Version: ${installed_version} (package.json ${version})"
echo "Binary: $(stat -f '%Sm' "${installed}/Contents/MacOS/${executable}")"
if [[ "$installed_version" != "$version" ]]; then
  echo "Installed version does not match package.json." >&2
  exit 1
fi

if $clean; then
  rm -rf "${root}/dist" "${root}/src-tauri/gen"
  case "$target_dir" in
    /tmp/nodaysidle-cascade-v3-target|/private/tmp/nodaysidle-cascade-v3-target|"${root}/src-tauri/target")
      rm -rf "$target_dir"
      echo "Removed dist/ and ${target_dir}" ;;
    *) echo "Removed dist/; kept custom CARGO_TARGET_DIR ${target_dir}" ;;
  esac
fi
