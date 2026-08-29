# Security Threat Model

Last reviewed: 2026-07-12. This is an engineering threat model, not a compliance certification.

2026-07-16 delta: the Google OAuth callback no longer redirects access or refresh tokens in URL query parameters. It now redirects with a short-lived, single-use web-auth handoff code, and a regression test verifies the callback URL does not contain bearer tokens and that the code cannot be reused. OAuth state is still not proven nonce-bound and remains a public-release hardening requirement.

## Trust boundaries and protected assets


## Implemented controls

- Every new domain endpoint is authenticated except the deliberately public one-time bootstrap exchange. Resource reads are filtered by `ownerId`; unauthorized IDs return 404.
- Workflow descriptions create proposals only. Deterministic validation blocks unregistered actions before persistence or activation; models do not receive operating-system tools through this path.
- A central risk registry controls approval requirements. Grants may be scoped by assistant, workflow, action and resource and may expire or be revoked.
- Local file actions canonicalize the granted directory and the target parent using `realpath` and `path.relative`, preventing text-prefix and symlink escapes. Writes are atomic where content is replaced. File create uses exclusive creation.
- Workflow runs, approvals and undo requests require idempotency keys. Runs have action/runtime/data/model limits in their versioned definition.
- Reversible file operations capture prior state or an expected hash. Undo checks the current hash and refuses to overwrite newer changes.
- Audit events redact common credential/content keys, carry trace IDs and form a per-owner SHA-256 hash chain. Migration 005 blocks ordinary update/delete operations on the database audit table.
- Memory records are owner-filtered before scope and assistant visibility filtering. Deletion tombstones content. Highly sensitive memory is rejected until a dedicated explicit-confirmation flow is implemented.
- Package publication rejects secret/private-data manifest keys. Paid acquisition fails closed until a real provider is configured.
- Legacy execution approvals now verify user and assistant ownership. Legacy webhooks require an HMAC signature and a five-minute timestamp window; missing webhook configuration fails closed.
- Helmet, restricted configured CORS, JSON size limits, rate limiting, stable errors, backend-only provider keys and upload type/size/path validation remain active.

## Threat review and residual risks

| Threat | Current mitigation | Remaining risk / required operation |
|---|---|---|
| Broken object authorization / cross-tenant access | Owner-scoped service lookups and 404 responses; integration tests | Extend tests to every listing/build/license endpoint as those UIs are added. |
| Prompt injection / tool abuse | Deterministic registry and validation; proposal does not execute | Legacy `ExecutionEngineService` still allows LLM-planned integration calls and should be retired after UI migration. Treat document instructions only as data. |
| Privilege escalation | Server-side grant policy | Organization roles do not yet exist. |
| Path traversal / symlink escape | Canonical scope validation and upload sanitizer | Windows junction and platform-specific filesystem tests are still required on release hosts. |
| Replay / malicious webhook | HMAC plus timestamp | Durable event-ID deduplication is not yet implemented in PostgreSQL. Rotate `WEBHOOK_SIGNING_SECRET` operationally. |
| License bypass | Server-authoritative entitlement and bootstrap check | Offline license grace and paid webhook/refund state are not implemented. |
| Audit manipulation | Hash chain and DB mutation trigger | The active JSON development store is writable by the host account. Production must use PostgreSQL, restricted roles and immutable backups. |
| Memory leakage | Owner/scope/visibility filter and tombstone deletion | Semantic embeddings are not implemented; enforce ownership inside any future vector query. |
| Unsafe undo | Expected-hash conflict detection and idempotency | Rename/move undo adapters remain unavailable. |
| Watcher abuse / denial of service / model cost | No watcher shipped; workflow limits | Queue backpressure, per-user execution quotas and model cost ledger remain required before unattended automation. |
| CSRF/XSS/CORS | Bearer auth, Helmet, configured exact CORS | If cookie auth is enabled, add origin-bound CSRF protection. Continue React output encoding and avoid unsafe HTML. |

## Operational requirements

Use unique 32+ byte JWT and webhook secrets; TLS only; `NODE_ENV=production`; an exact HTTPS CORS origin; no debug stack traces; separate production credentials; least-privilege OAuth scopes; encrypted database/object-store volumes; log access controls; dependency and container scanning; daily backups with restore drills; secret rotation; alerting on signature failures, repeated approval denial, audit-chain failure and unusual device activation.
