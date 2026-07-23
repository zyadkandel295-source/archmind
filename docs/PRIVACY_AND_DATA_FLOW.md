# Privacy and Data Flow

## Data paths

The browser sends account, assistant, workflow and chat data to the Express API over TLS in production. Platform automation data uses PostgreSQL when `DATABASE_URL` is configured and `ARCHMIND_PLATFORM_STORE` is not set to `memory`; tests and explicitly selected local development can still use the in-memory/local JSON store. Uploaded knowledge is parsed locally and may be stored locally or in configured object storage. Chat/RAG content is sent to OpenRouter only from the backend. Google/Notion/webhook data leaves ArchMind only through configured adapters and permission policy. The desktop runtime exchanges a single-use bootstrap token for a device session, stores the session secret with OS-protected Electron `safeStorage` when available, watches user-approved folders locally, and reports action audit events to the API.

Workflow interpretation through `/api/platform/workflows/propose` is deterministic and does not call an AI provider or run actions. `data.extract` declares that content may be sent to the configured AI provider and requires approval. Action previews disclose resources, reversibility, risk and provider before execution.

## Memory and retention

Durable memory is opt-in through explicit API creation; chat messages are not automatically copied into memory. Records contain owner, scope, source, category, confidence, sensitivity, visibility and provenance. Retrieval filters owner first. Deletion tombstones content; export returns active owner records. Highly sensitive memory is rejected until a dedicated confirmation/control UI exists.

Production must define retention periods for conversations, uploads, audit records, workflow runs, memories, device sessions and integration logs. Privacy deletion of immutable audit records must be an exceptional authorized process that writes a separate deletion certificate/event; do not let ordinary clients rewrite history.

## Subprocessors and user controls

Potential subprocessors are the selected cloud host, PostgreSQL/Redis/object storage providers, OpenRouter, configured OAuth services, email/monitoring/billing providers and code-signing/artifact services. Disclose only providers actually enabled. Users can delete/tombstone memories, export memories, revoke grants, pause automations, disconnect integrations through existing provider routes where available and revoke desktop sessions. Full account export/deletion orchestration remains required before production launch.
