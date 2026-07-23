import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PostgresPlatformStore } from "../src/db/postgres-platform";
import type { WorkflowDefinition } from "../src/platform-types";
import { PlatformService } from "../src/services/platform-service";
import type { AssistantRecord, AuthUser } from "../src/types";

const databaseUrl = process.env.TEST_DATABASE_URL;

function definition(): WorkflowDefinition {
  return {
    trigger: { type: "manual", config: {} }, conditions: [], actions: [{ id: "notify", type: "notification.send", name: "Notify", input: { message: "Persisted" }, riskLevel: "read_only", requiresApproval: false }],
    requiredConnections: [], requiredPermissions: ["notification.send"], approvalPolicy: "risk_based", errorBehavior: "stop",
    retryPolicy: { maxRetries: 1, backoffMs: 10 }, inputSchema: { type: "object" }, outputSchema: { type: "object" },
    limits: { maxActions: 10, maxRuntimeMs: 10000, maxModelCalls: 0, maxDataBytes: 1024 * 1024 }
  };
}

async function seedCoreRows(ownerId: string, assistantId: string) {
  if (!databaseUrl) return;
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(
      `insert into users(id, email, plan, token_usage, created_at, updated_at)
       values($1,$2,'pro',0,now(),now()) on conflict(id) do nothing`,
      [ownerId, `${ownerId}@example.com`]
    );
    await pool.query(
      `insert into assistants(id, user_id, name, system_prompt, tone, is_public, model, temperature, version, created_at)
       values($1,$2,$3,'Help safely.','professional',false,'openrouter/auto',0.2,1,now()) on conflict(id) do nothing`,
      [assistantId, ownerId, `Assistant ${assistantId.slice(0, 8)}`]
    );
  } finally {
    await pool.end();
  }
}

function authUser(id = randomUUID()): AuthUser {
  return { id, email: `${id}@example.com`, plan: "pro" };
}

