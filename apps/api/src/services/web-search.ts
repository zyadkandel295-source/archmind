import https from "node:https";
import http from "node:http";
import { URL } from "node:url";
import type { RetrievedChunk } from "../types";

export type SearchTimeRange = "day" | "week" | "month" | "year" | "any";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publication_date?: string;
  source?: string;
  provider?: string;
  semanticScore?: number;
  recencyScore?: number;
  hybridScore?: number;
}

export interface ConstructedSearchQuery {
  rawQuery: string;
  cleanQuery: string;
  isNewsIntent: boolean;
  timeRange: SearchTimeRange;
  /** Google/SerpApi time constraint parameter, e.g. qdr:d (24h), qdr:w (7d), qdr:m (30d) */
  tbs?: string;
  /** Brave Search freshness parameter: pd (24h), pw (7d), pm (30d), py (1y) */
  freshness?: string;
  /** Google News temporal operator: when:1d, when:7d, when:30d */
  whenOperator?: string;
  /** DuckDuckGo date filter: d, w, m, y */
  ddgDateFilter?: string;
  /** ISO timestamp for startPublishedDate filters (Exa, NewsAPI) */
  startPublishedDate?: string;
  recencyDays?: number;
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "up", "about", "into", "over", "after", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "can", "could", "will", "would",
  "should", "please", "tell", "me", "give", "find", "search", "look", "what", "who",
  "where", "when", "why", "how", "show", "explain"
]);

const NEWS_OR_TEMPORAL_REGEX =
  /\b(news|latest|newest|breaking|today|tonight|yesterday|current|currently|recent|recently|now|update|updates|live|weather|stock|price|prices|score|scores|election|release|released|announced|launch|launched|2025|2026|2027|this week|this month|last 24 hours|happening)\b/i;

/**
 * Determine whether a message should trigger real-time web & news search.
 * Triggers whenever the user explicitly toggles Web Search OR asks anything
 * involving live facts, news, current events, entities, or lookups.
 */
export function shouldPerformWebSearch(query: string, explicitToggle?: boolean): boolean {
  if (explicitToggle === true) return true;
  if (explicitToggle === false) return false;
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  if (!query || query.trim().length < 3) return false;

  if (NEWS_OR_TEMPORAL_REGEX.test(query)) return true;
  if (/\b(search|google|find online|web|internet|who is|what is|where is|when did|when is|how much|status of|headline|headlines|article|articles)\b/i.test(query)) {
    return true;
  }
  return false;
}

/**
 * Step 1 of the Algorithm: Query Construction with Temporal Constraints
 * Extracts search terms and attaches recency constraints (e.g. tbs="qdr:d", when:1d).
 */
