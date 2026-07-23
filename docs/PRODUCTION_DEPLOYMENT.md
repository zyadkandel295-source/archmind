# Production Deployment

ArchMind requires Node.js 20+, PostgreSQL 16, Redis 7, object storage for uploaded/release artifacts, two web services (Next.js and Express) and one worker service. The repository includes Dockerfiles and Railway/AWS/Kong starters, but no external deployment was performed.

## Domain and services

Use `www.example.com` (web) and `api.example.com` (API), replacing the examples with the owned `.com` domain. Create DNS records to the selected platform, enforce HTTPS/HSTS at the edge, redirect HTTP to HTTPS and restrict API CORS to the exact web origin. Do not expose PostgreSQL or Redis publicly.

Set at minimum: `NODE_ENV=production`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL`, `API_CORS_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, Firebase server/client variables if Firebase login is enabled, and `OPENROUTER_API_KEY`. Configure OAuth callback URLs at each provider (`GOOGLE_CALLBACK_URL`, `NOTION_REDIRECT_URI`) with exact HTTPS URLs. Configure S3 variables, `WEBHOOK_SIGNING_SECRET`, monitoring/email/billing variables only for services actually enabled. `.env.example` is the inventory and contains no secret values.

## Build and migration

```powershell
npm ci
npm run typecheck
npm test
npm run build
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/migrations/005_six_features_foundation.sql
npm run start -w @archmind/api
npm run start -w @archmind/web
npm run worker -w @archmind/api
```

Apply all migrations in numeric order on a backed-up staging clone first. Migration 005 is additive. The migration currently creates enum types without an existence guard, so it must be recorded by a migration ledger and executed once—not replayed blindly. The active application still uses the JSON `MemoryStore`; production durability is blocked until a PostgreSQL repository adapter is wired and verified.

## Health, monitoring and storage

`GET /api/health` is the liveness endpoint. Add an infrastructure readiness probe that checks PostgreSQL, Redis and object storage without returning secret/configuration detail; the existing route reports configuration booleans and should be edge-restricted. Send structured logs to the selected provider and initialize the configured Sentry hook before launch. Store uploads and desktop artifacts in private buckets with encryption, versioning, lifecycle rules and short-lived authorized downloads.

## Backups, rollback and verification

- Enable daily encrypted PostgreSQL backups with point-in-time recovery and quarterly restore drills.
- Enable object versioning and test restoration of a deleted source and release artifact.
- Before release, retain the prior web/API/worker images and database backup. Roll back application images first. Never roll back a destructive schema migration; migration 005 is additive and can remain during an app rollback.
- Verify HTTPS, cookies/token handling, exact CORS, login/logout/refresh, cross-user isolation, workflow proposal/save/activation, approval denial, file-scope tests on the runtime host, audit chain, memory export/delete, entitlement failure modes and webhook signature rejection.

## External actions requiring authorization

Domain purchase, DNS changes, provider callback edits, cloud creation, production migrations, billing activation, email sending, code signing and marketplace publication require the account owner’s credentials and explicit authorization.

