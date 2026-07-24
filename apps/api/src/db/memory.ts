import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type {
  AnalyticsEventRecord,
  AssistantActionRecord,
  AssistantRecord,
  AuthUser,
  ConversationRecord,
  DataSourceRecord,
  MessageRecord,
  RetrievedChunk,
  UserRecord,
  ExecutionBridgeLogRecord,
  ExecutionApprovalRecord,
  NotionActivityLogRecord,
  NotionOAuthStateRecord
} from "../types";
import { HttpError } from "../lib/http-error";
import type { AssistantActionInput, AssistantActionUpdateInput, AssistantCreateInput, AssistantUpdateInput } from "@archmind/shared";
import { emptyPlatformState, type PlatformState } from "../platform-types";
import type { PlatformStateStore } from "./platform-store";

function now() {
  return new Date().toISOString();
}

interface PersistedMemoryStore {
  demoUserId: string;
  users: UserRecord[];
  assistants: AssistantRecord[];
  actions: AssistantActionRecord[];
  sources: DataSourceRecord[];
  conversations: ConversationRecord[];
  messages: MessageRecord[];
  events: AnalyticsEventRecord[];
  bridgeLogs?: ExecutionBridgeLogRecord[];
  bridgeApprovals?: ExecutionApprovalRecord[];
  notionOAuthStates?: NotionOAuthStateRecord[];
  notionActivityLogs?: NotionActivityLogRecord[];
  platform?: PlatformState;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function countTokens(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
}

function normalizeInstructions(input: Pick<AssistantCreateInput, "systemPrompt" | "instructions"> | Pick<AssistantUpdateInput, "systemPrompt" | "instructions">) {
  return input.instructions ?? input.systemPrompt;
}

function chunkText(
  text: string,
  sourceName: string,
  sourceId: string,
  metadata: { userId?: string; assistantId?: string; filename?: string } = {}
): RetrievedChunk[] {
  const clean = text.trim();
  if (!clean) {
    return [];
  }
  const words = clean.split(/\s+/);
  const chunks: RetrievedChunk[] = [];

  for (let index = 0; index < words.length; index += 160) {
    const page = Math.floor(index / 480) + 1;
    chunks.push({
      sourceId,
      sourceName,
      userId: metadata.userId,
      assistantId: metadata.assistantId,
      fileId: sourceId,
      filename: metadata.filename ?? sourceName,
      chunkIndex: chunks.length,
      page,
      text: words.slice(index, index + 200).join(" "),
      similarity: Number((0.92 - chunks.length * 0.04).toFixed(2))
    });
  }

  return chunks;
}

function resolvePersistPath() {
  if (process.env.ARCHMIND_DATA_PATH) return process.env.ARCHMIND_DATA_PATH;
  if (process.env.VERCEL === "1") {
    return path.join("/tmp", ".archmind-data", "memory.json");
  }
  const workspaceRoot = fs.existsSync(path.resolve(process.cwd(), "..", "..", "package.json"))
    ? path.resolve(process.cwd(), "..", "..")
    : process.cwd();
  return path.join(workspaceRoot, ".archmind-data", "memory.json");
}

export class MemoryStore implements PlatformStateStore {
  private users = new Map<string, UserRecord>();
  private assistants = new Map<string, AssistantRecord>();
  private actions = new Map<string, AssistantActionRecord>();
  private sources = new Map<string, DataSourceRecord>();
  private conversations = new Map<string, ConversationRecord>();
  private messages = new Map<string, MessageRecord>();
  private events = new Map<string, AnalyticsEventRecord>();
  private bridgeLogs = new Map<string, ExecutionBridgeLogRecord>();
  private bridgeApprovals = new Map<string, ExecutionApprovalRecord>();
  private notionOAuthStates = new Map<string, NotionOAuthStateRecord>();
  private notionActivityLogs = new Map<string, NotionActivityLogRecord>();
  private passwordResetTokens = new Map<string, { userId: string; expiresAt: number }>();
  private webAuthHandoffs = new Map<string, { accessToken: string; refreshToken: string; user: AuthUser; expiresAt: number }>();
  private platform: PlatformState = emptyPlatformState();
  private persistPath?: string;
  private dbPool?: Pool;
  readonly demoUserId: string;

  constructor() {
    if (process.env.DATABASE_URL) {
      try {
        this.dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
        this.loadFromPg().catch((err) => {
          console.warn("[MemoryStore] loadFromPg initial sync warning:", err instanceof Error ? err.message : err);
        });
      } catch (err) {
        console.warn("[MemoryStore] Could not connect DB Pool:", err);
      }
    }

    if (process.env.NODE_ENV !== "test") {
      this.persistPath = resolvePersistPath();
      const restored = this.restore();
      if (restored) {
        this.demoUserId = restored.demoUserId;
        return;
      }
    }

    const createdAt = now();
    const user: UserRecord = {
      id: randomUUID(),
      email: "demo@archmind.dev",
      passwordHash: bcrypt.hashSync("password123", 10),
      plan: "pro",
      tokenUsage: 18850,
      createdAt,
      updatedAt: createdAt
    };

    this.demoUserId = user.id;
    this.users.set(user.id, user);
    this.persist();
  }

