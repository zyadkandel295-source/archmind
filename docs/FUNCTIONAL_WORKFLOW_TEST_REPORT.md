# ArchMind Functional Workflow Test Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Verified checks

| Workflow | Status | Evidence |
|---|---:|---|
| Root typecheck | Verified | `npm.cmd run typecheck` passed for shared, API, web, and desktop. |
| Root build | Verified | `npm.cmd run build` passed for shared, API, web, and desktop. |
| Root lint | Verified | `npm.cmd run lint` passed. |
| Default API tests | Verified | `npm.cmd test` passed after increasing timeout for slow Windows/Docker tests: 43 passed, 5 skipped. |
| PostgreSQL platform integration | Blocked | Prior targeted PostgreSQL run passed 5/5. Current rerun failed with `ECONNREFUSED` because local Docker/PostgreSQL is not running and Docker daemon is unavailable. |

## Desktop assistant workflow

Status: Implemented but unverified

The desired desktop behavior is:

1. install assistant-specific Windows app;
2. start as a small draggable always-on-top bubble;
3. show assistant icon/name;
4. open the correct assistant chat when clicked;
5. persist position/profile/session separately per assistant;
6. allow different assistants to run simultaneously;
7. prevent duplicate instances of the same assistant.

Prior evidence showed two assistant-specific apps installed and launched with separate identities and credentials. The latest runtime still needs a fresh install and visual proof with two actual bubbles.

## Invoice vertical slice

Status: Not implemented

The following complete workflow is not yet verified in this report:

- new invoice enters approved local folder;
- fields are extracted;
- proposed CSV/spreadsheet row is previewed;
- approval is requested;
- approved action writes row and moves invoice to processed folder;
- denied approval prevents modification;
- duplicate file events do not duplicate rows;
- revoked device cannot continue;
- safe undo does not overwrite newer user changes;
- audit record survives API restart;
- user/assistant isolation is enforced.

## Current functional blockers

- Latest desktop runtime must be rebuilt and used for fresh installers.
- Desktop-to-web real persisted chat must be proven for two assistants.
- Uninstall isolation must be proven by uninstalling one assistant and verifying the other remains intact.
- Current PostgreSQL rerun is blocked until local Docker/PostgreSQL is running again.
