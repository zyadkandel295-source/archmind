const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const { Client } = require("pg");

const envPath = path.resolve(__dirname, "../.env");
const local = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
const connectionString = process.env.DATABASE_URL || local.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for schema inspection");
const overridePort = process.argv[2];
if (overridePort && !["5432", "6543"].includes(overridePort)) throw new Error("Unsupported database port override");
const connectionUrl = new URL(connectionString);
if (overridePort) connectionUrl.port = overridePort;

async function main() {
  const client = new Client({ connectionString: connectionUrl.toString(), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query("begin read only");
    const relations = await client.query(`
      select c.oid, n.nspname as schema, c.relname as name, c.relkind,
             s.n_live_tup as estimated_rows,
             pg_total_relation_size(c.oid) as total_bytes
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      left join pg_stat_user_tables s on s.relid = c.oid
      where n.nspname = 'public'
        and (c.relname ~* '(message|chat|conversation)' or c.relname = 'generated_files')
        and c.relkind in ('r', 'p')
      order by c.relname
    `);
    const names = relations.rows.map((row) => row.name);
    const columns = await client.query(`
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name = any($1::text[])
      order by table_name, ordinal_position
    `, [names]);
    const foreignKeys = await client.query(`
      select conrelid::regclass::text as source_table,
             confrelid::regclass::text as target_table,
             conname as name, pg_get_constraintdef(oid) as definition
      from pg_constraint
      where contype = 'f' and
        (conrelid = any($1::oid[]) or confrelid = any($1::oid[]))
      order by source_table, name
    `, [relations.rows.map((row) => row.oid)]);
    const triggers = await client.query(`
      select tgrelid::regclass::text as table_name, tgname as name,
             pg_get_triggerdef(oid) as definition
      from pg_trigger
      where not tgisinternal and tgrelid = any($1::oid[])
      order by table_name, name
    `, [relations.rows.map((row) => row.oid)]);
    const policies = await client.query(`
      select tablename, policyname, cmd, roles, qual, with_check
      from pg_policies
      where schemaname = 'public' and tablename = any($1::text[])
      order by tablename, policyname
    `, [names]);
    const indexes = await client.query(`
      select tablename, indexname, indexdef
      from pg_indexes
      where schemaname = 'public' and tablename = any($1::text[])
      order by tablename, indexname
    `, [names]);
    const extensions = await client.query("select extname from pg_extension where extname = any($1::text[])", [["pg_cron", "pg_net"]]);
    const cronJobs = await client.query("select to_regclass('cron.job')::text as relation");
    let jobs = [];
    if (cronJobs.rows[0]?.relation) {
      try {
        const result = await client.query("select jobid, jobname, schedule, active from cron.job order by jobid");
        jobs = result.rows;
      } catch (error) {
        jobs = [{ inspection_error: error.message }];
      }
    }
    console.log(JSON.stringify({
      relations: relations.rows,
      columns: columns.rows,
      foreignKeys: foreignKeys.rows,
      triggers: triggers.rows,
      policies: policies.rows,
      indexes: indexes.rows,
      extensions: extensions.rows.map((row) => row.extname),
      cronJobs: jobs
    }, null, 2));
    await client.query("rollback");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Schema inspection failed: ${error.message}`);
  process.exitCode = 1;
});
