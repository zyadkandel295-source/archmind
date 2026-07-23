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

function desktopBuild(row: Row): PlatformState["desktopBuilds"][number] {
  return { id: String(row.id), ownerId: String(row.owner_id), assistantId: String(row.assistant_id), packageId: iso(row.package_id), platform: row.platform as PlatformState["desktopBuilds"][number]["platform"], architecture: (row.architecture ?? "x64") as PlatformState["desktopBuilds"][number]["architecture"], status: row.status as PlatformState["desktopBuilds"][number]["status"], appId: String(row.app_id), productName: String(row.product_name), protocol: String(row.protocol), runtimeVersion: String(row.runtime_version ?? "unknown"), assistantVersion: Number(row.assistant_version ?? 1), brandingHash: String(row.branding_hash ?? "unknown"), idempotencyKey: iso(row.idempotency_key), buildQueueId: iso(row.build_queue_id), artifactPath: iso(row.artifact_path), artifactSize: row.artifact_size == null ? undefined : Number(row.artifact_size), artifactSha256: iso(row.artifact_sha256), downloadTokenHash: String(row.download_token_hash), error: iso(row.error), expiresAt: iso(row.expires_at)!, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}

function runtimeRelease(row: Row): PlatformState["desktopRuntimeReleases"][number] {
  return { id: String(row.id), version: String(row.version), platform: row.platform as "windows", architecture: row.architecture as "x64", channel: row.channel as PlatformState["desktopRuntimeReleases"][number]["channel"], status: row.status as PlatformState["desktopRuntimeReleases"][number]["status"], artifactKey: String(row.artifact_key), artifactPath: iso(row.artifact_path), filename: String(row.filename), mimeType: String(row.mime_type), byteSize: Number(row.byte_size), sha256: String(row.sha256), signatureStatus: row.signature_status as PlatformState["desktopRuntimeReleases"][number]["signatureStatus"], minimumApiVersion: String(row.minimum_api_version), manifestSchemaVersion: Number(row.manifest_schema_version), createdAt: iso(row.created_at)!, publishedAt: iso(row.published_at), retiredAt: iso(row.retired_at) };
}

function assistantSnapshot(row: Row): PlatformState["assistantSnapshots"][number] {
  return { id: String(row.id), ownerId: String(row.owner_id), assistantId: String(row.assistant_id), assistantVersion: Number(row.assistant_version), displayName: String(row.display_name), icon: iso(row.icon), iconDigest: iso(row.icon_digest), instructionDigest: String(row.instruction_digest), manifestSchemaVersion: Number(row.manifest_schema_version), manifest: json(row.manifest, {}), manifestDigest: String(row.manifest_digest), signature: String(row.signature), signatureKeyId: String(row.signature_key_id), status: row.status as PlatformState["assistantSnapshots"][number]["status"], createdAt: iso(row.created_at)! };
}

function installIntent(row: Row): PlatformState["assistantInstallIntents"][number] {
  return { id: String(row.id), ownerId: String(row.owner_id), assistantId: String(row.assistant_id), snapshotId: String(row.snapshot_id), runtimeReleaseId: String(row.runtime_release_id), platform: row.platform as "windows", architecture: row.architecture as "x64", status: row.status as PlatformState["assistantInstallIntents"][number]["status"], idempotencyKey: String(row.idempotency_key), requestFingerprint: String(row.request_fingerprint), claimSecretHash: String(row.claim_secret_hash), downloadTokenHash: String(row.download_token_hash), downloadTokenHashes: json(row.download_token_hashes, []), expiresAt: iso(row.expires_at)!, claimedAt: iso(row.claimed_at), activatedAt: iso(row.activated_at), revokedAt: iso(row.revoked_at), claimedDeviceId: iso(row.claimed_device_id), errorCode: iso(row.error_code), errorMessage: iso(row.error_message), correlationId: String(row.correlation_id), createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)! };
}