  public async loadFromPg() {
    if (!this.dbPool) return;
    try {
      const client = await this.dbPool.connect();
      try {
        const [usersRes, assistantsRes, sourcesRes] = await Promise.all([
          client.query("select * from users"),
          client.query("select * from assistants"),
          client.query("select * from data_sources")
        ]);

        for (const row of (usersRes.rows as any[])) {
          const u: UserRecord = {
            id: String(row.id),
            email: String(row.email),
            passwordHash: row.password_hash ? String(row.password_hash) : undefined,
            googleId: row.google_id ? String(row.google_id) : undefined,
            firebaseUid: row.firebase_uid ? String(row.firebase_uid) : undefined,
            displayName: row.display_name ? String(row.display_name) : undefined,
            photoUrl: row.photo_url ? String(row.photo_url) : undefined,
            provider: row.provider ? String(row.provider) : undefined,
            plan: (row.plan ?? "free") as UserRecord["plan"],
            tokenUsage: Number(row.token_usage ?? 0),
            lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : undefined,
            createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
            updatedAt: new Date(row.updated_at ?? Date.now()).toISOString()
          };
          this.users.set(u.id, u);
        }

        for (const row of (assistantsRes.rows as any[])) {
          const a: AssistantRecord = {
            id: String(row.id),
            userId: String(row.user_id),
            createdByUserId: String(row.user_id),
            name: String(row.name),
            description: String(row.description ?? ""),
            systemPrompt: String(row.system_prompt ?? ""),
            tone: (row.tone ?? "professional") as AssistantRecord["tone"],
            isPublic: Boolean(row.is_public),
            publicSlug: row.public_slug ? String(row.public_slug) : undefined,
            slug: String(row.slug ?? row.public_slug ?? `assistant-${String(row.id).slice(0, 8)}`),
            visibility: (row.visibility ?? (row.is_public ? "public" : "private")) as AssistantRecord["visibility"],
            icon: String(row.icon ?? "bot"),
            color: String(row.color ?? "indigo"),
            model: String(row.model ?? "openrouter/auto"),
            temperature: Number(row.temperature ?? 0.7),
            version: Number(row.version ?? 1),
            starterPrompts: typeof row.starter_prompts === "string" ? JSON.parse(row.starter_prompts) : (Array.isArray(row.starter_prompts) ? row.starter_prompts : []),
            enabledTools: typeof row.enabled_tools === "string" ? JSON.parse(row.enabled_tools) : (Array.isArray(row.enabled_tools) ? row.enabled_tools : []),
            createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date(row.created_at ?? Date.now()).toISOString()
          };
          this.assistants.set(a.id, a);
        }

        for (const row of (sourcesRes.rows as any[])) {
          const s: DataSourceRecord = {
            id: String(row.id),
            assistantId: String(row.assistant_id),
            type: row.type as DataSourceRecord["type"],
            name: String(row.name),
            s3Key: row.s3_key ? String(row.s3_key) : undefined,
            url: row.url ? String(row.url) : undefined,
            status: row.status as DataSourceRecord["status"],
            chunkCount: Number(row.chunk_count ?? 0),
            tokenCount: Number(row.token_count ?? 0),
            chunks: [],
            createdAt: new Date(row.created_at ?? Date.now()).toISOString(),
            updatedAt: new Date(row.updated_at ?? Date.now()).toISOString()
          };
          this.sources.set(s.id, s);
        }
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("[MemoryStore] loadFromPg warning:", err instanceof Error ? err.message : err);
    }
  }

  private async syncToPg() {
    if (!this.dbPool) return;
    try {
      const client = await this.dbPool.connect();
      try {
        await client.query("begin");

        for (const u of this.users.values()) {
          await client.query(
            `insert into users(id, email, password_hash, google_id, firebase_uid, display_name, photo_url, provider, plan, token_usage, last_login_at, created_at, updated_at)
             values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             on conflict (id) do update set
               email = excluded.email,
               password_hash = excluded.password_hash,
               google_id = excluded.google_id,
               firebase_uid = excluded.firebase_uid,
               display_name = excluded.display_name,
               photo_url = excluded.photo_url,
               provider = excluded.provider,
               plan = excluded.plan,
               token_usage = excluded.token_usage,
               last_login_at = excluded.last_login_at,
               updated_at = excluded.updated_at`,
            [u.id, u.email, u.passwordHash ?? null, u.googleId ?? null, u.firebaseUid ?? null, u.displayName ?? null, u.photoUrl ?? null, u.provider ?? null, u.plan, u.tokenUsage ?? 0, u.lastLoginAt ?? null, u.createdAt, u.updatedAt]
          );
        }

        for (const a of this.assistants.values()) {
          const mirroredSlug = a.slug || `assistant-${a.id.slice(0, 8)}`;
          const mirroredPublicSlug = a.isPublic && a.publicSlug ? a.publicSlug : null;
          await client.query(
            `insert into assistants(id, user_id, name, description, system_prompt, tone, is_public, public_slug, model, temperature, version, created_at, slug, visibility, icon, color, starter_prompts, enabled_tools, updated_at)
             values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             on conflict (id) do update set
               name = excluded.name,
               description = excluded.description,
               system_prompt = excluded.system_prompt,
               tone = excluded.tone,
               is_public = excluded.is_public,
               public_slug = excluded.public_slug,
               model = excluded.model,
               temperature = excluded.temperature,
               version = excluded.version,
               slug = excluded.slug,
               visibility = excluded.visibility,
               icon = excluded.icon,
               color = excluded.color,
               starter_prompts = excluded.starter_prompts,
               enabled_tools = excluded.enabled_tools,
               updated_at = excluded.updated_at`,
            [
              a.id, a.userId, a.name, a.description ?? "", a.systemPrompt ?? "", a.tone ?? "professional",
              a.isPublic ?? false, mirroredPublicSlug, a.model ?? "openrouter/auto", a.temperature ?? 0.7, a.version ?? 1,
              a.createdAt, mirroredSlug, a.visibility ?? "private", a.icon ?? "bot", a.color ?? "indigo",
              JSON.stringify(a.starterPrompts ?? []), JSON.stringify(a.enabledTools ?? []), a.updatedAt ?? a.createdAt
            ]
          );
        }

        for (const s of this.sources.values()) {
          await client.query(
            `insert into data_sources(id, assistant_id, type, name, s3_key, url, status, chunk_count, token_count, created_at, updated_at)
             values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             on conflict (id) do update set
               name = excluded.name,
               status = excluded.status,
               chunk_count = excluded.chunk_count,
               token_count = excluded.token_count,
               updated_at = excluded.updated_at`,
            [s.id, s.assistantId, s.type, s.name, s.s3Key ?? null, s.url ?? null, s.status, s.chunkCount ?? 0, s.tokenCount ?? 0, s.createdAt, s.updatedAt]
          );
        }

        await client.query("commit");
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn("[MemoryStore] syncToPg background warning:", err instanceof Error ? err.message : err);
    }
  }

  private restore() {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return undefined;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.persistPath, "utf8")) as PersistedMemoryStore;
      this.users = new Map(parsed.users.map((item) => [item.id, item]));
      this.assistants = new Map(parsed.assistants.map((item) => [item.id, item]));
      this.actions = new Map((parsed.actions ?? []).map((item) => [item.id, item]));
      this.sources = new Map(parsed.sources.map((item) => [item.id, item]));
      this.conversations = new Map(parsed.conversations.map((item) => [item.id, item]));
      this.messages = new Map(parsed.messages.map((item) => [item.id, item]));
      this.events = new Map(parsed.events.map((item) => [item.id, item]));
      this.bridgeLogs = new Map((parsed.bridgeLogs ?? []).map((item) => [item.id, item]));
      this.bridgeApprovals = new Map((parsed.bridgeApprovals ?? []).map((item) => [item.id, item]));
      this.notionOAuthStates = new Map((parsed.notionOAuthStates ?? []).map((item) => [item.state, item]));
      this.notionActivityLogs = new Map((parsed.notionActivityLogs ?? []).map((item) => [item.id, item]));
      this.platform = { ...emptyPlatformState(), ...(parsed.platform ?? {}) };
      return parsed;
    } catch {
      return undefined;
    }
  }

