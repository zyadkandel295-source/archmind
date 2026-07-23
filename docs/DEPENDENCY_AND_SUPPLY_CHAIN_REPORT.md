# ArchMind Dependency and Supply Chain Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Current controls

| Control | Status | Evidence |
|---|---:|---|
| Lockfile-based Node install | Implemented but unverified | Repository uses npm workspaces and package-lock. |
| Typecheck across workspaces | Verified | Root typecheck passed. |
| Lint | Verified | Root lint passed. |
| Desktop artifact hash | Implemented but unverified | Runtime builder records SHA-256 for runtime artifact and `app.asar`. |
| Runtime metadata pinning | Implemented but unverified | Assistant build metadata includes runtime-template version/digest. |
| Partial artifact quarantine | Implemented but unverified | Runtime builder quarantines invalid tiny artifacts. |

## Required before public release

| Item | Status | Notes |
|---|---:|---|
| Dependency vulnerability scan | Not implemented | Run `npm audit` or approved scanner in a network-enabled environment. |
| License review | Not implemented | Produce allowed/denied license list for runtime, web, API, and installer packages. |
| Reproducible build notes | Not implemented | Record Node/npm/electron-builder versions and build host requirements. |
| Code-signing trust chain | Blocked | Requires real Windows code-signing certificate and timestamp service. |
| Artifact provenance | Implemented but unverified | Need CI metadata tying installer to source commit/tree and runtime digest. |
| Secret scanning | Implemented but unverified | Only a filename-only sensitive-term scan has been done; run a proper scanner before release. |

## Supply-chain risks

- Electron/NSIS installers are large binary artifacts and must be hash-verified before download/install.
- Assistant-specific packages must never reuse stale runtime templates when source changes.
- Public downloads must be protected by authorization checks and digest validation.
