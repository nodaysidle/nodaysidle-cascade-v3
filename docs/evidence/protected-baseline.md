# Protected-path baseline

Captured read-only at `2026-08-29T18:05:42Z` before V3 implementation.

## Installed applications

Aggregate hashes cover every regular file in each bundle. Per-file SHA-256 lines are sorted with `LC_ALL=C`, then SHA-256 hashed again.

| Path | Bundle ID | Version / build | Executable | Aggregate SHA-256 |
| --- | --- | --- | --- | --- |
| `/Applications/NODAYSIDLE.app` | `com.nodaysidle.browser` | `0.1.0` / `1` | `nodaysidle` | `45bd366257c76508eccfc4fe3af24a25ed077dd93101972d4b3cd40fba59b6ce` |
| `/Applications/NODAYSIDLE ARCHITECH V2.app` | `com.omarchyuser.prdcompiler.v2lab` | `0.6.0` / `0.6.0` | `app` | `f809840bd35950ff97d991c941c02353fe2042aaa5ca29d844ca84dcf0e31c67` |
| `/Applications/NODAYSIDLE Cascade.app` | `com.nodaysidle.cascade` | `1.0.0` / `1.0.0` | `nodaysidle-cascade` | `5b815001e34d69170ed58495313656760075a133fd8a689ecfc1c80f03422b8a` |

All three bundles were ad-hoc signed ARM64 applications. `/Applications/NODAYSIDLE Cascade V3.app` was absent.

## Protected source paths

### `/Volumes/omarchyuser/COMPILER/prd-compiler-v2-lab`

- Git HEAD: `ff76e807077c2a5d2fa5d235bc37fed085cab386`
- Full `git status --porcelain=v1 -uall` SHA-256: `ce4b227f9b72e9db9dcc63fcbf2918d2d3d312a83c39008d38646f368504256f`
- Full tracked `git diff --binary HEAD` SHA-256: `56b1c98e385c5a0932f1db474d5bbfbf0c55357deedc4da08f13977fb3fedc36`
- Source/config aggregate SHA-256: `2f183876e427fef3cd964d6167c6820db07a7f41516c869ccc72358e034b957f`
- Aggregate exclusions: `.git`, `node_modules`, `dist`, `generated`, `src-tauri/target`, and `src-tauri/target-v2-lab`.

The checkout was already heavily modified and untracked. Its existing state is user-owned.

### `/Volumes/omarchyuser/nodaysidle-voice-v3`

- Regular files: `5`
- Full aggregate SHA-256: `77ffabe1c03101f89d63152c204dc7677fde3de53930930ee622811231272794`
- Git metadata: absent.

## Final comparison rule

Recompute the same values after the V3 installation. Every protected value above must remain byte-identical.

## Final comparison

Recomputed after installation on `2026-08-29` using the original commands:

| Protected evidence | Baseline | Final | Result |
| --- | --- | --- | --- |
| `/Applications/NODAYSIDLE.app` aggregate | `45bd366257c76508eccfc4fe3af24a25ed077dd93101972d4b3cd40fba59b6ce` | same | PASS |
| `/Applications/NODAYSIDLE ARCHITECH V2.app` aggregate | `f809840bd35950ff97d991c941c02353fe2042aaa5ca29d844ca84dcf0e31c67` | same | PASS |
| `/Applications/NODAYSIDLE Cascade.app` aggregate | `5b815001e34d69170ed58495313656760075a133fd8a689ecfc1c80f03422b8a` | same | PASS |
| V2 Git HEAD | `ff76e807077c2a5d2fa5d235bc37fed085cab386` | same | PASS |
| V2 full status hash | `ce4b227f9b72e9db9dcc63fcbf2918d2d3d312a83c39008d38646f368504256f` | same | PASS |
| V2 tracked-diff hash | `56b1c98e385c5a0932f1db474d5bbfbf0c55357deedc4da08f13977fb3fedc36` | same | PASS |
| V2 source/config aggregate | `2f183876e427fef3cd964d6167c6820db07a7f41516c869ccc72358e034b957f` | `409ad75410fc4b1ed3782199c72194f2df3ca0bb954db406be52544a64752ca7` | MISMATCH |
| `/Volumes/omarchyuser/nodaysidle-voice-v3` aggregate | `77ffabe1c03101f89d63152c204dc7677fde3de53930930ee622811231272794` | same | PASS |

The only included V2 file newer than the baseline is ignored Finder metadata at `.DS_Store` (`8196` bytes, final SHA-256 `c2a95cd3d533b9e5c382fe0d5641b889ff352486e2a4d1500e70dedad9022cb9`). No V2 tracked or status-visible state changed. The protected-file instruction forbids rewriting it, so this strict aggregate mismatch remains an explicit completion limitation.
