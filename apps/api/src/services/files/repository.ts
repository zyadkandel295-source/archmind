import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { Env } from "../../config/env";
import { HttpError } from "../../lib/http-error";
import { createSupabaseServerClient } from "../supabase-server";
import { MIME, MAX_FILE_BYTES, type GeneratedFile } from "./types";
import { usesManagedVercelFileQueue } from "./queue-runtime";

export const FILE_BUCKET = "generated-files";
export class FileRepository {
  readonly pool?: Pool;
  readonly directory: string;
  private storage = createSupabaseServerClient();
  private serial: Promise<unknown> = Promise.resolve();
  constructor(
    readonly env: Env,
    directory = process.env.FILE_GENERATION_LOCAL_DIR ||
      path.resolve(process.cwd(), ".archmind-data", "generated-files"),
  ) {
    this.directory = directory;
    if (env.databaseUrl)
      this.pool = new Pool({ connectionString: env.databaseUrl });
  }
  async assertConfigured() {
    if (
      this.env.nodeEnv === "production" &&
      (!this.pool ||
        (!usesManagedVercelFileQueue() && !this.env.redisUrl) ||
        !process.env.SUPABASE_SERVICE_ROLE_KEY ||
        !(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL))
    ) {
      throw new HttpError(
        503,
        "File generation requires the database, private storage, and document worker to be configured.",
        "FILES_UNAVAILABLE",
      );
    }
    if (this.pool) {
      const result = await this.pool.query(
        "select to_regclass('public.generated_files') as ready",
      );
      if (!result.rows[0]?.ready)
        throw new HttpError(
          503,
          "File generation is not set up yet. The administrator must apply migration 016.",
          "FILES_MIGRATION_REQUIRED",
        );
      const { data, error } = await this.storage.storage.getBucket(FILE_BUCKET);
      if (error || !data || data.public)
        throw new HttpError(
          503,
          "Private file storage is not configured correctly.",
          "FILES_STORAGE_UNAVAILABLE",
        );
    }
  }
  private metadataPath(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new HttpError(404, "File not found", "FILE_NOT_FOUND");
    return path.join(this.directory, `${id}.json`);
  }
  async get(id: string): Promise<GeneratedFile | undefined> {
    if (this.pool)
      return (
        await this.pool.query<{ payload: GeneratedFile }>(
          "select payload from generated_files where id=$1",
          [id],
        )
      ).rows[0]?.payload;
    try {
      return JSON.parse(await fs.readFile(this.metadataPath(id), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  async pending(): Promise<GeneratedFile[]> {
    if (this.pool)
      return (
        await this.pool.query<{ payload: GeneratedFile }>(
          "select payload from generated_files where status in ('queued','generating','rendering') order by created_at limit 500",
        )
      ).rows.map((r) => r.payload);
    return (await this.list()).filter((f) =>
      ["queued", "generating", "rendering"].includes(f.status),
    );
  }
  async list(
    userId?: string,
    conversationId?: string,
  ): Promise<GeneratedFile[]> {
    if (this.pool)
      return (
        await this.pool.query<{ payload: GeneratedFile }>(
          "select payload from generated_files where ($1::text is null or user_id=$1) and ($2::text is null or conversation_id::text=$2) order by created_at desc limit 200",
          [userId ?? null, conversationId ?? null],
        )
      ).rows.map((r) => r.payload);
    await fs.mkdir(this.directory, { recursive: true });
    const files = await Promise.all(
      (await fs.readdir(this.directory))
        .filter((n) => n.endsWith(".json"))
        .map((n) => this.get(n.slice(0, -5))),
    );
    return files
      .filter((f): f is GeneratedFile =>
        Boolean(
          f &&
          (!userId || f.userId === userId) &&
          (!conversationId || f.conversationId === conversationId),
        ),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async owned(id: string, userId: string, assistantId?: string) {
    const file = await this.get(id);
    if (
      !file ||
      file.userId !== userId ||
      (assistantId && file.assistantId !== assistantId)
    )
      throw new HttpError(404, "File not found", "FILE_NOT_FOUND");
    return file;
  }
  async save(file: GeneratedFile) {
    file.updatedAt = new Date().toISOString();
    if (this.pool) {
      await this.pool.query(
        "update generated_files set status=$2, updated_at=now(), payload=$3::jsonb where id=$1",
        [file.id, file.status, JSON.stringify(file)],
      );
    } else {
      await fs.mkdir(this.directory, { recursive: true });
      const dest = this.metadataPath(file.id),
        temporary = `${dest}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(file), { mode: 0o600 });
      await fs.rename(temporary, dest);
    }
  }
  async create(file: GeneratedFile): Promise<GeneratedFile> {
    // Serialize admission per user across every API replica, including retries.
    if (this.pool) {
      const client = await this.pool.connect();
      try {
        await client.query("begin");
        await client.query("select pg_advisory_xact_lock(hashtext($1))", [
          `files:${file.userId}`,
        ]);
        const existing = await client.query<{ payload: GeneratedFile }>(
          "select payload from generated_files where user_id=$1 and request_id=$2",
          [file.userId, file.requestId],
        );
        if (existing.rows[0]) {
          await client.query("commit");
          return existing.rows[0].payload;
        }
        const records = await client.query<{ payload: GeneratedFile }>(
          "select payload from generated_files where user_id=$1 and (created_at > now()-interval '1 day' or status in ('queued','generating','rendering'))",
          [file.userId],
        );
        this.checkLimits(records.rows.map((r) => r.payload));
        await client.query(
          "insert into generated_files(id,user_id,conversation_id,assistant_id,request_id,status,payload) values($1,$2,$3,$4,$5,$6,$7::jsonb)",
          [
            file.id,
            file.userId,
            file.conversationId,
            file.assistantId ?? null,
            file.requestId,
            file.status,
            JSON.stringify(file),
          ],
        );
        await client.query("commit");
        return file;
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }
    }
    const result = this.serial.then(async () => {
      const files = await this.list(file.userId);
      const existing = files.find((f) => f.requestId === file.requestId);
      if (existing) return existing;
      this.checkLimits(files);
      await this.save(file);
      return file;
    });
    this.serial = result.catch(() => undefined);
    return result;
  }
  private checkLimits(files: GeneratedFile[]) {
    if (
      files.filter((f) => !["completed", "failed"].includes(f.status)).length >=
      2
    )
      throw new HttpError(
        429,
        "Two files are already generating. Wait for one to finish.",
        "FILE_CONCURRENCY_LIMIT",
      );
    if (
      files.filter((f) => Date.parse(f.createdAt) > Date.now() - 86400000)
        .length >= 20
    )
      throw new HttpError(
        429,
        "Daily file-generation limit reached. Try again tomorrow.",
        "FILE_DAILY_LIMIT",
      );
  }
  async upload(file: GeneratedFile, bytes: Buffer) {
    if (bytes.length < 100 || bytes.length > MAX_FILE_BYTES)
      throw new Error("Generated file is empty or exceeds 25 MB.");
    const key = `${file.id}/${file.filename}`;
    if (this.pool) {
      const { error } = await this.storage.storage
        .from(FILE_BUCKET)
        .upload(key, bytes, { contentType: MIME[file.format], upsert: true });
      if (error) throw new Error("Private storage upload failed.");
    } else {
      await fs.writeFile(
        path.join(this.directory, `${file.id}.${file.format}`),
        bytes,
        { mode: 0o600 },
      );
    }
    file.storagePath = key;
    file.size = bytes.length;
  }
  async download(file: GeneratedFile) {
    if (file.status !== "completed" || !file.storagePath)
      throw new HttpError(
        409,
        "The file is not ready to download.",
        "FILE_NOT_READY",
      );
    if (this.pool) {
      const { data, error } = await this.storage.storage
        .from(FILE_BUCKET)
        .download(file.storagePath);
      if (error || !data)
        throw new HttpError(
          503,
          "File storage is temporarily unavailable. Please retry.",
          "FILE_STORAGE_UNAVAILABLE",
        );
      return Buffer.from(await data.arrayBuffer());
    }
    return fs.readFile(path.join(this.directory, `${file.id}.${file.format}`));
  }
  async close() {
    await this.pool?.end();
  }
}
