import { Pool } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantRecord, DataSourceRecord, RetrievedChunk } from "../types";

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
  const userId = row.user_id ? String(row.user_id) : payload.userId || undefined;
  const originalFilename = row.original_filename ? String(row.original_filename) : payload.originalFilename;
  const safeFilename = row.safe_filename ? String(row.safe_filename) : payload.safeFilename;
  const storagePath = row.storage_path ? String(row.storage_path) : payload.storagePath;
  const mimeType = row.mime_type ? String(row.mime_type) : payload.mimeType;
  const sizeBytes = row.size_bytes == null ? payload.sizeBytes : Number(row.size_bytes);
  const extractedTextLength = row.extracted_text_length == null
    ? payload.extractedTextLength ?? 0
    : Number(row.extracted_text_length);
  const errorMessage = row.processing_error ? String(row.processing_error) : payload.errorMessage;
  return {
    id: String(row.id),
    userId,
    assistantId: String(row.assistant_id),
    type: (row.type === "pdf" ? "pdf" : "text") as DataSourceRecord["type"],
    name: String(row.name),
    originalFilename,
    safeFilename,
    mimeType,
    sizeBytes,
    storagePath,
    extractedTextLength,
    errorMessage,
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

function chunkFromRow(row: Record<string, unknown>): RetrievedChunk {
  return {
    sourceId: String(row.source_id),
    sourceName: String(row.document_name),
    userId: String(row.user_id),
    assistantId: String(row.assistant_id),
    fileId: String(row.source_id),
    filename: String(row.document_name),
    chunkIndex: Number(row.chunk_index),
    page: Number(row.page_number),
    text: String(row.content),
    similarity: 0
  };
}

function rankChunks(chunks: RetrievedChunk[], question: string, limit: number) {
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
  return chunks
    .map((chunk) => {
      const haystack = chunk.text.toLowerCase();
      const matches = terms.filter((term) => haystack.includes(term)).length;
      return { ...chunk, similarity: terms.length > 0 ? matches / terms.length : 0 };
    })
    .filter((chunk) => chunk.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0))
    .slice(0, limit);
}

export class KnowledgeRepository {
  private pool: Pool;

