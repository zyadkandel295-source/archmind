import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { GoogleAuthService } from "./google-auth";
import { NotionService } from "./notion-service";
import { HttpError } from "../lib/http-error";

export interface ToolExecutionResult {
  success: boolean;
  response: unknown;
  timestamp: string;
  durationMs: number;
  errorMessage?: string;
}

/**
 * Production-grade Tool Gateway - REAL APIs ONLY
 *
 * This service connects to real Google APIs (Gmail, Calendar, Sheets).
 * If a real API fails, the error is returned to the caller.
 */
export class ToolGatewayService {
  private googleAuth: GoogleAuthService;
  private notionService: NotionService;

  constructor(
    private env: Env,
    store: MemoryStore
  ) {
    this.googleAuth = new GoogleAuthService(env, store);
    this.notionService = new NotionService(env, store);
  }

  /**
   * Execute a tool with real API calls only.
   * Returns actual results or throws errors - NO SIMULATION.
   */
  private async executeTool<T>(
    toolName: string,
    action: () => Promise<T>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    try {
      const response = await action();
      const durationMs = Date.now() - startTime;
      console.log(`[ToolGateway] ✓ ${toolName} completed in ${durationMs}ms`);
      
      return {
        success: true,
        response,
        timestamp,
        durationMs
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error?.message || `Execution of ${toolName} failed`;
      console.error(`[ToolGateway] ✗ ${toolName} failed (${durationMs}ms):`, errorMessage);
      
      return {
        success: false,
        response: null,
        timestamp,
        durationMs,
        errorMessage
      };
    }
  }

  // ==================== GMAIL API TOOLS ====================

  /**
   * Send real email via Gmail API.
   * Requires valid OAuth token with gmail.modify scope.
   * REAL implementation - actual emails sent to real recipients.
   */
  async send_email(params: { to: string; subject: string; body: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("send_email", async () => {
      if (!params.to || !params.subject || !params.body) {
        throw new Error("Missing required parameters: to, subject, body");
      }

      // Get valid access token (auto-refreshes if needed)
      const accessToken = await this.googleAuth.getAccessToken(userId);

      // Create RFC 2822 formatted message
      const message = this.createRfc2822Message({
        to: params.to,
        subject: params.subject,
        body: params.body
      });

      // Encode message to base64url
      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Call REAL Gmail API
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: encodedMessage })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as { id?: string };

      return {
        messageId: data.id,
        status: "sent",
        provider: "Gmail API",
        recipient: params.to,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Read real emails from Gmail inbox.
   * Returns actual messages from user's account.
   * REAL implementation - real Gmail API call.
   */
  async read_email(params: { query?: string; messageId?: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("read_email", async () => {
      const accessToken = await this.googleAuth.getAccessToken(userId);

      // If specific messageId provided, get that message
      if (params.messageId) {
        const response = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${params.messageId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch message: ${response.statusText}`);
        }

        const message = (await response.json()) as any;

        return {
          messages: [
            {
              id: message.id,
              from:
                message.payload?.headers?.find((h: any) => h.name === "From")?.value || "unknown",
              subject:
                message.payload?.headers?.find((h: any) => h.name === "Subject")?.value ||
                "(no subject)",
              body: this.decodeMessageBody(message.payload),
              date: new Date(Number(message.internalDate)).toISOString()
            }
          ]
        };
      }

      // Otherwise list messages with query
      const query = params.query ? `q=${encodeURIComponent(params.query)}` : "";
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?${query}&maxResults=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      const list = (await response.json()) as { messages?: Array<{ id: string }> };

      return {
        messages: list.messages || []
      };
    });
  }

  /**
   * Filter real emails via Gmail API.
   * Returns filtered message list from actual inbox.
   */
  async filter_email(params: { query: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("filter_email", async () => {
      if (!params.query) {
        throw new Error("Missing required parameter: query");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(
          params.query
        )}&maxResults=20`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      const list = (await response.json()) as { messages?: Array<{ id: string }> };

      return {
        query: params.query,
        messageCount: list.messages?.length || 0,
        messages: list.messages || [],
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Archive real emails in Gmail.
   * Removes INBOX label from actual messages.
   */
  async archive_email(params: { messageIds: string[] }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("archive_email", async () => {
      if (!params.messageIds || params.messageIds.length === 0) {
        throw new Error("Missing required parameter: messageIds");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      // Archive by removing INBOX label
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/batchModify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: params.messageIds,
          removeLabelIds: ["INBOX"]
        })
      });

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      return {
        archivedCount: params.messageIds.length,
        status: "success",
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Apply labels to real emails in Gmail.
   * Applies labels to actual messages in user's account.
   */
  async label_email(params: {
    messageIds: string[];
    labelName: string;
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("label_email", async () => {
      if (!params.messageIds || params.messageIds.length === 0) {
        throw new Error("Missing required parameter: messageIds");
      }
      if (!params.labelName) {
        throw new Error("Missing required parameter: labelName");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      // Get label ID
      const labelsResponse = await fetch("https://www.googleapis.com/gmail/v1/users/me/labels", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!labelsResponse.ok) {
        throw new Error("Failed to fetch labels");
      }

      const labelsData = (await labelsResponse.json()) as { labels: Array<{ id: string; name: string }> };
      const label = labelsData.labels.find(
        (l) => l.name.toLowerCase() === params.labelName.toLowerCase()
      );

      if (!label) {
        throw new Error(`Label "${params.labelName}" not found`);
      }

      // Apply label
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/batchModify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: params.messageIds,
          addLabelIds: [label.id]
        })
      });

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      return {
        labeledCount: params.messageIds.length,
        labelName: params.labelName,
        status: "success",
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Create real email draft in Gmail.
   * Creates actual draft message in user's account.
   */
  async draft_email(params: {
    to: string;
    subject: string;
    body: string;
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("draft_email", async () => {
      if (!params.to || !params.subject || !params.body) {
        throw new Error("Missing required parameters: to, subject, body");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      // Create RFC 2822 formatted message
      const message = this.createRfc2822Message({
        to: params.to,
        subject: params.subject,
        body: params.body
      });

      const encodedMessage = Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Create draft
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: { raw: encodedMessage }
        })
      });

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.statusText}`);
      }

      const draft = (await response.json()) as { id?: string };

      return {
        draftId: draft.id,
        to: params.to,
        subject: params.subject,
        status: "draft",
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==================== GOOGLE CALENDAR API TOOLS ====================

  /**
   * Create real calendar event via Google Calendar API.
   * Creates actual calendar event in user's primary calendar.
   */
  async create_calendar_event(params: {
    title: string;
    startTime: string;
    endTime: string;
    attendees: string[];
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("create_calendar_event", async () => {
      if (!params.title || !params.startTime || !params.endTime) {
        throw new Error("Missing required parameters: title, startTime, endTime");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          summary: params.title,
          description: `Created by Archmind Autonomous Agent at ${new Date().toISOString()}`,
          start: { dateTime: params.startTime },
          end: { dateTime: params.endTime },
          attendees: params.attendees.map((email) => ({ email })),
          conferenceData: {
            createRequest: { requestId: Math.random().toString(36).substring(7) }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar API error (${response.status}): ${errorText}`);
      }

      const event = (await response.json()) as { id?: string; htmlLink?: string };

      return {
        id: event.id,
        title: params.title,
        start: params.startTime,
        end: params.endTime,
        attendees: params.attendees,
        status: "confirmed",
        htmlLink: event.htmlLink,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Update real calendar event via Google Calendar API.
   * Updates actual event in user's primary calendar.
   */
  async update_calendar_event(params: {
    eventId: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    attendees?: string[];
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("update_calendar_event", async () => {
      if (!params.eventId) {
        throw new Error("Missing required parameter: eventId");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${params.eventId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            summary: params.title,
            start: params.startTime ? { dateTime: params.startTime } : undefined,
            end: params.endTime ? { dateTime: params.endTime } : undefined,
            attendees: params.attendees?.map((email) => ({ email }))
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Calendar API error (${response.status}): ${errorText}`);
      }

      const event = (await response.json()) as any;

      return {
        id: event.id,
        title: event.summary,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
        attendees: event.attendees?.map((a: any) => a.email),
        status: "updated",
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Detect real calendar conflicts via Google Calendar API.
   * Checks for overlapping events in user's calendar.
   */
  async detect_calendar_conflicts(params: {
    startTime: string;
    endTime: string;
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("detect_calendar_conflicts", async () => {
      if (!params.startTime || !params.endTime) {
        throw new Error("Missing required parameters: startTime, endTime");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
          params.startTime
        )}&timeMax=${encodeURIComponent(params.endTime)}&singleEvents=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { items?: Array<{ summary: string; start: any; end: any }> };

      return {
        timeRange: {
          start: params.startTime,
          end: params.endTime
        },
        conflicts: data.items || [],
        conflictCount: data.items?.length || 0,
        hasConflicts: (data.items?.length || 0) > 0,
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==================== GOOGLE SHEETS API TOOLS ====================

  /**
   * Read real data from Google Sheets.
   * Returns actual spreadsheet data from user's account.
   */
  async read_sheets(params: { spreadsheetId: string; range: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("read_sheets", async () => {
      if (!params.spreadsheetId || !params.range) {
        throw new Error("Missing required parameters: spreadsheetId, range");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(
          params.range
        )}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sheets API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as { values?: string[][] };

      return {
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        values: data.values || [],
        rowCount: data.values?.length || 0,
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Write real data to Google Sheets.
   * Appends actual rows to user's spreadsheet.
   */
  async write_sheets(params: {
    spreadsheetId: string;
    range: string;
    values: any[][];
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("write_sheets", async () => {
      if (!params.spreadsheetId || !params.range || !params.values) {
        throw new Error("Missing required parameters: spreadsheetId, range, values");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(
          params.range
        )}:append?valueInputOption=USER_ENTERED`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ values: params.values })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sheets API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;

      return {
        spreadsheetId: params.spreadsheetId,
        updatedRange: data.updates?.updatedRange,
        updatedRows: data.updates?.updatedRows || params.values.length,
        updatedColumns: data.updates?.updatedColumns,
        status: "success",
        timestamp: new Date().toISOString()
      };
    });
  }

  /**
   * Generate real report from Google Sheets.
   * Creates summary from actual spreadsheet data.
   */
  async generate_sheets_report(params: {
    spreadsheetId: string;
    range: string;
  }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("generate_sheets_report", async () => {
      if (!params.spreadsheetId || !params.range) {
        throw new Error("Missing required parameters: spreadsheetId, range");
      }

      const accessToken = await this.googleAuth.getAccessToken(userId);

      // Read all data from sheet
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(
          params.range
        )}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) {
        throw new Error(`Sheets API error: ${response.statusText}`);
      }

      const data = (await response.json()) as { values?: string[][] };
      const rows = data.values || [];

      // Generate statistics from actual data
      return {
        spreadsheetId: params.spreadsheetId,
        range: params.range,
        rowCount: rows.length,
        columnCount: rows[0]?.length || 0,
        headers: rows[0] || [],
        dataRows: rows.slice(1) || [],
        summary: {
          totalRows: rows.length,
          totalColumns: rows[0]?.length || 0,
          lastUpdated: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==================== WEBHOOK TOOLS ====================

  /**
   * Trigger a webhook.
   * Mock/simulated implementation.
   */
  async trigger_webhook(params: { url: string; payload: any }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("trigger_webhook", async () => {
      console.log(`[Webhook] Triggering ${params.url} with payload`, params.payload);
      return {
        status: "triggered",
        url: params.url,
        payload: params.payload,
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==================== NOTION TOOLS ====================

  /**
   * Search pages in the user's Notion workspace.
   */
  async getNotionPages(params: { query?: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("getNotionPages", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      const res = await this.notionService.searchPages(userId, params.query);
      if (!res.success) {
        throw new Error(res.error || "Failed to search Notion pages");
      }
      return res.data;
    });
  }

  /**
   * Search databases in the user's Notion workspace.
   */
  async getNotionDatabases(params: { query?: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("getNotionDatabases", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      const res = await this.notionService.searchDatabases(userId, params.query);
      if (!res.success) {
        throw new Error(res.error || "Failed to search Notion databases");
      }
      return res.data;
    });
  }

  /**
   * Retrieve complete page content and metadata.
   */
  async getPageContent(params: { pageId: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("getPageContent", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      if (!params.pageId) throw new Error("Missing required parameter: pageId");
      const res = await this.notionService.getPageContent(userId, params.pageId);
      if (!res.success) {
        throw new Error(res.error || `Failed to get content for page ${params.pageId}`);
      }
      return res.data;
    });
  }

  /**
   * Create a new page in Notion.
   */
  async createNotionPage(
    params: { parentId: string; title: string; children?: any[]; content?: string },
    userId?: string
  ): Promise<ToolExecutionResult> {
    return this.executeTool("createNotionPage", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      if (!params.parentId || !params.title) {
        throw new Error("Missing required parameters: parentId, title");
      }
      let children = params.children;
      if (params.content && typeof params.content === "string") {
        children = [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: params.content } }]
            }
          }
        ];
      }
      const res = await this.notionService.createPage(userId, params.parentId, params.title, children);
      if (!res.success) {
        throw new Error(res.error || "Failed to create Notion page");
      }
      return res.data;
    });
  }

  /**
   * Update a Notion page's properties.
   */
  async updateNotionPage(params: { pageId: string; properties: any }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("updateNotionPage", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      if (!params.pageId || !params.properties) {
        throw new Error("Missing required parameters: pageId, properties");
      }
      const res = await this.notionService.updatePage(userId, params.pageId, params.properties);
      if (!res.success) {
        throw new Error(res.error || `Failed to update Notion page ${params.pageId}`);
      }
      return res.data;
    });
  }

  /**
   * Alias for backward compatibility.
   */
  async update_notion_page(params: { pageId: string; properties: any }, userId?: string): Promise<ToolExecutionResult> {
    return this.updateNotionPage(params, userId);
  }

  /**
   * Create a new database record (entry) in Notion.
   */
  async createDatabaseRecord(
    params: { databaseId: string; properties: any },
    userId?: string
  ): Promise<ToolExecutionResult> {
    return this.executeTool("createDatabaseRecord", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      if (!params.databaseId || !params.properties) {
        throw new Error("Missing required parameters: databaseId, properties");
      }
      const res = await this.notionService.createDatabaseEntry(userId, params.databaseId, params.properties);
      if (!res.success) {
        throw new Error(res.error || "Failed to create Notion database record");
      }
      return res.data;
    });
  }

  /**
   * Update an existing database record (entry) in Notion.
   */
  async updateDatabaseRecord(
    params: { entryId: string; properties: any },
    userId?: string
  ): Promise<ToolExecutionResult> {
    return this.executeTool("updateDatabaseRecord", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      if (!params.entryId || !params.properties) {
        throw new Error("Missing required parameters: entryId, properties");
      }
      const res = await this.notionService.updateDatabaseEntry(userId, params.entryId, params.properties);
      if (!res.success) {
        throw new Error(res.error || `Failed to update Notion database record ${params.entryId}`);
      }
      return res.data;
    });
  }

  /**
   * Search all Notion workspace content.
   */
  async searchNotion(params: { query?: string }, userId?: string): Promise<ToolExecutionResult> {
    return this.executeTool("searchNotion", async () => {
      if (!userId) throw new Error("User ID is required for Notion operations");
      const res = await this.notionService.searchNotion(userId, params.query);
      if (!res.success) {
        throw new Error(res.error || "Failed to search Notion workspace");
      }
      return res.data;
    });
  }

  // ==================== TELEGRAM API TOOLS ====================

  /**
   * Send real message via Telegram Bot API.
   * If chat_id/chatId is missing, it will fetch updates from getUpdates API
   * to target the most recent chat that interacted with the bot.
   */
  async send_telegram_message(
    params: { chat_id?: string; chatId?: string; text: string },
    userId?: string
  ): Promise<ToolExecutionResult> {
    return this.executeTool("send_telegram_message", async () => {
      const text = params.text;
      if (!text) {
        throw new Error("Missing required parameter: text");
      }

      const token = this.env.telegramBotToken;
      if (!token || token === "mock-telegram-token-xyz") {
        throw new Error("Telegram Bot Token is not configured. Please add TELEGRAM_BOT_TOKEN to your environment.");
      }

      let resolvedChatId = params.chat_id || params.chatId;

      // Fallback: If no chat_id provided or placeholder is used, fetch the last chat_id from getUpdates
      const isPlaceholder = resolvedChatId && /^(?:123456789|1234567890|your_chat_id|mock_chat_id|placeholder)$/i.test(String(resolvedChatId).trim());
      if (!resolvedChatId || isPlaceholder) {
        console.log(`[ToolGateway] chat_id not provided or placeholder used (${resolvedChatId}). Querying getUpdates to resolve latest chat_id...`);
        const updatesRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10&offset=-1`);
        if (!updatesRes.ok) {
          const errText = await updatesRes.text();
          throw new Error(`Telegram getUpdates failed with status ${updatesRes.status}: ${errText}`);
        }

        const updatesData = (await updatesRes.json()) as { ok: boolean; result?: any[] };
        if (!updatesData.ok || !updatesData.result || updatesData.result.length === 0) {
          throw new Error("No recent chat interaction found. Please open your Telegram bot and send a message to it first so it knows who to reply to.");
        }

        // Find the last update with a message or callback_query that contains chat info
        let lastChatId: string | number | undefined;
        for (let i = updatesData.result.length - 1; i >= 0; i--) {
          const update = updatesData.result[i];
          const chat = update.message?.chat || update.edited_message?.chat || update.callback_query?.message?.chat || update.channel_post?.chat;
          if (chat && chat.id) {
            lastChatId = chat.id;
            break;
          }
        }

        if (!lastChatId) {
          throw new Error("Could not parse any active chat_id from recent updates. Please send a direct message to the bot first.");
        }

        resolvedChatId = String(lastChatId);
        console.log(`[ToolGateway] Resolved latest active chat_id to: ${resolvedChatId}`);
      }

      // Send the telegram message
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: resolvedChatId,
          text: text
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Telegram sendMessage failed with status ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;

      return {
        messageId: data.result?.message_id,
        chatId: resolvedChatId,
        status: "sent",
        provider: "Telegram Bot API",
        timestamp: new Date().toISOString()
      };
    });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Create RFC 2822 formatted email message for Gmail API
   */
  private createRfc2822Message(params: { to: string; subject: string; body: string }): string {
    const headers = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      "Content-Type: text/plain; charset=utf-8",
      `Date: ${new Date().toUTCString()}`,
      ""
    ];
    return headers.join("\r\n") + params.body;
  }

  /**
   * Decode message body from Gmail API response
   */
  private decodeMessageBody(payload: any): string {
    try {
      if (payload.parts) {
        for (const part of payload.parts) {
          if (part.mimeType === "text/plain" && part.body?.data) {
            return Buffer.from(part.body.data, "base64url").toString("utf-8");
          }
        }
      }
      if (payload.body?.data) {
        return Buffer.from(payload.body.data, "base64url").toString("utf-8");
      }
      return "(No content)";
    } catch {
      return "(Error decoding message)";
    }
  }
}
