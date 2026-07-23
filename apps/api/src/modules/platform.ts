import { Router } from "express";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import type { PlatformStateStore } from "../db/platform-store";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { WorkflowDefinition } from "../platform-types";
import type { AuthedRequest } from "../types";
import { PlatformService } from "../services/platform-service";
import { listActionPolicies } from "../services/risk-policy";
import { proposeWorkflow, validateWorkflow } from "../services/workflow-proposal";
import { enqueueDesktopBuild } from "../services/desktop-build-queue";
import { RagService } from "../services/rag";
import { runAssistantChat } from "../services/assistant-chat";

const workflowInput = z.object({ name: z.string().trim().min(1).max(120), purpose: z.string().trim().min(1).max(2000), definition: z.record(z.unknown()) });
const idempotency = (req: AuthedRequest) => {
  const key = req.header("Idempotency-Key")?.trim();
  if (!key || key.length > 200) throw new HttpError(400, "A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};
const workspaceRoot = path.resolve(__dirname, "..", "..", "..", "..");
const localRuntimeArtifact = path.join(workspaceRoot, "apps", "desktop", "out", "Install ArchMind Assistant.exe");
const localRuntimeManifest = path.join(workspaceRoot, ".archmind-data", "desktop-runtime", "current.json");

/** Ensure the resolved file path is within an allowed base directory to prevent path traversal. */
function assertSafeArtifactPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const allowedBases = [
    path.join(workspaceRoot, "apps", "desktop", "out"),
    path.join(workspaceRoot, ".archmind-data"),
    path.join(workspaceRoot, "apps", "api", "storage")
  ];
  if (!allowedBases.some((base) => resolved.startsWith(base + path.sep) || resolved === base)) {
    throw new HttpError(403, "Access to the requested file is denied.", "PATH_TRAVERSAL_DENIED");
  }
  return resolved;
}

type LocalRuntimeManifest = {
  version: string;
  platform: "windows";
  architecture: "x64";
  installerPath: string;
  installerName: string;
  installerSize: number;
  installerSha256: string;
  signatureStatus?: "unsigned-dev" | "signed" | "blocked";
  buildFinishedAt?: string;
};

async function sha256File(filePath: string) {
  return createHash("sha256").update(await fs.readFile(filePath)).digest("hex");
}

async function validateLocalRuntimeArtifact(filePath: string) {
  const stat = await fs.stat(filePath).catch(() => undefined);
  if (!stat?.isFile()) return undefined;
  if (stat.size < 50 * 1024 * 1024) return undefined;
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(2);
    await handle.read(header, 0, 2, 0);
    if (header.toString("ascii") !== "MZ") return undefined;
  } finally {
    await handle.close();
  }
  return { stat, sha256: await sha256File(filePath) };
}

async function readLocalRuntimeManifest() {
  const raw = await fs.readFile(localRuntimeManifest, "utf8").catch(() => undefined);
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as Partial<LocalRuntimeManifest>;
  if (!parsed.version || !parsed.installerPath || !parsed.installerName) return undefined;
  const artifact = await validateLocalRuntimeArtifact(parsed.installerPath);
  if (!artifact) return undefined;
  if (parsed.installerSize && parsed.installerSize !== artifact.stat.size) return undefined;
  if (parsed.installerSha256 && parsed.installerSha256 !== artifact.sha256) return undefined;
  return { manifest: parsed as LocalRuntimeManifest, artifact };
}