  constructor(databaseUrl: string, private supabase: SupabaseClient) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async ensureAssistant(input: { assistant: AssistantRecord; userEmail: string }) {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const existingUser = await client.query("select id from users where lower(email) = lower($1) limit 1", [input.userEmail]);
      const databaseUserId = existingUser.rows[0]?.id ?? input.assistant.userId;
      if (!existingUser.rows[0]) {
        await client.query(
          "insert into users(id, email, plan, token_usage, created_at, updated_at) values($1, $2, 'free', 0, now(), now()) on conflict(email) do nothing",
          [databaseUserId, input.userEmail]
        );
      }
      await client.query(
        `insert into assistants(id, user_id, name, description, system_prompt, tone, is_public, public_slug, model, temperature, version, created_at, slug, visibility, icon, color, starter_prompts, enabled_tools, updated_at)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         on conflict(id) do update set name=excluded.name, description=excluded.description, system_prompt=excluded.system_prompt, tone=excluded.tone, model=excluded.model, temperature=excluded.temperature, updated_at=excluded.updated_at`,
        [
          input.assistant.id, databaseUserId, input.assistant.name, input.assistant.description ?? "", input.assistant.systemPrompt ?? "", input.assistant.tone,
          input.assistant.isPublic, input.assistant.publicSlug ?? null, input.assistant.model, input.assistant.temperature, input.assistant.version,
          input.assistant.createdAt, input.assistant.slug, input.assistant.visibility, input.assistant.icon ?? "Bot", input.assistant.color ?? "#06b6d4",
          JSON.stringify(input.assistant.starterPrompts ?? []), JSON.stringify(input.assistant.enabledTools ?? []), input.assistant.updatedAt
        ]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
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
        (id, user_id, assistant_id, type, name, original_filename, safe_filename, mime_type, size_bytes, storage_path, s3_key, url, status, chunk_count, token_count, extracted_text_length)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10, $11, 'pending', 0, 0, 0)
       returning *`,
      [
        input.id,
        input.userId,
        input.assistantId,
        input.type === "pdf" ? "pdf" : "text",
        input.name,
        input.originalFilename,
        input.safeFilename,
        input.mimeType,
        input.sizeBytes,
        input.storagePath,
        JSON.stringify({ ...input, chunks: [] })
      ]
    );
    return sourceFromRow(result.rows[0]!);
  }

  async upload(storagePath: string, buffer: Buffer, contentType: string) {
    const { error } = await this.supabase.storage.from(KNOWLEDGE_BUCKET).upload(storagePath, buffer, {
      contentType: contentType || "application/octet-stream",
      upsert: false
    });
    if (error) throw error;
  }

  async download(storagePath: string) {
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
    if (!current.userId) throw new Error("Knowledge source is missing its owner scope.");
    if (chunks.some((chunk) => chunk.sourceId !== current.id || chunk.assistantId !== current.assistantId || chunk.userId !== current.userId)) {
      throw new Error("Knowledge chunk scope does not match its source.");
    }
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query("delete from knowledge_chunks where source_id = $1", [id]);
      for (const chunk of chunks) {
        await client.query(
          `insert into knowledge_chunks
            (source_id, assistant_id, user_id, document_name, page_number, chunk_index, content, token_count)
           values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            current.id,
            current.assistantId,
            current.userId,
            current.originalFilename ?? current.name,
            chunk.page ?? 1,
            chunk.chunkIndex ?? 0,
            chunk.text,
            words(chunk.text).length
          ]
        );
      }
      const result = await client.query(
        `update data_sources
         set status = 'ready', url = $2, chunk_count = $3, token_count = $4,
             extracted_text_length = $5, processing_error = null
         where id = $1
         returning *`,
        [
          id,
          JSON.stringify(payloadFor(current, { extractedTextLength: textLength, errorMessage: undefined, chunks })),
          chunks.length,
          words(chunks.map((chunk) => chunk.text).join(" ")).length,
          textLength
        ]
      );
      await client.query("commit");
      return sourceFromRow(result.rows[0]!);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async markFailed(id: string, message: string) {
    const current = await this.byId(id);
    if (!current) return undefined;
    const result = await this.pool.query(
      "update data_sources set status = 'error', url = $2, processing_error = $3 where id = $1 returning *",
      [id, JSON.stringify(payloadFor(current, { errorMessage: message.slice(0, 500), chunks: [] })), message.slice(0, 500)]
    );
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async list(assistantId: string, userId: string) {
    const result = await this.pool.query(
      `select ds.* from data_sources ds
       inner join assistants a on a.id = ds.assistant_id
       where ds.assistant_id = $1 and a.user_id = $2 and (ds.user_id = $2 or ds.user_id is null)
       order by ds.created_at desc`,
      [assistantId, userId]
    );
    // The request has already established assistant ownership. Assistant IDs are
    // globally unique, so scoping by assistant is the durable isolation boundary
    // even when a legacy source row predates explicit owner metadata.
    return result.rows.map(sourceFromRow);
  }

  private async byId(id: string) {
    const result = await this.pool.query("select * from data_sources where id = $1", [id]);
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async get(assistantId: string, userId: string, id: string) {
    const result = await this.pool.query(
      `select ds.* from data_sources ds
       inner join assistants a on a.id = ds.assistant_id
       where ds.id = $1 and ds.assistant_id = $2 and a.user_id = $3 and (ds.user_id = $3 or ds.user_id is null)`,
      [id, assistantId, userId]
    );
    return result.rows[0] ? sourceFromRow(result.rows[0]) : undefined;
  }

  async delete(assistantId: string, userId: string, id: string) {
    const source = await this.get(assistantId, userId, id);
    if (!source) return undefined;
    await this.pool.query(
      `delete from data_sources ds using assistants a
       where ds.id = $1 and ds.assistant_id = $2 and a.id = ds.assistant_id
         and a.user_id = $3 and (ds.user_id = $3 or ds.user_id is null)`,
      [id, assistantId, userId]
    );
    if (source.storagePath) {
      const { error } = await this.supabase.storage.from(KNOWLEDGE_BUCKET).remove([source.storagePath]);
      if (error) console.error("[Knowledge] Stored object removal failed", { sourceId: id, message: error.message });
    }
    return source;
  }

  async retrieve(assistantId: string, userId: string, question: string, limit: number) {
    const durable = await this.pool.query(
      `select kc.* from knowledge_chunks kc
       inner join data_sources ds on ds.id = kc.source_id
       inner join assistants a on a.id = ds.assistant_id
       where kc.assistant_id = $1 and kc.user_id = $2
         and ds.assistant_id = $1 and ds.user_id = $2 and ds.status = 'ready'
         and a.user_id = $2`,
      [assistantId, userId]
    );
    if (durable.rows.length > 0) {
      const retrieved = rankChunks(durable.rows.map(chunkFromRow), question, limit);
      console.info("[Knowledge] Assistant-scoped retrieval", {
        assistantId,
        userId,
        storage: "knowledge_chunks",
        candidateChunkCount: durable.rows.length,
        retrievedChunkCount: retrieved.length,
        sourceIds: [...new Set(retrieved.map((chunk) => chunk.sourceId))]
      });
      return retrieved;
    }

    // Legacy uploads stored indexed chunks inside the source payload. The
    // compatibility read still joins the authoritative assistant owner, so it
    // cannot broaden access to another assistant or user.
    const legacy = await this.pool.query(
      `select ds.* from data_sources ds
       inner join assistants a on a.id = ds.assistant_id
       where ds.assistant_id = $1 and a.user_id = $2 and ds.status = 'ready'
         and (ds.user_id = $2 or ds.user_id is null)`,
      [assistantId, userId]
    );
    const candidates = legacy.rows.map(sourceFromRow).flatMap((source) => source.chunks);
    const retrieved = rankChunks(candidates, question, limit);
    console.info("[Knowledge] Assistant-scoped retrieval", {
      assistantId,
      userId,
      storage: "legacy_source_payload",
      candidateChunkCount: candidates.length,
      retrievedChunkCount: retrieved.length,
      sourceIds: [...new Set(retrieved.map((chunk) => chunk.sourceId))]
    });
    return retrieved;
  }
}
