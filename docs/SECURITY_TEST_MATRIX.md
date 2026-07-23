# ArchMind Security Test Matrix

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

Date: 2026-07-16

## Scope

This matrix covers the current ArchMind web, API, PostgreSQL platform store, desktop installer/runtime, assistant isolation, and local-development release path. It is intentionally evidence-based and does not mark the public release as production-ready.

## Test matrix

| Area | Test / review | Status | Evidence | Remaining work |
|---|---|---:|---|---|
| TypeScript safety | Root typecheck for shared, API, web, and desktop workspaces | Verified | `npm.cmd run typecheck` passed before this report. | Keep in CI. |
| Production build | Shared, API, web, and desktop build | Verified | `npm.cmd run build` passed for all four workspaces. | Keep in CI and rerun from a clean checkout before release. |
| Web lint | Next lint | Verified | `npm.cmd run lint` passed before this report. | Keep in CI. |
| API unit/integration tests | Default API test suite | Verified | `npm.cmd test` passed after increasing API Vitest timeout for slow Windows/Docker runs: 43 passed, 5 skipped. | Remove skips only when matching services are intentionally available. |
| PostgreSQL platform persistence | Targeted PostgreSQL platform integration tests | Blocked | Prior run passed 5/5. Current rerun failed with `ECONNREFUSED` because local Docker/PostgreSQL is not running and Docker daemon is unavailable. | Start Docker/PostgreSQL and rerun as a required release gate. |
| Production web build | Next production build | Verified | `npm.cmd run build -w @archmind/web` and root `npm.cmd run build` completed successfully and generated 13 static pages. | Keep in CI and rerun before release. |
| Desktop base runtime atomic build | Runtime artifact validation | Implemented but unverified | Atomic runtime builder validates minimum size, `MZ` header, SHA-256, `app.asar`, and publishes through `current.json`. | Re-run after command execution recovers and verify current artifact. |
| Partial installer protection | Reject partial runtime templates | Implemented but unverified | Runtime registration and assistant builder now validate current runtime metadata before use. | Add regression test that a tiny/partial artifact is rejected. |
| Desktop direct chat | Installed app opens desktop chat instead of external Google login | Implemented but unverified | Desktop runtime was changed to prefer the bundled desktop chat view. | Reinstall latest assistant installer and verify no Google sign-in prompt appears. |
| Assistant isolation | Different assistants use separate identities, profiles, user-data, credentials | Implemented but unverified | Prior manual evidence showed two assistant-specific installers installed with separate executable names, process paths, sessions, data folders, and encrypted credential files. | Reverify with latest runtime and screenshots of two bubbles. |
| Duplicate instance control | Same assistant focuses existing instance, different assistants run together | Implemented but unverified | Desktop code has assistant-scoped identity behavior. | Add automated or manual Windows verification evidence. |
| OAuth callback token handling | Tokens must not be placed in URLs | Verified | Added one-time `/api/auth/handoff/exchange` flow. Regression test verifies callback URL has no `accessToken`/`refreshToken`, exchange succeeds once, and replay is rejected. | Continue toward HttpOnly-cookie session hardening. |
| OAuth state/CSRF | OAuth state must be nonce-validated | Not implemented | Callback accepts return state without server-side nonce validation evidence. | Add nonce storage/validation and tests. |
| Secrets in repo | Filename-only sensitive-term scan | Implemented but unverified | A filename-only scan found expected config/source locations; no secret values were printed into this report. | Run a proper secret scanner with redacted output before release. |
| Authenticated installer download | Authorized vs unauthorized installer access | Implemented but unverified | Download endpoints exist and are protected in the app flow. | Add explicit automated authorized/unauthorized download tests. |
| Revoked session behavior | Desktop must show revoked only for confirmed revocation | Implemented but unverified | Current desktop has session/revocation handling. | Verify latest package against live API and offline failure modes. |
| Dependency/supply chain | Lockfile and package scripts reviewed | Implemented but unverified | Dependency review report created. | Run `npm audit`/license scan in a controlled network-enabled environment. |

## Release blockers

- OAuth nonce/state validation remains a public-release blocker.
- PostgreSQL rerun is currently blocked by local Docker/PostgreSQL availability.
- Latest desktop runtime and two-bubble Windows proof are not yet verified after the final patches.
- Public `.com`, code signing, production DNS/OAuth callbacks, storage, and secrets remain external deployment blockers.
