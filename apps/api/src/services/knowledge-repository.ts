import { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataSourceRecord, RetrievedChunk } from "../types";

const KNOWLEDGE_BUCKET = "knowledge-files";

type StoredSource = DataSourceRecord & { storagePath: string };

type KnowledgePayload = {
  userId: string;
  originalFilename: string;
  safeFilename: string;
  mimeType?: string;
  sizeBytes: number;
  storagePath: string;
  extractedTextLength?: number;
  errorMessage?: string;
  chunks?: RetrievedChunk[];
};

function payloadFromRow(row: Record<string, unknown>): KnowledgePayload {
  try {
    const payload = JSON.parse(String(row.url ?? "{}")) as Partial<KnowledgePayload>;
    if (payload.userId && payload.storagePath) {
      return {
        userId: payload.userId,
        originalFilename: payload.originalFilename ?? String(row.name),
        safeFilename: payload.safeFilename ?? payload.originalFilename ?? String(row.name),
        mimeType: payload.mimeType,
        sizeBytes: Number(payload.sizeBytes ?? 0),
        storagePath: payload.storagePath,
        extractedTextLength: Number(payload.extractedTextLength ?? 0),
        errorMessage: payload.errorMessage,
        chunks: Array.isArray(payload.chunks) ? payload.chunks : []
      };
    }
  } catch {
    // Legacy URL sources are not knowledge uploads.
  }
  return {
    userId: "",
    originalFilename: String(row.name),
    safeFilename: String(row.name),
    sizeBytes: 0,
    storagePath: String(row.s3_key ?? ""),
    chunks: []
  };
}

function sourceFromRow(row: Record<string, unknown>): StoredSource {
  const payload = payloadFromRow(row);
  return {
    id: String(row.id),
    userId: payload.userId || undefined,
    assistantId: String(row.assistant_id),
    type: (row.type === "pdf" ? "pdf" : "text") as DataSourceRecord["type"],
    name: String(row.name),
    originalFilename: payload.originalFilename,
    safeFilename: payload.safeFilename,
    mimeType: payload.mimeType,
    sizeBytes: payload.sizeBytes,
    storagePath: payload.storagePath,
    extractedTextLength: payload.extractedTextLength ?? 0,
    errorMessage: payload.errorMessage,
    s3Key: row.s3_key ? String(row.s3_key) : undefined,
    status: row.status === "error" ? "failed" : String(row.status) as DataSourceRecord["status"],
    chunkCount: Number(row.chunk_count ?? 0),
    tokenCount: Number(row.token_count ?? 0),
    chunks: payload.chunks ?? [],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString()
  };
}

function payloadFor(source: StoredSource, changes: Partial<KnowledgePayload> = {}): KnowledgePayload {
  return {
    userId: source.userId ?? "",
    originalFilename: source.originalFilename ?? source.name,
    safeFilename: source.safeFilename ?? source.originalFilename ?? source.name,
    mimeType: source.mimeType,
    sizeBytes: source.sizeBytes ?? 0,
    storagePath: source.storagePath,
    extractedTextLength: source.extractedTextLength ?? 0,
    errorMessage: source.errorMessage,
    chunks: source.chunks,
    ...changes
  };
}

