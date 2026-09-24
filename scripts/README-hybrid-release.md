# Hybrid release flow

Local Mac builds the DMG; CI only creates the GitHub Release with generated notes when a version tag is pushed.

1. **Bump the version** with `scripts/bump-version.sh 3.1.0`, review the diff, and commit it.
2. **Build the DMG locally** on the Mac with `npm run tauri:build`.
3. **Tag and push** a version tag (`v*`), e.g. `git tag v3.1.0 && git push origin v3.1.0`.
4. **CI creates the release** (`.github/workflows/release-on-tag.yml`) with generated notes — no binaries.
5. **Attach the DMG** with `scripts/attach-release-asset.sh`:

   ```bash
   scripts/attach-release-asset.sh v3.1.0 ./path/to/NODAYSIDLE-Cascade-V3-3.1.0-aarch64.dmg
   ```

This automation never republishes or replaces an existing release; a new `v*` tag is required for a new release.