export function constructSearchQuery(
  rawInput: string,
  explicitTimeRange?: SearchTimeRange
): ConstructedSearchQuery {
  const rawQuery = rawInput.trim();
  const lower = rawQuery.toLowerCase();
  const isNewsIntent = NEWS_OR_TEMPORAL_REGEX.test(rawQuery);

  // Strip conversational prefixes while keeping the core query intact
  const stripped = rawQuery
    .replace(
      /^(?:please\s+)?(?:can you\s+|could you\s+)?(?:search(?:\s+the\s+web)?(?:\s+for)?|find(?:\s+me)?|tell me(?:\s+about)?|what(?:\s+is|\s+are)(?:\s+the)?|give me(?:\s+the)?|show me(?:\s+the)?)\s+/i,
      ""
    )
    .replace(/[?!.]+$/g, "")
    .trim();

  const cleanQuery = (stripped || rawQuery).slice(0, 240);

  let timeRange: SearchTimeRange = explicitTimeRange ?? "any";
  if (timeRange === "any") {
    if (/\b(today|tonight|last 24 hours|breaking|right now|just happened|this morning)\b/i.test(lower)) {
      timeRange = "day";
    } else if (/\b(latest|newest|recent|this week|current|news|updates|headline|headlines)\b/i.test(lower)) {
      timeRange = "week";
    } else if (/\b(this month|past month)\b/i.test(lower)) {
      timeRange = "month";
    } else if (/\b(2026|this year)\b/i.test(lower)) {
      timeRange = "year";
    }
  }

  const nowMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (timeRange === "day") {
    return {
      rawQuery,
      cleanQuery,
      isNewsIntent: true,
      timeRange,
      tbs: "qdr:d",
      freshness: "pd",
      whenOperator: "when:1d",
      ddgDateFilter: "d",
      recencyDays: 1,
      startPublishedDate: new Date(nowMs - 2 * dayMs).toISOString()
    };
  }

  if (timeRange === "week") {
    return {
      rawQuery,
      cleanQuery,
      isNewsIntent: true,
      timeRange,
      tbs: "qdr:w",
      freshness: "pw",
      whenOperator: "when:7d",
      ddgDateFilter: "w",
      recencyDays: 7,
      startPublishedDate: new Date(nowMs - 7 * dayMs).toISOString()
    };
  }

  if (timeRange === "month") {
    return {
      rawQuery,
      cleanQuery,
      isNewsIntent,
      timeRange,
      tbs: "qdr:m",
      freshness: "pm",
      whenOperator: "when:30d",
      ddgDateFilter: "m",
      recencyDays: 30,
      startPublishedDate: new Date(nowMs - 30 * dayMs).toISOString()
    };
  }

  if (timeRange === "year") {
    return {
      rawQuery,
      cleanQuery,
      isNewsIntent,
      timeRange,
      tbs: "qdr:y",
      freshness: "py",
      whenOperator: "when:365d",
      ddgDateFilter: "y",
      recencyDays: 365,
      startPublishedDate: new Date(nowMs - 365 * dayMs).toISOString()
    };
  }

  return {
    rawQuery,
    cleanQuery,
    isNewsIntent,
    timeRange: "any"
  };
}

/**
 * Clean HTML markup and decode XML/HTML entities into plain text
 */
function cleanHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch URL text with timeout and redirect handling
 */
function fetchUrlText(
  targetUrl: string,
  timeoutMs = 4500,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const reqModule = parsedUrl.protocol === "https:" ? https : http;

      const req = reqModule.get(
        targetUrl,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
            ...extraHeaders
          },
          timeout: timeoutMs
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            fetchUrlText(redirectUrl, timeoutMs, extraHeaders).then(resolve);
            return;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            if (data.length > 600_000) res.destroy();
          });
          res.on("end", () => resolve(data));
        }
      );

      req.on("error", () => resolve(""));
      req.on("timeout", () => {
        req.destroy();
        resolve("");
      });
    } catch {
      resolve("");
    }
  });
}

/**
 * POST JSON helper with timeout
 */
async function postJson<T>(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs = 5000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeIsoDate(dateStr?: string | number | null): string | undefined {
  if (!dateStr) return undefined;
  const parsed = typeof dateStr === "number" ? new Date(dateStr) : new Date(String(dateStr));
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

// ============================================================================
// PROVIDER 1: Dedicated Neural / AI Search APIs (Exa AI, Tavily, Perplexity)
// ============================================================================

async function searchExaAi(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) return [];

  const payload: Record<string, unknown> = {
    query: q.cleanQuery,
    type: "auto",
    useAutoprompt: true,
    numResults: limit,
    contents: { text: { maxCharacters: 500 } }
  };
  if (q.startPublishedDate) {
    payload.startPublishedDate = q.startPublishedDate;
  }
  if (q.isNewsIntent) {
    payload.category = "news";
  }

  const data = await postJson<{
    results?: Array<{
      title?: string;
      url?: string;
      text?: string;
      publishedDate?: string;
      author?: string;
    }>;
  }>("https://api.exa.ai/search", { Authorization: `Bearer ${apiKey}` }, payload);

  return (data?.results ?? [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title!.trim(),
      url: item.url!,
      snippet: cleanHtml(item.text ?? "").slice(0, 360) || item.title!,
      publication_date: normalizeIsoDate(item.publishedDate),
      source: item.author || new URL(item.url!).hostname.replace(/^www\./, ""),
      provider: "exa"
    }));
}

