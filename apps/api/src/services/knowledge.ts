import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import mammoth from "mammoth";
import type { MemoryStore } from "../db/memory";
import type { Env } from "../config/env";
import { HttpError } from "../lib/http-error";
import type { DataSourceRecord, RetrievedChunk } from "../types";
import { KnowledgeRepository } from "./knowledge-repository";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "./supabase-server";

export const KNOWLEDGE_MAX_FILE_SIZE = 15 * 1024 * 1024;

const SUPPORTED_TYPES: Record<string, DataSourceRecord["type"]> = {
  ".txt": "text",
  ".md": "md",
  ".pdf": "pdf",
  ".docx": "docx",
  ".csv": "csv",
  ".json": "json"
};

function sanitizeFilename(filename: string) {
  const parsed = path.parse(filename.replace(/\\/g, "/"));
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  const ext = parsed.ext.toLowerCase().replace(/[^.\w]/g, "");
  return `${base || "knowledge-file"}${ext}`;
}

function normalizeExtractedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function assertReadableText(text: string, label: string) {
  const normalized = normalizeExtractedText(text);
  if (normalized.length < 1) {
    throw new Error(`${label} did not contain readable text.`);
  }
  return normalized;
}

function chunkExtractedText(
  pages: Array<{ page: number; text: string }>,
  source: Pick<DataSourceRecord, "id" | "assistantId" | "userId" | "name" | "originalFilename">
): RetrievedChunk[] {
  const chunks: RetrievedChunk[] = [];
  for (const page of pages) {
    const pageWords = page.text.trim().split(/\s+/).filter(Boolean);
    for (let index = 0; index < pageWords.length; index += 160) {
      chunks.push({
        sourceId: source.id,
        sourceName: source.originalFilename ?? source.name,
        userId: source.userId,
        assistantId: source.assistantId,
        fileId: source.id,
        filename: source.originalFilename ?? source.name,
        chunkIndex: chunks.length,
        page: page.page,
        text: pageWords.slice(index, index + 200).join(" "),
        similarity: 0
      });
    }
  }
  return chunks;
}

async function extractPages(buffer: Buffer, extension: string, filename: string) {

  if (extension === ".txt" || extension === ".md") {
    const txt = buffer.toString("utf8").trim();
    return [{ page: 1, text: assertReadableText(txt, "Text file") }];
  }

  if (extension === ".json") {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      return [{ page: 1, text: assertReadableText(JSON.stringify(parsed, null, 2), "JSON file") }];
    } catch {
      return [{ page: 1, text: assertReadableText(buffer.toString("utf8"), "JSON file") }];
    }
  }

  if (extension === ".csv") {
    try {
      const rows = parseCsv(buffer.toString("utf8"), {
        bom: true,
        relax_column_count: true,
        skip_empty_lines: true
      }) as string[][];
      const text = rows.map((row) => row.map((cell) => String(cell).trim()).filter(Boolean).join(" | ")).join("\n");
      return [{ page: 1, text: assertReadableText(text, "CSV file") }];
    } catch {
      return [{ page: 1, text: assertReadableText(buffer.toString("utf8"), "CSV file") }];
    }
  }

  if (extension === ".docx") {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return [{ page: 1, text: assertReadableText(result.value, "DOCX file") }];
    } catch (error) {
      throw new Error(`Could not process this DOCX file${error instanceof Error && error.message ? `: ${error.message}` : "."}`);
    }
  }

  if (extension === ".pdf") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PDFParse } = require("pdf-parse") as typeof import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      await parser.destroy();
      if (pdfData.pages?.length) {
        return pdfData.pages
          .map((page) => ({ page: page.num, text: normalizeExtractedText(page.text) }))
          .filter((page) => page.text.length > 0);
      }
    } catch (err) {
      console.warn("[Knowledge] PDF extraction failed", { reason: err instanceof Error ? err.message : "unknown" });
      throw new Error("The PDF is invalid or could not be parsed.");
    }
    throw new Error("The PDF did not contain readable text.");
  }

  throw new Error(`Unsupported file type: ${filename}.`);
}