  public persist() {
    if (this.persistPath) {
      try {
        const data: PersistedMemoryStore = {
          demoUserId: this.demoUserId,
          users: [...this.users.values()],
          assistants: [...this.assistants.values()],
          actions: [...this.actions.values()],
          sources: [...this.sources.values()],
          conversations: [...this.conversations.values()],
          messages: [...this.messages.values()],
          events: [...this.events.values()],
          bridgeLogs: [...this.bridgeLogs.values()],
          bridgeApprovals: [...this.bridgeApprovals.values()],
          notionOAuthStates: [...this.notionOAuthStates.values()],
          notionActivityLogs: [...this.notionActivityLogs.values()],
          platform: this.platform
        };
        fs.mkdirSync(path.dirname(this.persistPath), { recursive: true });
        fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.warn("MemoryStore persist skipped on read-only filesystem:", error);
      }
    }

    if (this.dbPool) {
      this.syncToPg().catch((err) => {
        console.warn("[MemoryStore] syncToPg background warning:", err instanceof Error ? err.message : err);
      });
    }
  }

  getDemoUser() {
    return this.users.get(this.demoUserId)!;
  }

  createUser(email: string, passwordHash: string) {
    if ([...this.users.values()].some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      throw new HttpError(409, "Email is already registered", "EMAIL_EXISTS");
    }

    const user: UserRecord = {
      id: randomUUID(),
      email: email.toLowerCase(),
      passwordHash,
      plan: "free",
      tokenUsage: 0,
      createdAt: now(),
      updatedAt: now()
    };
    this.users.set(user.id, user);
    this.persist();
    return user;
  }

  updateUserPassword(userId: string, passwordHash: string) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      passwordHash,
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  createPasswordResetToken(email: string) {
    const user = this.findUserByEmail(email);
    const token = randomUUID().replace(/-/g, "");
    if (user) {
      this.passwordResetTokens.set(token, {
        userId: user.id,
        expiresAt: Date.now() + 1000 * 60 * 30
      });
    }
    return { token, userExists: Boolean(user) };
  }

  consumePasswordResetToken(token: string) {
    const reset = this.passwordResetTokens.get(token);
    if (!reset || reset.expiresAt < Date.now()) {
      this.passwordResetTokens.delete(token);
      return undefined;
    }
    this.passwordResetTokens.delete(token);
    return this.users.get(reset.userId);
  }