async function searchTavily(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return [];

  const payload: Record<string, unknown> = {
    query: q.cleanQuery,
    topic: q.isNewsIntent ? "news" : "general",
    search_depth: "basic",
    max_results: limit,
    ...(q.recencyDays ? { days: q.recencyDays } : {})
  };

  const data = await postJson<{
    results?: Array<{
      title?: string;
      url?: string;
      content?: string;
      published_date?: string;
    }>;
  }>("https://api.tavily.com/search", { Authorization: `Bearer ${apiKey}` }, payload);

  return (data?.results ?? [])
    .filter((item) => item.title && item.url)
    .map((item) => ({
      title: item.title!.trim(),
      url: item.url!,
      snippet: cleanHtml(item.content ?? "").slice(0, 360),
      publication_date: normalizeIsoDate(item.published_date),
      source: new URL(item.url!).hostname.replace(/^www\./, ""),
      provider: "tavily"
    }));
}

// ============================================================================
// PROVIDER 2: Structured SERP & News APIs (Brave, You.com, NewsAPI, SerpApi)
// ============================================================================

async function searchBraveApi(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: q.cleanQuery,
    count: String(Math.min(limit, 10))
  });
  if (q.freshness) params.set("freshness", q.freshness);

  const raw = await fetchUrlText(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    4500,
    { "X-Subscription-Token": apiKey, Accept: "application/json" }
  );
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      news?: { results?: Array<{ title?: string; url?: string; description?: string; age?: string; page_age?: string }> };
      web?: { results?: Array<{ title?: string; url?: string; description?: string; page_age?: string }> };
    };
    const combined = [...(parsed.news?.results ?? []), ...(parsed.web?.results ?? [])];
    return combined
      .filter((item) => item.title && item.url && item.description)
      .slice(0, limit)
      .map((item) => ({
        title: cleanHtml(item.title!),
        url: item.url!,
        snippet: cleanHtml(item.description!),
        publication_date: normalizeIsoDate(item.page_age),
        source: new URL(item.url!).hostname.replace(/^www\./, ""),
        provider: "brave"
      }));
  } catch {
    return [];
  }
}

async function searchNewsApiOrg(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.NEWS_API_KEY?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: q.cleanQuery,
    sortBy: "publishedAt",
    pageSize: String(Math.min(limit, 10)),
    language: "en"
  });
  if (q.startPublishedDate) {
    params.set("from", q.startPublishedDate);
  }

  const raw = await fetchUrlText(
    `https://newsapi.org/v2/everything?${params.toString()}`,
    4500,
    { Authorization: `Bearer ${apiKey}`, "X-Api-Key": apiKey }
  );
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      articles?: Array<{
        title?: string;
        url?: string;
        description?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };
    return (parsed.articles ?? [])
      .filter((a) => a.title && a.url && a.title !== "[Removed]")
      .slice(0, limit)
      .map((a) => ({
        title: cleanHtml(a.title!),
        url: a.url!,
        snippet: cleanHtml(a.description ?? a.title!),
        publication_date: normalizeIsoDate(a.publishedAt),
        source: a.source?.name || new URL(a.url!).hostname.replace(/^www\./, ""),
        provider: "newsapi"
      }));
  } catch {
    return [];
  }
}

