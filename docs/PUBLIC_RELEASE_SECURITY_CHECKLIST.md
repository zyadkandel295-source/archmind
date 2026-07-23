# ArchMind Public Release Security Checklist

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

| Gate | Status | Evidence / blocker |
|---|---:|---|
| Root typecheck passes | Verified | `npm.cmd run typecheck` passed. |
| Root build passes | Verified | `npm.cmd run build` passed for shared, API, web, and desktop. |
| Root lint passes | Verified | `npm.cmd run lint` passed. |
| Default API tests pass | Verified | `npm.cmd test` passed after timeout hardening: 43 passed, 5 skipped. |
| PostgreSQL integration tests pass | Blocked | Prior targeted PostgreSQL platform tests passed 5/5. Current rerun is blocked by unavailable local Docker/PostgreSQL. |
| Production web build passes | Verified | `npm.cmd run build -w @archmind/web` completed successfully. |
| Runtime build publication is atomic | Implemented but unverified | Builder validates and publishes through immutable release metadata. |
| Partial runtime artifact cannot be consumed | Implemented but unverified | Runtime consumers validate current runtime manifest/artifacts. Needs regression test. |
| Latest desktop runtime includes bubble/direct-chat fixes | Implemented but unverified | Runtime version metadata was updated; reinstall verification still required. |
| Two real desktop bubbles shown simultaneously | Not implemented | Need screenshot and diagnostics after fresh latest-runtime install. |
| Desktop opens directly to assistant chat | Implemented but unverified | Desktop was changed to prefer bundled chat view. Must re-test latest installer. |
| Desktop and web share persisted conversations | Not implemented | Need two-way desktop/web message proof in PostgreSQL. |
| Per-assistant isolation | Implemented but unverified | Prior evidence exists, but latest runtime must be verified for two assistants. |
| Uninstalling one assistant preserves another | Not implemented | Needs controlled uninstall/reinstall proof. |
| OAuth tokens are not exposed in URLs | Verified | Google OAuth callback uses a one-time handoff code; regression test verifies no `accessToken`/`refreshToken` in the redirect and replay is rejected. |
| OAuth state/CSRF protection | Not implemented | Server-side nonce validation is not verified. |
| Installer downloads require authorization | Implemented but unverified | Add explicit authorized/unauthorized tests. |
| Secrets are not committed | Implemented but unverified | Filename-only scan done; run a real secret scanner before release. |
| Code signing | Blocked | Requires production signing certificate/timestamp service. |
| Public `.com` deployment | Blocked | Requires DNS/TLS/OAuth callback/storage/secrets configuration. |

## Release decision

Status: Not implemented

ArchMind must not be described as production-ready yet. The current release blockers are OAuth state validation, current PostgreSQL rerun blocked by local service availability, latest desktop runtime verification, two-bubble proof, desktop/web chat persistence proof, and uninstall isolation proof.
