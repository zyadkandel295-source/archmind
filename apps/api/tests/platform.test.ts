import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/config/env";
import { MemoryStore } from "../src/db/memory";
import type { PlatformStateStore } from "../src/db/platform-store";
import type { WorkflowDefinition } from "../src/platform-types";
import { proposeWorkflow, validateWorkflow } from "../src/services/workflow-proposal";

const env: Env = {
  nodeEnv: "test", appUrl: "http://localhost:3000", port: 4000, corsOrigin: "http://localhost:3000",
  jwtAccessSecret: "test-access", jwtRefreshSecret: "test-refresh", jwtAccessTtl: "15m", jwtRefreshTtl: "7d",
  demoAuth: false, googleCallbackUrl: "http://localhost:4000/api/auth/google/callback", llmProvider: "openrouter",
  openRouterDefaultModel: "openrouter/auto", openRouterReasoningModel: "reasoning", openRouterCodingModel: "coding",
  openRouterVerifierModel: "verify", enableAnswerVerification: false, verifyMath: false, verifyCode: false, verifyResearch: false,
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))); });

async function account(app: ReturnType<typeof createApp>["app"], suffix: string) {
  const auth = await request(app).post("/api/auth/register").send({ email: `${suffix}@example.com`, password: "password123", confirmPassword: "password123" }).expect(201);
  const token = auth.body.accessToken as string;
  const response = await request(app).post("/api/assistants").set("Authorization", `Bearer ${token}`).send({ name: `${suffix} helper`, systemPrompt: "Help safely.", tone: "professional", isPublic: false, model: "openrouter/auto", temperature: 0.2 }).expect(201);
  return { token, assistantId: response.body.assistant.id as string };
}

function definition(action: WorkflowDefinition["actions"][number]): WorkflowDefinition {
  return {
    trigger: { type: "manual", config: {} }, conditions: [], actions: [action], requiredConnections: [],
    requiredPermissions: [action.type], approvalPolicy: "risk_based", errorBehavior: "stop",
    retryPolicy: { maxRetries: 1, backoffMs: 10 }, inputSchema: { type: "object" }, outputSchema: { type: "object" },
    limits: { maxActions: 10, maxRuntimeMs: 10000, maxModelCalls: 0, maxDataBytes: 1024 * 1024 }
  };
}

async function createWorkflow(app: ReturnType<typeof createApp>["app"], token: string, assistantId: string, workflow: WorkflowDefinition) {
  const response = await request(app).post(`/api/platform/assistants/${assistantId}/workflows`).set("Authorization", `Bearer ${token}`).send({ name: "Safe workflow", purpose: "Exercise controlled actions", definition: workflow }).expect(201);
  return response.body.workflow.id as string;
}

