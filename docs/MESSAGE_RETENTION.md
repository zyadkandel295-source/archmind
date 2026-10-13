# Supabase chat-message retention

`db/migrations/018_message_retention.sql` schedules `public.messages` cleanup with
Supabase Cron (`pg_cron`) at **03:00 UTC daily**. The default is **5 days**. The
job deletes at most 10,000 eligible messages per run, in 250-row statements.
It does not delete chats, conversations, users, profiles, authentication data,
or generated files. Messages belonging to favorite or archived chats are
exempt. There is currently no per-message pin/save field in the inspected live
schema; the migration stops if one of those fields appears later.

## Before enabling in production

1. Run `node scripts/inspect-message-rest.cjs` and
   `node scripts/dry-run-message-retention.cjs`. Both are read-only and do not
   print message content or credentials.
2. Run `node scripts/inspect-message-schema.cjs` using an available PostgreSQL
   connection. Review columns, foreign keys, DELETE triggers, RLS policies,
   indexes, and existing cron jobs. The migration also fails closed for an
   unexpected message schema, incoming foreign key, DELETE trigger/rule, or
   per-message pin/save column.
3. Run the migration as the database owner through the Supabase SQL editor or
   normal migration pipeline. **Committing this file does not by itself enable
   the scheduled job.** The migration does not call the cleanup function, so it
   does not delete messages at apply time. It asserts that the job is active.
4. Verify the active job without executing it:

   ```sql
   select jobid, jobname, schedule, command, active
   from cron.job
   where jobname = 'agentia-message-cleanup';

   select name, value from agentia_maintenance.settings;
   ```

5. After the first scheduled run, inspect the private audit table and Supabase
   Cron run history:

   ```sql
   select started_at, finished_at, retention_days, cutoff_at,
          deleted_messages, status, error
   from agentia_maintenance.message_cleanup_runs
   order by id desc limit 20;

   select jobid, runid, status, start_time, end_time, return_message
   from cron.job_run_details
   where jobid = (
     select jobid from cron.job where jobname = 'agentia-message-cleanup'
   )
   order by runid desc limit 20;
   ```

The job is deliberately not run immediately during deployment or testing:
doing so would delete real old production messages. Use isolated test records
in a non-production database to verify actual deletion behavior.

## Change to three days

Run once as the database owner; no function or cron edit is required:

```sql
update agentia_maintenance.settings
set value = 3
where name = 'MESSAGE_RETENTION_DAYS';
```

Set `value = 5` to restore the default. The next 03:00 UTC run uses the new
value. The check constraint permits only 3 or 5 days.

## Reliability and storage

The function uses a transaction-scoped advisory lock to skip overlapping runs,
`SKIP LOCKED` to avoid waiting on active message writes, a fixed cutoff per
run, and private audit rows for success, skip, or failure. It keeps existing
RLS policies unchanged and is not exposed to frontend roles. New message
inserts are handled by the existing API, not this job.

Only `public.messages` rows are deleted. The migration may add a leading
`created_at` B-tree index if no suitable one exists. It leaves orphan cleanup
and unrelated tables alone because their retention rules are not established.
PostgreSQL marks deleted rows reusable; autovacuum later reclaims dead tuples
for reuse. The physical database file and Supabase's reported size need not
shrink immediately. Savings depend on actual old-message volume and all other
database records; no fixed size or free-tier outcome is guaranteed.

The dedicated-assistant chat endpoint also uses an in-memory store in the
current API. This database job governs only messages persisted in Supabase's
`public.messages` table; it does not redesign that separate storage path.

## Local isolated test

Install `@electric-sql/pglite` outside the repository, set
`PGLITE_MODULE_PATH` to that package directory, and run
`node scripts/test-message-retention.cjs`. This tests five- and three-day
selection, exemptions, a 251-row backlog, idempotence, audit records, and
preservation of unrelated tables. PGlite does not include `pg_cron`, so use
the production read-only job query above to verify scheduling.
