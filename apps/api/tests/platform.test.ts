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
  demoAuth: false, googleCallbackUrl: "http://localhost:4000/api/auth/google/callback", llmProvider: "under_development", openrouterApiKey: "sk-or-v1-mock-test-key-1234567890", openrouterDefaultModel: "nvidia/nemotron-3-ultra:free", enableAnswerVerification: false, verifyMath: false, verifyCode: false, verifyResearch: false,
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))); });

async function account(app: ReturnType<typeof createApp>["app"], suffix: string) {
  const auth = await request(app).post("/api/auth/register").send({ email: `${suffix}@example.com`, password: "password123", confirmPassword: "password123" }).expect(201);
  const token = auth.body.accessToken as string;
  const response = await request(app).post("/api/assistants").set("Authorization", `Bearer ${token}`).send({ name: `${suffix} helper`, systemPrompt: "Help safely.", tone: "professional", isPublic: false, model: "llama-3.1-8b-instant", temperature: 0.2 }).expect(201);
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
    const response = await request(app).get("/api/platform/memories").set("Authorization", `Bearer ${user.token}`).expect(503);
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




});
