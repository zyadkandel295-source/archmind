# ArchMind Functional Workflow Test Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Verified checks

| Workflow | Status | Evidence |
|---|---:|---|
| Root lint | Verified | `npm.cmd run lint` passed. |
| Default API tests | Verified | `npm.cmd test` passed after increasing timeout for slow Windows/Docker tests: 43 passed, 5 skipped. |
| PostgreSQL platform integration | Blocked | Prior targeted PostgreSQL run passed 5/5. Current rerun failed with `ECONNREFUSED` because local Docker/PostgreSQL is not running and Docker daemon is unavailable. |


Status: Implemented but unverified


1. install assistant-specific Windows app;
3. show assistant icon/name;
4. open the correct assistant chat when clicked;
5. persist position/profile/session separately per assistant;
6. allow different assistants to run simultaneously;
7. prevent duplicate instances of the same assistant.


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

- Current PostgreSQL rerun is blocked until local Docker/PostgreSQL is running again.
