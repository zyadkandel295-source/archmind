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

const BASE_KNOWLEDGE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "what", "who", "where", "when", "why", "how", "which",
  "are", "was", "were", "been", "being", "have", "has", "had", "does", "did", "can", "could", "will", "would",
  "should", "may", "might", "must", "shall", "into", "onto", "upon", "over", "under", "about", "after", "before",
  "between", "through", "during", "without", "within", "along", "across", "behind", "beyond", "near", "since",
  "until", "tell", "give", "show", "explain", "find", "search", "help", "please", "make", "know", "think",
  "take", "took", "taken", "place", "held", "won", "win", "winner", "winners", "champion", "champions",
  "world", "cup", "fifa", "tournament", "final", "finals", "team", "teams", "game", "games", "match",
  "year", "years", "date", "dates", "time", "timeline", "history", "historical", "event", "events", "current",
  "latest", "news", "today", "yesterday", "first", "last", "next", "previous", "most", "many", "much", "some",
  "any", "all", "every", "each", "other", "another", "such", "more", "less", "very", "just", "only", "also"
]);

/** Reads the generated AGENTIA books and returns only pages with real lexical relevance. */
export class BaseKnowledgeService {
  private documents?: KnowledgeDocument[];
  private pages = new Map<string, Array<{ page: number; text: string }>>();

  private catalog() {
    if (this.documents) return this.documents;
    const docs: KnowledgeDocument[] = [];
    const root = workspaceRoot();
    const textbooksCatalogPath = path.join(root, "apps", "api", "storage", "ai-base", "knowledge-textbooks-catalog.json");

    try {
      if (fs.existsSync(textbooksCatalogPath)) {
        const textbooks = JSON.parse(fs.readFileSync(textbooksCatalogPath, "utf8")) as KnowledgeDocument[];
        docs.push(...textbooks);
      }
    } catch (error) {
      console.warn("[AI Base] Textbooks catalog is unavailable", error instanceof Error ? error.message : error);
    }

    this.documents = docs;
    return this.documents;
  }

  private documentPages(document: KnowledgeDocument) {
    const existing = this.pages.get(document.id);
    if (existing) return existing;
    try {
      const raw = fs.readFileSync(path.join(workspaceRoot(), document.textPath), "utf8");
      const normalized = raw.replace(/\r\n/g, "\n");
      const matches = [...normalized.matchAll(/(?:^|\n\n)PAGE (\d+)\n([\s\S]*?)(?=\n\nPAGE \d+\n|$)/g)];
      const parsed = matches.map((match) => ({ page: Number(match[1]), text: match[2] ?? "" }));
      this.pages.set(document.id, parsed);
      return parsed;
    } catch (error) {
      console.warn("[AI Base] Document text is unavailable", { id: document.id, error: error instanceof Error ? error.message : error });
      return [];
    }
  }

  retrieve(query: string, limit = 5): RetrievedChunk[] {
    if (limit <= 0) return [];
    const terms = new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 3 && !BASE_KNOWLEDGE_STOPWORDS.has(term) && !/^\d+$/.test(term))
    );
    if (terms.size === 0) return [];
    const minRequiredMatches = terms.size >= 2 ? 2 : 1;

    return this.catalog()
      .flatMap((document) => this.documentPages(document).map((page) => ({ document, ...page })))
      .map(({ document, page, text }) => {
        const titleCategory = `${document.title} ${document.category}`.toLowerCase();
        const haystack = `${titleCategory} ${text}`.toLowerCase();
        const matches = [...terms].filter((term) => haystack.includes(term)).length;
        const topicalHit = [...terms].some((term) => titleCategory.includes(term));
        return { document, page, text, matches, topicalHit };
      })
      .filter((item) => item.matches >= minRequiredMatches && (item.topicalHit || item.matches >= 3))
      .sort((a, b) => b.matches - a.matches || Number(b.topicalHit) - Number(a.topicalHit) || a.document.title.localeCompare(b.document.title) || a.page - b.page)
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
