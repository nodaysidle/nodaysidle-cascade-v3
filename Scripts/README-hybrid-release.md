# Hybrid release flow

Local Mac builds the DMG; CI only creates the GitHub Release with generated notes when a version tag is pushed.

1. **Build the DMG locally** on the Mac (existing packaging scripts).
2. **Tag and push** a version tag (`v*`), e.g. `git tag v3.1.0 && git push origin v3.1.0`.
3. **CI creates the release** (`.github/workflows/release-on-tag.yml`) with generated notes — no binaries.
4. **Attach the DMG** with `Scripts/attach-release-asset.sh`:

   ```bash
   Scripts/attach-release-asset.sh v3.1.0 ./path/to/NODAYSIDLE-Cascade-V3-3.1.0-aarch64.dmg
   ```

Existing Latest release is **v3.0.1**. This automation does not republish or replace it; a new `v*` tag is required for a new release.
