// Isolated PostgreSQL-compatible test of the cleanup function. It deliberately
// omits pg_cron, which PGlite does not ship; no production database is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const modulePath = process.env.PGLITE_MODULE_PATH;
if (!modulePath) throw new Error('Set PGLITE_MODULE_PATH to the installed @electric-sql/pglite package');
const { PGlite } = require(modulePath);

const migrationPath = path.resolve(__dirname, '../db/migrations/018_message_retention.sql');
const migration = fs.readFileSync(migrationPath, 'utf8')
  .replace('create extension if not exists pg_cron;', '')
  .split('-- The job name is stable,')[0];

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.chats (
        id uuid primary key, is_favorite boolean not null default false,
        is_archived boolean not null default false
      );
      create table public.conversations (id uuid primary key);
      create table public.messages (
        id uuid primary key, chat_id uuid,
        conversation_id uuid, created_at timestamptz not null default now(),
        content text not null
      );
      create table public.generated_files (id uuid primary key);
      alter table public.messages enable row level security;
    `);
    await db.exec(migration);
    await db.exec(`
      insert into public.chats(id, is_favorite, is_archived) values
        ('00000000-0000-0000-0000-000000000001', false, false),
        ('00000000-0000-0000-0000-000000000002', true, false),
        ('00000000-0000-0000-0000-000000000003', false, true);
      insert into public.conversations(id) values
        ('00000000-0000-0000-0000-000000000004');
      insert into public.generated_files(id) values
        ('00000000-0000-0000-0000-000000000005');
      insert into public.messages(id, chat_id, conversation_id, created_at, content) values
        ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, now() - interval '6 days', 'expired'),
        ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null, now() - interval '1 day', 'recent'),
        ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', null, now() - interval '6 days', 'favorite'),
        ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', null, now() - interval '6 days', 'archived'),
        ('10000000-0000-0000-0000-000000000005', null, '00000000-0000-0000-0000-000000000004', now() - interval '6 days', 'conversation'),
        ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', null, now() - interval '4 days', 'three-day-only');
    `);

    const run = async () => (await db.query('select agentia_maintenance.cleanup_messages() as deleted')).rows[0].deleted;
    const remaining = async () => (await db.query('select content from public.messages order by content')).rows.map((row) => row.content);
    assert.equal(await run(), 2, 'five-day retention removes only two unprotected old messages');
    assert.deepEqual(await remaining(), ['archived', 'favorite', 'recent', 'three-day-only']);
    assert.equal(await run(), 0, 'repeated cleanup is idempotent');

    await db.query("update agentia_maintenance.settings set value = 3 where name = 'MESSAGE_RETENTION_DAYS'");
    assert.equal(await run(), 1, 'three-day retention removes the four-day-old message');
    assert.deepEqual(await remaining(), ['archived', 'favorite', 'recent']);
    await db.exec(`
      insert into public.messages(id, chat_id, created_at, content)
      select md5('bulk-' || n)::uuid,
        '00000000-0000-0000-0000-000000000001',
        now() - interval '6 days', 'bulk-' || n
      from generate_series(1, 251) as n;
    `);
    assert.equal(await run(), 251, 'cleanup continues across 250-row batches');
    assert.deepEqual(await remaining(), ['archived', 'favorite', 'recent']);
    assert.equal((await db.query('select count(*)::int as n from public.chats')).rows[0].n, 3);
    assert.equal((await db.query('select count(*)::int as n from public.conversations')).rows[0].n, 1);
    assert.equal((await db.query('select count(*)::int as n from public.generated_files')).rows[0].n, 1);
    const logs = (await db.query('select retention_days, deleted_messages, status from agentia_maintenance.message_cleanup_runs order by id')).rows;
    assert.deepEqual(logs.map((row) => [row.retention_days, row.deleted_messages, row.status]),
      [[5, 2, 'success'], [5, 0, 'success'], [3, 1, 'success'], [3, 251, 'success']]);
    console.log('PASS: 5-day and 3-day cleanup, recent/favorite/archived preservation, idempotence, batching, unrelated tables, audit logs');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
