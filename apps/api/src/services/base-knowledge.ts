import fs from "node:fs";
import path from "node:path";
import type { RetrievedChunk } from "../types";

type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  filename: string;
  url: string;
  textPath: string;
};

function workspaceRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === "api" && path.basename(path.dirname(cwd)) === "apps" ? path.resolve(cwd, "..", "..") : cwd;
}

/** Reads the generated AGENTIA books and returns only pages with real lexical relevance. */
export class BaseKnowledgeService {
  private documents?: KnowledgeDocument[];
  private pages = new Map<string, Array<{ page: number; text: string }>>();

  private catalog() {
    if (this.documents) return this.documents;
    const catalogPath = path.join(workspaceRoot(), "apps", "api", "storage", "ai-base", "knowledge-catalog.json");
    try {
      this.documents = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as KnowledgeDocument[];
    } catch (error) {
      console.warn("[AI Base] Knowledge catalog is unavailable", error instanceof Error ? error.message : error);
      this.documents = [];
    }
    return this.documents;
  }

  private documentPages(document: KnowledgeDocument) {
    const existing = this.pages.get(document.id);
    if (existing) return existing;
    try {
      const raw = fs.readFileSync(path.join(workspaceRoot(), document.textPath), "utf8");
      const matches = [...raw.matchAll(/(?:^|\n\n)PAGE (\d+)\n([\s\S]*?)(?=\n\nPAGE \d+\n|$)/g)];
      const parsed = matches.map((match) => ({ page: Number(match[1]), text: match[2] ?? "" }));
      this.pages.set(document.id, parsed);
      return parsed;
    } catch (error) {
      console.warn("[AI Base] Document text is unavailable", { id: document.id, error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  retrieve(query: string, limit = 5): RetrievedChunk[] {
    const terms = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2));
    if (terms.size === 0) return [];
    return this.catalog()
      .flatMap((document) => this.documentPages(document).map((page) => ({ document, ...page })))
      .map(({ document, page, text }) => {
        const haystack = `${document.title} ${document.category} ${text}`.toLowerCase();
        const matches = [...terms].filter((term) => haystack.includes(term)).length;
        return { document, page, text, matches };
      })
      .filter((item) => item.matches > 0)
      .sort((a, b) => b.matches - a.matches || a.document.title.localeCompare(b.document.title) || a.page - b.page)
      .slice(0, limit)
      .map(({ document, page, text, matches }) => ({
        sourceId: document.id,
        sourceName: `AGENTIA ${document.category} Knowledge Base`,
        filename: document.title,
        page,
        text,
        similarity: Math.min(0.99, 0.55 + matches * 0.1),
        sourceType: "ai_base" as const,
        sourceUrl: document.url
      }));
  }
}
