import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PlatformStateStore } from "../db/platform-store";
import type {
  ApprovalRequestRecord, AuditEventRecord, MemoryRecord, PermissionGrantRecord, PlatformState,
  UndoRecord, WorkflowAction, WorkflowDefinition, WorkflowRecord, WorkflowRunRecord, WorkflowStepRecord,
  WorkflowVersionRecord
} from "../platform-types";
import { HttpError } from "../lib/http-error";
import { actionPreview, getActionPolicy } from "./risk-policy";
import { validateWorkflow } from "./workflow-proposal";

const iso = () => new Date().toISOString();
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function canonicalJson(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).filter((key) => record[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    key,
    /token|secret|password|authorization|cookie|content/i.test(key) ? "[REDACTED]" : redact(item)
  ]));
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

}