function words(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

export class KnowledgeRepository {
  private pool: Pool;
  private bucketReady?: Promise<void>;

  constructor(databaseUrl: string, private supabase: SupabaseClient) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  private async ensureBucket() {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const { error: lookupError } = await this.supabase.storage.getBucket(KNOWLEDGE_BUCKET);
        if (!lookupError) return;
        const { error } = await this.supabase.storage.createBucket(KNOWLEDGE_BUCKET, {
          public: false,
          fileSizeLimit: 15 * 1024 * 1024
        });
        if (error && !/already exists/i.test(error.message)) throw error;
      })();
    }
    return this.bucketReady;
  }

  async create(input: {
    id: string;
    userId: string;
    assistantId: string;
    name: string;
    originalFilename: string;
    safeFilename: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
    type: DataSourceRecord["type"];
  }) {
    const result = await this.pool.query(
      `insert into data_sources
        (id, assistant_id, type, name, s3_key, url, status, chunk_count, token_count)
       values ($1, $2, $3, $4, $5, $6, 'pending', 0, 0)
       returning *`,
      [input.id, input.assistantId, input.type === "pdf" ? "pdf" : "text", input.name, input.storagePath, JSON.stringify({ ...input, chunks: [] })]
    );
    return sourceFromRow(result.rows[0]!);
  }

  async upload(storagePath: string, buffer: Buffer, contentType: string) {
    await this.ensureBucket();
    const { error } = await this.supabase.storage.from(KNOWLEDGE_BUCKET).upload(storagePath, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: false
    });
    if (error) throw error;
  }

  async download(storagePath: string) {
    await this.ensureBucket();
    const { data, error } = await this.supabase.storage.from(KNOWLEDGE_BUCKET).download(storagePath);
    if (error || !data) throw error ?? new Error("Uploaded file could not be found.");
    return Buffer.from(await data.arrayBuffer());
  }

  async markProcessing(id: string) {
    const result = await this.pool.query(
      "update data_sources set status = 'processing' where id = $1 returning *",
      [id]
    );
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async markReady(id: string, textLength: number, chunks: RetrievedChunk[]) {
    const current = await this.byId(id);
    if (!current) throw new Error("Knowledge source no longer exists.");
    const result = await this.pool.query(
      `update data_sources set status = 'ready', url = $2, chunk_count = $3, token_count = $4 where id = $1 returning *`,
      [id, JSON.stringify(payloadFor(current, { extractedTextLength: textLength, errorMessage: undefined, chunks })), chunks.length, words(chunks.map((chunk) => chunk.text).join(" ")).length]
    );
    return sourceFromRow(result.rows[0]!);
  }

  async markFailed(id: string, message: string) {
    const current = await this.byId(id);
    if (!current) return undefined;
    const result = await this.pool.query(
      "update data_sources set status = 'error', url = $2 where id = $1 returning *",
      [id, JSON.stringify(payloadFor(current, { errorMessage: message.slice(0, 500), chunks: [] }))]
    );
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async list(assistantId: string, userId: string) {
    const result = await this.pool.query(
      "select * from data_sources where assistant_id = $1 order by created_at desc",
      [assistantId]
    );
    return result.rows.map(sourceFromRow).filter((source) => source.userId === userId);
  }

  private async byId(id: string) {
    const result = await this.pool.query("select * from data_sources where id = $1", [id]);
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async get(assistantId: string, userId: string, id: string) {
    const result = await this.pool.query(
      "select * from data_sources where id = $1 and assistant_id = $2",
      [id, assistantId]
    );
    const source = result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
    return source?.userId === userId ? source : undefined;
  }

  async delete(assistantId: string, userId: string, id: string) {
    const source = await this.get(assistantId, userId, id);
    if (!source) return undefined;
    await this.pool.query("delete from data_sources where id = $1 and assistant_id = $2", [id, assistantId]);
    if (source.storagePath) {
      const { error } = await this.supabase.storage.from(KNOWLEDGE_BUCKET).remove([source.storagePath]);
      if (error) console.error("[Knowledge] Stored object removal failed", { sourceId: id, message: error.message });
    }
    return source;
  }

  async retrieve(assistantId: string, userId: string, question: string, limit: number) {
    const result = await this.pool.query(
      "select * from data_sources where assistant_id = $1 and status = 'ready'",
      [assistantId]
    );
    const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
    return result.rows
      .map(sourceFromRow)
      .filter((source) => source.userId === userId)
      .flatMap((source) => source.chunks)
      .map((chunk) => {
        const haystack = chunk.text.toLowerCase();
        const matches = terms.filter((term) => haystack.includes(term)).length;
        return { ...chunk, similarity: terms.length > 0 ? matches / terms.length : 0 };
      })
      .filter((chunk) => chunk.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity || (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0))
      .slice(0, limit);
  }
}