describe("six-feature platform foundation", () => {
  it("returns a correlated 503 when PostgreSQL is unavailable instead of a generic 500", async () => {
    const unavailable: PlatformStateStore = {
      getPlatformState: async () => { throw Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }); },
      savePlatformState: async () => undefined
    };
    const { app } = createApp({ env, platformStore: unavailable });
    const user = await account(app, "platform-unavailable");
    const response = await request(app).get("/api/platform/devices").set("Authorization", `Bearer ${user.token}`).expect(503);
    expect(response.body.error).toMatchObject({ code: "PLATFORM_STORE_UNAVAILABLE", retryable: true });
    expect(response.body.error.correlationId).toEqual(expect.any(String));
  });

  it("fails closed instead of silently using memory storage for production platform data", () => {
    expect(() => createApp({ env: { ...env, nodeEnv: "production", databaseUrl: undefined, platformStore: "postgres" } })).toThrow(/Production requires DATABASE_URL/);
    expect(() => createApp({ env: { ...env, nodeEnv: "production", databaseUrl: "postgres://example.invalid/db", platformStore: "memory" } })).toThrow(/Production requires DATABASE_URL/);
  });

  it("turns ordinary language into a deterministic, non-executing workflow proposal", () => {
    const proposal = proposeWorkflow("When a new invoice arrives, extract its fields, add a row to my spreadsheet, and ask me before moving it.");
    expect(proposal.definition.trigger.type).toBe("file_created");
    expect(proposal.definition.actions.map((item) => item.type)).toEqual(expect.arrayContaining(["file.read", "data.extract", "csv.append", "file.move"]));
    expect(proposal.questions.length).toBeGreaterThan(0);
    expect(proposal.validation.valid).toBe(true);
    expect(validateWorkflow({ ...proposal.definition, actions: [{ ...proposal.definition.actions[0]!, type: "shell.exec" }] }).valid).toBe(false);
  });

  it("creates, versions, activates and runs a workflow with an append-only audit chain", async () => {
    const { app } = createApp({ env }); const user = await account(app, "workflow");
    const workflowId = await createWorkflow(app, user.token, user.assistantId, definition({ id: "notify-1", type: "notification.send", name: "Notify me", input: { message: "Done" }, riskLevel: "read_only", requiresApproval: false }));
    await request(app).post(`/api/platform/workflows/${workflowId}/activate`).set("Authorization", `Bearer ${user.token}`).send({ version: 1 }).expect(200);
    const run = await request(app).post(`/api/platform/workflows/${workflowId}/runs`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "run-1").send({ input: {} }).expect(202);
    expect(run.body.run.status).toBe("completed");
    const replay = await request(app).post(`/api/platform/workflows/${workflowId}/runs`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "run-1").send({ input: {} }).expect(202);
    expect(replay.body.run.id).toBe(run.body.run.id);
    const audit = await request(app).get("/api/platform/audit").set("Authorization", `Bearer ${user.token}`).expect(200);
    expect(audit.body.chainValid).toBe(true);
    expect(audit.body.events.length).toBeGreaterThanOrEqual(3);
  });

  it("enforces a canonical folder grant, changes a real file, and safely undoes it", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "archmind-platform-")); temporary.push(directory);
    const target = path.join(directory, "note.txt"); await fs.writeFile(target, "before");
    const { app } = createApp({ env }); const user = await account(app, "files");
    const workflowId = await createWorkflow(app, user.token, user.assistantId, definition({ id: "update-1", type: "file.update", name: "Update approved note", input: { path: target, content: "after" }, riskLevel: "low_risk_reversible", requiresApproval: true }));
    await request(app).post("/api/platform/permissions").set("Authorization", `Bearer ${user.token}`).send({ assistantId: user.assistantId, workflowId, actionType: "file.update", resource: directory, mode: "resource" }).expect(201);
    await request(app).post(`/api/platform/workflows/${workflowId}/activate`).set("Authorization", `Bearer ${user.token}`).send({ version: 1 }).expect(200);
    const run = await request(app).post(`/api/platform/workflows/${workflowId}/runs`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "file-run-1").send({ input: {} }).expect(202);
    expect(run.body.run.status).toBe("completed"); expect(await fs.readFile(target, "utf8")).toBe("after");
    const undoList = await request(app).get("/api/platform/undo").set("Authorization", `Bearer ${user.token}`).expect(200);
    await request(app).post(`/api/platform/undo/${undoList.body.undo[0].id}`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "undo-1").expect(200);
    expect(await fs.readFile(target, "utf8")).toBe("before");
  });

  it("requires approval and a denial prevents execution", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "archmind-deny-")); temporary.push(directory);
    const target = path.join(directory, "protected.txt"); await fs.writeFile(target, "original");
    const { app } = createApp({ env }); const user = await account(app, "approval");
    const workflowId = await createWorkflow(app, user.token, user.assistantId, definition({ id: "update-denied", type: "file.update", name: "Update protected file", input: { path: target, content: "changed" }, riskLevel: "low_risk_reversible", requiresApproval: true }));
    await request(app).post(`/api/platform/workflows/${workflowId}/activate`).set("Authorization", `Bearer ${user.token}`).send({ version: 1 }).expect(200);
    const run = await request(app).post(`/api/platform/workflows/${workflowId}/runs`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "deny-run").send({ input: {} }).expect(202);
    expect(run.body.run.status).toBe("waiting_for_permission");
    const approvals = await request(app).get("/api/platform/approvals").set("Authorization", `Bearer ${user.token}`).expect(200);
    const denied = await request(app).post(`/api/platform/approvals/${approvals.body.approvals[0].id}/decision`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "deny-1").send({ decision: "denied" }).expect(200);
    expect(denied.body.run.status).toBe("cancelled"); expect(await fs.readFile(target, "utf8")).toBe("original");

    const approvedWorkflowId = await createWorkflow(app, user.token, user.assistantId, definition({ id: "update-approved", type: "file.update", name: "Approve protected file", input: { path: target, content: "approved" }, riskLevel: "low_risk_reversible", requiresApproval: true }));
    await request(app).post(`/api/platform/workflows/${approvedWorkflowId}/activate`).set("Authorization", `Bearer ${user.token}`).send({ version: 1 }).expect(200);
    await request(app).post(`/api/platform/workflows/${approvedWorkflowId}/runs`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "approve-run").send({ input: {} }).expect(202);
    const pending = await request(app).get("/api/platform/approvals").set("Authorization", `Bearer ${user.token}`).expect(200);
    const approval = pending.body.approvals.find((item: { workflowId: string; status: string }) => item.workflowId === approvedWorkflowId && item.status === "pending");
    expect(approval).toBeTruthy();
    const approved = await request(app).post(`/api/platform/approvals/${(approval as { id: string }).id}/decision`).set("Authorization", `Bearer ${user.token}`).set("Idempotency-Key", "approve-1").send({ decision: "approved" }).expect(200);
    expect(approved.body.run.status).toBe("completed"); expect(await fs.readFile(target, "utf8")).toBe("approved");
  });

  it("isolates workflows and memories across users", async () => {
    const { app } = createApp({ env }); const a = await account(app, "tenant-a"); const b = await account(app, "tenant-b");
    const workflowId = await createWorkflow(app, a.token, a.assistantId, definition({ id: "n", type: "notification.send", name: "N", input: {}, riskLevel: "read_only", requiresApproval: false }));
    await request(app).get(`/api/platform/workflows/${workflowId}/versions`).set("Authorization", `Bearer ${b.token}`).expect(404);
    await request(app).post("/api/platform/memories").set("Authorization", `Bearer ${a.token}`).send({ scope: "assistant", assistantId: a.assistantId, source: "manual", category: "preference", content: "Use concise summaries", confidence: 1, sensitivity: "normal", assistantVisibility: [a.assistantId], provenance: { confirmed: true } }).expect(201);
    const memories = await request(app).get("/api/platform/memories").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(memories.body.memories).toEqual([]);
  });

  it("exchanges a desktop bootstrap credential once and supports device revocation", async () => {
    const { app } = createApp({ env }); const user = await account(app, "desktop");
    const issued = await request(app).post(`/api/platform/assistants/${user.assistantId}/bootstrap`).set("Authorization", `Bearer ${user.token}`).send({}).expect(201);
    const exchanged = await request(app).post("/api/platform/desktop/bootstrap/exchange").send({ token: issued.body.token, installationId: "install-12345", deviceName: "Test PC" }).expect(201);
    expect(exchanged.body.sessionToken).toEqual(expect.any(String));
    await request(app).post("/api/platform/desktop/bootstrap/exchange").send({ token: issued.body.token, installationId: "install-other", deviceName: "Other" }).expect(401);
    const devices = await request(app).get("/api/platform/devices").set("Authorization", `Bearer ${user.token}`).expect(200);
    expect(devices.body.devices[0]).not.toHaveProperty("sessionTokenHash");
    await request(app).delete(`/api/platform/devices/${devices.body.devices[0].id}`).set("Authorization", `Bearer ${user.token}`).expect(200);
  });

  it("creates a fast signed assistant install intent without creating a desktop build", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "archmind-runtime-")); temporary.push(directory);
    const artifactPath = path.join(directory, "ArchMind Desktop Setup.exe");
    const bytes = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(2048, 7)]);
    await fs.writeFile(artifactPath, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const platformStore = new MemoryStore();
    const createdAt = new Date().toISOString();
    await platformStore.savePlatformState({
      ...platformStore.getPlatformState(),
      desktopRuntimeReleases: [{
        id: randomUUID(),
        version: "test-runtime-1",
        platform: "windows",
        architecture: "x64",
        channel: "development",
        status: "ready",
        artifactKey: "test/runtime.exe",
        artifactPath,
        filename: "ArchMind-Desktop-test-runtime-1-x64.exe",
        mimeType: "application/vnd.microsoft.portable-executable",
        byteSize: bytes.length,
        sha256: digest,
        signatureStatus: "unsigned-dev",
        minimumApiVersion: "0.1.0",
        manifestSchemaVersion: 1,
        createdAt,
        publishedAt: createdAt
      }]
    });
    const { app } = createApp({ env, store: platformStore, platformStore });
    const user = await account(app, "fast-install");
    const first = await request(app)
      .post(`/api/platform/assistants/${user.assistantId}/install-intents`)
      .set("Authorization", `Bearer ${user.token}`)
      .set("Idempotency-Key", "fast-install-1")
      .send({ platform: "windows", architecture: "x64" })
      .expect(201);
    expect(first.body.nextAction).toBe("download_runtime");
    expect(first.body.runtime.sha256).toBe(digest);
    expect(first.body.downloadAuthorization.url).toContain(first.body.installIntentId);
    expect(platformStore.getPlatformState().desktopBuilds).toHaveLength(0);
    expect(platformStore.getPlatformState().assistantSnapshots[0].signature).toEqual(expect.any(String));

    const replay = await request(app)
      .post(`/api/platform/assistants/${user.assistantId}/install-intents`)
      .set("Authorization", `Bearer ${user.token}`)
      .set("Idempotency-Key", "fast-install-1")
      .send({ platform: "windows", architecture: "x64" })
      .expect(200);
    expect(replay.body.installIntentId).toBe(first.body.installIntentId);
    expect(platformStore.getPlatformState().assistantInstallIntents).toHaveLength(1);

    const download = await request(app)
      .get(first.body.downloadAuthorization.url)
      .set("Authorization", `Bearer ${user.token}`)
      .expect(200);
    expect(download.headers["x-archmind-runtime-sha256"]).toBe(digest);
    expect(download.headers["content-disposition"]).toContain("attachment");
  });

  it("publishes an immutable safe package, blocks nested secrets, and grants a free entitlement", async () => {
    const { app } = createApp({ env }); const user = await account(app, "publisher"); const consumer = await account(app, "consumer");
    const created = await request(app).post(`/api/platform/assistants/${user.assistantId}/packages`).set("Authorization", `Bearer ${user.token}`).send({ productName: "Safe Helper", description: "A packaged assistant", publisherName: "Test Publisher", category: "productivity", pricingType: "free" }).expect(201);
    const packageId = created.body.package.id as string;
    await request(app).post(`/api/platform/packages/${packageId}/publish`).set("Authorization", `Bearer ${user.token}`).send({ releaseNotes: "Unsafe", manifest: { assistant: { oauthToken: "must-not-ship" } } }).expect(400);
    const published = await request(app).post(`/api/platform/packages/${packageId}/publish`).set("Authorization", `Bearer ${user.token}`).send({ releaseNotes: "First release", manifest: { assistant: { name: "Safe Helper", instructions: "Help safely" }, workflows: [] } }).expect(201);
    expect(published.body.version.version).toBe(1);
    expect(published.body.version.checksum).toMatch(/^[a-f0-9]{64}$/);
    const entitlement = await request(app).post(`/api/platform/packages/${packageId}/acquire`).set("Authorization", `Bearer ${consumer.token}`).set("Idempotency-Key", "acquire-1").expect(201);
    expect(entitlement.body.entitlement.status).toBe("active");
    const bootstrap = await request(app).post(`/api/platform/assistants/${user.assistantId}/bootstrap`).set("Authorization", `Bearer ${consumer.token}`).send({ packageId }).expect(201);
    expect(bootstrap.body.token).toEqual(expect.any(String));
  });

  it("creates a protected desktop installer build request with pollable status", async () => {
    const platformStore = new MemoryStore();
    const { app } = createApp({ env, store: platformStore, platformStore }); const user = await account(app, "installer"); const other = await account(app, "installer-other");
    const created = await request(app)
      .post("/api/platform/desktop/builds")
      .set("Authorization", `Bearer ${user.token}`)
      .set("Idempotency-Key", "desktop-build-1")
      .send({ assistantId: user.assistantId, platform: "win32", architecture: "x64" })
      .expect(202);
    expect(created.body.downloadToken).toEqual(expect.any(String));
    expect(created.body.build.status).toBe("queued");
    expect(created.body.build.appId).toContain(user.assistantId.replace(/-/g, "").slice(0, 8));
    expect(created.body.build.protocol).toContain(user.assistantId.replace(/-/g, "").slice(0, 8));

    const duplicate = await request(app)
      .post("/api/platform/desktop/builds")
      .set("Authorization", `Bearer ${user.token}`)
      .set("Idempotency-Key", "desktop-build-1")
      .send({ assistantId: user.assistantId, platform: "win32", architecture: "x64" })
      .expect(200);
    expect(duplicate.body.reused).toBe(true);
    expect(duplicate.body.build.id).toBe(created.body.build.id);
    expect(platformStore.getPlatformState().bootstrapTokens.filter((token) => token.assistantId === user.assistantId)).toHaveLength(0);

    const status = await request(app).get(`/api/platform/desktop/builds/${created.body.build.id}`).set("Authorization", `Bearer ${user.token}`).expect(200);
    expect(status.body.build.assistantId).toBe(user.assistantId);
    expect(status.body.build.status).toBe("queued");

    const list = await request(app).get(`/api/platform/desktop/builds?assistantId=${user.assistantId}`).set("Authorization", `Bearer ${user.token}`).expect(200);
    expect(list.body.builds[0].id).toBe(created.body.build.id);

    await request(app)
      .get(`/api/platform/desktop/builds/${created.body.build.id}/download?token=${created.body.downloadToken}`)
      .set("Authorization", `Bearer ${user.token}`)
      .expect(409);
    const secondAssistant = await request(app)
      .post("/api/assistants")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ name: "Study Coach Test", systemPrompt: "Coach study habits.", tone: "professional", isPublic: false, model: "openrouter/auto", temperature: 0.2, icon: "BookOpen", color: "#16A34A" })
      .expect(201);
    const secondBuild = await request(app)
      .post("/api/platform/desktop/builds")
      .set("Authorization", `Bearer ${user.token}`)
      .set("Idempotency-Key", "desktop-build-2")
      .send({ assistantId: secondAssistant.body.assistant.id, platform: "win32", architecture: "x64" })
      .expect(202);
    expect(secondBuild.body.build.productName).toBe("Study Coach Test");
    expect(secondBuild.body.build.assistantId).toBe(secondAssistant.body.assistant.id);
    expect(secondBuild.body.build.appId).not.toBe(created.body.build.appId);
    expect(secondBuild.body.build.protocol).not.toBe(created.body.build.protocol);
    expect(secondBuild.body.build.appId).toContain(secondAssistant.body.assistant.id.replace(/-/g, "").slice(0, 8));
    await request(app).get(`/api/platform/desktop/builds/${created.body.build.id}`).set("Authorization", `Bearer ${other.token}`).expect(404);
    await request(app).post("/api/platform/desktop/builds").set("Authorization", `Bearer ${other.token}`).set("Idempotency-Key", "other-build-1").send({ assistantId: user.assistantId, platform: "win32", architecture: "x64" }).expect(404);
  });
});