export function platformRouter(env: Env, store: MemoryStore, platformStore: PlatformStateStore = store) {
  const router = Router();
  const service = new PlatformService(platformStore);
  const rag = new RagService(env, store);
  const auth = authenticate(env, store);
  const syncPrincipal = async (req: AuthedRequest, assistantId?: string) => {
    const assistant = assistantId
      ? (store.getAssistantForUser(assistantId, req.user!.id) ??
         store.getPublicAssistantBySlug(assistantId) ??
         store.getAssistant(assistantId))
      : undefined;
    if (req.user) {
      try {
        await platformStore.ensurePlatformPrincipal?.(req.user, assistant);
      } catch (error) {
        console.warn("[Platform] syncPrincipal non-fatal warning:", error instanceof Error ? error.message : error);
      }
    }
    return assistant;
  };
  const desktopAssistantPayload = (assistantId: string, ownerId: string) => {
    const assistant = store.getAssistantForUser(assistantId, ownerId) ?? store.getAssistant(assistantId);
    if (!assistant || assistant.userId !== ownerId) return undefined;
    return {
      id: assistant.id,
      displayName: assistant.name,
      icon: assistant.icon,
      color: assistant.color,
      webUrl: `${env.appUrl.replace(/\/$/, "")}/a/${encodeURIComponent(assistant.publicSlug ?? assistant.slug ?? assistant.id)}?desktop=1`
    };
  };
  const ensureDevelopmentRuntimeRelease = async () => {
    if (env.nodeEnv === "production") return;
    const current = await readLocalRuntimeManifest();
    const artifactPath = current?.manifest.installerPath ?? localRuntimeArtifact;
    const artifact = current?.artifact ?? await validateLocalRuntimeArtifact(localRuntimeArtifact);
    if (!artifact) return;
    const runtimeVersion = current?.manifest.version ?? "33.2.0-archmind-universal-dev.1";
    const filename = current?.manifest.installerName ?? "Install ArchMind Assistant.exe";
    await service.registerDesktopRuntimeRelease({
      version: runtimeVersion,
      platform: "windows",
      architecture: "x64",
      channel: "development",
      status: "ready",
      artifactKey: current ? `local-dev/desktop-runtime/${runtimeVersion}/${filename}` : "local-dev/apps/desktop/out/Install ArchMind Assistant.exe",
      artifactPath,
      filename,
      mimeType: "application/vnd.microsoft.portable-executable",
      byteSize: artifact.stat.size,
      sha256: artifact.sha256,
      signatureStatus: current?.manifest.signatureStatus ?? "unsigned-dev",
      minimumApiVersion: "0.1.0",
      manifestSchemaVersion: 1,
      publishedAt: current?.manifest.buildFinishedAt ?? artifact.stat.mtime.toISOString()
    });
  };

  router.get("/actions", auth, (_req, res) => res.json({ actions: listActionPolicies() }));
  router.post("/workflows/propose", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const { description } = z.object({ description: z.string().trim().min(10).max(10000) }).parse(req.body);
    res.status(201).json(proposeWorkflow(description));
  }));
  router.post("/workflows/validate", auth, asyncHandler(async (req: AuthedRequest, res) => res.json(validateWorkflow(req.body.definition as WorkflowDefinition))));
  router.get("/assistants/:assistantId/workflows", auth, asyncHandler(async (req: AuthedRequest, res) => {
    await syncPrincipal(req, req.params.assistantId!);
    res.json({ workflows: await service.listWorkflows(req.user!.id, req.params.assistantId!) });
  }));
  router.post("/assistants/:assistantId/workflows", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const assistant = assertFound(await syncPrincipal(req, req.params.assistantId!), "Assistant not found");
    const parsed = workflowInput.parse(req.body);
    res.status(201).json(await service.createWorkflow(req.user!.id, assistant.id, parsed as unknown as { name: string; purpose: string; definition: WorkflowDefinition }));
  }));
  router.get("/workflows/:workflowId/versions", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ versions: await service.listVersions(req.user!.id, req.params.workflowId!) })));
  router.post("/workflows/:workflowId/versions", auth, asyncHandler(async (req: AuthedRequest, res) => res.status(201).json({ version: await service.addVersion(req.user!.id, req.params.workflowId!, req.body.definition as WorkflowDefinition) })));
  router.post("/workflows/:workflowId/activate", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ workflow: await service.setWorkflowStatus(req.user!.id, req.params.workflowId!, "active", z.object({ version: z.number().int().positive().optional() }).parse(req.body).version) })));
  router.post("/workflows/:workflowId/pause", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ workflow: await service.setWorkflowStatus(req.user!.id, req.params.workflowId!, "paused") })));
  router.delete("/workflows/:workflowId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ workflow: await service.setWorkflowStatus(req.user!.id, req.params.workflowId!, "deleted") })));
  router.post("/workflows/:workflowId/runs", auth, asyncHandler(async (req: AuthedRequest, res) => res.status(202).json({ run: await service.runWorkflow(req.user!.id, req.params.workflowId!, z.record(z.unknown()).parse(req.body.input ?? {}), idempotency(req)) })));
  router.get("/workflows/:workflowId/runs", auth, asyncHandler(async (req: AuthedRequest, res) => { await service.getWorkflow(req.user!.id, req.params.workflowId!); res.json({ runs: await service.listRuns(req.user!.id, req.params.workflowId!) }); }));
  router.get("/runs/:runId/steps", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ steps: await service.listSteps(req.user!.id, req.params.runId!) })));

  router.get("/approvals", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ approvals: await service.listApprovals(req.user!.id) })));
  router.post("/approvals/:approvalId/decision", auth, asyncHandler(async (req: AuthedRequest, res) => { const { decision } = z.object({ decision: z.enum(["approved", "denied"]) }).parse(req.body); res.json({ run: await service.respondApproval(req.user!.id, req.params.approvalId!, decision, idempotency(req)) }); }));
  router.get("/permissions", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ permissions: await service.listPermissions(req.user!.id) })));
  router.post("/permissions", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = z.object({ assistantId: z.string().uuid().optional(), workflowId: z.string().uuid().optional(), actionType: z.string().min(1), resource: z.string().min(1).max(2048), mode: z.enum(["once", "workflow", "assistant", "resource", "until", "deny"]), expiresAt: z.string().datetime().optional() }).parse(req.body);
    await syncPrincipal(req, parsed.assistantId);
    if (parsed.workflowId) await service.getWorkflow(req.user!.id, parsed.workflowId);
    res.status(201).json({ permission: await service.grantPermission(req.user!.id, parsed) });
  }));
  router.delete("/permissions/:permissionId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ permission: await service.revokePermission(req.user!.id, req.params.permissionId!) })));
  router.get("/audit", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ events: await service.listAudits(req.user!.id, Number(req.query.limit ?? 50)), chainValid: await service.verifyAuditChain(req.user!.id) })));
  router.get("/undo", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ undo: await service.listUndo(req.user!.id) })));
  router.post("/undo/:undoId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ undo: await service.undo(req.user!.id, req.params.undoId!, idempotency(req)) })));
  router.post("/pause", auth, asyncHandler(async (req: AuthedRequest, res) => { const parsed = z.object({ scope: z.enum(["global", "assistant", "workflow"]), id: z.string().uuid().optional(), paused: z.boolean() }).parse(req.body); if (parsed.scope !== "global" && !parsed.id) throw new HttpError(400, "An assistant or workflow ID is required.", "SCOPE_ID_REQUIRED"); if (parsed.scope === "assistant") assertFound(store.getAssistantForUser(parsed.id!, req.user!.id), "Assistant not found"); if (parsed.scope === "workflow") await service.getWorkflow(req.user!.id, parsed.id!); res.json({ pause: await service.setPause(req.user!.id, parsed) }); }));

  router.get("/memories", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ memories: await service.listMemories(req.user!.id, typeof req.query.assistantId === "string" ? req.query.assistantId : undefined) })));
  router.post("/memories", auth, asyncHandler(async (req: AuthedRequest, res) => { const parsed = z.object({ scope: z.enum(["conversation", "assistant", "user", "workflow", "session"]), assistantId: z.string().uuid().optional(), workflowId: z.string().uuid().optional(), source: z.string().min(1), category: z.string().min(1), content: z.string().trim().min(1).max(5000), confidence: z.number().min(0).max(1).default(1), sensitivity: z.enum(["normal", "sensitive", "highly_sensitive"]).default("normal"), assistantVisibility: z.array(z.string().uuid()).default([]), provenance: z.record(z.unknown()).default({}), expiresAt: z.string().datetime().optional(), lastUsedAt: z.string().datetime().optional(), deletedAt: z.string().datetime().optional() }).parse(req.body); if (parsed.assistantId) assertFound(store.getAssistantForUser(parsed.assistantId, req.user!.id), "Assistant not found"); res.status(201).json({ memory: await service.createMemory(req.user!.id, parsed) }); }));
  router.patch("/memories/:memoryId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ memory: await service.updateMemory(req.user!.id, req.params.memoryId!, z.object({ content: z.string().trim().min(1).max(5000).optional(), category: z.string().min(1).optional(), assistantVisibility: z.array(z.string().uuid()).optional(), expiresAt: z.string().datetime().optional() }).parse(req.body)) })));
  router.delete("/memories/:memoryId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json(await service.deleteMemory(req.user!.id, req.params.memoryId!))));
  router.get("/memories/export", auth, asyncHandler(async (req: AuthedRequest, res) => { res.setHeader("Content-Disposition", "attachment; filename=archmind-memories.json"); res.json({ exportedAt: new Date().toISOString(), memories: await service.listMemories(req.user!.id) }); }));

  router.post("/assistants/:assistantId/packages", auth, asyncHandler(async (req: AuthedRequest, res) => { const assistant = assertFound(store.getAssistantForUser(req.params.assistantId!, req.user!.id), "Assistant not found"); const parsed = z.object({ productName: z.string().min(1).max(120), description: z.string().max(2000), publisherName: z.string().min(1).max(120), category: z.string().min(1).max(80), pricingType: z.enum(["private", "invitation", "free", "one_time", "subscription", "organization", "trial", "unlisted"]) }).parse(req.body); res.status(201).json({ package: await service.createPackage(req.user!.id, assistant.id, parsed) }); }));
  router.post("/packages/:packageId/publish", auth, asyncHandler(async (req: AuthedRequest, res) => { const parsed = z.object({ releaseNotes: z.string().max(5000), manifest: z.record(z.unknown()) }).parse(req.body); res.status(201).json({ version: await service.publishPackage(req.user!.id, req.params.packageId!, parsed) }); }));
  router.post("/packages/:packageId/acquire", auth, asyncHandler(async (req: AuthedRequest, res) => { idempotency(req); res.status(201).json({ entitlement: await service.acquirePackage(req.user!.id, req.params.packageId!) }); }));
  router.post("/assistants/:assistantId/bootstrap", auth, asyncHandler(async (req: AuthedRequest, res) => { const { packageId } = z.object({ packageId: z.string().uuid().optional() }).parse(req.body); if (!packageId) assertFound(store.getAssistantForUser(req.params.assistantId!, req.user!.id), "Assistant not found"); res.status(201).json(await service.issueBootstrap(req.user!.id, req.params.assistantId!, packageId)); }));
  router.post("/assistants/:assistantId/install-intents", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = z.object({
      platform: z.enum(["windows"]).default("windows"),
      architecture: z.enum(["x64"]).default("x64"),
      runtimeInstalled: z.boolean().optional()
    }).parse(req.body ?? {});
    const assistant = assertFound(await syncPrincipal(req, req.params.assistantId!), "Assistant not found");
    await ensureDevelopmentRuntimeRelease();
    const created = await service.createAssistantInstallIntent(req.user!.id, assistant, {
      platform: parsed.platform,
      architecture: parsed.architecture,
      idempotencyKey: idempotency(req),
      runtimeChannel: env.nodeEnv === "production" ? "stable" : "development",
      runtimeInstalled: Boolean(parsed.runtimeInstalled)
    });
    const protocolLaunch = created.claimSecret
      ? `archmind://install-assistant?intent=${encodeURIComponent(created.claimSecret)}`
      : null;
    res.status(created.reused ? 200 : 201).json({
      installIntentId: created.intent.id,
      assistantId: assistant.id,
      snapshotId: created.snapshot.id,
      snapshotVersion: created.snapshot.assistantVersion,
      nextAction: parsed.runtimeInstalled ? "open_runtime" : "download_runtime",
      runtime: {
        id: created.runtime.id,
        version: created.runtime.version,
        platform: created.runtime.platform,
        architecture: created.runtime.architecture,
        required: !parsed.runtimeInstalled,
        byteSize: created.runtime.byteSize,
        sha256: created.runtime.sha256,
        signatureStatus: created.runtime.signatureStatus
      },
      downloadAuthorization: created.downloadToken ? { token: created.downloadToken, url: `/api/platform/install-intents/${created.intent.id}/runtime-download?token=${encodeURIComponent(created.downloadToken)}` } : null,
      protocolLaunch,
      expiresAt: created.intent.expiresAt,
      correlationId: created.intent.correlationId,
      elapsedMs: created.elapsedMs
    });
  }));
  router.get("/install-intents/:intentId/runtime-download", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const token = z.string().min(32).parse(req.query.token);
    const { intent, runtime } = await service.verifyRuntimeDownload(req.user!.id, req.params.intentId!, token);
    const snapshot = (await platformStore.getPlatformState()).assistantSnapshots.find((item) => item.id === intent.snapshotId && item.ownerId === req.user!.id);
    const assistantName = snapshot?.displayName ?? "Assistant";
    const safeName = `Install ${assistantName.replace(/[^a-z0-9 ._-]+/gi, "").trim().slice(0, 80) || "ArchMind Assistant"}.exe`;
    res.setHeader("Content-Type", runtime.mimeType);
    res.setHeader("Content-Length", String(runtime.byteSize));
    res.setHeader("Content-Disposition", `attachment; filename="${safeName.replace(/"/g, "")}"`);
    res.setHeader("ETag", `"sha256-${runtime.sha256}"`);
    res.setHeader("X-ArchMind-Runtime-Version", runtime.version);
    res.setHeader("X-ArchMind-Runtime-Sha256", runtime.sha256);
    res.setHeader("X-ArchMind-Install-Intent-Id", intent.id);
    res.sendFile(assertSafeArtifactPath(runtime.artifactPath!));
  }));
  router.post("/desktop/install-intents/claim", asyncHandler(async (req, res) => {
    const parsed = z.object({ intent: z.string().min(32), installationId: z.string().min(8).max(200), deviceName: z.string().min(1).max(200) }).parse(req.body);
    const claimed = await service.claimAssistantInstallIntent(parsed.intent, parsed);
    res.status(201).json({
      ...claimed,
      assistant: {
        ...claimed.assistant,
        ...desktopAssistantPayload(claimed.session.assistantId, claimed.session.ownerId)
      }
    });
  }));
  router.post("/desktop/bootstrap/exchange", asyncHandler(async (req, res) => {
    const parsed = z.object({ token: z.string().min(32), installationId: z.string().min(8).max(200), deviceName: z.string().min(1).max(200) }).parse(req.body);
    const exchanged = await service.exchangeBootstrap(parsed.token, parsed);
    res.status(201).json({
      ...exchanged,
      assistant: desktopAssistantPayload(exchanged.session.assistantId, exchanged.session.ownerId)
    });
  }));
  router.get("/desktop/session", asyncHandler(async (req, res) => {
    const token = String(req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const session = await service.authenticateDevice(token);
    res.json({
      session: { id: session.id, ownerId: session.ownerId, assistantId: session.assistantId, installationId: session.installationId, deviceName: session.deviceName, revokedAt: session.revokedAt, lastSeenAt: session.lastSeenAt },
      assistant: desktopAssistantPayload(session.assistantId, session.ownerId)
    });
  }));
  router.get("/desktop/workflows", asyncHandler(async (req, res) => { const token = String(req.header("Authorization") ?? "").replace(/^Bearer\s+/i, ""); const session = await service.authenticateDevice(token); res.json({ workflows: await service.listDesktopWorkflows(session.ownerId, session.assistantId) }); }));
  router.post("/desktop/audit", asyncHandler(async (req, res) => { const token = String(req.header("Authorization") ?? "").replace(/^Bearer\s+/i, ""); const session = await service.authenticateDevice(token); const parsed = z.object({ workflowId: z.string().uuid().optional(), runId: z.string().uuid().optional(), actionType: z.string().min(1), status: z.string().min(1), preview: z.record(z.unknown()).optional(), details: z.record(z.unknown()).default({}) }).parse(req.body); res.status(201).json({ event: await service.recordDesktopAudit(session.ownerId, { assistantId: session.assistantId, ...parsed }) }); }));
  router.post("/desktop/chat", asyncHandler(async (req, res) => {
    const token = String(req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const session = await service.authenticateDevice(token);
    const parsed = z.object({
      message: z.string().trim().min(1).max(10000),
      conversationId: z.string().uuid().optional(),
      sessionId: z.string().optional(),
      responseLength: z.string().default("balanced"),
      language: z.string().default("English")
    }).parse(req.body);
    const result = await runAssistantChat({
      env,
      store,
      rag,
      assistantId: session.assistantId,
      userId: session.ownerId,
      message: parsed.message,
      conversationId: parsed.conversationId,
      sessionId: parsed.sessionId ?? session.id,
      responseLength: parsed.responseLength,
      language: parsed.language
    });
    await service.recordDesktopAudit(session.ownerId, {
      assistantId: session.assistantId,
      actionType: "desktop.chat.message",
      status: "completed",
      details: { conversationId: result.conversation.id, tokensUsed: result.tokensUsed, sourceCount: result.chunks.length }
    });
    res.status(201).json({
      conversationId: result.conversation.id,
      answer: result.answer,
      sources: result.chunks.map((chunk) => ({ sourceName: chunk.sourceName, page: chunk.page, similarity: chunk.similarity }))
    });
  }));
  router.get("/devices", auth, asyncHandler(async (req: AuthedRequest, res) => { await syncPrincipal(req); res.json({ devices: await service.listDevices(req.user!.id) }); }));
  router.delete("/devices/:deviceId", auth, asyncHandler(async (req: AuthedRequest, res) => res.json({ device: await service.revokeDevice(req.user!.id, req.params.deviceId!) })));
  router.get("/desktop/builds", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const rawAssistantId = typeof req.query.assistantId === "string" ? req.query.assistantId : undefined;
    const resolvedAssistant = rawAssistantId
      ? store.getAssistantForUser(rawAssistantId, req.user!.id) ?? store.getPublicAssistantBySlug(rawAssistantId)
      : undefined;
    const assistantId = resolvedAssistant?.id ?? rawAssistantId;
    await syncPrincipal(req, assistantId);
    res.json({ builds: await service.listDesktopBuilds(req.user!.id, assistantId) });
  }));
  router.get("/desktop/builds/:buildId", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const build = await service.getDesktopBuildForOwner(req.user!.id, req.params.buildId!);
    res.json({ build });
  }));
  router.post("/desktop/builds", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const parsed = z.object({ assistantId: z.string().min(1), platform: z.enum(["win32", "darwin", "linux"]).default("win32"), architecture: z.enum(["x64", "arm64"]).default("x64"), packageId: z.string().optional(), force: z.boolean().optional() }).parse(req.body);
    await syncPrincipal(req);
    const assistant = parsed.packageId
      ? assertFound(store.getAssistant(parsed.assistantId), "Assistant not found")
      : assertFound(
          store.getAssistantForUser(parsed.assistantId, req.user!.id) ??
          store.getPublicAssistantBySlug(parsed.assistantId),
          "Assistant not found"
        );
    if (assistant.userId === req.user!.id) await platformStore.ensurePlatformPrincipal?.(req.user!, assistant);
    if (env.nodeEnv === "production" && !env.redisUrl) throw new HttpError(503, "Redis is required for production desktop builds.", "REDIS_REQUIRED");
    const buildIdempotencyKey = req.header("Idempotency-Key")?.trim();
    if (!buildIdempotencyKey || buildIdempotencyKey.length > 200) throw new HttpError(400, "A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED");
    const created = await service.createDesktopBuild(req.user!.id, { assistantId: assistant.id, packageId: parsed.packageId, platform: parsed.platform, architecture: parsed.architecture, productName: assistant.name, color: assistant.color, appIcon: assistant.icon, assistantVersion: assistant.version, idempotencyKey: buildIdempotencyKey, force: Boolean(parsed.force) });
    let queue: Awaited<ReturnType<typeof enqueueDesktopBuild>> | undefined;
    if (!created.reused) {
      try {
        queue = await enqueueDesktopBuild(env, platformStore, {
          build: created.build,
          apiUrl: env.appUrl.replace(/:\d+$/, `:${env.port}`),
          assistant: {
            id: assistant.id,
            name: assistant.name,
            color: assistant.color,
            icon: assistant.icon,
            instructions: assistant.systemPrompt,
            webUrl: `${env.appUrl.replace(/\/$/, "")}/a/${encodeURIComponent(assistant.publicSlug ?? assistant.slug ?? assistant.id)}?desktop=1`
          }
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message.slice(0, 1000) : "Desktop build could not be queued.";
        const failedBuild = await service.updateDesktopBuild(created.build.id, {
          status: "failed",
          error: errorMsg
        });
        return res.status(200).json({ build: failedBuild, downloadToken: created.downloadToken, reused: false, error: errorMsg });
      }
    }
    const build = await service.getDesktopBuildForOwner(req.user!.id, created.build.id);
    await service.recordDesktopAudit(req.user!.id, { assistantId: assistant.id, actionType: created.reused ? "desktop.build.reused" : "desktop.build.queued", status: build.status, details: { buildId: build.id, platform: build.platform, architecture: build.architecture, queue } });
    res.status(created.reused ? 200 : 202).json({ build, downloadToken: created.downloadToken, reused: created.reused, queue });
  }));
  router.post("/desktop/builds/:buildId/download-authorization", auth, asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await service.issueDesktopDownload(req.user!.id, req.params.buildId!));
  }));
  router.get("/desktop/builds/:buildId/download", auth, asyncHandler(async (req: AuthedRequest, res) => {
    const token = z.string().min(32).parse(req.query.token);
    const build = await service.verifyDesktopDownload(req.user!.id, req.params.buildId!, token);
    if (!["ready", "downloading"].includes(build.status) || !build.artifactPath || !build.artifactSize || !build.artifactSha256) throw new HttpError(409, "Installer is not ready.", "INSTALLER_NOT_READY");
    res.setHeader("X-ArchMind-Installer-Size", String(build.artifactSize));
    res.setHeader("X-ArchMind-Installer-Sha256", build.artifactSha256);
    res.setHeader("X-ArchMind-Assistant-Id", build.assistantId);
    res.setHeader("X-ArchMind-Build-Id", build.id);
    res.download(assertSafeArtifactPath(build.artifactPath), `${build.productName.replace(/[^a-z0-9 -]+/gi, "").trim() || "ArchMind Assistant"} Setup.exe`);
  }));
  return router;
}
