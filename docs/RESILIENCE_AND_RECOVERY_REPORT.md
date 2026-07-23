# ArchMind Resilience and Recovery Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Implemented resilience controls

| Control | Status | Notes |
|---|---:|---|
| Local service readiness | Implemented but unverified | Dev launcher now attempts to start required local PostgreSQL/Redis Docker services and waits for ports. |
| Runtime build atomicity | Implemented but unverified | Runtime templates are built in a temp directory and published only after validation. |
| Partial artifact rejection | Implemented but unverified | Runtime consumers validate manifest and artifact metadata before use. |
| Desktop destroyed-window guard | Implemented but unverified | Desktop main process guards against applying mode changes to destroyed windows. |
| PostgreSQL platform tests | Blocked | Prior targeted integration tests passed 5/5. Current rerun failed because the local PostgreSQL service is not listening and Docker daemon is unavailable. |

## Recovery scenarios still required

| Scenario | Status | Required proof |
|---|---:|---|
| API restart preserves audit/conversation/device records | Implemented but unverified | Create records, restart API, retrieve same data. |
| Redis unavailable | Implemented but unverified | Worker should idle or degrade safely in local dev, and fail clearly in production. |
| PostgreSQL unavailable | Implemented but unverified | API should return clear 503s without corrupting state. |
| Runtime build interruption | Implemented but unverified | Interrupted temp output must not become downloadable. |
| Revoked desktop session | Implemented but unverified | Confirmed revocation blocks actions and shows revoked; network failure shows Offline. |
| Uninstall one assistant | Not implemented | Verify other assistant install, data, credentials, and chat remain intact. |

## Public-release blockers

- Final latest-runtime build and assistant reinstall proof are still missing.
- Uninstall isolation is not verified.
- Current PostgreSQL rerun is blocked until local Docker/PostgreSQL is running again.
