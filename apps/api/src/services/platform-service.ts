import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PlatformStateStore } from "../db/platform-store";
import type {
  ApprovalRequestRecord, AssistantInstallIntentRecord, AssistantPackageRecord, AssistantSnapshotRecord,
  AuditEventRecord, BootstrapTokenRecord, DesktopBuildRecord, DesktopRuntimeReleaseRecord,
  DeviceAssistantRecord, DeviceSessionRecord, EntitlementRecord, InstallerDownloadRecord, LicenseRecord, MemoryRecord, PackageVersionRecord,
  PermissionGrantRecord, PlatformState, UndoRecord, WorkflowAction, WorkflowDefinition, WorkflowRecord,
  WorkflowRunRecord, WorkflowStepRecord, WorkflowVersionRecord
} from "../platform-types";
import type { AssistantRecord } from "../types";
import { HttpError } from "../lib/http-error";
import { actionPreview, getActionPolicy } from "./risk-policy";
import { validateWorkflow } from "./workflow-proposal";

const iso = () => new Date().toISOString();
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const DESKTOP_RUNTIME_VERSION = "33.2.0-archmind-web-bubble-fast.4";
const MANIFEST_SCHEMA_VERSION = 1;

function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function containsForbiddenPackageKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPackageKey);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    /token|secret|api.?key|conversation|user.?memory|local.?path|execution.?log|oauth|credential/i.test(key) || containsForbiddenPackageKey(item)
  );
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    /token|secret|password|authorization|cookie|content/i.test(key) ? "[REDACTED]" : redact(item)
  ]));
}

function safeAppSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "assistant";
}

function brandingHash(input: { productName: string; appIcon?: string; color?: string }) {
  return sha256(JSON.stringify(input));
}

function assistantStableId(ownerId: string, assistantId: string) {
  return `${assistantId.replace(/-/g, "").slice(0, 8)}${sha256(`${ownerId}:${assistantId}`).slice(0, 8)}`;
}