  createWebAuthHandoff(input: { accessToken: string; refreshToken: string; user: AuthUser }) {
    const code = randomUUID().replace(/-/g, "");
    this.webAuthHandoffs.set(code, {
      ...input,
      expiresAt: Date.now() + 1000 * 60 * 5
    });
    return code;
  }

  consumeWebAuthHandoff(code: string) {
    const handoff = this.webAuthHandoffs.get(code);
    if (!handoff || handoff.expiresAt < Date.now()) {
      this.webAuthHandoffs.delete(code);
      return undefined;
    }
    this.webAuthHandoffs.delete(code);
    return {
      accessToken: handoff.accessToken,
      refreshToken: handoff.refreshToken,
      user: handoff.user
    };
  }

  findUserByEmail(email: string) {
    return [...this.users.values()].find((user) => user.email.toLowerCase() === email.toLowerCase());
  }

  findUserByGoogleId(googleId: string) {
    return [...this.users.values()].find((user) => user.googleId === googleId);
  }

  findUserByFirebaseUid(firebaseUid: string) {
    return [...this.users.values()].find((user) => user.firebaseUid === firebaseUid);
  }

  upsertFirebaseUser(input: { firebaseUid: string; email: string; displayName?: string; photoUrl?: string; provider?: string }) {
    const loginAt = now();
    const byFirebase = this.findUserByFirebaseUid(input.firebaseUid);
    if (byFirebase) {
      const updated: UserRecord = {
        ...byFirebase,
        email: input.email.toLowerCase(),
        displayName: input.displayName ?? byFirebase.displayName,
        photoUrl: input.photoUrl ?? byFirebase.photoUrl,
        provider: input.provider ?? byFirebase.provider,
        lastLoginAt: loginAt,
        updatedAt: loginAt
      };
      this.users.set(updated.id, updated);
      this.persist();
      return updated;
    }

    const byEmail = this.findUserByEmail(input.email);
    if (byEmail) {
      const updated: UserRecord = {
        ...byEmail,
        firebaseUid: input.firebaseUid,
        displayName: input.displayName ?? byEmail.displayName,
        photoUrl: input.photoUrl ?? byEmail.photoUrl,
        provider: input.provider ?? byEmail.provider,
        lastLoginAt: loginAt,
        updatedAt: loginAt
      };
      this.users.set(updated.id, updated);
      this.persist();
      return updated;
    }

    const user: UserRecord = {
      id: randomUUID(),
      firebaseUid: input.firebaseUid,
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      photoUrl: input.photoUrl,
      provider: input.provider,
      plan: "free",
      tokenUsage: 0,
      lastLoginAt: loginAt,
      createdAt: loginAt,
      updatedAt: loginAt
    };
    this.users.set(user.id, user);
    this.persist();
    return user;
  }

