import fs from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolClient } from "pg";
import { emptyPlatformState, type PlatformState } from "../platform-types";
import type { PlatformStateStore } from "./platform-store";
import type { AssistantRecord, AuthUser } from "../types";

const root = path.resolve(__dirname, "..", "..", "..", "..");
const migrationsDir = path.join(root, "db", "migrations");

type Row = Record<string, unknown>;

function iso(value: unknown) {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") return JSON.parse(value) as T;
  return value as T;
}

function dbJson(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function uniqueAssistantSlug(value: string | undefined, assistantId: string) {
  const base = (value?.trim() || `assistant-${assistantId}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "assistant";
  return `${base}-${assistantId.slice(0, 8)}`;
}

async function runMigrations(client: PoolClient) {
  await client.query("create table if not exists schema_migrations(version text primary key, applied_at timestamptz not null default now())");
  const files = (await fs.readdir(migrationsDir)).filter((item) => /^\d+_.+\.sql$/.test(item)).sort();
  for (const file of files) {
    const version = file.split("_")[0]!;
    const existing = await client.query("select 1 from schema_migrations where version = $1", [version]);
    if (existing.rowCount) continue;
    await client.query(await fs.readFile(path.join(migrationsDir, file), "utf8"));
    await client.query("insert into schema_migrations(version) values($1)", [version]);
  }
}

export class PostgresPlatformStore implements PlatformStateStore {
  private pool: Pool;
  private ready?: Promise<void>;
  public memoryStore?: any;

  constructor(databaseUrl: string, options: { runMigrations?: boolean; memoryStore?: any } = {}) {
    this.memoryStore = options.memoryStore;
    const pool = new Pool({ connectionString: databaseUrl });
    this.pool = pool;
    if (options.runMigrations ?? true) {
      this.ready = (async () => {
        const client = await pool.connect();
        try {
          await client.query("begin");
          await runMigrations(client);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback").catch(() => undefined);
          throw error;
        } finally {
          client.release();
        }
      })();
    }
  }

  private async ensureReady() {
    if (this.ready) await this.ready;
  }

  async close() {
    await this.pool.end();
  }

  async ensurePlatformPrincipal(user: AuthUser, assistant?: AssistantRecord) {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const byId = await client.query("select id from users where id = $1 limit 1", [user.id]);
      if (byId.rows.length === 0) {
        const byEmail = await client.query("select id from users where lower(email) = $1 limit 1", [user.email.toLowerCase()]);
        if (byEmail.rows.length > 0) {
          await client.query("update users set id = $1, plan = $3, updated_at = now() where lower(email) = $2", [user.id, user.email.toLowerCase(), user.plan]);
        } else {
          await client.query(
            `insert into users(id, email, plan, token_usage, created_at, updated_at)
             values($1, $2, $3, 0, now(), now())
             on conflict (id) do update set email = excluded.email, plan = excluded.plan, updated_at = now()`,
            [user.id, user.email.toLowerCase(), user.plan]
          );
        }
      } else {
        await client.query(
          "update users set email = $2, plan = $3, updated_at = now() where id = $1",
          [user.id, user.email.toLowerCase(), user.plan]
        );
      }

      if (assistant) {
        const mirroredSlug = uniqueAssistantSlug(assistant.slug, assistant.id);
        const mirroredPublicSlug = assistant.isPublic && assistant.publicSlug ? uniqueAssistantSlug(assistant.publicSlug, assistant.id) : null;
        await client.query(
          `insert into assistants(id, user_id, name, description, system_prompt, tone, is_public, public_slug, model, temperature, version, created_at, slug, visibility, icon, color, starter_prompts, enabled_tools, updated_at)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           on conflict(id) do update set name=excluded.name, description=excluded.description, system_prompt=excluded.system_prompt, tone=excluded.tone, is_public=excluded.is_public, public_slug=excluded.public_slug, model=excluded.model, temperature=excluded.temperature, version=excluded.version, slug=excluded.slug, visibility=excluded.visibility, icon=excluded.icon, color=excluded.color, starter_prompts=excluded.starter_prompts, enabled_tools=excluded.enabled_tools, updated_at=excluded.updated_at`,
          [assistant.id, user.id, assistant.name, assistant.description, assistant.systemPrompt, assistant.tone, assistant.isPublic, mirroredPublicSlug, assistant.model, assistant.temperature, assistant.version, assistant.createdAt, mirroredSlug, assistant.visibility, assistant.icon, assistant.color, dbJson(assistant.starterPrompts), dbJson(assistant.enabledTools), assistant.updatedAt]
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      console.warn("[PostgresPlatformStore] ensurePlatformPrincipal non-fatal warning:", error instanceof Error ? error.message : error);
    } finally {
      client.release();
    }
  }

  async getPlatformState(): Promise<PlatformState> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      const [
        workflows, workflowVersions, workflowRuns, workflowSteps, permissionGrants, approvals, auditEvents,
        undoRecords, memories, memorySettings, pauseStates
      ] = await Promise.all([
        client.query("select * from workflows order by created_at"),
        client.query("select * from workflow_versions order by created_at"),
        client.query("select * from workflow_runs order by created_at"),
        client.query("select * from workflow_steps order by created_at"),
        client.query("select * from permission_grants order by created_at"),
        client.query("select * from approval_requests order by created_at"),
        client.query("select * from audit_events order by created_at"),
        client.query("select * from undo_records order by created_at"),
        client.query("select * from memory_records order by created_at"),
        client.query("select * from memory_settings order by updated_at"),
        client.query("select * from automation_pause_states order by updated_at")
      ]);

      return {
        workflows: workflows.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), organizationId: iso(r.organization_id), assistantId: String(r.assistant_id), name: String(r.name), purpose: String(r.purpose), status: r.status as PlatformState["workflows"][number]["status"], createdVersion: Number(r.created_version), activeVersion: r.active_version == null ? undefined : Number(r.active_version), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        workflowVersions: workflowVersions.rows.map((r: Row) => ({ id: String(r.id), workflowId: String(r.workflow_id), version: Number(r.version), definition: json(r.definition, {}) as PlatformState["workflowVersions"][number]["definition"], validation: json(r.validation, { valid: false, errors: [], warnings: [] }), createdBy: String(r.created_by), createdAt: iso(r.created_at)! })),
        workflowRuns: workflowRuns.rows.map((r: Row) => ({ id: String(r.id), workflowId: String(r.workflow_id), workflowVersion: Number(r.workflow_version), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), status: r.status as PlatformState["workflowRuns"][number]["status"], idempotencyKey: String(r.idempotency_key), input: json(r.input, {}), output: json(r.output, undefined), error: iso(r.error), traceId: String(r.trace_id), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        workflowSteps: workflowSteps.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), workflowId: String(r.workflow_id), runId: String(r.run_id), actionId: String(r.action_id), actionType: String(r.action_type), status: r.status as PlatformState["workflowSteps"][number]["status"], preview: json(r.preview, undefined), result: json(r.result, undefined), error: iso(r.error), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        permissionGrants: permissionGrants.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), assistantId: iso(r.assistant_id), workflowId: iso(r.workflow_id), actionType: String(r.action_type), resource: String(r.resource), mode: r.mode as PlatformState["permissionGrants"][number]["mode"], expiresAt: iso(r.expires_at), revokedAt: iso(r.revoked_at), createdAt: iso(r.created_at)! })),
        approvals: approvals.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), workflowId: String(r.workflow_id), runId: String(r.run_id), action: json(r.action, {}) as PlatformState["approvals"][number]["action"], preview: json(r.preview, {}), status: r.status as PlatformState["approvals"][number]["status"], decidedBy: iso(r.decided_by), decidedAt: iso(r.decided_at), idempotencyKey: iso(r.idempotency_key), createdAt: iso(r.created_at)! })),
        auditEvents: auditEvents.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), organizationId: iso(r.organization_id), assistantId: iso(r.assistant_id), workflowId: iso(r.workflow_id), runId: iso(r.run_id), actionType: String(r.action_type), riskLevel: r.risk_level as PlatformState["auditEvents"][number]["riskLevel"], decision: iso(r.decision), status: String(r.status), preview: json(r.preview, undefined), details: json(r.details, {}), traceId: String(r.trace_id), previousHash: String(r.previous_hash), hash: String(r.hash), createdAt: iso(r.created_at)! })),
        undoRecords: undoRecords.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), auditEventId: String(r.audit_event_id), actionType: String(r.action_type), payload: json(r.payload, {}), expectedResourceHash: iso(r.expected_resource_hash), status: r.status as PlatformState["undoRecords"][number]["status"], idempotencyKey: iso(r.idempotency_key), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        memories: memories.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), scope: r.scope as PlatformState["memories"][number]["scope"], assistantId: iso(r.assistant_id), workflowId: iso(r.workflow_id), source: String(r.source), category: String(r.category), content: String(r.content), confidence: Number(r.confidence), sensitivity: r.sensitivity as PlatformState["memories"][number]["sensitivity"], assistantVisibility: json(r.assistant_visibility, []), provenance: json(r.provenance, {}), expiresAt: iso(r.expires_at), lastUsedAt: iso(r.last_used_at), deletedAt: iso(r.deleted_at), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        memorySettings: memorySettings.rows.map((r: Row) => ({ ownerId: String(r.owner_id), assistantId: iso(r.assistant_id), memoryEnabled: Boolean(r.memory_enabled), defaultSensitivity: r.default_sensitivity as PlatformState["memorySettings"][number]["defaultSensitivity"], retentionDays: r.retention_days == null ? undefined : Number(r.retention_days), updatedAt: iso(r.updated_at)! })),
        pauseStates: pauseStates.rows.map((r: Row) => ({ ownerId: String(r.owner_id), globalPaused: Boolean(r.global_paused), assistantIds: json(r.assistant_ids, []), workflowIds: json(r.workflow_ids, []), updatedAt: iso(r.updated_at)! }))
      };
    } finally {
      client.release();
    }
  }

  async savePlatformState(state: PlatformState): Promise<void> {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.upsertState(client, { ...emptyPlatformState(), ...state });
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertState(client: PoolClient, state: PlatformState) {
    for (const item of state.workflows) await client.query(
      `insert into workflows(id, owner_id, organization_id, assistant_id, name, purpose, status, created_version, active_version, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       on conflict(id) do update set organization_id=excluded.organization_id, name=excluded.name, purpose=excluded.purpose, status=excluded.status, active_version=excluded.active_version, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.organizationId, item.assistantId, item.name, item.purpose, item.status, item.createdVersion, item.activeVersion, item.createdAt, item.updatedAt]);
    for (const item of state.workflowVersions) await client.query(
      `insert into workflow_versions(id, workflow_id, version, definition, validation, created_by, created_at)
       values($1,$2,$3,$4,$5,$6,$7) on conflict(workflow_id, version) do update set definition=excluded.definition, validation=excluded.validation`,
      [item.id, item.workflowId, item.version, dbJson(item.definition), dbJson(item.validation), item.createdBy, item.createdAt]);
    for (const item of state.workflowRuns) await client.query(
      `insert into workflow_runs(id, workflow_id, workflow_version, owner_id, assistant_id, status, idempotency_key, input, output, error, trace_id, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict(id) do update set status=excluded.status, output=excluded.output, error=excluded.error, updated_at=excluded.updated_at`,
      [item.id, item.workflowId, item.workflowVersion, item.ownerId, item.assistantId, item.status, item.idempotencyKey, dbJson(item.input), dbJson(item.output), item.error, item.traceId, item.createdAt, item.updatedAt]);
    for (const item of state.workflowSteps) await client.query(
      `insert into workflow_steps(id, owner_id, assistant_id, workflow_id, run_id, action_id, action_type, status, preview, result, error, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict(id) do update set status=excluded.status, preview=excluded.preview, result=excluded.result, error=excluded.error, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.assistantId, item.workflowId, item.runId, item.actionId, item.actionType, item.status, dbJson(item.preview), dbJson(item.result), item.error, item.createdAt, item.updatedAt]);
    for (const item of state.permissionGrants) await client.query(
      `insert into permission_grants(id, owner_id, assistant_id, workflow_id, action_type, resource, mode, expires_at, revoked_at, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict(id) do update set expires_at=excluded.expires_at, revoked_at=excluded.revoked_at`,
      [item.id, item.ownerId, item.assistantId, item.workflowId, item.actionType, item.resource, item.mode, item.expiresAt, item.revokedAt, item.createdAt]);
    for (const item of state.approvals) await client.query(
      `insert into approval_requests(id, owner_id, assistant_id, workflow_id, run_id, action, preview, status, decided_by, decided_at, idempotency_key, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict(id) do update set status=excluded.status, decided_by=excluded.decided_by, decided_at=excluded.decided_at, idempotency_key=excluded.idempotency_key`,
      [item.id, item.ownerId, item.assistantId, item.workflowId, item.runId, dbJson(item.action), dbJson(item.preview), item.status, item.decidedBy, item.decidedAt, item.idempotencyKey, item.createdAt]);
    for (const item of state.auditEvents) await client.query(
      `insert into audit_events(id, owner_id, organization_id, assistant_id, workflow_id, run_id, action_type, risk_level, decision, status, preview, details, trace_id, previous_hash, hash, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) on conflict(id) do nothing`,
      [item.id, item.ownerId, item.organizationId, item.assistantId, item.workflowId, item.runId, item.actionType, item.riskLevel, item.decision, item.status, dbJson(item.preview), dbJson(item.details), item.traceId, item.previousHash, item.hash, item.createdAt]);
    for (const item of state.undoRecords) await client.query(
      `insert into undo_records(id, owner_id, audit_event_id, action_type, payload, expected_resource_hash, status, idempotency_key, created_at, updated_at)
       values($1,$2,nullif($3,'00000000-0000-0000-0000-000000000000')::uuid,$4,$5,$6,$7,$8,$9,$10)
       on conflict(id) do update set status=excluded.status, idempotency_key=excluded.idempotency_key, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.auditEventId, item.actionType, dbJson(item.payload), item.expectedResourceHash, item.status, item.idempotencyKey, item.createdAt, item.updatedAt]);
    for (const item of state.memories) await client.query(
      `insert into memory_records(id, owner_id, scope, assistant_id, workflow_id, source, category, content, confidence, sensitivity, assistant_visibility, provenance, expires_at, last_used_at, deleted_at, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict(id) do update set content=excluded.content, category=excluded.category, assistant_visibility=excluded.assistant_visibility, expires_at=excluded.expires_at, last_used_at=excluded.last_used_at, deleted_at=excluded.deleted_at, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.scope, item.assistantId, item.workflowId, item.source, item.category, item.content, item.confidence, item.sensitivity, dbJson(item.assistantVisibility), dbJson(item.provenance), item.expiresAt, item.lastUsedAt, item.deletedAt, item.createdAt, item.updatedAt]);
    for (const item of state.memorySettings) await client.query(
      `insert into memory_settings(owner_id, assistant_id, memory_enabled, default_sensitivity, retention_days, updated_at)
       values($1,$2,$3,$4,$5,$6) on conflict(owner_id, coalesce(assistant_id, '00000000-0000-0000-0000-000000000000'::uuid)) do update set memory_enabled=excluded.memory_enabled, default_sensitivity=excluded.default_sensitivity, retention_days=excluded.retention_days, updated_at=excluded.updated_at`,
      [item.ownerId, item.assistantId, item.memoryEnabled, item.defaultSensitivity, item.retentionDays, item.updatedAt]);
    for (const item of state.pauseStates) await client.query(
      `insert into automation_pause_states(owner_id, global_paused, assistant_ids, workflow_ids, updated_at)
       values($1,$2,$3,$4,$5) on conflict(owner_id) do update set global_paused=excluded.global_paused, assistant_ids=excluded.assistant_ids, workflow_ids=excluded.workflow_ids, updated_at=excluded.updated_at`,
      [item.ownerId, item.globalPaused, dbJson(item.assistantIds), dbJson(item.workflowIds), item.updatedAt]);
  }
}
