# ArchMind Security Test Matrix

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

Date: 2026-07-16

## Scope


## Test matrix

| Area | Test / review | Status | Evidence | Remaining work |
|---|---|---:|---|---|
| Web lint | Next lint | Verified | `npm.cmd run lint` passed before this report. | Keep in CI. |
| API unit/integration tests | Default API test suite | Verified | `npm.cmd test` passed after increasing API Vitest timeout for slow Windows/Docker runs: 43 passed, 5 skipped. | Remove skips only when matching services are intentionally available. |
| PostgreSQL platform persistence | Targeted PostgreSQL platform integration tests | Blocked | Prior run passed 5/5. Current rerun failed with `ECONNREFUSED` because local Docker/PostgreSQL is not running and Docker daemon is unavailable. | Start Docker/PostgreSQL and rerun as a required release gate. |
| Production web build | Next production build | Verified | `npm.cmd run build -w @archmind/web` and root `npm.cmd run build` completed successfully and generated 13 static pages. | Keep in CI and rerun before release. |
| OAuth callback token handling | Tokens must not be placed in URLs | Verified | Added one-time `/api/auth/handoff/exchange` flow. Regression test verifies callback URL has no `accessToken`/`refreshToken`, exchange succeeds once, and replay is rejected. | Continue toward HttpOnly-cookie session hardening. |
| OAuth state/CSRF | OAuth state must be nonce-validated | Not implemented | Callback accepts return state without server-side nonce validation evidence. | Add nonce storage/validation and tests. |
| Secrets in repo | Filename-only sensitive-term scan | Implemented but unverified | A filename-only scan found expected config/source locations; no secret values were printed into this report. | Run a proper secret scanner with redacted output before release. |
| Dependency/supply chain | Lockfile and package scripts reviewed | Implemented but unverified | Dependency review report created. | Run `npm audit`/license scan in a controlled network-enabled environment. |

## Release blockers

- OAuth nonce/state validation remains a public-release blocker.
- PostgreSQL rerun is currently blocked by local Docker/PostgreSQL availability.
- Public `.com`, code signing, production DNS/OAuth callbacks, storage, and secrets remain external deployment blockers.
