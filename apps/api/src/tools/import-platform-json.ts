import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { emptyPlatformState, type PlatformState } from "../platform-types";
import { PostgresPlatformStore } from "../db/postgres-platform";

type PersistedMemory = {
  users?: Array<Record<string, unknown>>;
  assistants?: Array<Record<string, unknown>>;
  platform?: PlatformState;
};

function workspaceRoot() {
  return path.resolve(__dirname, "..", "..", "..", "..");
}

async function upsertCoreRows(databaseUrl: string, data: PersistedMemory) {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const user of data.users ?? []) {
      await client.query(
        `insert into users(id, email, password_hash, google_id, plan, token_usage, created_at, updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict(id) do update set email=excluded.email, password_hash=excluded.password_hash, google_id=excluded.google_id, plan=excluded.plan, token_usage=excluded.token_usage, updated_at=excluded.updated_at`,
        [user.id, user.email, user.passwordHash, user.googleId, user.plan ?? "free", user.tokenUsage ?? 0, user.createdAt, user.updatedAt]
      );
    }
    for (const assistant of data.assistants ?? []) {
      await client.query(
        `insert into assistants(id, user_id, name, description, system_prompt, tone, is_public, public_slug, model, temperature, version, created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         on conflict(id) do update set name=excluded.name, description=excluded.description, system_prompt=excluded.system_prompt, tone=excluded.tone, is_public=excluded.is_public, public_slug=excluded.public_slug, model=excluded.model, temperature=excluded.temperature, version=excluded.version`,
        [assistant.id, assistant.userId, assistant.name, assistant.description, assistant.systemPrompt, assistant.tone ?? "professional", assistant.isPublic ?? false, assistant.publicSlug, assistant.model ?? "openrouter/auto", assistant.temperature ?? 0.7, assistant.version ?? 1, assistant.createdAt]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const inputPath = process.argv[2] ?? path.join(workspaceRoot(), ".archmind-data", "memory.json");
  const raw = await fs.readFile(inputPath, "utf8");
  const data = JSON.parse(raw) as PersistedMemory;

  await upsertCoreRows(databaseUrl, data);
  const store = new PostgresPlatformStore(databaseUrl, { runMigrations: process.env.ARCHMIND_RUN_MIGRATIONS === "true" });
  await store.savePlatformState({ ...emptyPlatformState(), ...(data.platform ?? {}) });
  await store.close();
  console.log(`Imported ArchMind platform JSON data from ${inputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
