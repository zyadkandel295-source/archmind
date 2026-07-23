import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import mammoth from "mammoth";
import type { MemoryStore } from "../db/memory";
import { HttpError } from "../lib/http-error";
import type { DataSourceRecord, RetrievedChunk } from "../types";

export const KNOWLEDGE_MAX_FILE_SIZE = 15 * 1024 * 1024;

const SUPPORTED_TYPES: Record<string, DataSourceRecord["type"]> = {
  ".txt": "text",
  ".md": "md",
  ".pdf": "pdf",
  ".docx": "docx",
  ".csv": "csv",
  ".json": "json"
};

function apiRoot() {
  const cwd = process.cwd();
  if (path.basename(cwd) === "api" && path.basename(path.dirname(cwd)) === "apps") return cwd;
  const nested = path.join(cwd, "apps", "api");
  return nested;
}

function storageRoot() {
  return path.join(apiRoot(), "storage", "knowledge");
}

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
  text: string,
  source: Pick<DataSourceRecord, "id" | "assistantId" | "userId" | "name" | "originalFilename">
): RetrievedChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: RetrievedChunk[] = [];

  for (let index = 0; index < words.length; index += 160) {
    chunks.push({
      sourceId: source.id,
      sourceName: source.originalFilename ?? source.name,
      userId: source.userId,
      assistantId: source.assistantId,
      fileId: source.id,
      filename: source.originalFilename ?? source.name,
      chunkIndex: chunks.length,
      page: Math.floor(index / 480) + 1,
      text: words.slice(index, index + 200).join(" "),
      similarity: Number((0.92 - chunks.length * 0.04).toFixed(2))
    });
  }

  return chunks;
}

async function extractText(filePath: string, extension: string) {
  const buffer = await fs.readFile(filePath);

  if (extension === ".txt" || extension === ".md") {
    return assertReadableText(buffer.toString("utf8"), extension === ".md" ? "Markdown file" : "Text file");
  }

  if (extension === ".json") {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      return assertReadableText(JSON.stringify(parsed, null, 2), "JSON file");
    } catch {
      throw new Error("JSON file could not be parsed.");
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
      return assertReadableText(text, "CSV file");
    } catch {
      throw new Error("CSV file could not be parsed.");
    }
  }

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return assertReadableText(result.value, "DOCX file");
  }

  if (extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return assertReadableText(result.text, "PDF file");
    } finally {
      await parser.destroy();
    }
  }

  throw new Error("Unsupported file type.");
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
  constructor(private store: MemoryStore) {}

  validateUpload(file: Express.Multer.File) {
    if (!file) {
      throw new HttpError(400, "Choose a file to upload.", "VALIDATION_ERROR");
    }
    if (file.size > KNOWLEDGE_MAX_FILE_SIZE) {
      throw new HttpError(413, "File is too large. Maximum size is 15 MB.", "FILE_TOO_LARGE");
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const type = SUPPORTED_TYPES[extension];
    if (!type) {
      throw new HttpError(400, "Unsupported file type. Upload .txt, .md, .pdf, .docx, .csv, or .json.", "UNSUPPORTED_FILE_TYPE");
    }

    return { extension, type };
  }

  async createUpload(input: { userId: string; assistantId: string; file: Express.Multer.File }) {
    const { extension, type } = this.validateUpload(input.file);
    const fileId = randomUUID();
    const originalFilename = path.basename(input.file.originalname.replace(/\\/g, "/"));
    const safeFilename = `${fileId}-${sanitizeFilename(originalFilename)}`;
    const directory = path.join(storageRoot(), input.userId, input.assistantId, fileId, "original-file");
    const storagePath = path.join(directory, safeFilename);

    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(storagePath, input.file.buffer, { flag: "wx" });

    const source = this.store.createKnowledgeSource({
      id: fileId,
      userId: input.userId,
      assistantId: input.assistantId,
      type,
      originalFilename,
      safeFilename,
      mimeType: input.file.mimetype,
      sizeBytes: input.file.size,
      storagePath
    });

    void this.processFile(source.id, extension);
    return source;
  }

  async processFile(fileId: string, extension?: string) {
    const source = this.store.getSource(fileId);
    if (!source?.storagePath) return undefined;

    try {
      const ext = extension ?? path.extname(source.originalFilename ?? source.name).toLowerCase();
      const text = await extractText(source.storagePath, ext);
      const chunks = chunkExtractedText(text, source);
      if (chunks.length === 0) {
        throw new Error("File did not contain enough readable text to index.");
      }
      return this.store.markKnowledgeSourceReady(source.id, {
        text,
        chunks,
        extractedTextLength: text.length
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "File parsing failed.";
      return this.store.markKnowledgeSourceFailed(source.id, message);
    }
  }

  list(assistantId: string, userId: string) {
    return this.store.listKnowledgeFiles(assistantId, userId).map(toKnowledgeStatus);
  }

  getStatus(assistantId: string, userId: string, fileId: string) {
    const source = this.store.getKnowledgeFile(assistantId, userId, fileId);
    return source ? toKnowledgeStatus(source) : undefined;
  }

  async delete(assistantId: string, userId: string, fileId: string) {
    const source = this.store.deleteKnowledgeFile(assistantId, userId, fileId);
    if (!source) return undefined;
    if (source.storagePath) {
      const fileDir = path.dirname(source.storagePath);
      await fs.rm(path.dirname(fileDir), { recursive: true, force: true }).catch(() => undefined);
    }
    return source;
  }
}