async function searchSerpApi(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: q.cleanQuery,
    api_key: apiKey,
    num: String(Math.min(limit, 10)),
    ...(q.tbs ? { tbs: q.tbs } : {}),
    ...(q.isNewsIntent ? { tbm: "nws" } : {})
  });

  const raw = await fetchUrlText(`https://serpapi.com/search.json?${params.toString()}`, 4500);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      news_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string; source?: string }>;
      organic_results?: Array<{ title?: string; link?: string; snippet?: string; date?: string }>;
    };
    const items = [...(parsed.news_results ?? []), ...(parsed.organic_results ?? [])];
    return items
      .filter((item) => item.title && item.link)
      .slice(0, limit)
      .map((item) => ({
        title: cleanHtml(item.title!),
        url: item.link!,
        snippet: cleanHtml(item.snippet ?? item.title!),
        publication_date: normalizeIsoDate(item.date),
        source: new URL(item.link!).hostname.replace(/^www\./, ""),
        provider: "serpapi"
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// PROVIDER 3: Built-In Live Web & News Indexers (Zero Extra Key Needed)
// ============================================================================

/**
 * Live Google News RSS Index Search
 * Supports temporal operators (e.g. `when:1d`, `when:7d`) and returns real-time
 * breaking news articles with exact `<pubDate>` (`publication_date`) and publisher `<source>`.
 */
async function searchGoogleNewsLive(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const effectiveQuery = q.whenOperator ? `${q.cleanQuery} ${q.whenOperator}` : q.cleanQuery;
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(effectiveQuery)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchUrlText(rssUrl, 4500);
  if (!xml) return [];

  const results: WebSearchResult[] = [];
  const itemBlocks = xml.split(/<item>/i).slice(1);

  for (const item of itemBlocks) {
    if (results.length >= limit * 2) break;
    const titleRaw = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const linkRaw = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const pubDateRaw = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "";
    const sourceRaw = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] ?? "";
    const descRaw = item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";

    const title = cleanHtml(titleRaw);
    const url = cleanHtml(linkRaw);
    const source = cleanHtml(sourceRaw);
    const desc = cleanHtml(descRaw);
    const publication_date = normalizeIsoDate(pubDateRaw);

    if (title && url) {
      const snippet = desc && desc !== title
        ? `${source ? `[${source}] ` : ""}${desc}`
        : `${source ? `Published by ${source}. ` : ""}${title}`;
      results.push({
        title,
        url,
        snippet: snippet.slice(0, 380),
        publication_date,
        source: source || "Google News",
        provider: "google_news"
      });
    }
  }

  return results;
}

/**
 * DuckDuckGo Live Web Search with Date Filter Support
 */
async function searchDuckDuckGoWeb(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const params = new URLSearchParams({ q: q.cleanQuery });
  if (q.ddgDateFilter) {
    params.set("df", q.ddgDateFilter);
  }
  const ddgUrl = `https://html.duckduckgo.com/html/?${params.toString()}`;
  const htmlData = await fetchUrlText(ddgUrl, 4500);
  if (!htmlData) return [];

  const results: WebSearchResult[] = [];
  const resultBlocks = htmlData.split(/<div[^>]*class="[^"]*result\b[^"]*"[^>]*>/i).slice(1);

  for (const block of resultBlocks) {
    if (results.length >= limit * 2) break;

    const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const snippetMatch =
      block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const urlMatch = block.match(/href="([^"]+)"/i);
    const dateMatch = block.match(/<span[^>]*class="[^"]*result__timestamp[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

    if (titleMatch && snippetMatch) {
      const title = cleanHtml(titleMatch[1] ?? "");
      const snippet = cleanHtml(snippetMatch[1] ?? "");
      let url = urlMatch?.[1] ?? "";
      if (url.includes("uddg=")) {
        const match = url.match(/uddg=([^&]+)/);
        if (match?.[1]) url = decodeURIComponent(match[1]);
      }
      if (url.startsWith("//")) {
        url = `https:${url}`;
      }

      if (title && snippet && /^https?:\/\//i.test(url)) {
        let host = "Web";
        try {
          host = new URL(url).hostname.replace(/^www\./, "");
        } catch {}
        results.push({
          title,
          url,
          snippet,
          publication_date: normalizeIsoDate(dateMatch ? cleanHtml(dateMatch[1] ?? "") : undefined),
          source: host,
          provider: "duckduckgo"
        });
      }
    }
  }

  return results;
}

/**
 * HackerNews Algolia Real-Time Tech/World Search API
 */
async function searchHackerNewsAlgolia(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const endpoint = q.isNewsIntent ? "search_by_date" : "search";
  const params = new URLSearchParams({
    query: q.cleanQuery,
    tags: "story",
    hitsPerPage: String(Math.min(limit, 6))
  });
  const raw = await fetchUrlText(`https://hn.algolia.com/api/v1/${endpoint}?${params.toString()}`, 3500);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as {
      hits?: Array<{
        title?: string;
        url?: string;
        story_text?: string;
        created_at?: string;
        objectID?: string;
        points?: number;
      }>;
    };
    return (parsed.hits ?? [])
      .filter((hit) => hit.title && (hit.url || hit.objectID))
      .map((hit) => {
        const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        let host = "Hacker News";
        try {
          host = new URL(url).hostname.replace(/^www\./, "");
        } catch {}
        return {
          title: cleanHtml(hit.title!),
          url,
          snippet: cleanHtml(hit.story_text ?? `${hit.title!} (Source: ${host})`).slice(0, 320),
          publication_date: normalizeIsoDate(hit.created_at),
          source: host,
          provider: "hn_algolia"
        };
      });
  } catch {
    return [];
  }
}

/**
 * Wikipedia Search API for Factual Grounding
 */
async function searchWikipedia(q: ConstructedSearchQuery, limit: number): Promise<WebSearchResult[]> {
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q.cleanQuery)}&srlimit=${Math.min(limit, 4)}&format=json&utf8=1`;
  const wikiRaw = await fetchUrlText(wikiUrl, 3000);
  if (!wikiRaw) return [];

  try {
    const parsed = JSON.parse(wikiRaw) as {
      query?: {
        search?: Array<{
          title?: string;
          snippet?: string;
          timestamp?: string;
        }>;
      };
    };
    return (parsed.query?.search ?? [])
      .filter((item) => item.title && item.snippet)
      .map((item) => ({
        title: item.title!,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title!.replace(/\s+/g, "_"))}`,
        snippet: cleanHtml(item.snippet ?? ""),
        publication_date: normalizeIsoDate(item.timestamp),
        source: "Wikipedia",
        provider: "wikipedia"
      }));
  } catch {
    return [];
  }
}