  updateUserProfile(userId: string, input: { displayName?: string; photoUrl?: string }) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      displayName: input.displayName ?? user.displayName,
      photoUrl: input.photoUrl ?? user.photoUrl,
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  upsertGoogleUser(input: { googleId: string; email: string; accessToken?: string; refreshToken?: string; expiresIn?: number }) {
    const byGoogle = this.findUserByGoogleId(input.googleId);
    if (byGoogle) {
      // Update tokens if provided
      if (input.accessToken || input.refreshToken) {
        const updated: UserRecord = {
          ...byGoogle,
          googleAccessToken: input.accessToken ?? byGoogle.googleAccessToken,
          googleRefreshToken: input.refreshToken ?? byGoogle.googleRefreshToken,
          googleAccessTokenExpiresAt: input.expiresIn 
            ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
            : byGoogle.googleAccessTokenExpiresAt,
          updatedAt: now()
        };
        this.users.set(updated.id, updated);
        this.persist();
        return updated;
      }
      return byGoogle;
    }

    const byEmail = this.findUserByEmail(input.email);
    if (byEmail) {
      const updated: UserRecord = {
        ...byEmail,
        googleId: input.googleId,
        googleAccessToken: input.accessToken ?? byEmail.googleAccessToken,
        googleRefreshToken: input.refreshToken ?? byEmail.googleRefreshToken,
        googleAccessTokenExpiresAt: input.expiresIn 
          ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
          : byEmail.googleAccessTokenExpiresAt,
        provider: "google.com",
        updatedAt: now()
      };
      this.users.set(updated.id, updated);
      this.persist();
      return updated;
    }

    const user: UserRecord = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      googleId: input.googleId,
      googleAccessToken: input.accessToken,
      googleRefreshToken: input.refreshToken,
      googleAccessTokenExpiresAt: input.expiresIn 
        ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
        : undefined,
      provider: "google.com",
      plan: "free",
      tokenUsage: 0,
      createdAt: now(),
      updatedAt: now()
    };
    this.users.set(user.id, user);
    this.persist();
    return user;
  }

  findUserById(id: string) {
    return this.users.get(id);
  }

  getUserCredits(userId: string) {
    const user = this.users.get(userId);
    if (!user) return { credits: 0, dailyLimit: 0 };
    const currentDate = new Date().toISOString().slice(0, 10);
    const dailyLimit = user.plan === "pro" ? 100 : 20;

    if (user.creditsLastResetDate !== currentDate) {
      user.credits = dailyLimit;
      user.creditsLastResetDate = currentDate;
      user.updatedAt = now();
      this.persist();
    }

    return {
      credits: user.credits ?? dailyLimit,
      dailyLimit
    };
  }

  updateUserCredits(userId: string, credits: number, lastResetDate: string) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      credits,
      creditsLastResetDate: lastResetDate,
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  deductUserCredits(userId: string, amount: number) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const { credits } = this.getUserCredits(userId);
    const updatedCredits = Math.max(0, credits - amount);

    const updated: UserRecord = {
      ...user,
      credits: updatedCredits,
      creditsLastResetDate: new Date().toISOString().slice(0, 10),
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  updateUserGoogleTokens(userId: string, tokens: { accessToken?: string; expiresIn?: number }) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    
    const updated: UserRecord = {
      ...user,
      googleAccessToken: tokens.accessToken ?? user.googleAccessToken,
      googleAccessTokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
        : user.googleAccessTokenExpiresAt,
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  listAssistants(userId: string) {
    return [...this.assistants.values()]
      .filter((assistant) => assistant.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getAssistant(id: string) {
    return this.assistants.get(id);
  }

  getAssistantForUser(idOrSlug: string, userId: string) {
    const assistant =
      this.assistants.get(idOrSlug) ??
      [...this.assistants.values()].find(
        (candidate) => candidate.slug === idOrSlug || candidate.publicSlug === idOrSlug
      );
    return assistant?.userId === userId ? assistant : undefined;
  }

  getPublicAssistantBySlug(slug: string) {
    return [...this.assistants.values()].find((assistant) => assistant.isPublic && assistant.publicSlug === slug);
  }

  getDefaultAssistantForUser(userId: string) {
    const existing = this.listAssistants(userId)[0];
    if (existing) return existing;
    return this.createAssistant(userId, {
      name: "General Assistant",
      description: "A private default assistant for everyday questions.",
      systemPrompt:
        "You are ArchMind, a professional AI assistant. Follow these instructions strictly: answer clearly, helpfully, and intelligently. Use Markdown for structure and code blocks for code. Be concise unless the user asks for detail.",
      tone: "professional",
      isPublic: false,
      model: "llama-3.1-8b-instant",
      temperature: 0.7,
      icon: "Bot",
      color: "#06b6d4",
      starterPrompts: [
        "Explain a difficult topic clearly.",
        "Help me debug this code.",
        "Summarize this into action steps."
      ],
      enabledTools: []
    });
  }

  private uniqueAssistantSlug(name: string, requested?: string, ignoreId?: string) {
    const base = slugify(requested || name || "assistant") || "assistant";
    let slug = base;
    let index = 2;
    while (
      [...this.assistants.values()].some(
        (assistant) => assistant.id !== ignoreId && (assistant.slug === slug || assistant.publicSlug === slug)
      )
    ) {
      slug = `${base}-${index}`;
      index += 1;
    }
    return slug;
  }

  createAssistant(userId: string, input: AssistantCreateInput) {
    const id = randomUUID();
    const createdAt = now();
    const isPublic = input.visibility ? input.visibility === "public" : input.isPublic;
    const slug = this.uniqueAssistantSlug(input.name, input.slug, id);
    const systemPrompt = normalizeInstructions(input);
    if (!systemPrompt) throw new HttpError(400, "Assistant instructions are required", "VALIDATION_ERROR");
    const assistant: AssistantRecord = {
      id,
      userId,
      createdByUserId: userId,
      name: input.name,
      slug,
      description: input.description,
      systemPrompt,
      tone: input.tone,
      isPublic,
      visibility: isPublic ? "public" : "private",
      publicSlug: isPublic ? slug : undefined,
      model: input.model,
      temperature: input.temperature,
      icon: input.icon,
      color: input.color,
      starterPrompts: input.starterPrompts,
      enabledTools: input.enabledTools,
      version: 1,
      createdAt,
      updatedAt: createdAt
    };
    this.assistants.set(id, assistant);
    this.recordEvent(id, "assistant_created", 0, {});
    this.persist();
    return assistant;
  }

  updateAssistant(id: string, userId: string, input: AssistantUpdateInput) {
    const assistant = this.getAssistantForUser(id, userId);
    if (!assistant) return undefined;
    const nextIsPublic = input.visibility ? input.visibility === "public" : input.isPublic ?? assistant.isPublic;
    const nextSlug =
      input.slug || (input.name && input.name !== assistant.name)
        ? this.uniqueAssistantSlug(input.name ?? assistant.name, input.slug ?? assistant.slug, assistant.id)
        : assistant.slug;
    const nextSystemPrompt = normalizeInstructions(input) ?? assistant.systemPrompt;

    const updated: AssistantRecord = {
      ...assistant,
      ...input,
      slug: nextSlug,
      systemPrompt: nextSystemPrompt,
      isPublic: nextIsPublic,
      visibility: nextIsPublic ? "public" : "private",
      publicSlug: nextIsPublic ? nextSlug : undefined,
      starterPrompts: input.starterPrompts ?? assistant.starterPrompts,
      enabledTools: input.enabledTools ?? assistant.enabledTools,
      version: assistant.version + 1,
      updatedAt: now()
    };
    this.assistants.set(assistant.id, updated);
    this.recordEvent(assistant.id, "assistant_updated", 0, { version: updated.version });
    this.persist();
    return updated;
  }

  duplicateAssistant(id: string, userId: string) {
    const assistant = this.getAssistantForUser(id, userId);
    if (!assistant) return undefined;
    return this.createAssistant(userId, {
      name: `${assistant.name} Copy`,
      description: assistant.description ?? "",
      systemPrompt: assistant.systemPrompt,
      tone: assistant.tone,
      isPublic: false,
      model: assistant.model,
      temperature: assistant.temperature,
      icon: assistant.icon ?? "Bot",
      color: assistant.color ?? "#06b6d4",
      starterPrompts: assistant.starterPrompts,
      enabledTools: assistant.enabledTools
    });
  }

  deleteAssistant(id: string, userId: string) {
    const assistant = this.getAssistantForUser(id, userId);
    if (!assistant) return false;
    this.assistants.delete(assistant.id);
    for (const [sourceId, source] of this.sources.entries()) {
      if (source.assistantId === assistant.id) this.sources.delete(sourceId);
    }
    for (const [actionId, action] of this.actions.entries()) {
      if (action.assistantId === assistant.id) this.actions.delete(actionId);
    }
    this.clearConversationsForAssistant(assistant.id, userId);
    this.persist();
    return true;
  }

  clearConversationsForAssistant(id: string, userId: string) {
    const assistant = this.getAssistantForUser(id, userId);
    if (!assistant) return false;
    for (const [conversationId, conversation] of this.conversations.entries()) {
      if (conversation.assistantId === assistant.id) {
        this.conversations.delete(conversationId);
        for (const [messageId, message] of this.messages.entries()) {
          if (message.conversationId === conversationId) this.messages.delete(messageId);
        }
      }
    }
    this.persist();
    return true;
  }

  listActions(assistantId: string) {
    return [...this.actions.values()]
      .filter((action) => action.assistantId === assistantId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  createAction(assistantId: string, input: AssistantActionInput) {
    const createdAt = now();
    const action: AssistantActionRecord = {
      id: randomUUID(),
      assistantId,
      name: input.name,
      type: input.type,
      enabled: input.enabled,
      config: input.config,
      createdAt,
      updatedAt: createdAt
    };
    this.actions.set(action.id, action);
    this.persist();
    return action;
  }

  updateAction(assistantId: string, actionId: string, input: AssistantActionUpdateInput) {
    const action = this.actions.get(actionId);
    if (!action || action.assistantId !== assistantId) return undefined;
    const updated: AssistantActionRecord = {
      ...action,
      ...input,
      config: input.config ?? action.config,
      updatedAt: now()
    };
    this.actions.set(actionId, updated);
    this.persist();
    return updated;
  }

  deleteAction(assistantId: string, actionId: string) {
    const action = this.actions.get(actionId);
    if (!action || action.assistantId !== assistantId) return false;
    this.actions.delete(actionId);
    this.persist();
    return true;
  }

  createSource(assistantId: string, data: { type: DataSourceRecord["type"]; name: string; url?: string; text?: string }) {
    const id = randomUUID();
    const text = data.text ?? `Source ${data.name} is queued for ingestion.`;
    const chunks = chunkText(text, data.name, id, { assistantId, filename: data.name });
    const source: DataSourceRecord = {
      id,
      assistantId,
      type: data.type,
      name: data.name,
      url: data.url,
      status: "ready",
      chunkCount: chunks.length,
      tokenCount: countTokens(text),
      chunks,
      createdAt: now(),
      updatedAt: now()
    };
    this.sources.set(id, source);
    this.recordEvent(assistantId, "source_ready", source.tokenCount, { sourceId: id, type: data.type });
    this.persist();
    return source;
  }

  createKnowledgeSource(input: {
    id: string;
    userId: string;
    assistantId: string;
    type: DataSourceRecord["type"];
    originalFilename: string;
    safeFilename: string;
    mimeType?: string;
    sizeBytes: number;
    storagePath: string;
  }) {
    const createdAt = now();
    const source: DataSourceRecord = {
      id: input.id,
      userId: input.userId,
      assistantId: input.assistantId,
      type: input.type,
      name: input.originalFilename,
      originalFilename: input.originalFilename,
      safeFilename: input.safeFilename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      status: "processing",
      chunkCount: 0,
      tokenCount: 0,
      chunks: [],
      createdAt,
      updatedAt: createdAt
    };
    this.sources.set(source.id, source);
    this.persist();
    return source;
  }

  markKnowledgeSourceReady(
    id: string,
    input: { text: string; chunks?: RetrievedChunk[]; extractedTextLength?: number }
  ) {
    const source = this.sources.get(id);
    if (!source) return undefined;
    const chunks =
      input.chunks ??
      chunkText(input.text, source.name, source.id, {
        userId: source.userId,
        assistantId: source.assistantId,
        filename: source.originalFilename ?? source.name
      });
    const updated: DataSourceRecord = {
      ...source,
      status: "ready",
      chunkCount: chunks.length,
      tokenCount: countTokens(input.text),
      extractedTextLength: input.extractedTextLength ?? input.text.length,
      errorMessage: undefined,
      chunks,
      updatedAt: now()
    };
    this.sources.set(id, updated);
    this.recordEvent(source.assistantId, "knowledge_ready", updated.tokenCount, {
      fileId: id,
      filename: source.originalFilename ?? source.name,
      chunkCount: chunks.length
    });
    this.persist();
    return updated;
  }

  markKnowledgeSourceFailed(id: string, errorMessage: string) {
    const source = this.sources.get(id);
    if (!source) return undefined;
    const updated: DataSourceRecord = {
      ...source,
      status: "failed",
      errorMessage,
      chunkCount: 0,
      tokenCount: 0,
      chunks: [],
      updatedAt: now()
    };
    this.sources.set(id, updated);
    this.recordEvent(source.assistantId, "knowledge_failed", 0, { fileId: id });
    this.persist();
    return updated;
  }

  listKnowledgeFiles(assistantId: string, userId: string) {
    return this.listSources(assistantId)
      .filter((source) => source.userId === userId && Boolean(source.originalFilename))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getKnowledgeFile(assistantId: string, userId: string, fileId: string) {
    const source = this.sources.get(fileId);
    if (!source || source.assistantId !== assistantId || source.userId !== userId || !source.originalFilename) {
      return undefined;
    }
    return source;
  }

  deleteKnowledgeFile(assistantId: string, userId: string, fileId: string) {
    const source = this.getKnowledgeFile(assistantId, userId, fileId);
    if (!source) return undefined;
    this.sources.delete(fileId);
    this.persist();
    return source;
  }

  listSources(assistantId: string) {
    return [...this.sources.values()].filter((source) => source.assistantId === assistantId);
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  retrieveChunks(assistantId: string, query: string, limit = 4, userId?: string): RetrievedChunk[] {
    const terms = new Set(query.toLowerCase().split(/\W+/).filter((term) => term.length > 2));
    return this.listSources(assistantId)
      .filter((source) => source.status === "ready")
      .filter((source) => !source.userId || source.userId === userId)
      .flatMap((source) => source.chunks)
      .map((chunk) => {
        const scoreBoost = chunk.text
          .toLowerCase()
          .split(/\W+/)
          .filter((word) => terms.has(word)).length;
        return { ...chunk, similarity: Math.min(0.99, chunk.similarity + scoreBoost * 0.03) };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  getConversation(id: string) {
    return this.conversations.get(id);
  }

  listConversationsForAssistant(assistantId: string, userId: string) {
    return [...this.conversations.values()]
      .filter((conversation) => conversation.assistantId === assistantId && conversation.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  ensureConversation(input: { assistantId: string; userId: string; sessionId?: string; conversationId?: string }) {
    if (input.conversationId) {
      const existing = this.conversations.get(input.conversationId);
      if (existing) {
        if (existing.assistantId !== input.assistantId) {
          throw new HttpError(403, "Conversation belongs to another assistant", "CONVERSATION_ASSISTANT_MISMATCH");
        }
        if (existing.userId !== input.userId) {
          throw new HttpError(403, "Conversation belongs to another user", "CONVERSATION_USER_MISMATCH");
        }
        return existing;
      }
    }

    const conversation: ConversationRecord = {
      id: randomUUID(),
      assistantId: input.assistantId,
      userId: input.userId,
      sessionId: input.sessionId,
      title: "New conversation",
      messageCount: 0,
      createdAt: now()
    };
    this.conversations.set(conversation.id, conversation);
    this.persist();
    return conversation;
  }

  addMessage(input: Omit<MessageRecord, "id" | "createdAt">) {
    const message: MessageRecord = {
      id: randomUUID(),
      createdAt: now(),
      ...input
    };
    this.messages.set(message.id, message);
    const conversation = this.conversations.get(input.conversationId);
    if (conversation) {
      this.conversations.set(conversation.id, {
        ...conversation,
        title: conversation.title === "New conversation" && input.role === "user" ? input.content.slice(0, 80) : conversation.title,
        messageCount: conversation.messageCount + 1
      });
    }
    this.persist();
    return message;
  }

  listMessages(conversationId: string) {
    return [...this.messages.values()]
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  listMessagesForUser(conversationId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return [];
    if (conversation.userId !== userId) return [];
    return this.listMessages(conversationId);
  }

  listMessagesForAssistant(conversationId: string, assistantId: string, userId: string) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.assistantId !== assistantId || conversation.userId !== userId) return [];
    return this.listMessages(conversationId);
  }

  recordEvent(assistantId: string, eventType: string, tokens: number, metadata: Record<string, unknown>) {
    const event: AnalyticsEventRecord = {
      id: randomUUID(),
      assistantId,
      eventType,
      tokens,
      metadata,
      createdAt: now()
    };
    this.events.set(event.id, event);
    this.persist();
    return event;
  }

  analyticsOverview(userId: string) {
    const assistants = this.listAssistants(userId);
    const assistantIds = new Set(assistants.map((assistant) => assistant.id));
    const events = [...this.events.values()].filter((event) => assistantIds.has(event.assistantId));
    const conversations = [...this.conversations.values()].filter((conversation) => assistantIds.has(conversation.assistantId));

    return {
      assistants: assistants.length,
      sources: [...this.sources.values()].filter((source) => assistantIds.has(source.assistantId)).length,
      conversations: conversations.length,
      messages: [...this.messages.values()].filter((message) => conversations.some((conversation) => conversation.id === message.conversationId)).length,
      tokens: events.reduce((sum, event) => sum + event.tokens, 0),
      topEvents: Object.entries(
        events.reduce<Record<string, number>>((acc, event) => {
          acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
          return acc;
        }, {})
      ).map(([eventType, count]) => ({ eventType, count }))
    };
  }

  assistantAnalytics(assistantId: string) {
    const conversations = [...this.conversations.values()].filter((conversation) => conversation.assistantId === assistantId);
    const events = [...this.events.values()].filter((event) => event.assistantId === assistantId);
    return {
      assistantId,
      conversations: conversations.length,
      messageCount: conversations.reduce((sum, conversation) => sum + conversation.messageCount, 0),
      tokens: events.reduce((sum, event) => sum + event.tokens, 0),
      events
    };
  }

  userProfileStats(userId: string) {
    const assistants = this.listAssistants(userId);
    const assistantIds = new Set(assistants.map((assistant) => assistant.id));
    const conversations = [...this.conversations.values()].filter((conversation) => conversation.userId === userId);
    const conversationIds = new Set(conversations.map((conversation) => conversation.id));
    return {
      assistants: assistants.length,
      conversations: conversations.length,
      messages: [...this.messages.values()].filter((message) => conversationIds.has(message.conversationId)).length,
      sources: [...this.sources.values()].filter((source) => assistantIds.has(source.assistantId)).length
    };
  }

  listBridgeLogs(assistantId: string) {
    return [...this.bridgeLogs.values()]
      .filter((log) => log.assistantId === assistantId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  getBridgeLog(id: string) {
    return this.bridgeLogs.get(id);
  }

  createBridgeLog(log: ExecutionBridgeLogRecord) {
    this.bridgeLogs.set(log.id, log);
    this.persist();
    return log;
  }

  updateBridgeLog(id: string, updates: Partial<ExecutionBridgeLogRecord>) {
    const existing = this.bridgeLogs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.bridgeLogs.set(id, updated);
    this.persist();
    return updated;
  }

  listBridgeApprovals(assistantId: string) {
    return [...this.bridgeApprovals.values()]
      .filter((app) => app.assistantId === assistantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBridgeApproval(id: string) {
    return this.bridgeApprovals.get(id);
  }

  createBridgeApproval(approval: ExecutionApprovalRecord) {
    this.bridgeApprovals.set(approval.id, approval);
    this.persist();
    return approval;
  }

  updateBridgeApproval(id: string, status: "approved" | "rejected") {
    const existing = this.bridgeApprovals.get(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      status,
      updatedAt: now()
    };
    this.bridgeApprovals.set(id, updated);
    this.persist();
    return updated;
  }

  // ══════════════════════════════════════════════════
  // Notion OAuth State Management
  // ══════════════════════════════════════════════════

  createNotionOAuthState(state: string, userId: string) {
    const record: NotionOAuthStateRecord = {
      state,
      userId,
      createdAt: Date.now()
    };
    this.notionOAuthStates.set(state, record);
    this.cleanExpiredNotionOAuthStates();
    this.persist();
    return record;
  }

  consumeNotionOAuthState(state: string) {
    const record = this.notionOAuthStates.get(state);
    if (!record) return undefined;

    // Check TTL (10 minutes)
    const TEN_MINUTES = 10 * 60 * 1000;
    if (Date.now() - record.createdAt > TEN_MINUTES) {
      this.notionOAuthStates.delete(state);
      this.persist();
      return undefined;
    }

    // One-time use — consume (delete) the state
    this.notionOAuthStates.delete(state);
    this.persist();
    return record;
  }

  cleanExpiredNotionOAuthStates() {
    const TEN_MINUTES = 10 * 60 * 1000;
    const cutoff = Date.now() - TEN_MINUTES;
    for (const [key, record] of this.notionOAuthStates) {
      if (record.createdAt < cutoff) {
        this.notionOAuthStates.delete(key);
      }
    }
  }

  // ══════════════════════════════════════════════════
  // Notion Token Management
  // ══════════════════════════════════════════════════

  updateUserNotionTokens(userId: string, tokens: {
    accessToken: string;
    workspaceId?: string;
    workspaceName?: string;
    workspaceIcon?: string;
    botId?: string;
  }) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      notionAccessToken: tokens.accessToken,
      notionWorkspaceId: tokens.workspaceId ?? user.notionWorkspaceId,
      notionWorkspaceName: tokens.workspaceName ?? user.notionWorkspaceName,
      notionWorkspaceIcon: tokens.workspaceIcon ?? user.notionWorkspaceIcon,
      notionBotId: tokens.botId ?? user.notionBotId,
      notionConnectedAt: now(),
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  clearUserNotionTokens(userId: string) {
    const user = this.users.get(userId);
    if (!user) return undefined;
    const updated: UserRecord = {
      ...user,
      notionAccessToken: undefined,
      notionWorkspaceId: undefined,
      notionWorkspaceName: undefined,
      notionWorkspaceIcon: undefined,
      notionBotId: undefined,
      notionConnectedAt: undefined,
      updatedAt: now()
    };
    this.users.set(userId, updated);
    this.persist();
    return updated;
  }

  // ══════════════════════════════════════════════════
  // Notion Activity Logging
  // ══════════════════════════════════════════════════

  createNotionActivityLog(log: NotionActivityLogRecord) {
    this.notionActivityLogs.set(log.id, log);
    this.persist();
    return log;
  }

  listNotionActivityLogs(userId: string, limit = 50) {
    return [...this.notionActivityLogs.values()]
      .filter((log) => log.userId === userId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  getPlatformState() {
    return this.platform;
  }

  savePlatformState(state: PlatformState) {
    this.platform = state;
    this.persist();
  }
}
