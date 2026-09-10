# File generation service

AGENTIA accepts natural PDF, DOCX, and PPTX requests in workspace and assistant chat. The API returns a queued file card immediately. The existing BullMQ worker plans the document, generates and validates each page/slide, checkpoints progress, renders a native file, uploads it to private storage, reads it back, and marks it ready. Maximum length is 50 pages/slides; maximum output size is 25 MiB.

The composer also has a **Generate file** button. Choose PDF, Word, or PowerPoint, optionally specify 1–50 pages/slides, type a description in the message box, and press Send. Cancel returns to normal chat without discarding the draft.

Chat and private file requests use the same-origin `/api/workspace/*` relay. Set `API_INTERNAL_URL` on the web server to the API host, or keep the existing `NEXT_PUBLIC_PLATFORM_URL` / `NEXT_PUBLIC_API_URL`. The relay forwards the user's authentication (not a server credential), preserves streaming and binary downloads, and reports unreachable/misconfigured backends as actionable JSON errors. The API must be a separate server origin; arbitrary destinations and redirects are rejected. Browser clients do not need cross-origin access for these calls. Other existing API calls retain their current routing.

## Production setup

1. Apply `db/migrations/016_file_generation.sql` with a database administrator connection. It adds `generated_files` and the private Supabase bucket. The existing `agentia_worker` role receives SELECT, INSERT and UPDATE privileges. Other deployments must grant these privileges to their trusted server database role, which must bypass RLS. Browser roles have no table or object access.
2. API and worker need the same `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, and signing configuration. Never expose the service-role key to the frontend. Non-Vercel deployments also need `REDIS_URL`.
3. On Vercel, AGENTIA uses the managed private `archmind-file-generation` queue configured in `apps/api/vercel.json`; it does not require a daemon or a worker heartbeat. Elsewhere, run `node apps/api/dist/worker.js` as a persistent process using the API Docker image and `REDIS_URL`. The images include LibreOffice for Office pagination checks. PDFs embed redistributable DejaVu fonts.
4. `FILE_GENERATION_MODEL` optionally overrides the existing model. The service normalizes the retired `nvidia/nemotron-3-ultra:free` identifier to `nvidia/nemotron-3-ultra-550b-a55b:free`. Provider quotas and availability still apply.
5. `FILE_GENERATION_SOFFICE` points to the worker's LibreOffice executable. Docker sets `/usr/bin/soffice` and validates DOCX pagination in a real Office engine. Vercel validates the native DOCX archive and labels its page count as an estimate when no Office engine is available. Other clients or changed fonts may repaginate editable documents after download.

The API checks the schema and bucket privacy before admitting production jobs. On Vercel, durable queue admission verifies the worker path; elsewhere it also checks the BullMQ worker heartbeat. Missing prerequisites return 503. Deployment is not complete until live database/storage/worker acceptance tests pass.

## Local development

With PostgreSQL configured, the migration and private bucket are required. Without `DATABASE_URL` and `REDIS_URL`, run the API and a **single** existing worker with the same absolute `FILE_GENERATION_LOCAL_DIR`. The worker polls durable local records and resumes incomplete jobs. Production never falls back to local disk. `npm run dev` already starts the worker.

## API

All routes require a cryptographically verified login token. Invalid tokens, guessed session identifiers and assistant-scoped tokens cannot access private file resources.

| Route                                          | Result                                       |
| ---------------------------------------------- | -------------------------------------------- |
| `POST /api/files/generate`                     | 202 with queued metadata                     |
| `GET /api/files/:id/status`                    | Persisted progress and status                |
| `GET /api/files/:id/download`                  | Binary download; PDF supports `?inline=true` |
| `POST /api/files/:id/regenerate`               | A new version with prior content as context  |
| `GET /api/conversations/:conversationId/files` | Owned conversation history                   |
| `GET /api/files?assistantId=...`               | Latest 200 owned records                     |

```json
{
  "description": "Create a beginner-friendly neural network guide with examples and a comparison table",
  "format": "pdf",
  "title": "Neural Networks for Beginners",
  "pages": 20,
  "audience": "high school students",
  "tone": "educational"
}
```

Use `slides` for PowerPoint. Optional `requestId` is a UUID idempotency key. Supplied conversation/assistant IDs must belong to the verified user. The server generates new conversation IDs. `parentId` must belong to the same user and conversation. API responses omit the storage location and private content checkpoints.

## Reliability and security

PostgreSQL advisory transaction locks enforce two active files and twenty generations per user per rolling day across API replicas. Idempotent resubmissions return the existing job. BullMQ retries three times with exponential backoff; model responses have bounded validation retries. Checkpoints survive failure. The metadata table acts as an outbox, reconciled every thirty seconds, covering a crash between creation and enqueue. Jobs have a one-hour deadline across automatic retries. User-triggered retries preserve old versions and reuse validated content.

The renderer never executes generated code, fetches model-supplied image URLs, or accepts storage paths from clients. Native output supports headings, rich text, lists, tables, numbering, headers/footers and simple editable processes. Every archive is reopened and checked; production Office pagination is validated in an isolated LibreOffice profile. Empty files, incomplete plans, exact duplicate bodies, invalid formats, excessive sizes and detected overflow fail closed.

This is a document generation service, not an independently verified research engine. Prompts prohibit invented citations/statistics; validation rejects unqualified percentage claims. References and consequential factual claims still need review.

## Verification

```sh
npm run test -w @archmind/api -- tests/file-generation.test.ts
npm run typecheck
node --use-system-ca node_modules/tsx/dist/cli.mjs apps/api/src/tools/test-file-generation-live.ts
```

The opt-in live test uses the real model and isolated local storage under `tmp/file-generation-live`. It covers normal chat, 5/20/49-page PDFs, 10/30-slide PPTX, DOCX, downloads, cross-user denial, reload through a new repository and versioned chat editing. Model calls may incur charges. Set `FILE_ACCEPTANCE_DIR` to resume an interrupted run. Local checks do not replace production infrastructure acceptance.

On Windows, `scripts/verify-generated-office.ps1 -Directory <output>` opens test files read-only in Microsoft Office and exports local previews. Alternatively use LibreOffice and render DOCX pages with the document verifier. Inspect the previews before release.

### Acceptance and deployment handoff — September 7, 2026

- Real-model acceptance produced and authenticated downloads of 5-, 20-, and 49-page PDFs, 10- and 30-slide presentations, and a 5-page DOCX, with persistent local reload, ownership denial and versioned export checks. The user reviewed downloaded files and approved their quality.
- LibreOffice successfully opened the Word report and both presentations. Visual review informed stricter outline/placeholder validation and measured presentation table spacing. Deterministic tests exercise these safeguards; the subsequent large-file rerun was stopped at the user's request to finalize and push.
- The production private `generated-files` bucket was created. An actual generated PDF passed upload/readback equality and unauthenticated public-access denial. The temporary test object was removed; the private bucket remains.
- Automated browser testing reached a real queued/completed card, but cross-origin download automation on the local Edge setup failed. This is not recorded as a passing browser acceptance test; user-confirmed downloads are separate evidence.
- **Production activation:** migration 016 and the private bucket are applied. Vercel deployments use its managed durable queue for document work; non-Vercel deployments retain the persistent BullMQ worker. Verify a production job after each worker deployment because queue consumer configuration is deployment-specific.

Infrastructure verification (requires configured server credentials):

```sh
node --use-system-ca --import tsx apps/api/src/tools/check-file-generation-storage.ts --file=/path/to/generated.pdf
```

Use `--prepare-storage` only when authorized to create the private bucket. `FILE_ACCEPTANCE_REVALIDATE=1` creates a new version when rerunning a completed live-test file instead of modifying its original.
