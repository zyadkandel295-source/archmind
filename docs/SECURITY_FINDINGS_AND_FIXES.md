# ArchMind Security Findings and Fixes

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Fixed or mitigated in this pass

### Local PostgreSQL/Redis startup reliability

Status: Implemented but unverified

The local development launcher was updated to detect when PostgreSQL or Redis are required by `.env` and start the matching Docker Compose services when their ports are closed. This reduces false installer/build failures caused by the API returning `ECONNREFUSED` for platform-store routes.

Evidence:

- `scripts/dev-stack.cjs` now checks configured local service URLs and waits for required ports.
- The prior observed failure was repeated platform-store `ECONNREFUSED` for `/api/platform/desktop/builds` and `/api/platform/devices`.

Remaining verification:

- Re-run `npm run dev` from a cold machine state and verify API, web, PostgreSQL, Redis, and worker readiness.

### Slow Windows/PostgreSQL test timeout

Status: Verified

The API Vitest timeout was increased from 15 seconds to 60 seconds to avoid false failures during slow Windows/Docker integration runs.

Evidence:

- Before the change, PDF/DOCX extraction, platform install-intent, and PostgreSQL integration tests exceeded the old 15-second limit.
- After the change, `npm.cmd test` passed: 42 passed, 5 skipped.
- PostgreSQL integration tests passed separately: 5/5.

### Desktop runtime partial-artifact guard

Status: Implemented but unverified

The desktop runtime build path was hardened so runtime publication is atomic:

- build into a temporary directory;
- hold a runtime-version lock;
- validate installer size, `MZ` header, SHA-256, and `app.asar`;
- publish immutable release metadata only after validation;
- prevent assistant builders from consuming invalid or currently-building runtime templates.

Remaining verification:

- Re-run the final runtime build after local command execution recovers.
- Add a regression test for a tiny partial installer.

## Open high-priority findings

### OAuth tokens were exposed in redirect URLs

Status: Verified

The Google OAuth callback previously redirected to the web login route with access and refresh tokens in URL query parameters. Tokens in URLs can leak through browser history, logs, crash reports, referrers, screenshots, extensions, and support captures.

Fix applied:

- Replaced query-token redirects with a server-side one-time handoff code.
- Added `/api/auth/handoff/exchange` to exchange the short-lived code for the existing web session payload.
- Added regression coverage proving callback URLs do not contain token material and the handoff cannot be reused.

Remaining hardening:

- Move browser session credentials toward secure HttpOnly same-site cookies or a documented equivalent.
- Add server-side OAuth state nonce validation.

### OAuth state is not proven nonce-bound

Status: Not implemented

The OAuth callback accepts a return path in `state`, but there is no verified server-side nonce/CSRF validation in the current evidence. This can weaken login CSRF protection.

Required fix:

- Generate and store a nonce before redirecting to Google.
- Bind the nonce to the callback with SameSite/HttpOnly cookie or server-side pending-login storage.
- Validate and consume it once.
- Add success, missing-state, replay, and wrong-state tests.

### Production web build was not verified

Status: Verified

The root production build previously reached the web build and then the Next build worker exited with Windows code `3221226505`. A targeted rerun of the web production build now succeeds.

Evidence:

- `npm.cmd run build -w @archmind/web` completed successfully.
- Next generated 13 static pages and completed build tracing.

## External blockers

Status: Blocked

The following cannot be fully verified locally without production credentials or services:

- public `.com` DNS and TLS;
- production OAuth redirect callbacks;
- production secrets and secret rotation;
- code-signing certificate and timestamp service;
- production object storage/CDN;
- real email/SMS provider limits, if enabled.
