# Operations Runbook

## Normal checks

Check API liveness, web response, worker heartbeat, PostgreSQL connections/replication, Redis depth/failures, object-store access, error rate, p95 latency, audit-chain verification, provider token health and unusual device activations. Never log request authorization headers, bootstrap/session tokens, file contents or raw memory content.

## Incidents

- **Automation incident:** call `POST /api/platform/pause` with `{ "scope": "global", "paused": true }` for the affected authenticated owner; revoke grants and integration tokens; cancel queued jobs when queue cancellation is implemented. Preserve audit evidence.
- **Credential leak:** rotate the provider/JWT/webhook secret, revoke sessions/tokens, deploy configuration, inspect audit/device events and notify affected owners according to policy.
- **Webhook attack:** rotate the signing secret, keep the endpoint disabled during investigation and review timestamp/signature failures. Do not bypass HMAC to restore service.
- **Audit-chain failure:** pause automation, take read-only snapshots and compare PostgreSQL audit records/backups. Do not “repair” history in place.
- **Queue backlog:** pause new triggers, identify retry storms, cap concurrency and dead-letter poison events. The current worker is not production-capable and must not be used for real automation.
- **Provider outage:** show disconnected/degraded state, stop irreversible calls and use bounded retry with jitter. Never report success without provider confirmation.

## Recovery and maintenance

Restore PostgreSQL to an isolated environment, verify ownership counts and audit chains, then promote through the platform’s documented failover. Restore object versions by immutable key/checksum. Revoke expired bootstrap tokens and sessions, tombstoned memory search representations, abandoned build jobs and temporary uploads on scheduled maintenance once PostgreSQL workers are active.

Rollback uses the prior immutable web/API/worker images. Keep additive schema changes, then investigate forward. Record operator identity, timestamps, reason and outcome for emergency privacy deletion or audit-retention actions.

