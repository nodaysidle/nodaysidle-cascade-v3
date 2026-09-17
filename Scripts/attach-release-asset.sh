#!/usr/bin/env bash
# Attach a locally built DMG/APK/zip to an existing GitHub Release for this tag.
# Usage: Scripts/attach-release-asset.sh v3.1.0 ./path/to/NODAYSIDLE-Cascade-V3-3.1.0-aarch64.dmg
set -euo pipefail

TAG="${1:-}"
ASSET="${2:-}"
REPO="${REPO:-nodaysidle/nodaysidle-cascade-v3}"

if [[ -z "$TAG" || -z "$ASSET" ]]; then
  echo "Usage: $0 <tag> <asset-path>" >&2
  exit 1
fi
if [[ ! -f "$ASSET" ]]; then
  echo "Asset not found: $ASSET" >&2
  exit 1
fi

if ! gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "Release $TAG not found on $REPO. Push the tag first so CI can create the release, or:" >&2
  echo "  gh release create \"$TAG\" --repo \"$REPO\" --generate-notes --title \"Cascade $TAG\"" >&2
  exit 1
fi

gh release upload "$TAG" "$ASSET" --repo "$REPO" --clobber
echo "Attached $(basename "$ASSET") → $TAG on $REPO"