// ============================================================================
// STEP 3: Hybrid Semantic and Time-Decayed Ranking Algorithm
// ============================================================================

function tokenizeForRanking(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0600-\u06FF]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

/**
 * Computes semantic similarity score in [0, 1] using BM25-style lexical saturation,
 * exact phrase/bigram overlap, title match boost, and neural provider prior.
 */
function computeSemanticScore(result: WebSearchResult, queryTokens: string[], cleanQueryLower: string): number {
  if (queryTokens.length === 0) return 0.5;

  const titleLower = result.title.toLowerCase();
  const snippetLower = result.snippet.toLowerCase();
  const docTokens = tokenizeForRanking(`${result.title} ${result.snippet}`);
  if (docTokens.length === 0) return 0.1;

  const docFreq = new Map<string, number>();
  for (const token of docTokens) {
    docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
  }

  // BM25-inspired term match with title boost
  let matchedTerms = 0;
  let weightedSum = 0;
  const k1 = 1.2;
  const b = 0.75;
  const avgDocLen = 45;

  for (const qToken of queryTokens) {
    const tf = docFreq.get(qToken) ?? 0;
    const inTitle = titleLower.includes(qToken) ? 1.5 : 0;
    const inPartial = tf === 0 && (titleLower.includes(qToken) || snippetLower.includes(qToken)) ? 0.5 : 0;
    const effectiveTf = tf + inTitle + inPartial;

    if (effectiveTf > 0) {
      matchedTerms += 1;
      const normTf = (effectiveTf * (k1 + 1)) / (effectiveTf + k1 * (1 - b + b * (docTokens.length / avgDocLen)));
      weightedSum += Math.min(1, normTf / 2.2);
    }
  }

  const coverage = matchedTerms / queryTokens.length;
  const bm25Component = weightedSum / queryTokens.length;

  // Bigram / exact phrase bonus
  let phraseBonus = 0;
  if (cleanQueryLower.length > 4 && (titleLower.includes(cleanQueryLower) || snippetLower.includes(cleanQueryLower))) {
    phraseBonus = 0.22;
  } else if (queryTokens.length >= 2) {
    let bigramHits = 0;
    for (let i = 0; i < queryTokens.length - 1; i++) {
      const bigram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
      if (titleLower.includes(bigram) || snippetLower.includes(bigram)) {
        bigramHits += 1;
      }
    }
    phraseBonus = (bigramHits / (queryTokens.length - 1)) * 0.15;
  }

  // Neural/dedicated search provider prior
  const providerPrior =
    result.provider === "exa" || result.provider === "tavily"
      ? 0.12
      : result.provider === "brave" || result.provider === "serpapi" || result.provider === "newsapi"
        ? 0.08
        : result.provider === "google_news" || result.provider === "duckduckgo"
          ? 0.05
          : 0;

  return Math.min(1, Number((coverage * 0.45 + bm25Component * 0.35 + phraseBonus + providerPrior).toFixed(4)));
}

