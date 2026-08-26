# Agentia App Export Architecture

## Current audit

The repository is a TypeScript monorepo: Next.js web (`apps/web`), Express API (`apps/api`), Electron desktop runtime (`apps/desktop`), shared contracts (`packages/shared`), and PostgreSQL migrations (`db/migrations`). The reusable foundation was already present in `assistant_packages`, immutable `package_versions`, `desktop_builds`, device sessions, bootstrap tokens, runtime releases, and a Redis/BullMQ-capable build queue.

The prior implementation was a Windows-only Electron installer path. Its deploy page was a “coming soon” screen, its snapshot manifest was not a portable public contract, and it did not retain export-manifest checksums or build stages. It also must not be described as cross-platform: macOS, Linux, PWA, local model execution, Supabase-backed sync, code signing, notarization, and a containerized production worker are not implemented.

## Implemented increment

- `agentia.app-manifest` v1 is a strict Zod contract in `@archmind/shared`.
- Manifests are created server-side from the assistant’s immutable version and are canonicalized, SHA-256 checksummed, and signed. Credential-like keys are rejected.
- Export packages use the existing normalized package/version tables. Published package-version contents are protected from in-place mutation by migration `012`.
- The real Windows build route only accepts an owned, validated package/version and injects its signed configuration into the Electron installer build.
- Build records now preserve manifest checksum, source package version, correlation id, stage, and progress. The queue updates real build stages.
- `/assistants/:id/deploy` now creates the manifest, queues a Windows x64 installer, polls the job, and only enables download after the worker produces and hashes an installer.

## Boundaries

```text
Web export UI -> Express API -> package_versions + desktop_builds -> queue worker
                      |                                      |
                      v                                      v
             signed App Manifest                       Electron runtime template
                                                              |
                                                              v
                                                     checksum-verified installer
```

The manifest holds no provider keys, Supabase service-role key, database password, OAuth credential, local path, or conversation content. Cloud inference must use an authenticated Agentia proxy; local credentials belong in OS secure storage, not in the manifest. The present Electron builder uses a single-use, short-lived activation bootstrap for the legacy installed runtime flow; rotate it to device-link-only activation before public distribution.

## Runtime decision

Electron remains the current adapter because this repository already has a working Electron runtime and installer pipeline. The export contract is runtime-neutral, so a Tauri runtime can later consume the same manifest. Tauri should be evaluated when the team can fund a Rust desktop/security toolchain and cross-platform signing pipeline; its smaller footprint is attractive, but switching now would delay a verified Windows path.

## Build adapters and status

| Target | Status | Requirement before enabling |
| --- | --- | --- |
| Windows x64 | Implemented | Isolated Windows worker and code-signing certificate for production |
| Windows arm64 | Contract-ready | arm64 Electron runtime + runner |
| macOS | Contract-ready | macOS runner, Developer ID, notarization |
| Linux | Contract-ready | Linux runner and package policy |
| Web/PWA | Contract-ready | PWA adapter and public distribution/security review |

## Local data and sync

The existing runtime encrypts its device credentials through Electron `safeStorage`; it does not yet provide the required encrypted local conversation/memory database or a Supabase sync protocol. When implemented, records need `{ id, user_id, device_id, version, created_at, updated_at, deleted_at, sync_status }`, idempotency keys, tombstones, exponential retry, and a manual conflict record. Supabase remains canonical; the runtime must never use a service-role key.

## Production controls

- Run builds in short-lived, network-restricted workers with a read-only runtime template and a per-job workspace.
- Allow only registered build adapters; never execute customer code, package scripts, or shell fragments.
- Store artifacts in private object storage and issue short-lived, audited download authorization.
- Keep signing material in a managed secret store/HSM; never in Git, build inputs, or Electron resources.
- Test RLS with separate authenticated principals. The migration preserves owner-scoped package-version access; API authorization is also enforced server-side.

## OWNER ACTION REQUIRED

1. Apply database migrations in a staging Supabase/Postgres environment, including `012_agentia_app_export_foundation.sql`, then run the RLS cross-user test suite with real Supabase auth identities.
2. Provision an isolated Windows build worker and set `BUILD_WORKER_URL` plus `BUILD_STORAGE_BUCKET`. Do not expose worker credentials to `NEXT_PUBLIC_*` variables.
3. Generate a dedicated, rotating `ARCHMIND_MANIFEST_SIGNING_SECRET` (at least 32 random bytes) and set `ARCHMIND_MANIFEST_SIGNING_KEY_ID`. Do not send the secret in chat or commit it.
4. For public Windows distribution, obtain a code-signing certificate and provide its secure worker-store reference. Do not place the certificate or password in `.env` on developer machines.
5. Before enabling public distribution, replace legacy bootstrap-in-installer activation with device-link-only activation and complete external security review.

## Rollback

Migration 012 is additive. To roll back application code, stop issuing new export packages and retain existing package versions/build artifacts. Do not delete published manifests or releases; retire them and revoke download authorization where needed.