function toKnowledgeStatus(source: DataSourceRecord) {
  return {
    id: source.id,
    filename: source.originalFilename ?? source.name,
    status: source.status === "error" ? "failed" : source.status,
    sizeBytes: source.sizeBytes ?? 0,
    mimeType: source.mimeType,
    uploadedAt: source.createdAt,
    updatedAt: source.updatedAt,
    chunks: source.chunkCount,
    textLength: source.extractedTextLength ?? 0,
    errorMessage: source.errorMessage
  };
}

export class KnowledgeService {
  private repository?: KnowledgeRepository;

  constructor(private store: MemoryStore, private env?: Env) {
    if (env?.nodeEnv !== "test" && env?.databaseUrl && isSupabaseServerConfigured()) {
      this.repository = new KnowledgeRepository(env.databaseUrl, createSupabaseServerClient());
    }
  }

  validateUpload(file: Express.Multer.File) {
    if (!file) {
      throw new HttpError(400, "Choose a file to upload.", "VALIDATION_ERROR");
    }
    if (file.size > KNOWLEDGE_MAX_FILE_SIZE) {
      throw new HttpError(413, "File is too large. Maximum size is 15 MB.", "FILE_TOO_LARGE");
    }

    const extension = path.extname(file.originalname).toLowerCase() || ".txt";
    const type = SUPPORTED_TYPES[extension];
    if (!type) {
      throw new HttpError(400, "Unsupported file type. Use TXT, MD, PDF, DOCX, CSV, or JSON.", "UNSUPPORTED_FILE_TYPE");
    }

    return { extension, type };
  }

  async createUpload(input: { userId: string; assistantId: string; file: Express.Multer.File }) {
    const { extension, type } = this.validateUpload(input.file);
    const fileId = randomUUID();
    const originalFilename = path.basename(input.file.originalname.replace(/\\/g, "/"));
    const safeFilename = `${fileId}-${sanitizeFilename(originalFilename)}`;
    const storagePath = `${input.userId}/${input.assistantId}/${fileId}/${safeFilename}`;

    if (this.repository) {
      let source: DataSourceRecord | undefined;
      try {
        source = await this.repository.create({
          id: fileId,
          userId: input.userId,
          assistantId: input.assistantId,
          type,
          name: originalFilename,
          originalFilename,
          safeFilename,
          mimeType: input.file.mimetype,
          sizeBytes: input.file.size,
          storagePath
        });
        await this.repository.upload(storagePath, input.file.buffer, input.file.mimetype);
        await this.repository.markProcessing(fileId);
        const pages = await extractPages(input.file.buffer, extension, originalFilename);
        const text = pages.map((page) => page.text).join("\n\n");
        const chunks = chunkExtractedText(pages, source);
        if (chunks.length === 0) throw new Error("The file did not contain readable text to index.");
        return await this.repository.markReady(fileId, text.length, chunks);
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "Knowledge indexing failed.";
        if (source) await this.repository.markFailed(fileId, message).catch(() => undefined);
        console.error("[Knowledge] Persistent ingestion failed", { assistantId: input.assistantId, fileId, message });
        if (/bucket|storage|upload|network|fetch/i.test(message)) {
          throw new HttpError(503, "Knowledge storage is temporarily unavailable. Please try again.", "KNOWLEDGE_STORAGE_UNAVAILABLE");
        }
        throw new HttpError(422, `Could not process this ${extension.slice(1).toUpperCase()} file.`, "KNOWLEDGE_PROCESSING_FAILED");
      }
    }

    // Test and local-memory fallback only. Production never writes uploads to its filesystem.
    const directory = path.join(process.cwd(), ".archmind-data", "knowledge", input.userId, input.assistantId, fileId);
    const localPath = path.join(directory, safeFilename);
    try {
      const fs = await import("node:fs/promises");
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(localPath, input.file.buffer, { flag: "wx" });
    } catch (error) {
      console.error("[Knowledge] Could not persist upload", { assistantId: input.assistantId, fileId, error });
      throw new HttpError(503, "Source storage is temporarily unavailable. Please try again.", "SOURCE_STORAGE_UNAVAILABLE");
    }

    const source = this.store.createKnowledgeSource({
      id: fileId,
      userId: input.userId,
      assistantId: input.assistantId,
      type,
      originalFilename,
      safeFilename,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storagePath: localPath
    });

    // Processing used to be detached from the request while the queue worker
    // only acknowledged jobs. That could leave a source permanently stuck in
    // Processing. A completed upload now always has a real terminal result.
    return (await this.processFile(source.id, extension)) ?? source;
  }