/**
 * Computes exponential time-decay score in [0, 1]:
 * S_time = exp(-lambda * ageInDays)
 * - For news/temporal queries: half-life = 2 days (lambda = ln(2)/2)
 * - For general queries: half-life = 30 days (lambda = ln(2)/30)
 */
function computeTimeDecayScore(publicationDateIso: string | undefined, isNewsIntent: boolean): number {
  if (!publicationDateIso) {
    // Unknown publication date gets a neutral baseline
    return isNewsIntent ? 0.35 : 0.6;
  }
  const pubMs = Date.parse(publicationDateIso);
  if (Number.isNaN(pubMs)) return isNewsIntent ? 0.35 : 0.6;

  const ageDays = Math.max(0, (Date.now() - pubMs) / (1000 * 60 * 60 * 24));
  const halfLifeDays = isNewsIntent ? 2.5 : 30;
  const lambda = Math.LN2 / halfLifeDays;
  const decay = Math.exp(-lambda * ageDays);
  return Math.max(0.05, Math.min(1, Number(decay.toFixed(4))));
}

/**
 * Ranks and deduplicates candidate results using the Hybrid Semantic + Time-Decayed Ranking Algorithm.
 */
export function rankResultsHybrid(
  candidates: WebSearchResult[],
  constructed: ConstructedSearchQuery,
  maxResults: number
): WebSearchResult[] {
  const queryTokens = tokenizeForRanking(constructed.cleanQuery);
  const cleanQueryLower = constructed.cleanQuery.toLowerCase();

  // Weight between semantic similarity (alpha) and temporal freshness (1 - alpha)
  const alpha = constructed.isNewsIntent ? 0.55 : 0.78;

  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const scored: WebSearchResult[] = [];

  for (const item of candidates) {
    const canonicalUrl = item.url.trim().replace(/\/+$/, "").toLowerCase();
    const canonicalTitle = item.title.trim().toLowerCase().replace(/\s+/g, " ");
    if (!canonicalUrl || !canonicalTitle) continue;
    if (seenUrls.has(canonicalUrl) || seenTitles.has(canonicalTitle)) continue;

    seenUrls.add(canonicalUrl);
    seenTitles.add(canonicalTitle);

    const semanticScore = computeSemanticScore(item, queryTokens, cleanQueryLower);
    const recencyScore = computeTimeDecayScore(item.publication_date, constructed.isNewsIntent);
    const hybridScore = Number((alpha * semanticScore + (1 - alpha) * recencyScore).toFixed(4));

    scored.push({
      ...item,
      semanticScore,
      recencyScore,
      hybridScore
    });
  }

  return scored
    .sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0))
    .slice(0, maxResults);
}