function assistant(ownerId: string, overrides: Partial<AssistantRecord> = {}): AssistantRecord {
  const id = overrides.id ?? randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    userId: ownerId,
    createdByUserId: ownerId,
    name: "Customer Support Assistant 3",
    slug: "customer-support-assistant-3",
    description: "Support users",
    systemPrompt: "Help safely.",
    tone: "professional",
    isPublic: true,
    visibility: "public",
    publicSlug: "customer-support-assistant-3",
    model: "openrouter/auto",
    temperature: 0.2,
    starterPrompts: [],
    enabledTools: [],
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe.skipIf(!databaseUrl)("Postgres platform repository", () => {
  it("persists workflows, runs, audit and memories across a repository restart", async () => {
    const ownerId = randomUUID();
    const assistantId = randomUUID();
    const store = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    await store.getPlatformState();
    await seedCoreRows(ownerId, assistantId);

    const service = new PlatformService(store);
    const created = await service.createWorkflow(ownerId, assistantId, { name: "Persistent workflow", purpose: "Prove persistence", definition: definition() });
    await service.setWorkflowStatus(ownerId, created.workflow.id, "active", 1);
    const run = await service.runWorkflow(ownerId, created.workflow.id, {}, `run-${randomUUID()}`);
    await service.createMemory(ownerId, { scope: "assistant", assistantId, source: "test", category: "preference", content: "Remember database proof", confidence: 1, sensitivity: "normal", assistantVisibility: [assistantId], provenance: {} });
    await store.close();

    const restarted = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    const restartedService = new PlatformService(restarted);
    expect((await restartedService.listVersions(ownerId, created.workflow.id)).length).toBe(1);
    expect((await restartedService.listRuns(ownerId, created.workflow.id)).map((item) => item.id)).toContain(run.id);
    expect(await restartedService.verifyAuditChain(ownerId)).toBe(true);
    expect((await restartedService.listMemories(ownerId, assistantId))[0]?.content).toBe("Remember database proof");
    await restarted.close();
  });

  it("keeps database-backed workflow and memory reads tenant isolated", async () => {
    const ownerA = randomUUID();
    const ownerB = randomUUID();
    const assistantA = randomUUID();
    const assistantB = randomUUID();
    const store = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    await store.getPlatformState();
    await seedCoreRows(ownerA, assistantA);
    await seedCoreRows(ownerB, assistantB);
    const service = new PlatformService(store);
    const created = await service.createWorkflow(ownerA, assistantA, { name: "Tenant A", purpose: "Isolation", definition: definition() });
    await service.createMemory(ownerA, { scope: "assistant", assistantId: assistantA, source: "test", category: "preference", content: "A-only", confidence: 1, sensitivity: "normal", assistantVisibility: [assistantA], provenance: {} });

    await expect(service.getWorkflow(ownerB, created.workflow.id)).rejects.toMatchObject({ status: 404 });
    expect(await service.listMemories(ownerB, assistantB)).toEqual([]);
    await store.close();
  });

  it("mirrors duplicate assistant slugs without blocking installer state reads", async () => {
    const store = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    const firstUser = authUser();
    const secondUser = authUser();
    try {
      await store.ensurePlatformPrincipal?.(firstUser, assistant(firstUser.id));
      await store.ensurePlatformPrincipal?.(secondUser, assistant(secondUser.id));
      const pool = new Pool({ connectionString: databaseUrl });
      try {
        const rows = await pool.query(
          `select id, slug, public_slug from assistants where user_id in ($1, $2) order by user_id`,
          [firstUser.id, secondUser.id]
        );
        expect(rows.rows).toHaveLength(2);
        expect(new Set(rows.rows.map((row) => row.slug))).toHaveLength(2);
        expect(new Set(rows.rows.map((row) => row.public_slug))).toHaveLength(2);
      } finally {
        await pool.end();
      }
    } finally {
      await store.close();
    }
  });

  it("atomically reuses one desktop build for concurrent idempotency requests", async () => {
    const ownerId = randomUUID();
    const assistantId = randomUUID();
    await seedCoreRows(ownerId, assistantId);
    const firstStore = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    const secondStore = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    const input = {
      assistantId, platform: "win32" as const, architecture: "x64" as const, productName: "Concurrent build",
      appIcon: "FileText", color: "#2563eb", assistantVersion: 1, idempotencyKey: `build-${randomUUID()}`
    };
    try {
      const [first, second] = await Promise.all([
        new PlatformService(firstStore).createDesktopBuild(ownerId, input),
        new PlatformService(secondStore).createDesktopBuild(ownerId, input)
      ]);
      expect(first.build.id).toBe(second.build.id);
      expect([first.reused, second.reused].filter(Boolean)).toHaveLength(1);
      const verificationStore = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
      const persisted = await verificationStore.getPlatformState();
      await verificationStore.close();
      expect(persisted.desktopBuilds.filter((item) => item.ownerId === ownerId && item.idempotencyKey === input.idempotencyKey)).toHaveLength(1);
    } finally {
      await firstStore.close();
      await secondStore.close();
    }
  });

  it("does not reuse a ready installer across different assistants", async () => {
    const ownerId = randomUUID();
    const assistantA = randomUUID();
    const assistantB = randomUUID();
    await seedCoreRows(ownerId, assistantA);
    await seedCoreRows(ownerId, assistantB);
    const store = new PostgresPlatformStore(databaseUrl!, { runMigrations: true });
    const service = new PlatformService(store);
    const input = {
      platform: "win32" as const,
      architecture: "x64" as const,
      productName: "Same visible name",
      appIcon: "Bot",
      color: "#2563eb",
      assistantVersion: 1
    };
    try {
      const first = await service.createDesktopBuild(ownerId, { ...input, assistantId: assistantA, idempotencyKey: `build-${randomUUID()}` });
      await service.updateDesktopBuild(first.build.id, {
        status: "ready",
        artifactPath: `D:/fake/${first.build.id}.exe`,
        artifactSize: 80_000_000,
        artifactSha256: "a".repeat(64)
      });
      const second = await service.createDesktopBuild(ownerId, { ...input, assistantId: assistantB, idempotencyKey: `build-${randomUUID()}` });
      expect(second.reused).toBe(false);
      expect(second.build.id).not.toBe(first.build.id);
      expect(second.build.appId).not.toBe(first.build.appId);
      expect(second.build.protocol).not.toBe(first.build.protocol);
    } finally {
      await store.close();
    }
  });
});
