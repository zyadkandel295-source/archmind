import https from "node:https";
import http from "node:http";
import { URL } from "node:url";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Clean HTML markup to extract plain text
 */
function cleanHtml(rawHtml: string): string {
  return rawHtml
    .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, "")
    .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetch URL content helper with timeout and redirect handling
 */
function fetchUrlText(targetUrl: string, timeoutMs = 4000): Promise<string> {
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
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ar;q=0.8"
          },
          timeout: timeoutMs
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            fetchUrlText(redirectUrl, timeoutMs).then(resolve);
            return;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            if (data.length > 500000) res.destroy(); // Prevent memory overflow
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
 * Execute real-time web search across Wikipedia & DuckDuckGo APIs
 */
export async function performWebSearch(query: string, maxResults = 4): Promise<WebSearchResult[]> {
  if (!query || !query.trim()) return [];

  const results: WebSearchResult[] = [];
  const cleanQuery = query.trim().replace(/[^\w\s\u0600-\u06FF]/gi, " ");

  try {
    // 1. DuckDuckGo HTML API search
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const htmlData = await fetchUrlText(ddgUrl, 5000);

    if (htmlData) {
      const resultBlocks = htmlData.split(/<div[^>]*class="[^"]*result\b[^"]*"[^>]*>/i).slice(1);
      for (const block of resultBlocks) {
        if (results.length >= maxResults) break;

        const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
        const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                             block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        const urlMatch = block.match(/href="([^"]+)"/i);

        if (titleMatch && snippetMatch) {
          const title = cleanHtml(titleMatch[1] ?? "");
          const snippet = cleanHtml(snippetMatch[1] ?? "");
          let url = urlMatch?.[1] ?? "";
          if (url.includes("uddg=")) {
            const match = url.match(/uddg=([^&]+)/);
            if (match?.[1]) url = decodeURIComponent(match[1]);
          }

          if (title && snippet) {
            results.push({ title, url, snippet });
          }
        }
      }
    }

    // 2. Wikipedia Search Fallback if needed
    if (results.length < maxResults) {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&utf8=1`;
      const wikiRaw = await fetchUrlText(wikiUrl, 3000);
      try {
        const parsed = JSON.parse(wikiRaw);
        const items = parsed?.query?.search ?? [];
        for (const item of items) {
          if (results.length >= maxResults) break;
          const snippet = cleanHtml(item.snippet ?? "");
          if (snippet) {
            results.push({
              title: item.title,
              url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
              snippet
            });
          }
        }
      } catch {}
    }
  } catch {}

  return results;
}

/**
 * Formats WebSearchResults into prompt-ready context string
 */
export function formatWebSearchPrompt(results: WebSearchResult[], query: string): string {
  if (!results.length) {
    return `🌐 REAL-TIME WEB SEARCH: No live web results found for query "${query}". Answer using general reasoning.`;
  }

  const formatted = results
    .map(
      (res, idx) =>
        `[Result ${idx + 1}] Title: ${res.title}\nURL: ${res.url}\nSnippet: ${res.snippet}`
    )
    .join("\n\n");

  return `🌐 LIVE REAL-TIME WEB SEARCH RESULTS (Current Year: 2026, Query: "${query}"):\n\n${formatted}\n\nUse the above live web search results to provide accurate, up-to-date, real-time answers.`;
}
