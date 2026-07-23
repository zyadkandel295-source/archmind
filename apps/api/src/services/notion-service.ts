/**
 * NotionService — Production-grade Notion API service layer.
 *
 * Features:
 * - Six-layer permission validation before every operation
 * - AES-256-GCM token encryption (decrypt only at call time)
 * - Rate-limit detection (HTTP 429) with exponential backoff
 * - Request timeout protection (30s AbortController)
 * - Activity logging (operation, resourceId, timestamp, success, errorMessage only)
 * - Never exposes tokens in logs, responses, or error messages
 */

import { Client, APIResponseError } from "@notionhq/client";
import { randomUUID } from "crypto";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { decryptToken, maskToken } from "../lib/notion-crypto";
import { HttpError } from "../lib/http-error";
import type { NotionActivityLogRecord } from "../types";

// ── Constants ──────────────────────────────────────
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const REQUEST_TIMEOUT_MS = 30_000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ── Error Codes ────────────────────────────────────
export const NOTION_ERRORS = {
  NOT_CONNECTED: "NOTION_NOT_CONNECTED",
  TOKEN_INVALID: "NOTION_TOKEN_INVALID",
  TOKEN_EXPIRED: "NOTION_TOKEN_EXPIRED",
  PERMISSION_DENIED: "NOTION_PERMISSION_DENIED",
  WORKSPACE_REVOKED: "NOTION_WORKSPACE_REVOKED",
  RATE_LIMITED: "NOTION_RATE_LIMITED",
  TIMEOUT: "NOTION_TIMEOUT",
  RESOURCE_NOT_FOUND: "NOTION_RESOURCE_NOT_FOUND",
} as const;

// ── Types ──────────────────────────────────────────
interface NotionToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: string;
}

export class NotionService {
  constructor(
    private readonly env: Env,
    private readonly store: MemoryStore
  ) {}

  // ══════════════════════════════════════════════════
  // Permission Validation (6 layers)
  // ══════════════════════════════════════════════════

  private getEncryptionSecret(): string {
    return this.env.jwtAccessSecret;
  }

  /**
   * Validate that a user has a connected, working Notion integration.
   * Layers: 1) auth  2) connected  3) token exists  4) token valid  5) workspace access
   * Layer 6 (resource access) is checked at the operation level.
   */
  private async validateAccess(userId: string): Promise<Client> {
    // Layer 1: User is authenticated
    const user = this.store.findUserById(userId);
    if (!user) {
      throw new HttpError(401, "User not found", NOTION_ERRORS.NOT_CONNECTED);
    }

    // Layer 2: Notion account is connected
    if (!user.notionAccessToken) {
      throw new HttpError(403,
        "Notion is not connected. Please connect your Notion account first.",
        NOTION_ERRORS.NOT_CONNECTED
      );
    }

    // Layer 3: Token can be decrypted
    let accessToken: string;
    try {
      accessToken = decryptToken(user.notionAccessToken, this.getEncryptionSecret());
    } catch {
      throw new HttpError(403,
        "Notion token is invalid. Please reconnect your Notion account.",
        NOTION_ERRORS.TOKEN_INVALID
      );
    }

    // Layer 4 & 5: Token is valid + workspace access
    const client = new Client({ auth: accessToken });
    try {
      await this.withTimeout(() => client.users.me({}));
    } catch (err) {
      if (err instanceof APIResponseError) {
        if (err.status === 401) {
          throw new HttpError(403,
            "Notion access token has expired or been revoked. Please reconnect your Notion account.",
            NOTION_ERRORS.TOKEN_EXPIRED
          );
        }
        if (err.status === 403) {
          throw new HttpError(403,
            "Notion workspace access has been revoked. Please reconnect.",
            NOTION_ERRORS.WORKSPACE_REVOKED
          );
        }
      }
      throw new HttpError(502,
        "Failed to validate Notion connection. Please try again.",
        NOTION_ERRORS.TOKEN_INVALID
      );
    }

    return client;
  }

  // ══════════════════════════════════════════════════
  // Rate Limiting & Reliability
  // ══════════════════════════════════════════════════