  async processFile(fileId: string, extension?: string) {
    const source = this.store.getSource(fileId);
    if (!source?.storagePath) return undefined;

    try {
      const ext = extension ?? path.extname(source.originalFilename ?? source.name).toLowerCase();
      const fs = await import("node:fs/promises");
      const buffer = await fs.readFile(source.storagePath);
      const pages = await extractPages(buffer, ext, source.originalFilename ?? source.name);
      const text = pages.map((page) => page.text).join("\n\n");
      const chunks = chunkExtractedText(pages, source);
      if (chunks.length === 0) {
        throw new Error("File did not contain enough readable text to index.");
      }
      return this.store.markKnowledgeSourceReady(source.id, {
        text,
        chunks,
        extractedTextLength: text.length
      });
    } catch (error) {
      console.error("[Knowledge] Source processing failed", { fileId, error });
      const message = error instanceof Error && error.message ? error.message : "Source indexing failed.";
      return this.store.markKnowledgeSourceFailed(source.id, message);
    }
  }

  async list(assistantId: string, userId: string) {
    if (this.repository) return (await this.repository.list(assistantId, userId)).map(toKnowledgeStatus);
    return this.store.listKnowledgeFiles(assistantId, userId).map(toKnowledgeStatus);
  }

  async getStatus(assistantId: string, userId: string, fileId: string) {
    if (this.repository) {
      const source = await this.repository.get(assistantId, userId, fileId);
      return source ? toKnowledgeStatus(source) : undefined;
    }
    const source = this.store.getKnowledgeFile(assistantId, userId, fileId);
    return source ? toKnowledgeStatus(source) : undefined;
  }

  async delete(assistantId: string, userId: string, fileId: string) {
    if (this.repository) return this.repository.delete(assistantId, userId, fileId);
    const source = this.store.deleteKnowledgeFile(assistantId, userId, fileId);
    if (!source) return undefined;
    if (source.storagePath) {
      const fs = await import("node:fs/promises");
      const fileDir = path.dirname(source.storagePath);
      await fs.rm(path.dirname(fileDir), { recursive: true, force: true }).catch(() => undefined);
    }
    return source;
  }

  async retry(assistantId: string, userId: string, fileId: string) {
    if (this.repository) {
      const source = await this.repository.get(assistantId, userId, fileId);
      if (!source) return undefined;
      try {
        await this.repository.markProcessing(fileId);
        const buffer = await this.repository.download(source.storagePath);
        const extension = path.extname(source.originalFilename ?? source.name).toLowerCase();
        const pages = await extractPages(buffer, extension, source.originalFilename ?? source.name);
        const text = pages.map((page) => page.text).join("\n\n");
        const chunks = chunkExtractedText(pages, source);
        return await this.repository.markReady(fileId, text.length, chunks);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Knowledge indexing failed.";
        return this.repository.markFailed(fileId, message);
      }
    }
    const source = this.store.getKnowledgeFile(assistantId, userId, fileId);
    if (!source) return undefined;
    if (!source.storagePath) {
      return this.store.markKnowledgeSourceFailed(source.id, "The original uploaded file is no longer available for reprocessing.");
    }
    return this.processFile(source.id, path.extname(source.originalFilename ?? source.name).toLowerCase());
  }
}
