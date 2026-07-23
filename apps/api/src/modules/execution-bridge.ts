import { Router } from "express";
import { approvalDecisionSchema, bridgeRunSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";
import { ExecutionEngineService } from "../services/execution-engine";
import { GoogleAuthService } from "../services/google-auth";
import { createHmac, timingSafeEqual } from "node:crypto";

export function executionBridgeRouter(env: Env, store: MemoryStore) {
  const router = Router();

  function getConfiguredStatus(token?: string): "connected" | "disconnected" {
    return token?.trim() ? "connected" : "disconnected";
  }

  async function resolveGoogleStatus(userId: string) {
    const user = store.findUserById(userId);
    if (!user) throw new HttpError(404, "User not found", "USER_NOT_FOUND");

    const googleAuth = new GoogleAuthService(env, store);
    const hasUserRefreshToken = Boolean(user.googleRefreshToken?.trim());
    const hasServiceRefreshToken = Boolean(env.googleRefreshToken?.trim());

    if (!hasUserRefreshToken && !hasServiceRefreshToken) {
      return {
        status: "disconnected" as const,
        tokenSource: "none" as const,
        refreshSuccess: false,
        user,
        errorMessage: "Google APIs not configured. Set up Google OAuth or configure GOOGLE_REFRESH_TOKEN."
      };
    }

    try {
      if (hasUserRefreshToken) {
        await googleAuth.getAccessToken(userId);
        return {
          status: "connected" as const,
          tokenSource: "user" as const,
          refreshSuccess: true,
          user: store.findUserById(userId) ?? user
        };
      }

      await googleAuth.getAccessTokenFromEnv();
      return {
        status: "connected" as const,
        tokenSource: "environment" as const,
        refreshSuccess: true,
        user
      };
    } catch (error: any) {
      return {
        status: "disconnected" as const,
        tokenSource: hasUserRefreshToken ? "user" as const : "environment" as const,
        refreshSuccess: false,
        user: store.findUserById(userId) ?? user,
        errorMessage: error?.message ?? "Google token refresh failed."
      };
    }
  }

  // 1. Get Connection Status of API Tokens
  router.get(
    "/:id/execution-bridge/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      
      const googleStatus = await resolveGoogleStatus(req.user!.id);
      const connections = [
        { name: "Gmail API", key: "gmail", status: googleStatus.status, type: "User OAuth", tokenSource: googleStatus.tokenSource },
        { name: "Google Calendar API", key: "google_calendar", status: googleStatus.status, type: "User OAuth", tokenSource: googleStatus.tokenSource },
        { name: "Google Sheets API", key: "google_sheets", status: googleStatus.status, type: "User OAuth", tokenSource: googleStatus.tokenSource },
        { name: "Notion Integration", key: "notion", status: getConfiguredStatus(env.notionIntegrationToken), type: "Service Access" },
        { name: "Telegram Bot API", key: "telegram", status: getConfiguredStatus(env.telegramBotToken), type: "Messenger Bot" }
      ];

      res.json({ connections });
    })
  );

  // 1.5. Health Check for Google API Connectivity
  router.get(
    "/:id/execution-bridge/health",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const googleStatus = await resolveGoogleStatus(req.user!.id);
      const user = googleStatus.user;
      const googleTokenValid = Boolean(
        user.googleAccessTokenExpiresAt && new Date(user.googleAccessTokenExpiresAt) > new Date()
      );

      res.json({
        status: googleStatus.status,
        timestamp: new Date().toISOString(),
        tokenSource: googleStatus.tokenSource,
        refreshSuccess: googleStatus.refreshSuccess,
        credentials: {
          userGoogleAuth: {
            configured: Boolean(user.googleRefreshToken?.trim()),
            tokenValid: googleTokenValid,
            expiresAt: user.googleAccessTokenExpiresAt || null
          },
          serviceGoogleAuth: {
            configured: Boolean(env.googleRefreshToken?.trim())
          }
        },
        message: googleStatus.status === "connected"
          ? `Connected with ${googleStatus.tokenSource} Google token`
          : googleStatus.errorMessage
      });
    })
  );

  // 2. Fetch Automation Audit Logs
  router.get(
    "/:id/execution-bridge/logs",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const logs = store.listBridgeLogs(assistant.id);
      const approvals = store.listBridgeApprovals(assistant.id);
      res.json({ logs, approvals });
    })
  );

  // 3. Manual Automation Run
  router.post(
    "/:id/execution-bridge/run",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const { message } = bridgeRunSchema.parse(req.body);

      const engine = new ExecutionEngineService(env, store);
      const result = await engine.runPipeline(assistant.id, req.user!.id, message);

      res.json({ result });
    })
  );

  // 4. Confirm / Reject Pending Action (Human Safety Gate)
  router.post(
    "/:id/execution-bridge/approvals/:approvalId/confirm",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const { decision } = approvalDecisionSchema.parse(req.body);
      const approval = store.getBridgeApproval(req.params.approvalId!);
      if (!approval || approval.userId !== req.user!.id || approval.assistantId !== assistant.id) {
        throw new HttpError(404, "Approval not found", "APPROVAL_NOT_FOUND");
      }

      const engine = new ExecutionEngineService(env, store);
      const result = await engine.resumePipeline(req.params.approvalId!, decision);

      res.json({ result });
    })
  );

  // 5. Public Event webhook (e.g. Gmail webhook, Notion webhook, etc.)
  router.post(
    "/:id/execution-bridge/webhooks/:service",
    asyncHandler(async (req, res) => {
      if (!env.webhookSigningSecret?.trim()) {
        throw new HttpError(503, "Webhook processing is not configured.", "WEBHOOK_NOT_CONFIGURED");
      }
      const timestamp = req.header("x-archmind-timestamp") ?? "";
      const signature = req.header("x-archmind-signature") ?? "";
      const timestampMs = Number(timestamp);
      if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        throw new HttpError(401, "Webhook timestamp is invalid or expired.", "WEBHOOK_REPLAY_REJECTED");
      }
      const expected = createHmac("sha256", env.webhookSigningSecret).update(`${timestamp}.${JSON.stringify(req.body ?? {})}`).digest("hex");
      const supplied = signature.replace(/^sha256=/, "");
      if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        throw new HttpError(401, "Webhook signature is invalid.", "WEBHOOK_SIGNATURE_INVALID");
      }
      const assistant = assertFound(store.getAssistant(req.params.id!), "Assistant not found");
      const service = req.params.service!;

      // Sanitize user-controlled webhook fields to prevent prompt injection
      const sanitize = (value: unknown, maxLen = 500): string => {
        if (typeof value !== "string") return "";
        return value
          .replace(/[\x00-\x1F\x7F]/g, " ")  // Strip control characters
          .trim()
          .slice(0, maxLen);
      };
      
      let query = `[SYSTEM: Webhook event from ${sanitize(service, 50)}]`;
      if (service === "gmail") {
        const email = req.body || {};
        query = `[SYSTEM: New email received]\n[USER_CONTENT_START]\nFrom: ${sanitize(email.from, 200)}\nSubject: ${sanitize(email.subject, 300)}\nBody: ${sanitize(email.body, 2000)}\n[USER_CONTENT_END]`;
      } else if (service === "notion") {
        const page = req.body || {};
        query = `[SYSTEM: Notion page created]\n[USER_CONTENT_START]\nTitle: ${sanitize(page.title, 300)}\nProperties: ${sanitize(JSON.stringify(page.properties || {}), 1000)}\n[USER_CONTENT_END]`;
      } else if (service === "google_calendar") {
        query = `[SYSTEM: Google Calendar update]\n[USER_CONTENT_START]\nEvent: ${sanitize(req.body?.title, 300)}\nStatus: ${sanitize(req.body?.status, 100)}\n[USER_CONTENT_END]`;
      } else if (service === "crm") {
        query = `[SYSTEM: CRM update event]\n[USER_CONTENT_START]\nClient: ${sanitize(req.body?.name, 200)}\nStage: ${sanitize(req.body?.stage, 200)}\nDeal value: ${sanitize(req.body?.value, 100)}\n[USER_CONTENT_END]`;
      } else if (req.body?.message) {
        query = `[SYSTEM: Webhook message from ${sanitize(service, 50)}]\n[USER_CONTENT_START]\n${sanitize(req.body.message, 2000)}\n[USER_CONTENT_END]`;
      }

      const engine = new ExecutionEngineService(env, store);
      const result = await engine.runPipeline(assistant.id, assistant.userId, query);

      res.json({ ok: true, result });
    })
  );

  return router;
}