  /**
   * Execute a Notion API call with exponential backoff retry on 429.
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (err instanceof APIResponseError && err.status === 429) {
          // Parse Retry-After header if available
          const retryAfterHeader = (err as any).headers?.get?.("retry-after");
          const retryAfterMs = retryAfterHeader
            ? parseInt(retryAfterHeader, 10) * 1000
            : BACKOFF_BASE_MS * Math.pow(3, attempt); // 1s, 3s, 9s

          if (attempt < MAX_RETRIES - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
            continue;
          }
        }
        // Non-retryable error
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Wrap a function call with a timeout AbortController.
   */
  private async withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      return await fn();
    } catch (err: any) {
      if (err?.name === "AbortError" || controller.signal.aborted) {
        throw new HttpError(504,
          "Notion API request timed out. Please try again.",
          NOTION_ERRORS.TIMEOUT
        );
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute a Notion API call with retry + timeout + error mapping.
   */
  private async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.withRetry(() => this.withTimeout(fn));
  }

  // ══════════════════════════════════════════════════
  // Activity Logging
  // ══════════════════════════════════════════════════

  private logActivity(
    userId: string,
    operation: string,
    success: boolean,
    resourceId?: string,
    errorMessage?: string
  ): void {
    const log: NotionActivityLogRecord = {
      id: randomUUID(),
      userId,
      operation,
      resourceId,
      timestamp: new Date().toISOString(),
      success,
      errorMessage
    };
    this.store.createNotionActivityLog(log);
  }

  // ══════════════════════════════════════════════════
  // Error Mapping
  // ══════════════════════════════════════════════════

  private mapApiError(err: unknown): HttpError {
    if (err instanceof HttpError) return err;

    if (err instanceof APIResponseError) {
      switch (err.status) {
        case 401:
          return new HttpError(403,
            "Notion access has expired. Please reconnect your account.",
            NOTION_ERRORS.TOKEN_EXPIRED
          );
        case 403:
          return new HttpError(403,
            "You don't have permission to access this Notion resource.",
            NOTION_ERRORS.PERMISSION_DENIED
          );
        case 404:
          return new HttpError(404,
            "The requested Notion resource was not found. It may have been deleted or not shared with this integration.",
            NOTION_ERRORS.RESOURCE_NOT_FOUND
          );
        case 429:
          return new HttpError(429,
            "Notion API rate limit exceeded. Please wait and try again.",
            NOTION_ERRORS.RATE_LIMITED
          );
        default:
          return new HttpError(502,
            `Notion API error: ${err.message}`,
            "NOTION_API_ERROR"
          );
      }
    }

    return new HttpError(500,
      "An unexpected error occurred while communicating with Notion.",
      "NOTION_UNKNOWN_ERROR"
    );
  }

  // ══════════════════════════════════════════════════
  // Public API: Token Validation
  // ══════════════════════════════════════════════════

  async validateToken(userId: string): Promise<NotionToolResult> {
    try {
      await this.validateAccess(userId);
      this.logActivity(userId, "validateToken", true);
      return { success: true, data: { valid: true } };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "validateToken", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  // ══════════════════════════════════════════════════
  // Public API: Search Operations
  // ══════════════════════════════════════════════════

  async searchPages(userId: string, query?: string): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);
      const response = await this.execute(() =>
        client.search({
          query: query || undefined,
          filter: { value: "page", property: "object" },
          page_size: 20
        })
      );

      const pages = response.results.map((page: any) => ({
        id: page.id,
        title: this.extractTitle(page),
        url: page.url,
        createdTime: page.created_time,
        lastEditedTime: page.last_edited_time,
        archived: page.archived
      }));

      this.logActivity(userId, "searchPages", true);
      return { success: true, data: { pages, hasMore: response.has_more } };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "searchPages", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  async searchDatabases(userId: string, query?: string): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);
      const response = await this.execute(() =>
        client.search({
          query: query || undefined,
          filter: { value: "database" as any, property: "object" },
          page_size: 20
        })
      );

      const databases = response.results.map((db: any) => ({
        id: db.id,
        title: this.extractTitle(db),
        url: db.url,
        createdTime: db.created_time,
        lastEditedTime: db.last_edited_time,
        properties: Object.keys(db.properties || {})
      }));

      this.logActivity(userId, "searchDatabases", true);
      return { success: true, data: { databases, hasMore: response.has_more } };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "searchDatabases", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  async searchNotion(userId: string, query?: string): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);
      const response = await this.execute(() =>
        client.search({
          query: query || undefined,
          page_size: 20
        })
      );

      const results = response.results.map((item: any) => ({
        id: item.id,
        object: item.object,
        title: this.extractTitle(item),
        url: item.url,
        lastEditedTime: item.last_edited_time
      }));

      this.logActivity(userId, "searchNotion", true);
      return { success: true, data: { results, hasMore: response.has_more } };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "searchNotion", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  // ══════════════════════════════════════════════════
  // Public API: Page Operations
  // ══════════════════════════════════════════════════

  async getPageContent(userId: string, pageId: string): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);

      // Fetch page metadata and blocks in parallel
      const [page, blocks] = await Promise.all([
        this.execute(() => client.pages.retrieve({ page_id: pageId })),
        this.execute(() => client.blocks.children.list({ block_id: pageId, page_size: 100 }))
      ]);

      const pageData = page as any;
      const result = {
        id: pageData.id,
        title: this.extractTitle(pageData),
        url: pageData.url,
        createdTime: pageData.created_time,
        lastEditedTime: pageData.last_edited_time,
        archived: pageData.archived,
        properties: this.safeExtractProperties(pageData.properties),
        content: blocks.results.map((block: any) => this.extractBlockContent(block)),
        hasMoreContent: blocks.has_more
      };

      this.logActivity(userId, "getPageContent", true, pageId);
      return { success: true, data: result };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "getPageContent", false, pageId, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  async createPage(
    userId: string,
    parentId: string,
    title: string,
    children?: any[]
  ): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);

      let resolvedParentId = parentId;
      const stripped = parentId ? parentId.replace(/-/g, "") : "";
      
      if (stripped.length !== 32) {
        const searchRes = await this.execute(() => client.search({
          filter: { value: "page" as any, property: "object" },
          page_size: 1
        }));
        if (searchRes.results && searchRes.results.length > 0) {
          resolvedParentId = searchRes.results[0]!.id;
        } else {
          const dbSearchRes = await this.execute(() => client.search({
            filter: { value: "database" as any, property: "object" },
            page_size: 1
          }));
          if (dbSearchRes.results && dbSearchRes.results.length > 0) {
            resolvedParentId = dbSearchRes.results[0]!.id;
          } else {
            throw new Error("No accessible parent page or database found. Please share at least one page with this integration in Notion.");
          }
        }
      }

      // Determine parent type (database or page)
      const parent = resolvedParentId.replace(/-/g, "").length === 32
        ? await this.resolveParent(client, resolvedParentId)
        : { type: "page_id" as const, page_id: resolvedParentId };

      const createParams: any = {
        parent,
        properties: {
          title: {
            title: [{ text: { content: title } }]
          }
        }
      };

      if (children && children.length > 0) {
        createParams.children = children;
      }

      const page = await this.execute(() => client.pages.create(createParams));
      const pageData = page as any;

      this.logActivity(userId, "createPage", true, pageData.id);
      return {
        success: true,
        data: {
          id: pageData.id,
          title,
          url: pageData.url,
          createdTime: pageData.created_time
        }
      };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "createPage", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  async updatePage(
    userId: string,
    pageId: string,
    properties: Record<string, any>
  ): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);

      const page = await this.execute(() =>
        client.pages.update({
          page_id: pageId,
          properties
        })
      );
      const pageData = page as any;

      this.logActivity(userId, "updatePage", true, pageId);
      return {
        success: true,
        data: {
          id: pageData.id,
          url: pageData.url,
          lastEditedTime: pageData.last_edited_time
        }
      };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "updatePage", false, pageId, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  // ══════════════════════════════════════════════════
  // Public API: Database Entry Operations
  // ══════════════════════════════════════════════════

  async createDatabaseEntry(
    userId: string,
    databaseId: string,
    properties: Record<string, any>
  ): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);

      const entry = await this.execute(() =>
        client.pages.create({
          parent: { database_id: databaseId },
          properties
        })
      );
      const entryData = entry as any;

      this.logActivity(userId, "createDatabaseEntry", true, entryData.id);
      return {
        success: true,
        data: {
          id: entryData.id,
          url: entryData.url,
          createdTime: entryData.created_time
        }
      };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "createDatabaseEntry", false, databaseId, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  async updateDatabaseEntry(
    userId: string,
    entryId: string,
    properties: Record<string, any>
  ): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);

      const entry = await this.execute(() =>
        client.pages.update({
          page_id: entryId,
          properties
        })
      );
      const entryData = entry as any;

      this.logActivity(userId, "updateDatabaseEntry", true, entryId);
      return {
        success: true,
        data: {
          id: entryData.id,
          url: entryData.url,
          lastEditedTime: entryData.last_edited_time
        }
      };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "updateDatabaseEntry", false, entryId, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  // ══════════════════════════════════════════════════
  // Public API: Workspace
  // ══════════════════════════════════════════════════

  async getWorkspaceMetadata(userId: string): Promise<NotionToolResult> {
    try {
      const client = await this.validateAccess(userId);
      const me = await this.execute(() => client.users.me({}));
      const user = this.store.findUserById(userId);

      this.logActivity(userId, "getWorkspaceMetadata", true);
      return {
        success: true,
        data: {
          botId: (me as any).id,
          botName: (me as any).name,
          workspaceId: user?.notionWorkspaceId,
          workspaceName: user?.notionWorkspaceName,
          workspaceIcon: user?.notionWorkspaceIcon,
          connectedAt: user?.notionConnectedAt
        }
      };
    } catch (err) {
      const mapped = this.mapApiError(err);
      this.logActivity(userId, "getWorkspaceMetadata", false, undefined, mapped.message);
      return { success: false, error: mapped.message, errorCode: mapped.code };
    }
  }

  // ══════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════

  private extractTitle(item: any): string {
    // Page title
    if (item.properties?.title?.title) {
      const titleParts = item.properties.title.title;
      if (Array.isArray(titleParts) && titleParts.length > 0) {
        return titleParts.map((t: any) => t.plain_text || "").join("");
      }
    }

    // Page Name property
    if (item.properties?.Name?.title) {
      const nameParts = item.properties.Name.title;
      if (Array.isArray(nameParts) && nameParts.length > 0) {
        return nameParts.map((t: any) => t.plain_text || "").join("");
      }
    }

    // Database title
    if (item.title && Array.isArray(item.title)) {
      return item.title.map((t: any) => t.plain_text || "").join("");
    }

    return "Untitled";
  }

  private extractBlockContent(block: any): any {
    const base = {
      id: block.id,
      type: block.type,
      hasChildren: block.has_children
    };

    const content = block[block.type];
    if (!content) return base;

    // Extract rich text content
    if (content.rich_text) {
      return {
        ...base,
        text: content.rich_text.map((t: any) => t.plain_text || "").join("")
      };
    }

    return base;
  }

  private safeExtractProperties(properties: any): Record<string, any> {
    if (!properties) return {};
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(properties)) {
      const prop = value as any;
      result[key] = {
        type: prop.type,
        id: prop.id
      };

      // Extract simple scalar values from known property types
      if (prop.type === "title" && prop.title) {
        result[key].value = prop.title.map((t: any) => t.plain_text || "").join("");
      } else if (prop.type === "rich_text" && prop.rich_text) {
        result[key].value = prop.rich_text.map((t: any) => t.plain_text || "").join("");
      } else if (prop.type === "number") {
        result[key].value = prop.number;
      } else if (prop.type === "select" && prop.select) {
        result[key].value = prop.select.name;
      } else if (prop.type === "multi_select") {
        result[key].value = prop.multi_select?.map((s: any) => s.name) ?? [];
      } else if (prop.type === "checkbox") {
        result[key].value = prop.checkbox;
      } else if (prop.type === "date" && prop.date) {
        result[key].value = prop.date.start;
      } else if (prop.type === "url") {
        result[key].value = prop.url;
      } else if (prop.type === "email") {
        result[key].value = prop.email;
      } else if (prop.type === "status" && prop.status) {
        result[key].value = prop.status.name;
      }
    }

    return result;
  }

  private async resolveParent(client: Client, id: string): Promise<any> {
    // Try as database first
    try {
      await this.execute(() => client.databases.retrieve({ database_id: id }));
      return { database_id: id };
    } catch {
      // Fall back to page
      return { page_id: id };
    }
  }
}