function normalizeDisplayName(value: string) {
  const normalized = value.replace(/[\u0000-\u001f<>:"/\\|?*]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) throw new HttpError(400, "Assistant name is required for installation.", "ASSISTANT_NAME_INVALID");
  return normalized.slice(0, 120);
}

function manifestSigningKey() {
  return process.env.ARCHMIND_MANIFEST_SIGNING_SECRET ?? process.env.JWT_ACCESS_SECRET ?? "development-manifest-signing-key";
}

function signManifestDigest(digest: string) {
  return createHash("sha256").update(`${manifestSigningKey()}:${digest}`).digest("base64url");
}

function rotateInstallDownloadToken(intent: AssistantInstallIntentRecord, downloadToken: string) {
  const nextHash = sha256(downloadToken);
  intent.downloadTokenHashes = Array.from(new Set([...(intent.downloadTokenHashes ?? []), intent.downloadTokenHash, nextHash])).slice(-5);
  intent.downloadTokenHash = nextHash;
}

function runtimeArtifactKey(version: string, platform: string, architecture: string) {
  return `desktop-runtime/${version}/${platform}/${architecture}/ArchMind-Desktop-${version}-${architecture}.exe`;
}

export class PlatformService {
  constructor(private store: PlatformStateStore) {}

  private async state() { return this.store.getPlatformState(); }
  private async save(state: PlatformState) { await this.store.savePlatformState(state); }

  private async audit(input: Omit<AuditEventRecord, "id" | "createdAt" | "previousHash" | "hash">) {
    const state = await this.state();
    const ownerEvents = state.auditEvents.filter((event) => event.ownerId === input.ownerId);
    const previous = ownerEvents.find((event) => !ownerEvents.some((candidate) => candidate.previousHash === event.hash))?.hash ?? "GENESIS";
    const createdAt = iso();
    const eventWithoutHash = { ...input, details: redact(input.details) as Record<string, unknown>, preview: redact(input.preview) as Record<string, unknown> | undefined, id: randomUUID(), createdAt, previousHash: previous };
    const event: AuditEventRecord = { ...eventWithoutHash, hash: sha256(previous + canonicalJson(eventWithoutHash)) };
    state.auditEvents.push(event);
    await this.save(state);
    return event;
  }

  async verifyAuditChain(ownerId: string) {
    let previous = "GENESIS";
    const remaining = (await this.state()).auditEvents.filter((item) => item.ownerId === ownerId);
    while (remaining.length) {
      const index = remaining.findIndex((event) => event.previousHash === previous);
      if (index < 0) return false;
      const [event] = remaining.splice(index, 1);
      if (!event) return false;
      const { hash, ...withoutHash } = event;
      if (sha256(previous + canonicalJson(withoutHash)) !== hash) return false;
      previous = hash;
    }
    return true;
  }

  async listWorkflows(ownerId: string, assistantId: string) {
    return (await this.state()).workflows.filter((item) => item.ownerId === ownerId && item.assistantId === assistantId && item.status !== "deleted");
  }

  async createWorkflow(ownerId: string, assistantId: string, input: { name: string; purpose: string; definition: WorkflowDefinition }) {
    const validation = validateWorkflow(input.definition);
    if (!validation.valid) throw new HttpError(400, validation.errors.join(" "), "WORKFLOW_INVALID");
    const state = await this.state();
    const createdAt = iso();
    const workflow: WorkflowRecord = { id: randomUUID(), ownerId, assistantId, name: input.name, purpose: input.purpose, status: "draft", createdVersion: 1, createdAt, updatedAt: createdAt };
    const version: WorkflowVersionRecord = { id: randomUUID(), workflowId: workflow.id, version: 1, definition: input.definition, validation, createdBy: ownerId, createdAt };
    state.workflows.push(workflow);
    state.workflowVersions.push(version);
    await this.save(state);
    await this.audit({ ownerId, assistantId, workflowId: workflow.id, actionType: "workflow.created", riskLevel: "read_only", status: "success", details: { version: 1 }, traceId: randomUUID() });
    return { workflow, version };
  }

  async getWorkflow(ownerId: string, workflowId: string) {
    const workflow = (await this.state()).workflows.find((item) => item.id === workflowId && item.ownerId === ownerId && item.status !== "deleted");
    if (!workflow) throw new HttpError(404, "Workflow not found", "WORKFLOW_NOT_FOUND");
    return workflow;
  }

  async listVersions(ownerId: string, workflowId: string) {
    await this.getWorkflow(ownerId, workflowId);
    return (await this.state()).workflowVersions.filter((item) => item.workflowId === workflowId).sort((a, b) => b.version - a.version);
  }

  async addVersion(ownerId: string, workflowId: string, definition: WorkflowDefinition) {
    await this.getWorkflow(ownerId, workflowId);
    const validation = validateWorkflow(definition);
    if (!validation.valid) throw new HttpError(400, validation.errors.join(" "), "WORKFLOW_INVALID");
    const state = await this.state();
    const workflow = state.workflows.find((item) => item.id === workflowId && item.ownerId === ownerId && item.status !== "deleted")!;
    const versionNumber = Math.max(0, ...state.workflowVersions.filter((item) => item.workflowId === workflowId).map((item) => item.version)) + 1;
    const version: WorkflowVersionRecord = { id: randomUUID(), workflowId, version: versionNumber, definition, validation, createdBy: ownerId, createdAt: iso() };
    state.workflowVersions.push(version);
    workflow.updatedAt = iso();
    await this.save(state);
    return version;
  }

  async setWorkflowStatus(ownerId: string, workflowId: string, status: "active" | "paused" | "deleted", version?: number) {
    await this.getWorkflow(ownerId, workflowId);
    const state = await this.state();
    const workflow = state.workflows.find((item) => item.id === workflowId && item.ownerId === ownerId && item.status !== "deleted")!;
    if (status === "active") {
      const latest = Math.max(...state.workflowVersions.filter((v) => v.workflowId === workflowId).map((v) => v.version));
      const selected = state.workflowVersions.find((item) => item.workflowId === workflowId && item.version === (version ?? latest));
      if (!selected) throw new HttpError(404, "Workflow version not found", "WORKFLOW_VERSION_NOT_FOUND");
      const validation = validateWorkflow(selected.definition);
      if (!validation.activationReady) throw new HttpError(409, validation.warnings.join(" "), "WORKFLOW_SETUP_INCOMPLETE");
      workflow.activeVersion = selected.version;
    }
    workflow.status = status;
    workflow.updatedAt = iso();
    await this.save(state);
    await this.audit({ ownerId, assistantId: workflow.assistantId, workflowId, actionType: `workflow.${status}`, riskLevel: "read_only", status: "success", details: { version: workflow.activeVersion }, traceId: randomUUID() });
    return workflow;
  }

  async grantPermission(ownerId: string, input: Omit<PermissionGrantRecord, "id" | "ownerId" | "createdAt">) {
    const state = await this.state();
    const grant: PermissionGrantRecord = { ...input, id: randomUUID(), ownerId, createdAt: iso() };
    state.permissionGrants.push(grant);
    await this.save(state);
    await this.audit({ ownerId, assistantId: grant.assistantId, workflowId: grant.workflowId, actionType: "permission.granted", riskLevel: "sensitive_data_access", decision: grant.mode, status: "success", details: { actionType: grant.actionType, resource: grant.resource, expiresAt: grant.expiresAt }, traceId: randomUUID() });
    return grant;
  }

  async listPermissions(ownerId: string) {
    return (await this.state()).permissionGrants.filter((item) => item.ownerId === ownerId && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
  }

  async revokePermission(ownerId: string, id: string) {
    const state = await this.state();
    const grant = state.permissionGrants.find((item) => item.id === id && item.ownerId === ownerId);
    if (!grant) throw new HttpError(404, "Permission not found", "PERMISSION_NOT_FOUND");
    grant.revokedAt = iso();
    await this.save(state);
    await this.audit({ ownerId, assistantId: grant.assistantId, workflowId: grant.workflowId, actionType: "permission.revoked", riskLevel: "sensitive_data_access", status: "success", details: { permissionId: id }, traceId: randomUUID() });
    return grant;
  }

  private resource(action: WorkflowAction) { return String(action.input.path ?? action.input.folder ?? action.input.url ?? "action"); }
  private permissionResource(action: WorkflowAction) {
    const resource = this.resource(action);
    return /^(file\.|csv\.)/.test(action.type) ? path.dirname(resource) : resource;
  }
  private hasPermission(state: PlatformState, ownerId: string, assistantId: string, workflowId: string, action: WorkflowAction) {
    const now = Date.now();
    const resource = this.resource(action);
    return state.permissionGrants.some((grant) => grant.ownerId === ownerId && !grant.revokedAt && grant.mode !== "deny" && grant.actionType === action.type &&
      (!grant.expiresAt || Date.parse(grant.expiresAt) > now) && (!grant.assistantId || grant.assistantId === assistantId) &&
      (!grant.workflowId || grant.workflowId === workflowId) && (grant.resource === "*" || resource === grant.resource || resource.startsWith(grant.resource + path.sep)));
  }

  private isPaused(state: PlatformState, ownerId: string, assistantId: string, workflowId: string) {
    const pause = state.pauseStates.find((item) => item.ownerId === ownerId);
    return Boolean(pause?.globalPaused || pause?.assistantIds.includes(assistantId) || pause?.workflowIds.includes(workflowId));
  }

  async runWorkflow(ownerId: string, workflowId: string, input: Record<string, unknown>, idempotencyKey: string) {
    const workflow = await this.getWorkflow(ownerId, workflowId);
    const state = await this.state();
    const existing = state.workflowRuns.find((item) => item.ownerId === ownerId && item.idempotencyKey === idempotencyKey);
    if (existing) return existing;
    if (workflow.status !== "active" || !workflow.activeVersion) throw new HttpError(409, "Activate this workflow before running it.", "WORKFLOW_NOT_ACTIVE");
    if (this.isPaused(state, ownerId, workflow.assistantId, workflow.id)) throw new HttpError(423, "Automation execution is paused.", "AUTOMATIONS_PAUSED");
    const version = state.workflowVersions.find((item) => item.workflowId === workflow.id && item.version === workflow.activeVersion)!;
    const createdAt = iso();
    const run: WorkflowRunRecord = { id: randomUUID(), workflowId, workflowVersion: version.version, ownerId, assistantId: workflow.assistantId, status: "validating", idempotencyKey, input, traceId: randomUUID(), createdAt, updatedAt: createdAt };
    state.workflowRuns.push(run);
    await this.save(state);
    return this.continueRun(run, version.definition, 0);
  }

  private async recordStep(state: PlatformState, run: WorkflowRunRecord, action: WorkflowAction, status: WorkflowStepRecord["status"], data: Partial<WorkflowStepRecord> = {}) {
    const existing = state.workflowSteps.find((item) => item.runId === run.id && item.actionId === action.id);
    if (existing) {
      Object.assign(existing, data, { status, updatedAt: iso() });
      return existing;
    }
    const createdAt = iso();
    const step: WorkflowStepRecord = {
      id: randomUUID(), ownerId: run.ownerId, assistantId: run.assistantId, workflowId: run.workflowId,
      runId: run.id, actionId: action.id, actionType: action.type, status, createdAt, updatedAt: createdAt, ...data
    };
    state.workflowSteps.push(step);
    return step;
  }

  private async continueRun(run: WorkflowRunRecord, definition: WorkflowDefinition, start: number, approvedActionId?: string) {
    let state = await this.state();
    let activeRun = state.workflowRuns.find((item) => item.id === run.id && item.ownerId === run.ownerId) ?? run;
    activeRun.status = "running";
    activeRun.updatedAt = iso();
    await this.save(state);
    const results: unknown[] = Array.isArray(activeRun.output?.results) ? activeRun.output.results as unknown[] : [];
    for (let index = start; index < definition.actions.length; index++) {
      state = await this.state();
      activeRun = state.workflowRuns.find((item) => item.id === run.id && item.ownerId === run.ownerId) ?? activeRun;
      const action = definition.actions[index]!;
      const policy = getActionPolicy(action.type);
      const preview = actionPreview(action);
      if (policy.riskLevel === "blocked") {
        activeRun.status = "failed";
        activeRun.error = "Blocked action";
        await this.recordStep(state, activeRun, action, "failed", { preview, error: activeRun.error });
        await this.save(state);
        break;
      }
      if ((definition.approvalPolicy === "always_ask" || policy.approvalRequired) && action.id !== approvedActionId && !this.hasPermission(state, activeRun.ownerId, activeRun.assistantId, activeRun.workflowId, action)) {
        const approval: ApprovalRequestRecord = { id: randomUUID(), ownerId: activeRun.ownerId, assistantId: activeRun.assistantId, workflowId: activeRun.workflowId, runId: activeRun.id, action, preview, status: "pending", createdAt: iso() };
        state.approvals.push(approval);
        activeRun.status = "waiting_for_permission";
        activeRun.output = { results, nextActionIndex: index };
        activeRun.updatedAt = iso();
        await this.recordStep(state, activeRun, action, "waiting_for_permission", { preview });
        await this.save(state);
        await this.audit({ ownerId: activeRun.ownerId, assistantId: activeRun.assistantId, workflowId: activeRun.workflowId, runId: activeRun.id, actionType: action.type, riskLevel: policy.riskLevel, status: "waiting_for_permission", preview, details: {}, traceId: activeRun.traceId });
        return activeRun;
      }
      try {
        const result = await this.executeAction(activeRun.ownerId, action);
        results.push(result);
        await this.recordStep(state, activeRun, action, "completed", { preview, result: result as Record<string, unknown> });
      } catch (error) {
        activeRun.status = "failed";
        activeRun.error = error instanceof Error ? error.message : "Action failed";
        activeRun.updatedAt = iso();
        await this.recordStep(state, activeRun, action, "failed", { preview, error: activeRun.error });
        await this.save(state);
        return activeRun;
      }
      const actionResource = this.resource(action);
      const onceGrant = state.permissionGrants.find((grant) => grant.ownerId === activeRun.ownerId && grant.mode === "once" && !grant.revokedAt && grant.actionType === action.type &&
        (!grant.assistantId || grant.assistantId === activeRun.assistantId) && (!grant.workflowId || grant.workflowId === activeRun.workflowId) &&
        (grant.resource === "*" || actionResource === grant.resource || actionResource.startsWith(grant.resource + path.sep)));
      if (onceGrant) onceGrant.revokedAt = iso();
      await this.audit({ ownerId: activeRun.ownerId, assistantId: activeRun.assistantId, workflowId: activeRun.workflowId, runId: activeRun.id, actionType: action.type, riskLevel: policy.riskLevel, status: "completed", preview, details: { result: results[results.length - 1] }, traceId: activeRun.traceId });
    }
    state = await this.state();
    activeRun = state.workflowRuns.find((item) => item.id === run.id && item.ownerId === run.ownerId) ?? activeRun;
    if (activeRun.status !== "failed") activeRun.status = "completed";
    activeRun.output = { results };
    activeRun.updatedAt = iso();
    await this.save(state);
    return activeRun;
  }

  async respondApproval(ownerId: string, approvalId: string, decision: "approved" | "denied", idempotencyKey: string) {
    const state = await this.state();
    const approval = state.approvals.find((item) => item.id === approvalId && item.ownerId === ownerId);
    if (!approval) throw new HttpError(404, "Approval not found", "APPROVAL_NOT_FOUND");
    const run = state.workflowRuns.find((item) => item.id === approval.runId && item.ownerId === ownerId)!;
    if (approval.status !== "pending") {
      if (approval.idempotencyKey === idempotencyKey) return run;
      throw new HttpError(409, "This approval was already decided.", "APPROVAL_ALREADY_DECIDED");
    }
    approval.status = decision;
    approval.decidedBy = ownerId;
    approval.decidedAt = iso();
    approval.idempotencyKey = idempotencyKey;
    if (decision === "denied") {
      run.status = "cancelled";
      run.updatedAt = iso();
      await this.save(state);
      return run;
    }
    const grant: PermissionGrantRecord = {
      id: randomUUID(), ownerId, assistantId: approval.assistantId, workflowId: approval.workflowId,
      actionType: approval.action.type, resource: this.permissionResource(approval.action), mode: "once",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), createdAt: iso()
    };
    state.permissionGrants.push(grant);
    await this.save(state);
    await this.audit({ ownerId, assistantId: grant.assistantId, workflowId: grant.workflowId, actionType: "permission.granted", riskLevel: "sensitive_data_access", decision: grant.mode, status: "success", details: { actionType: grant.actionType, resource: grant.resource, expiresAt: grant.expiresAt }, traceId: randomUUID() });
    const version = (await this.state()).workflowVersions.find((item) => item.workflowId === run.workflowId && item.version === run.workflowVersion)!;
    return this.continueRun(run, version.definition, Number(run.output?.nextActionIndex ?? 0), approval.action.id);
  }

  async listApprovals(ownerId: string) {
    return (await this.state()).approvals.filter((item) => item.ownerId === ownerId && item.status !== "expired");
  }
  async listRuns(ownerId: string, workflowId?: string) { return (await this.state()).workflowRuns.filter((item) => item.ownerId === ownerId && (!workflowId || item.workflowId === workflowId)); }
  async listAudits(ownerId: string, limit = 50) { return (await this.state()).auditEvents.filter((item) => item.ownerId === ownerId).slice(-Math.min(limit, 200)).reverse(); }
  async listSteps(ownerId: string, runId: string) { return (await this.state()).workflowSteps.filter((item) => item.ownerId === ownerId && item.runId === runId); }

  async setPause(ownerId: string, input: { scope: "global" | "assistant" | "workflow"; id?: string; paused: boolean }) {
    const state = await this.state();
    let pause = state.pauseStates.find((item) => item.ownerId === ownerId);
    if (!pause) {
      pause = { ownerId, globalPaused: false, assistantIds: [], workflowIds: [], updatedAt: iso() };
      state.pauseStates.push(pause);
    }
    if (input.scope === "global") pause.globalPaused = input.paused;
    else {
      const key = input.scope === "assistant" ? "assistantIds" : "workflowIds";
      const values = new Set(pause[key]);
      if (input.paused && input.id) values.add(input.id);
      else if (input.id) values.delete(input.id);
      pause[key] = [...values];
    }
    pause.updatedAt = iso();
    await this.save(state);
    return pause;
  }

  private async canonicalScope(ownerId: string, actionType: string, resource: string) {
    const grants = (await this.state()).permissionGrants.filter((item) => item.ownerId === ownerId && item.actionType === actionType && !item.revokedAt && item.mode !== "deny");
    const grant = grants.find((item) => item.resource === resource || resource.startsWith(item.resource + path.sep));
    if (!grant) throw new HttpError(403, "This file is outside the approved folder.", "RESOURCE_OUT_OF_SCOPE");
    const allowed = await fs.realpath(grant.resource);
    const targetParent = await fs.realpath(path.dirname(resource));
    const relative = path.relative(allowed, targetParent);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new HttpError(403, "This file is outside the approved folder.", "RESOURCE_OUT_OF_SCOPE");
    return resource;
  }

  private async executeAction(ownerId: string, action: WorkflowAction) {
    if (action.type === "notification.send") return { notified: true, message: String(action.input.message ?? "Completed") };
    if (action.type === "file.read") { const target = String(action.input.path); await this.canonicalScope(ownerId, action.type, target); const content = await fs.readFile(target, "utf8"); return { path: target, content, sha256: sha256(content) }; }
    if (action.type === "file.create") { const target = String(action.input.path); await this.canonicalScope(ownerId, action.type, target); await fs.writeFile(target, String(action.input.content ?? ""), { flag: "wx" }); await this.addUndo(ownerId, action.type, { path: target, operation: "delete_created" }, sha256(String(action.input.content ?? ""))); return { path: target, created: true }; }
    if (action.type === "file.update") { const target = String(action.input.path); await this.canonicalScope(ownerId, action.type, target); const previous = await fs.readFile(target, "utf8"); const next = String(action.input.content ?? ""); const temp = `${target}.${randomUUID()}.tmp`; await fs.writeFile(temp, next); await fs.rename(temp, target); await this.addUndo(ownerId, action.type, { path: target, previous, operation: "restore_content" }, sha256(next)); return { path: target, sha256: sha256(next) }; }
    if (action.type === "csv.append") { const target = String(action.input.path); await this.canonicalScope(ownerId, action.type, target); const previous = await fs.readFile(target, "utf8").catch(() => ""); const row = Array.isArray(action.input.values) ? action.input.values : [action.input.values]; const line = row.map((item) => `"${String(item ?? "").replace(/"/g, '""')}"`).join(",") + "\n"; await fs.appendFile(target, line); await this.addUndo(ownerId, action.type, { path: target, previous, operation: "restore_content" }, sha256(previous + line)); return { path: target, appended: 1 }; }
    throw new HttpError(501, "This controlled action is registered but requires its production adapter.", "ACTION_ADAPTER_UNAVAILABLE");
  }

  private async addUndo(ownerId: string, actionType: string, payload: Record<string, unknown>, expectedResourceHash: string) {
    const state = await this.state();
    const record: UndoRecord = { id: randomUUID(), ownerId, auditEventId: "00000000-0000-0000-0000-000000000000", actionType, payload, expectedResourceHash, status: "available", createdAt: iso(), updatedAt: iso() };
    state.undoRecords.push(record);
    await this.save(state);
    return record;
  }

  async undo(ownerId: string, undoId: string, idempotencyKey: string) {
    const state = await this.state();
    const record = state.undoRecords.find((item) => item.id === undoId && item.ownerId === ownerId);
    if (!record) throw new HttpError(404, "Undo record not found", "UNDO_NOT_FOUND");
    if (record.status === "undone" && record.idempotencyKey === idempotencyKey) return record;
    if (record.status !== "available") throw new HttpError(409, "This action can no longer be undone automatically.", "UNDO_UNAVAILABLE");
    const target = String(record.payload.path);
    const current = await fs.readFile(target).catch(() => Buffer.from(""));
    if (sha256(current) !== record.expectedResourceHash) {
      record.status = "conflict";
      record.updatedAt = iso();
      await this.save(state);
      throw new HttpError(409, "The file changed after the action. Undo was stopped to protect newer changes.", "UNDO_CONFLICT");
    }
    if (record.payload.operation === "delete_created") await fs.unlink(target);
    else await fs.writeFile(target, String(record.payload.previous ?? ""));
    record.status = "undone";
    record.idempotencyKey = idempotencyKey;
    record.updatedAt = iso();
    await this.save(state);
    return record;
  }

  async listUndo(ownerId: string) { return (await this.state()).undoRecords.filter((item) => item.ownerId === ownerId); }

  async listMemories(ownerId: string, assistantId?: string) {
    const now = Date.now();
    return (await this.state()).memories.filter((item) => item.ownerId === ownerId && !item.deletedAt && (!item.expiresAt || Date.parse(item.expiresAt) > now) && (!assistantId || (item.scope === "user" ? item.assistantVisibility.includes(assistantId) : item.assistantId === assistantId)));
  }
  async createMemory(ownerId: string, input: Omit<MemoryRecord, "id" | "ownerId" | "createdAt" | "updatedAt">) {
    if (input.sensitivity === "highly_sensitive") throw new HttpError(400, "Highly sensitive memory requires a separate explicit confirmation flow.", "MEMORY_CONFIRMATION_REQUIRED");
    const state = await this.state();
    const createdAt = iso();
    const duplicate = state.memories.find((item) => item.ownerId === ownerId && !item.deletedAt && item.scope === input.scope && item.assistantId === input.assistantId && item.content.toLowerCase() === input.content.toLowerCase());
    if (duplicate) return duplicate;
    const memory: MemoryRecord = { ...input, id: randomUUID(), ownerId, createdAt, updatedAt: createdAt };
    state.memories.push(memory);
    await this.save(state);
    return memory;
  }
  async updateMemory(ownerId: string, id: string, updates: Partial<Pick<MemoryRecord, "content" | "category" | "assistantVisibility" | "expiresAt">>) {
    const state = await this.state();
    const memory = state.memories.find((item) => item.id === id && item.ownerId === ownerId && !item.deletedAt);
    if (!memory) throw new HttpError(404, "Memory not found", "MEMORY_NOT_FOUND");
    Object.assign(memory, updates, { updatedAt: iso() });
    await this.save(state);
    return memory;
  }
  async deleteMemory(ownerId: string, id: string) {
    const state = await this.state();
    const memory = state.memories.find((item) => item.id === id && item.ownerId === ownerId && !item.deletedAt);
    if (!memory) throw new HttpError(404, "Memory not found", "MEMORY_NOT_FOUND");
    memory.deletedAt = iso();
    memory.content = "[DELETED]";
    memory.updatedAt = iso();
    await this.save(state);
    return { deleted: true };
  }

  async createPackage(ownerId: string, assistantId: string, input: Pick<AssistantPackageRecord, "productName" | "description" | "publisherName" | "category" | "pricingType">) {
    const state = await this.state();
    const createdAt = iso();
    const item: AssistantPackageRecord = { ...input, id: randomUUID(), ownerId, assistantId, status: "draft", createdAt, updatedAt: createdAt };
    state.packages.push(item);
    await this.save(state);
    return item;
  }
  async publishPackage(ownerId: string, packageId: string, input: { releaseNotes: string; manifest: Record<string, unknown> }) {
    const state = await this.state();
    const pkg = state.packages.find((item) => item.id === packageId && item.ownerId === ownerId);
    if (!pkg) throw new HttpError(404, "Package not found", "PACKAGE_NOT_FOUND");
    if (containsForbiddenPackageKey(input.manifest)) throw new HttpError(400, "The package contains a forbidden private-data field.", "UNSAFE_PACKAGE");
    const versionNumber = Math.max(0, ...state.packageVersions.filter((item) => item.packageId === packageId).map((item) => item.version)) + 1;
    const version: PackageVersionRecord = { id: randomUUID(), packageId, version: versionNumber, releaseNotes: input.releaseNotes, manifest: input.manifest, checksum: sha256(JSON.stringify(input.manifest)), status: "published", createdAt: iso() };
    state.packageVersions.push(version);
    pkg.status = "published";
    pkg.currentVersion = versionNumber;
    pkg.updatedAt = iso();
    await this.save(state);
    return version;
  }
  async acquirePackage(ownerId: string, packageId: string) {
    const state = await this.state();
    const pkg = state.packages.find((item) => item.id === packageId && item.status === "published");
    if (!pkg) throw new HttpError(404, "Package not found", "PACKAGE_NOT_FOUND");
    if (!["free", "private", "invitation", "unlisted"].includes(pkg.pricingType)) throw new HttpError(503, "Paid checkout requires a configured payment provider.", "PAYMENT_PROVIDER_REQUIRED");
    if (pkg.pricingType === "private" && pkg.ownerId !== ownerId) throw new HttpError(404, "Package not found", "PACKAGE_NOT_FOUND");
    const existing = state.entitlements.find((item) => item.ownerId === ownerId && item.packageId === packageId && item.status === "active");
    if (existing) return existing;
    const entitlement: EntitlementRecord = { id: randomUUID(), ownerId, packageId, packageVersion: pkg.currentVersion!, status: "active", seats: 1, createdAt: iso() };
    const license: LicenseRecord = { id: randomUUID(), ownerId, packageId, entitlementId: entitlement.id, status: "active", seats: 1, issuedAt: entitlement.createdAt };
    state.entitlements.push(entitlement);
    state.licenses.push(license);
    await this.save(state);
    return entitlement;
  }

  async issueBootstrap(ownerId: string, assistantId: string, packageId?: string) {
    const state = await this.state();
    if (packageId) {
      const pkg = state.packages.find((item) => item.id === packageId && item.assistantId === assistantId);
      if (!pkg) throw new HttpError(404, "Package not found", "PACKAGE_NOT_FOUND");
      const ownsPackage = pkg.ownerId === ownerId;
      const licensed = state.entitlements.some((item) => item.ownerId === ownerId && item.packageId === packageId && item.status === "active" && (!item.expiresAt || Date.parse(item.expiresAt) > Date.now()));
      if (!ownsPackage && !licensed) throw new HttpError(403, "A valid license is required.", "ENTITLEMENT_REQUIRED");
    }
    const token = randomBytes(32).toString("base64url");
    const record: BootstrapTokenRecord = { id: randomUUID(), tokenHash: sha256(token), ownerId, assistantId, packageId, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), createdAt: iso() };
    state.bootstrapTokens.push(record);
    await this.save(state);
    return { token, expiresAt: record.expiresAt };
  }

  async exchangeBootstrap(token: string, input: { installationId: string; deviceName: string }) {
    const state = await this.state();
    const record = state.bootstrapTokens.find((item) => item.tokenHash === sha256(token));
    if (!record || record.usedAt || Date.parse(record.expiresAt) <= Date.now()) throw new HttpError(401, "Bootstrap credential is invalid or expired.", "BOOTSTRAP_INVALID");
    record.usedAt = iso();
    const sessionToken = randomBytes(32).toString("base64url");
    const session: DeviceSessionRecord = { id: randomUUID(), ownerId: record.ownerId, assistantId: record.assistantId, installationId: input.installationId, deviceName: input.deviceName, sessionTokenHash: sha256(sessionToken), lastSeenAt: iso(), createdAt: iso() };
    state.deviceSessions.push(session);
    await this.save(state);
    await this.audit({ ownerId: record.ownerId, assistantId: record.assistantId, actionType: "desktop.bootstrap.exchanged", riskLevel: "sensitive_data_access", status: "success", details: { installationId: input.installationId, deviceName: input.deviceName }, traceId: randomUUID() });
    return { session, sessionToken };
  }

  async authenticateDevice(sessionToken: string) {
    if (!sessionToken || sessionToken.length < 32) {
      throw new HttpError(401, "Desktop session is invalid or revoked.", "DEVICE_SESSION_INVALID");
    }
    const state = await this.state();
    const session = state.deviceSessions.find((item) => item.sessionTokenHash === sha256(sessionToken));
    if (!session || session.revokedAt) throw new HttpError(401, "Desktop session is invalid or revoked.", "DEVICE_SESSION_INVALID");
    session.lastSeenAt = iso();
    await this.save(state);
    return session;
  }

  async listDevices(ownerId: string) {
    return (await this.state()).deviceSessions.filter((item) => item.ownerId === ownerId).map(({ sessionTokenHash: _secret, ...item }) => item);
  }
  async revokeDevice(ownerId: string, id: string) {
    const state = await this.state();
    const session = state.deviceSessions.find((item) => item.id === id && item.ownerId === ownerId);
    if (!session) throw new HttpError(404, "Device not found", "DEVICE_NOT_FOUND");
    session.revokedAt = iso();
    await this.save(state);
    await this.audit({ ownerId, assistantId: session.assistantId, actionType: "desktop.device.revoked", riskLevel: "sensitive_data_access", status: "success", details: { deviceId: id }, traceId: randomUUID() });
    return session;
  }

  async listDesktopWorkflows(ownerId: string, assistantId: string) {
    const state = await this.state();
    return state.workflows
      .filter((item) => item.ownerId === ownerId && item.assistantId === assistantId && item.status === "active" && item.activeVersion)
      .map((workflow) => ({ workflow, version: state.workflowVersions.find((item) => item.workflowId === workflow.id && item.version === workflow.activeVersion) }))
      .filter((item): item is { workflow: WorkflowRecord; version: WorkflowVersionRecord } => Boolean(item.version));
  }

  async recordDesktopAudit(ownerId: string, input: { assistantId: string; workflowId?: string; runId?: string; actionType: string; status: string; details: Record<string, unknown>; preview?: Record<string, unknown>; riskLevel?: AuditEventRecord["riskLevel"] }) {
    return this.audit({ ownerId, assistantId: input.assistantId, workflowId: input.workflowId, runId: input.runId, actionType: input.actionType, riskLevel: input.riskLevel ?? "low_risk_reversible", status: input.status, preview: input.preview, details: input.details, traceId: randomUUID() });
  }

  async registerDesktopRuntimeRelease(input: Omit<DesktopRuntimeReleaseRecord, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
    const state = await this.state();
    const existing = state.desktopRuntimeReleases.find((item) =>
      item.version === input.version &&
      item.platform === input.platform &&
      item.architecture === input.architecture &&
      item.channel === input.channel
    );
    if (existing) {
      Object.assign(existing, input);
      await this.save(state);
      return existing;
    }
    const release: DesktopRuntimeReleaseRecord = { id: input.id ?? randomUUID(), createdAt: input.createdAt ?? iso(), ...input };
    state.desktopRuntimeReleases.push(release);
    await this.save(state);
    return release;
  }

  async selectReadyRuntimeRelease(input: { platform: "windows"; architecture: "x64"; channel?: "development" | "stable" }) {
    const release = (await this.state()).desktopRuntimeReleases
      .filter((item) =>
        item.platform === input.platform &&
        item.architecture === input.architecture &&
        item.status === "ready" &&
        (!input.channel || item.channel === input.channel) &&
        Boolean(item.artifactPath || item.artifactKey)
      )
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))[0];
    if (!release) throw new HttpError(503, "No compatible ArchMind Desktop runtime release is available yet.", "RUNTIME_RELEASE_UNAVAILABLE");
    return release;
  }

  private createAssistantSnapshotInState(state: PlatformState, ownerId: string, assistant: AssistantRecord) {
    const existing = state.assistantSnapshots.find((item) =>
      item.ownerId === ownerId &&
      item.assistantId === assistant.id &&
      item.assistantVersion === assistant.version &&
      item.manifestSchemaVersion === MANIFEST_SCHEMA_VERSION &&
      item.status === "published"
    );
    if (existing) return existing;

    const displayName = normalizeDisplayName(assistant.name);
    const instructionDigest = sha256(assistant.systemPrompt);
    const iconDigest = assistant.icon ? sha256(assistant.icon) : undefined;
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      assistantId: assistant.id,
      assistantVersion: assistant.version,
      displayName,
      icon: assistant.icon,
      iconDigest,
      color: assistant.color,
      instructionDigest,
      enabledTools: assistant.enabledTools ?? [],
      issuedAt: iso()
    };
    const manifestDigest = sha256(canonicalJson(manifest));
    const snapshot: AssistantSnapshotRecord = {
      id: randomUUID(),
      ownerId,
      assistantId: assistant.id,
      assistantVersion: assistant.version,
      displayName,
      icon: assistant.icon,
      iconDigest,
      instructionDigest,
      manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
      manifest,
      manifestDigest,
      signature: signManifestDigest(manifestDigest),
      signatureKeyId: process.env.ARCHMIND_MANIFEST_SIGNING_KEY_ID ?? "development-hmac-sha256",
      status: "published",
      createdAt: iso()
    };
    state.assistantSnapshots.push(snapshot);
    return snapshot;
  }

  async createAssistantInstallIntent(ownerId: string, assistant: AssistantRecord, input: { platform: "windows"; architecture: "x64"; idempotencyKey: string; runtimeChannel?: "development" | "stable"; runtimeInstalled?: boolean }) {
    const started = Date.now();
    const state = await this.state();
    const existingByKey = state.assistantInstallIntents.find((item) => item.ownerId === ownerId && item.idempotencyKey === input.idempotencyKey);
    if (existingByKey) {
      const snapshot = state.assistantSnapshots.find((item) => item.id === existingByKey.snapshotId)!;
      const runtime = state.desktopRuntimeReleases.find((item) => item.id === existingByKey.runtimeReleaseId)!;
      const claimSecret = randomBytes(32).toString("base64url");
      const downloadToken = randomBytes(32).toString("base64url");
      existingByKey.claimSecretHash = sha256(claimSecret);
      rotateInstallDownloadToken(existingByKey, downloadToken);
      existingByKey.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      existingByKey.updatedAt = iso();
      await this.save(state);
      return { intent: existingByKey, snapshot, runtime, claimSecret, downloadToken, reused: true, elapsedMs: Date.now() - started };
    }

    const snapshot = this.createAssistantSnapshotInState(state, ownerId, assistant);
    const runtime = state.desktopRuntimeReleases
      .filter((item) => item.platform === input.platform && item.architecture === input.architecture && item.status === "ready" && (!input.runtimeChannel || item.channel === input.runtimeChannel))
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))[0];
    if (!runtime) throw new HttpError(503, "No compatible ArchMind Desktop runtime release is available yet.", "RUNTIME_RELEASE_UNAVAILABLE");

    const active = state.assistantInstallIntents.find((item) =>
      item.ownerId === ownerId &&
      item.assistantId === assistant.id &&
      item.snapshotId === snapshot.id &&
      item.platform === input.platform &&
      item.architecture === input.architecture &&
      ["created", "runtime_required", "awaiting_claim"].includes(item.status) &&
      Date.parse(item.expiresAt) > Date.now()
    );
    if (active) {
      const claimSecret = randomBytes(32).toString("base64url");
      const downloadToken = randomBytes(32).toString("base64url");
      const updatedAt = iso();
      active.claimSecretHash = sha256(claimSecret);
      rotateInstallDownloadToken(active, downloadToken);
      active.expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      active.updatedAt = updatedAt;
      await this.save(state);
      return { intent: active, snapshot, runtime, claimSecret, downloadToken, reused: true, elapsedMs: Date.now() - started };
    }

    const claimSecret = randomBytes(32).toString("base64url");
    const downloadToken = randomBytes(32).toString("base64url");
    const createdAt = iso();
    const intent: AssistantInstallIntentRecord = {
      id: randomUUID(),
      ownerId,
      assistantId: assistant.id,
      snapshotId: snapshot.id,
      runtimeReleaseId: runtime.id,
      platform: input.platform,
      architecture: input.architecture,
      status: input.runtimeInstalled ? "awaiting_claim" : "runtime_required",
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: sha256(`${ownerId}:${assistant.id}:${snapshot.id}:${runtime.id}:${input.platform}:${input.architecture}`),
      claimSecretHash: sha256(claimSecret),
      downloadTokenHash: sha256(downloadToken),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      correlationId: randomUUID(),
      createdAt,
      updatedAt: createdAt
    };
    state.assistantInstallIntents.push(intent);
    await this.save(state);
    await this.audit({ ownerId, assistantId: assistant.id, actionType: "desktop.install_intent.created", riskLevel: "sensitive_data_access", status: "success", details: { intentId: intent.id, snapshotId: snapshot.id, runtimeReleaseId: runtime.id, elapsedMs: Date.now() - started }, traceId: intent.correlationId });
    return { intent, snapshot, runtime, claimSecret, downloadToken, reused: false, elapsedMs: Date.now() - started };
  }

  async verifyRuntimeDownload(ownerId: string, intentId: string, token: string) {
    const state = await this.state();
    const intent = state.assistantInstallIntents.find((item) => item.id === intentId && item.ownerId === ownerId);
    const tokenHash = sha256(token);
    if (!intent || !new Set([intent.downloadTokenHash, ...(intent.downloadTokenHashes ?? [])]).has(tokenHash) || Date.parse(intent.expiresAt) <= Date.now()) {
      throw new HttpError(403, "Desktop runtime download is not authorized.", "RUNTIME_DOWNLOAD_FORBIDDEN");
    }
    const runtime = state.desktopRuntimeReleases.find((item) => item.id === intent.runtimeReleaseId && item.status === "ready");
    if (!runtime || !runtime.artifactPath) throw new HttpError(409, "Desktop runtime artifact is unavailable.", "RUNTIME_ARTIFACT_UNAVAILABLE");
    await this.audit({ ownerId, assistantId: intent.assistantId, actionType: "desktop.runtime.download_authorized", riskLevel: "read_only", status: "success", details: { intentId: intent.id, runtimeReleaseId: runtime.id }, traceId: intent.correlationId });
    return { intent, runtime };
  }

  async claimAssistantInstallIntent(claimSecret: string, input: { installationId: string; deviceName: string }) {
    const state = await this.state();
    const intent = state.assistantInstallIntents.find((item) => item.claimSecretHash === sha256(claimSecret));
    if (!intent || Date.parse(intent.expiresAt) <= Date.now() || ["claimed", "activated", "expired", "revoked", "failed"].includes(intent.status)) {
      throw new HttpError(401, "Install intent is invalid, expired, or already claimed.", "INSTALL_INTENT_INVALID");
    }
    const snapshot = state.assistantSnapshots.find((item) => item.id === intent.snapshotId && item.ownerId === intent.ownerId);
    if (!snapshot || snapshot.signature !== signManifestDigest(snapshot.manifestDigest)) throw new HttpError(409, "Assistant snapshot integrity verification failed.", "SNAPSHOT_INVALID");

    const sessionToken = randomBytes(32).toString("base64url");
    const session: DeviceSessionRecord = {
      id: randomUUID(),
      ownerId: intent.ownerId,
      assistantId: intent.assistantId,
      installationId: input.installationId,
      deviceName: input.deviceName,
      sessionTokenHash: sha256(sessionToken),
      lastSeenAt: iso(),
      createdAt: iso()
    };
    state.deviceSessions.push(session);
    const binding: DeviceAssistantRecord = {
      id: randomUUID(),
      deviceSessionId: session.id,
      ownerId: intent.ownerId,
      assistantId: intent.assistantId,
      snapshotId: snapshot.id,
      assistantVersion: snapshot.assistantVersion,
      localProfileId: safeAppSlug(`${snapshot.displayName}-${intent.assistantId}`),
      status: "active",
      installedAt: iso(),
      lastSeenAt: iso(),
      updatedAt: iso()
    };
    state.deviceAssistants.push(binding);
    intent.status = "activated";
    intent.claimedAt = iso();
    intent.activatedAt = intent.claimedAt;
    intent.claimedDeviceId = session.id;
    intent.updatedAt = intent.claimedAt;
    await this.save(state);
    await this.audit({ ownerId: intent.ownerId, assistantId: intent.assistantId, actionType: "desktop.install_intent.claimed", riskLevel: "sensitive_data_access", status: "success", details: { intentId: intent.id, deviceSessionId: session.id, snapshotId: snapshot.id }, traceId: intent.correlationId });
    return { session, sessionToken, assistant: { snapshot, binding } };
  }

  async createDesktopBuild(ownerId: string, input: { assistantId: string; packageId?: string; platform: DesktopBuildRecord["platform"]; architecture?: DesktopBuildRecord["architecture"]; productName: string; appIcon?: string; color?: string; assistantVersion?: number; runtimeVersion?: string; idempotencyKey: string; force?: boolean }) {
    const state = await this.state();
    const runtimeVersion = input.runtimeVersion ?? DESKTOP_RUNTIME_VERSION;
    const architecture = input.architecture ?? "x64";
    const assistantVersion = input.assistantVersion ?? 1;
    const hash = brandingHash({ productName: input.productName, appIcon: input.appIcon, color: input.color });
    const existing = state.desktopBuilds.find((item) => item.ownerId === ownerId && item.assistantId === input.assistantId && item.platform === input.platform && item.architecture === architecture && item.idempotencyKey === input.idempotencyKey);
    if (existing) {
      const issued = this.issueDesktopDownloadInState(state, existing);
      await this.save(state);
      return { build: existing, downloadToken: issued, reused: true };
    }
    if (!input.force) {
      const reusable = state.desktopBuilds
        .filter((item) =>
          item.ownerId === ownerId &&
          item.assistantId === input.assistantId &&
          item.packageId === input.packageId &&
          item.platform === input.platform &&
          item.architecture === architecture &&
          item.runtimeVersion === runtimeVersion &&
          item.assistantVersion === assistantVersion &&
          item.brandingHash === hash &&
          item.status === "ready" &&
          Boolean(item.artifactPath && item.artifactSize && item.artifactSha256) &&
          Date.parse(item.expiresAt) > Date.now()
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (reusable) {
        const issued = this.issueDesktopDownloadInState(state, reusable);
        await this.save(state);
        return { build: reusable, downloadToken: issued, reused: true };
      }
    }
    const downloadToken = randomBytes(32).toString("base64url");
    const stableId = assistantStableId(ownerId, input.assistantId);
    const createdAt = iso();
    const build: DesktopBuildRecord = {
      id: randomUUID(), ownerId, assistantId: input.assistantId, packageId: input.packageId, platform: input.platform,
      architecture, status: "validating", appId: `com.archmind.assistant.${stableId}`, productName: normalizeDisplayName(input.productName),
      runtimeVersion, assistantVersion, brandingHash: hash, idempotencyKey: input.idempotencyKey,
      protocol: `archmind-assistant-${stableId}`, downloadTokenHash: sha256(downloadToken),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), createdAt, updatedAt: createdAt
    };
    const download: InstallerDownloadRecord = {
      id: randomUUID(), ownerId, buildId: build.id, status: "issued", tokenHash: build.downloadTokenHash,
      expiresAt: build.expiresAt, createdAt
    };
    if (this.store.createDesktopBuildIfAbsent) {
      const persisted = await this.store.createDesktopBuildIfAbsent(build, download);
      return { build: persisted.build, downloadToken, reused: !persisted.created };
    }
    state.desktopBuilds.push(build);
    state.installerDownloads.push(download);
    await this.save(state);
    return { build, downloadToken, reused: false };
  }

  private issueDesktopDownloadInState(state: PlatformState, build: DesktopBuildRecord) {
    const downloadToken = randomBytes(32).toString("base64url");
    const tokenHash = sha256(downloadToken);
    state.installerDownloads.push({
      id: randomUUID(), ownerId: build.ownerId, buildId: build.id, status: "issued", tokenHash,
      expiresAt: build.expiresAt, createdAt: iso()
    });
    return downloadToken;
  }

  async issueDesktopDownload(ownerId: string, buildId: string) {
    const state = await this.state();
    const build = state.desktopBuilds.find((item) => item.id === buildId && item.ownerId === ownerId);
    if (!build) throw new HttpError(404, "Desktop build not found", "DESKTOP_BUILD_NOT_FOUND");
    if (build.status !== "ready" || !build.artifactPath || !build.artifactSize || !build.artifactSha256) {
      throw new HttpError(409, "Installer is not ready.", "INSTALLER_NOT_READY");
    }
    const downloadToken = this.issueDesktopDownloadInState(state, build);
    await this.save(state);
    return { build, downloadToken };
  }

  async updateDesktopBuild(buildId: string, updates: Partial<DesktopBuildRecord>) {
    const state = await this.state();
    const build = state.desktopBuilds.find((item) => item.id === buildId);
    if (!build) throw new HttpError(404, "Desktop build not found", "DESKTOP_BUILD_NOT_FOUND");
    Object.assign(build, updates, { updatedAt: iso() });
    await this.save(state);
    return build;
  }

  async getDesktopBuildForOwner(ownerId: string, buildId: string) {
    const build = (await this.state()).desktopBuilds.find((item) => item.id === buildId && item.ownerId === ownerId);
    if (!build) throw new HttpError(404, "Desktop build not found", "DESKTOP_BUILD_NOT_FOUND");
    return build;
  }

  async listDesktopBuilds(ownerId: string, assistantId?: string) {
    return (await this.state()).desktopBuilds
      .filter((item) => item.ownerId === ownerId && (!assistantId || item.assistantId === assistantId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLatestDesktopBuild(ownerId: string, assistantId: string) {
    return (await this.listDesktopBuilds(ownerId, assistantId))[0];
  }

  async verifyDesktopDownload(ownerId: string, buildId: string, token: string) {
    const state = await this.state();
    const build = state.desktopBuilds.find((item) => item.id === buildId && item.ownerId === ownerId);
    const tokenHash = sha256(token);
    if (!build || Date.parse(build.expiresAt) <= Date.now()) throw new HttpError(403, "Installer download is not authorized.", "INSTALLER_DOWNLOAD_FORBIDDEN");
    const download = state.installerDownloads.find((item) => item.buildId === buildId && item.ownerId === ownerId && item.tokenHash === tokenHash && Date.parse(item.expiresAt) > Date.now());
    if (!download) throw new HttpError(403, "Installer download is not authorized.", "INSTALLER_DOWNLOAD_FORBIDDEN");
    if (download) {
      download.status = "downloaded";
      download.downloadedAt = iso();
      await this.save(state);
    }
    return build;
  }
}
