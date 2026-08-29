# ArchMind Dependency and Supply Chain Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Current controls

| Control | Status | Evidence |
|---|---:|---|
| Lockfile-based Node install | Implemented but unverified | Repository uses npm workspaces and package-lock. |
| Typecheck across workspaces | Verified | Root typecheck passed. |
| Lint | Verified | Root lint passed. |
| Runtime metadata pinning | Implemented but unverified | Assistant build metadata includes runtime-template version/digest. |
| Partial artifact quarantine | Implemented but unverified | Runtime builder quarantines invalid tiny artifacts. |

## Required before public release

| Item | Status | Notes |
|---|---:|---|
| Dependency vulnerability scan | Not implemented | Run `npm audit` or approved scanner in a network-enabled environment. |
| Reproducible build notes | Not implemented | Record Node/npm/electron-builder versions and build host requirements. |
| Code-signing trust chain | Blocked | Requires real Windows code-signing certificate and timestamp service. |
| Secret scanning | Implemented but unverified | Only a filename-only sensitive-term scan has been done; run a proper scanner before release. |

## Supply-chain risks

- Assistant-specific packages must never reuse stale runtime templates when source changes.
- Public downloads must be protected by authorization checks and digest validation.