function deviceAssistant(row: Row): PlatformState["deviceAssistants"][number] {
  return { id: String(row.id), deviceSessionId: String(row.device_session_id), ownerId: String(row.owner_id), assistantId: String(row.assistant_id), snapshotId: String(row.snapshot_id), assistantVersion: Number(row.assistant_version), localProfileId: String(row.local_profile_id), status: row.status as PlatformState["deviceAssistants"][number]["status"], installedAt: iso(row.installed_at)!, lastSeenAt: iso(row.last_seen_at)!, updatedAt: iso(row.updated_at)!, revokedAt: iso(row.revoked_at) };
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
        undoRecords, memories, memorySettings, packages, packageVersions, entitlements, licenses,
        bootstrapTokens, deviceSessions, desktopBuilds, installerDownloads,
        desktopRuntimeReleases, assistantSnapshots, assistantInstallIntents, deviceAssistants,
        pauseStates
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
        client.query("select * from assistant_packages order by created_at"),
        client.query("select * from package_versions order by created_at"),
        client.query("select * from entitlements order by created_at"),
        client.query("select * from package_licenses order by issued_at"),
        client.query("select * from bootstrap_tokens order by created_at"),
        client.query("select * from device_sessions order by created_at"),
        client.query("select * from desktop_builds order by created_at"),
        client.query("select * from installer_downloads order by created_at"),
        client.query("select * from desktop_runtime_releases order by created_at"),
        client.query("select * from assistant_snapshots order by created_at"),
        client.query("select * from assistant_install_intents order by created_at"),
        client.query("select * from device_assistants order by installed_at"),
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
        packages: packages.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), productName: String(r.product_name), description: String(r.description), publisherName: String(r.publisher_name), category: String(r.category), pricingType: r.pricing_type as PlatformState["packages"][number]["pricingType"], status: r.status as PlatformState["packages"][number]["status"], currentVersion: r.current_version == null ? undefined : Number(r.current_version), createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)! })),
        packageVersions: packageVersions.rows.map((r: Row) => ({ id: String(r.id), packageId: String(r.package_id), version: Number(r.version), releaseNotes: String(r.release_notes), manifest: json(r.manifest, {}), checksum: String(r.checksum), status: r.status as PlatformState["packageVersions"][number]["status"], createdAt: iso(r.created_at)! })),
        entitlements: entitlements.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), packageId: String(r.package_id), packageVersion: Number(r.package_version), status: r.status as PlatformState["entitlements"][number]["status"], seats: Number(r.seats), expiresAt: iso(r.expires_at), createdAt: iso(r.created_at)! })),
        licenses: licenses.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), packageId: String(r.package_id), entitlementId: String(r.entitlement_id), status: r.status as PlatformState["licenses"][number]["status"], seats: Number(r.seats), issuedAt: iso(r.issued_at)!, expiresAt: iso(r.expires_at), revokedAt: iso(r.revoked_at) })),
        bootstrapTokens: bootstrapTokens.rows.map((r: Row) => ({ id: String(r.id), tokenHash: String(r.token_hash), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), packageId: iso(r.package_id), expiresAt: iso(r.expires_at)!, usedAt: iso(r.used_at), createdAt: iso(r.created_at)! })),
        deviceSessions: deviceSessions.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), assistantId: String(r.assistant_id), installationId: String(r.installation_id), deviceName: String(r.device_name), sessionTokenHash: String(r.session_token_hash), revokedAt: iso(r.revoked_at), lastSeenAt: iso(r.last_seen_at)!, createdAt: iso(r.created_at)! })),
        desktopBuilds: desktopBuilds.rows.map((r: Row) => desktopBuild(r)),
        installerDownloads: installerDownloads.rows.map((r: Row) => ({ id: String(r.id), ownerId: String(r.owner_id), buildId: String(r.build_id), status: r.status as PlatformState["installerDownloads"][number]["status"], tokenHash: String(r.token_hash), downloadedAt: iso(r.downloaded_at), expiresAt: iso(r.expires_at)!, createdAt: iso(r.created_at)! })),
        desktopRuntimeReleases: desktopRuntimeReleases.rows.map((r: Row) => runtimeRelease(r)),
        assistantSnapshots: assistantSnapshots.rows.map((r: Row) => assistantSnapshot(r)),
        assistantInstallIntents: assistantInstallIntents.rows.map((r: Row) => installIntent(r)),
        deviceAssistants: deviceAssistants.rows.map((r: Row) => deviceAssistant(r)),
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

  async createDesktopBuildIfAbsent(build: PlatformState["desktopBuilds"][number], download: PlatformState["installerDownloads"][number]) {
    await this.ensureReady();
    const client = await this.pool.connect();
    try {
      await client.query("begin");

      // 1. Ensure user row exists in 'users' table
      const dbUser = await client.query("select id from users where id = $1 or lower(email) = $2 limit 1", [build.ownerId, `${build.ownerId}@archmind.local`]);
      if (dbUser.rows.length > 0) {
        const foundUser = dbUser.rows[0] as Row;
        if (foundUser && foundUser.id !== build.ownerId) {
          await client.query("update users set id = $1, updated_at = now() where lower(email) = $2 or id = $3", [build.ownerId, `${build.ownerId}@archmind.local`, foundUser.id]);
        }
      } else {
        await client.query(
          `insert into users(id, email, plan, token_usage, created_at, updated_at)
           values($1, $2, 'free', 0, now(), now())
           on conflict(id) do update set updated_at = now()`,
          [build.ownerId, `${build.ownerId}@archmind.local`]
        );
      }

      // 2. Ensure assistant row exists in 'assistants' table
      const dbAssistant = await client.query("select id from assistants where id = $1 limit 1", [build.assistantId]);
      if (dbAssistant.rows.length === 0 && this.memoryStore) {
        const memoryAssistant = this.memoryStore.getAssistant(build.assistantId) ?? this.memoryStore.getPublicAssistantBySlug(build.assistantId);
        if (memoryAssistant) {
          const mirroredSlug = uniqueAssistantSlug(memoryAssistant.slug, memoryAssistant.id);
          const mirroredPublicSlug = memoryAssistant.isPublic && memoryAssistant.publicSlug ? uniqueAssistantSlug(memoryAssistant.publicSlug, memoryAssistant.id) : null;
          await client.query(
            `insert into assistants(id, user_id, name, description, system_prompt, tone, is_public, public_slug, model, temperature, version, created_at, slug, visibility, icon, color, starter_prompts, enabled_tools, updated_at)
             values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             on conflict(id) do update set user_id = excluded.user_id, updated_at = now()`,
            [memoryAssistant.id, build.ownerId, memoryAssistant.name, memoryAssistant.description, memoryAssistant.systemPrompt, memoryAssistant.tone, memoryAssistant.isPublic, mirroredPublicSlug, memoryAssistant.model, memoryAssistant.temperature, memoryAssistant.version, memoryAssistant.createdAt, mirroredSlug, memoryAssistant.visibility, memoryAssistant.icon, memoryAssistant.color, dbJson(memoryAssistant.starterPrompts), dbJson(memoryAssistant.enabledTools), memoryAssistant.updatedAt]
          );
        }
      }

      // 3. Insert desktop build into desktop_builds table
      const inserted = await client.query(
        `insert into desktop_builds(id, owner_id, assistant_id, package_id, platform, architecture, status, app_id, product_name, protocol, runtime_version, assistant_version, branding_hash, idempotency_key, build_queue_id, artifact_path, artifact_size, artifact_sha256, download_token_hash, error, expires_at, created_at, updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
         on conflict(owner_id, idempotency_key) where idempotency_key is not null do nothing
         returning *`,
        [build.id, build.ownerId, build.assistantId, build.packageId, build.platform, build.architecture, build.status, build.appId, build.productName, build.protocol, build.runtimeVersion, build.assistantVersion, build.brandingHash, build.idempotencyKey, build.buildQueueId, build.artifactPath, build.artifactSize, build.artifactSha256, build.downloadTokenHash, build.error, build.expiresAt, build.createdAt, build.updatedAt]
      );
      const canonical = inserted.rows[0] ?? (await client.query("select * from desktop_builds where owner_id = $1 and idempotency_key = $2", [build.ownerId, build.idempotencyKey])).rows[0];
      if (!canonical) throw new Error("Desktop build idempotency lookup failed.");
      const saved = desktopBuild(canonical as Row);

      // 4. Insert download token into installer_downloads table
      await client.query(
        `insert into installer_downloads(id, owner_id, build_id, status, token_hash, downloaded_at, expires_at, created_at)
         values($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict(id) do update set status = excluded.status`,
        [download.id, download.ownerId, saved.id, download.status, download.tokenHash, download.downloadedAt, download.expiresAt, download.createdAt]
      );
      await client.query("commit");
      return { build: saved, created: inserted.rowCount === 1 };
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
    for (const item of state.packages) await client.query(
      `insert into assistant_packages(id, owner_id, assistant_id, product_name, description, publisher_name, category, pricing_type, status, current_version, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict(id) do update set status=excluded.status, current_version=excluded.current_version, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.assistantId, item.productName, item.description, item.publisherName, item.category, item.pricingType, item.status, item.currentVersion, item.createdAt, item.updatedAt]);
    for (const item of state.packageVersions) await client.query(
      `insert into package_versions(id, package_id, version, release_notes, manifest, checksum, status, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(package_id, version) do nothing`,
      [item.id, item.packageId, item.version, item.releaseNotes, dbJson(item.manifest), item.checksum, item.status, item.createdAt]);
    for (const item of state.entitlements) await client.query(
      `insert into entitlements(id, owner_id, package_id, package_version, status, seats, expires_at, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(owner_id, package_id) do update set status=excluded.status, seats=excluded.seats, expires_at=excluded.expires_at`,
      [item.id, item.ownerId, item.packageId, item.packageVersion, item.status, item.seats, item.expiresAt, item.createdAt]);
    for (const item of state.licenses) await client.query(
      `insert into package_licenses(id, owner_id, package_id, entitlement_id, status, seats, issued_at, expires_at, revoked_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set status=excluded.status, revoked_at=excluded.revoked_at`,
      [item.id, item.ownerId, item.packageId, item.entitlementId, item.status, item.seats, item.issuedAt, item.expiresAt, item.revokedAt]);
    for (const item of state.bootstrapTokens) await client.query(
      `insert into bootstrap_tokens(id, token_hash, owner_id, assistant_id, package_id, expires_at, used_at, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(token_hash) do update set used_at=excluded.used_at`,
      [item.id, item.tokenHash, item.ownerId, item.assistantId, item.packageId, item.expiresAt, item.usedAt, item.createdAt]);
    for (const item of state.deviceSessions) await client.query(
      `insert into device_sessions(id, owner_id, assistant_id, installation_id, device_name, session_token_hash, revoked_at, last_seen_at, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict(assistant_id, installation_id) do update set device_name=excluded.device_name, session_token_hash=excluded.session_token_hash, revoked_at=excluded.revoked_at, last_seen_at=excluded.last_seen_at`,
      [item.id, item.ownerId, item.assistantId, item.installationId, item.deviceName, item.sessionTokenHash, item.revokedAt, item.lastSeenAt, item.createdAt]);
    for (const item of state.desktopBuilds) await client.query(
      `insert into desktop_builds(id, owner_id, assistant_id, package_id, platform, architecture, status, app_id, product_name, protocol, runtime_version, assistant_version, branding_hash, idempotency_key, build_queue_id, artifact_path, artifact_size, artifact_sha256, download_token_hash, error, expires_at, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       on conflict(id) do update set status=excluded.status, build_queue_id=excluded.build_queue_id, artifact_path=excluded.artifact_path, artifact_size=excluded.artifact_size, artifact_sha256=excluded.artifact_sha256, error=excluded.error, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.assistantId, item.packageId, item.platform, item.architecture, item.status, item.appId, item.productName, item.protocol, item.runtimeVersion, item.assistantVersion, item.brandingHash, item.idempotencyKey, item.buildQueueId, item.artifactPath, item.artifactSize, item.artifactSha256, item.downloadTokenHash, item.error, item.expiresAt, item.createdAt, item.updatedAt]);
    for (const item of state.installerDownloads) await client.query(
      `insert into installer_downloads(id, owner_id, build_id, status, token_hash, downloaded_at, expires_at, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set status=excluded.status, downloaded_at=excluded.downloaded_at`,
      [item.id, item.ownerId, item.buildId, item.status, item.tokenHash, item.downloadedAt, item.expiresAt, item.createdAt]);
    for (const item of state.desktopRuntimeReleases) await client.query(
      `insert into desktop_runtime_releases(id, version, platform, architecture, channel, status, artifact_key, artifact_path, filename, mime_type, byte_size, sha256, signature_status, minimum_api_version, manifest_schema_version, created_at, published_at, retired_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       on conflict(version, platform, architecture, channel) do update set status=excluded.status, artifact_key=excluded.artifact_key, artifact_path=excluded.artifact_path, filename=excluded.filename, mime_type=excluded.mime_type, byte_size=excluded.byte_size, sha256=excluded.sha256, signature_status=excluded.signature_status, minimum_api_version=excluded.minimum_api_version, manifest_schema_version=excluded.manifest_schema_version, published_at=excluded.published_at, retired_at=excluded.retired_at`,
      [item.id, item.version, item.platform, item.architecture, item.channel, item.status, item.artifactKey, item.artifactPath, item.filename, item.mimeType, item.byteSize, item.sha256, item.signatureStatus, item.minimumApiVersion, item.manifestSchemaVersion, item.createdAt, item.publishedAt, item.retiredAt]);
    for (const item of state.assistantSnapshots) await client.query(
      `insert into assistant_snapshots(id, owner_id, assistant_id, assistant_version, display_name, icon, icon_digest, instruction_digest, manifest_schema_version, manifest, manifest_digest, signature, signature_key_id, status, created_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       on conflict(owner_id, assistant_id, assistant_version, manifest_schema_version) do update set display_name=excluded.display_name, icon=excluded.icon, icon_digest=excluded.icon_digest, instruction_digest=excluded.instruction_digest, manifest=excluded.manifest, manifest_digest=excluded.manifest_digest, signature=excluded.signature, signature_key_id=excluded.signature_key_id, status=excluded.status`,
      [item.id, item.ownerId, item.assistantId, item.assistantVersion, item.displayName, item.icon, item.iconDigest, item.instructionDigest, item.manifestSchemaVersion, dbJson(item.manifest), item.manifestDigest, item.signature, item.signatureKeyId, item.status, item.createdAt]);
    for (const item of state.assistantInstallIntents) await client.query(
      `insert into assistant_install_intents(id, owner_id, assistant_id, snapshot_id, runtime_release_id, platform, architecture, status, idempotency_key, request_fingerprint, claim_secret_hash, download_token_hash, download_token_hashes, expires_at, claimed_at, activated_at, revoked_at, claimed_device_id, error_code, error_message, correlation_id, created_at, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
       on conflict(owner_id, idempotency_key) do update set status=excluded.status, claim_secret_hash=excluded.claim_secret_hash, download_token_hash=excluded.download_token_hash, download_token_hashes=excluded.download_token_hashes, expires_at=excluded.expires_at, claimed_at=excluded.claimed_at, activated_at=excluded.activated_at, revoked_at=excluded.revoked_at, claimed_device_id=excluded.claimed_device_id, error_code=excluded.error_code, error_message=excluded.error_message, updated_at=excluded.updated_at`,
      [item.id, item.ownerId, item.assistantId, item.snapshotId, item.runtimeReleaseId, item.platform, item.architecture, item.status, item.idempotencyKey, item.requestFingerprint, item.claimSecretHash, item.downloadTokenHash, dbJson(item.downloadTokenHashes ?? []), item.expiresAt, item.claimedAt, item.activatedAt, item.revokedAt, item.claimedDeviceId, item.errorCode, item.errorMessage, item.correlationId, item.createdAt, item.updatedAt]);
    for (const item of state.deviceAssistants) await client.query(
      `insert into device_assistants(id, device_session_id, owner_id, assistant_id, snapshot_id, assistant_version, local_profile_id, status, installed_at, last_seen_at, updated_at, revoked_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict(device_session_id, assistant_id) do update set snapshot_id=excluded.snapshot_id, assistant_version=excluded.assistant_version, local_profile_id=excluded.local_profile_id, status=excluded.status, last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at, revoked_at=excluded.revoked_at`,
      [item.id, item.deviceSessionId, item.ownerId, item.assistantId, item.snapshotId, item.assistantVersion, item.localProfileId, item.status, item.installedAt, item.lastSeenAt, item.updatedAt, item.revokedAt]);
    for (const item of state.pauseStates) await client.query(
      `insert into automation_pause_states(owner_id, global_paused, assistant_ids, workflow_ids, updated_at)
       values($1,$2,$3,$4,$5) on conflict(owner_id) do update set global_paused=excluded.global_paused, assistant_ids=excluded.assistant_ids, workflow_ids=excluded.workflow_ids, updated_at=excluded.updated_at`,
      [item.ownerId, item.globalPaused, dbJson(item.assistantIds), dbJson(item.workflowIds), item.updatedAt]);
  }
}