/**
 * Execute real-time web & news search across configured Search Engine APIs
 * and live news/web indexes, ranked via the Hybrid Semantic & Time-Decayed Algorithm.
 */
export async function performWebSearch(
  query: string,
  maxResults = 6,
  options?: { timeRange?: SearchTimeRange }
): Promise<WebSearchResult[]> {
  if (!query || !query.trim()) return [];

  const constructed = constructSearchQuery(query, options?.timeRange);

  try {
    // Run configured API-key providers and built-in live news/web indexers concurrently
    const providerBatches = await Promise.all([
      searchExaAi(constructed, maxResults),
      searchTavily(constructed, maxResults),
      searchBraveApi(constructed, maxResults),
      searchNewsApiOrg(constructed, maxResults),
      searchSerpApi(constructed, maxResults),
      searchGoogleNewsLive(constructed, maxResults),
      searchDuckDuckGoWeb(constructed, maxResults),
      ...(constructed.isNewsIntent ? [searchHackerNewsAlgolia(constructed, 4)] : []),
      searchWikipedia(constructed, 3)
    ]);

    const allCandidates = providerBatches.flat();
    return rankResultsHybrid(allCandidates, constructed, maxResults);
  } catch {
    return [];
  }
}

/**
 * Converts WebSearchResult[] into RetrievedChunk[] so the chat UI and SSE stream
 * surface clickable web/news citations alongside RAG sources.
 */
export function webResultsToRetrievedChunks(results: WebSearchResult[]): RetrievedChunk[] {
  return results.map((res, index) => {
    const dateLabel = res.publication_date ? ` (${res.publication_date.slice(0, 10)})` : "";
    const sourceLabel = res.source ? `${res.source}${dateLabel}` : `${res.title}${dateLabel}`;
    return {
      sourceId: `web-${index + 1}`,
      sourceName: `${res.title} — ${sourceLabel}`,
      filename: `${res.title} (${res.source || "Web"}${dateLabel})`,
      chunkIndex: index,
      text: `${res.title}\nURL: ${res.url}\nPublished: ${res.publication_date ?? "Recent"}\nSnippet: ${res.snippet}`,
      similarity: res.hybridScore ?? Number((0.95 - index * 0.04).toFixed(2))
    };
  });
}

/**
 * Formats WebSearchResults into a rich prompt context block with publication dates,
 * hybrid relevance scores, and citation instructions.
 */
export function formatWebSearchPrompt(results: WebSearchResult[], query: string): string {
  const nowIso = new Date().toISOString();
  if (!results.length) {
    return `🌐 REAL-TIME WEB & NEWS SEARCH (Timestamp: ${nowIso}): No external results returned for "${query}". Answer accurately using your knowledge.`;
  }

  const formatted = results
    .map((res, idx) => {
      const pubDate = res.publication_date ? res.publication_date : "Recent / Live";
      const source = res.source ? ` | Source: ${res.source}` : "";
      const score = typeof res.hybridScore === "number" ? ` | Hybrid Rank Score: ${res.hybridScore}` : "";
      return `[${idx + 1}] Title: ${res.title}${source}\nURL: ${res.url}\nPublication Date: ${pubDate}${score}\nSnippet: ${res.snippet}`;
    })
    .join("\n\n");

  return `🌐 LIVE WEB & NEWS SEARCH RESULTS (Retrieved at: ${nowIso}, Query: "${query}", Ranked by Hybrid Semantic & Time-Decayed Algorithm):\n\n${formatted}\n\nINSTRUCTIONS FOR USING LIVE WEB RESULTS:\n1. Ground your response in the live search results above, prioritizing the newest publication dates for current events and breaking news.\n2. Cite sources inline using Markdown links, e.g. [[1](URL)] or [Source Name](URL), and mention publication dates when relevant.`;
}
