import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import type { PlatformStateStore } from "../db/platform-store";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { WorkflowDefinition } from "../platform-types";
import type { AssistantRecord, AuthedRequest, AuthUser } from "../types";
import { PlatformService } from "../services/platform-service";
import { listActionPolicies } from "../services/risk-policy";
import { proposeWorkflow, validateWorkflow } from "../services/workflow-proposal";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "../services/supabase-server";

const workflowInput = z.object({ name: z.string().trim().min(1).max(120), purpose: z.string().trim().min(1).max(2000), definition: z.record(z.unknown()) });
const idempotency = (req: AuthedRequest) => {
  const key = req.header("Idempotency-Key")?.trim();
  if (!key || key.length > 200) throw new HttpError(400, "A valid Idempotency-Key header is required.", "IDEMPOTENCY_KEY_REQUIRED");
  return key;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function supabaseAssistantToRecord(row: Record<string, unknown>): AssistantRecord | undefined {
  const id = typeof row.id === "string" ? row.id : undefined;
  const userId = typeof row.user_id === "string" ? row.user_id : undefined;
  const name = typeof row.name === "string" && row.name.trim() ? row.name : undefined;
  if (!id || !userId || !name) return undefined;

  const nowIso = new Date().toISOString();
  const rawVisibility = typeof row.visibility === "string" ? row.visibility : undefined;
  const isPublic = Boolean(row.is_public) || rawVisibility === "public";
  const rawTone = typeof row.tone === "string" ? row.tone : "professional";
  const tone: AssistantRecord["tone"] = rawTone === "casual" || rawTone === "teacher" || rawTone === "custom" ? rawTone : "professional";
  const slug = typeof row.slug === "string" && row.slug.trim() ? row.slug : id;
  const publicSlug = typeof row.public_slug === "string" && row.public_slug.trim() ? row.public_slug : undefined;
  const systemPrompt =
    (typeof row.system_prompt === "string" && row.system_prompt.trim() ? row.system_prompt : undefined) ??
    (typeof row.instructions === "string" && row.instructions.trim() ? row.instructions : undefined) ??
    "You are a helpful assistant deployed on AGENTIA.";

  return {
    id,
    userId,
    createdByUserId: userId,
    name,
    slug,
    description: typeof row.description === "string" ? row.description : "",
    systemPrompt,
    tone,
    isPublic,
    visibility: isPublic ? "public" : "private",
    publicSlug,
    model: (typeof row.model === "string" && row.model.trim()) || (typeof row.model_name === "string" && row.model_name.trim()) || "auto",
    temperature: typeof row.temperature === "number" ? row.temperature : Number(row.temperature ?? 0.7) || 0.7,
    icon: typeof row.icon === "string" ? row.icon : undefined,
    color: typeof row.color === "string" ? row.color : undefined,
    starterPrompts: stringArray(row.starter_prompts ?? row.starterPrompts),
    enabledTools: stringArray(row.enabled_tools ?? row.enabledTools),
    version: typeof row.version === "number" ? row.version : Number(row.version ?? 1) || 1,
    createdAt: typeof row.created_at === "string" ? row.created_at : nowIso,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : nowIso
  };
}

function decodedBearerClaims(req: AuthedRequest): { sub?: string; email?: string } {
  const token = String(req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    return {
      sub: typeof decoded.sub === "string" ? decoded.sub : undefined,
      email: typeof decoded.email === "string" ? decoded.email : undefined
    };
  } catch {
    return {};
  }
}

export function platformRouter(env: Env, store: MemoryStore, platformStore: PlatformStateStore = store) {
  const router = Router();
  const service = new PlatformService(platformStore);
  const auth = authenticate(env, store);
  const supabase = createSupabaseServerClient();
  const useSupabase = env.nodeEnv !== "test" && isSupabaseServerConfigured();
  const platformUserForRequest = (req: AuthedRequest): AuthUser => {
    const user = req.user!;
    if (uuidPattern.test(user.id)) return user;
    const claims = decodedBearerClaims(req);
    if (!claims.sub || !uuidPattern.test(claims.sub)) return user;
    return { ...user, id: claims.sub, email: user.email || claims.email || "" };
  };
  const allowedAssistantOwnerIds = (req: AuthedRequest) => {
    const platformUser = platformUserForRequest(req);
    return Array.from(new Set([req.user!.id, platformUser.id].filter(Boolean)));
  };
  const getSupabaseAssistantForUser = async (assistantId: string, ownerIds: string[]) => {
    if (!useSupabase || !uuidPattern.test(assistantId)) return undefined;
    const { data, error } = await supabase
      .from("assistants")
      .select("*")
      .eq("id", assistantId)
      .maybeSingle();
    if (error || !data || data.deleted_at) {
      if (error) console.warn("[Platform] Supabase assistant lookup failed:", error.message);
      return undefined;
    }
    if (!ownerIds.includes(String(data.user_id))) return undefined;
    return supabaseAssistantToRecord(data);
  };
  const syncPrincipal = async (req: AuthedRequest, assistantId?: string) => {
    const platformUser = platformUserForRequest(req);
    const ownerIds = allowedAssistantOwnerIds(req);
    const rawStoreAssistant = assistantId ? store.getAssistant(assistantId) : undefined;
    const assistant = assistantId
      ? (store.getAssistantForUser(assistantId, req.user!.id) ??
         store.getAssistantForUser(assistantId, platformUser.id) ??
         store.getPublicAssistantBySlug(assistantId) ??
         (rawStoreAssistant && ownerIds.includes(rawStoreAssistant.userId) ? rawStoreAssistant : undefined) ??
         await getSupabaseAssistantForUser(assistantId, ownerIds))
      : undefined;
    if (req.user) {
      try {
        await platformStore.ensurePlatformPrincipal?.(platformUser, assistant);
      } catch (error) {
        console.warn("[Platform] syncPrincipal non-fatal warning:", error instanceof Error ? error.message : error);
      }
    }
    return assistant;
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

  return router;
}
