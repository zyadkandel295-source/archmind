/**
 * Notion OAuth Router — `/api/auth/notion`
 *
 * Handles the complete Notion OAuth 2.0 flow:
 * - GET  /               → Redirect to Notion authorization (CSRF-protected)
 * - GET  /callback       → Exchange code for token (validates CSRF state)
 * - GET  /status         → Connection status
 * - DELETE /disconnect   → Remove stored tokens
 * - GET  /activity       → List activity logs
 */

import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { generateOAuthState, encryptToken, maskToken } from "../lib/notion-crypto";
import type { AuthedRequest } from "../types";

const NOTION_AUTHORIZE_URL = "https://api.notion.com/v1/oauth/authorize";
const NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
const FRONTEND_CALLBACK_PATH = "/auth/notion/callback";

export function notionAuthRouter(env: Env, store: MemoryStore) {
  const router = Router();

  /**
   * GET /api/auth/notion
   * Start the Notion OAuth flow.
   * Requires authenticated Archmind user session.
   * Generates CSRF state, binds to userId, redirects to Notion.
   */
  router.get(
    "/",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      if (!env.notionClientId || !env.notionClientSecret) {
        throw new HttpError(503,
          "Notion OAuth is not configured. Please set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.",
          "NOTION_NOT_CONFIGURED"
        );
      }

      const userId = req.user!.id;

      // Generate cryptographic CSRF state and bind to user
      const state = generateOAuthState();
      store.createNotionOAuthState(state, userId);

      // Build Notion OAuth authorization URL
      const params = new URLSearchParams({
        client_id: env.notionClientId,
        redirect_uri: env.notionRedirectUri,
        response_type: "code",
        owner: "user",
        state
      });

      const authUrl = `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
      res.redirect(authUrl);
    })
  );

  router.post(
    "/authorize",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      if (!env.notionClientId || !env.notionClientSecret) {
        throw new HttpError(
          503,
          "Notion OAuth is not configured. Please set NOTION_CLIENT_ID and NOTION_CLIENT_SECRET.",
          "NOTION_NOT_CONFIGURED"
        );
      }
      const userId = req.user!.id;
      const state = generateOAuthState();
      store.createNotionOAuthState(state, userId);
      const params = new URLSearchParams({
        client_id: env.notionClientId,
        redirect_uri: env.notionRedirectUri,
        response_type: "code",
        owner: "user",
        state
      });
      const authUrl = `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
      res.json({ authUrl });
    })
  );

  /**
   * GET /api/auth/notion/callback
   * Notion redirects here after user authorization.
   * Validates CSRF state → resolves userId → exchanges code → encrypts & stores token.
   * Then redirects browser to frontend callback page.
   */
  router.get(
    "/callback",
    asyncHandler(async (req, res) => {
      const frontendBase = env.appUrl || "http://localhost:3000";

      // Handle user cancellation
      const error = req.query.error as string | undefined;
      if (error) {
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent(error)}`
        );
      }

      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;

      // Validate state parameter exists
      if (!state) {
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("invalid_state")}`
        );
      }

      // Consume CSRF state (one-time use, validates TTL)
      const stateRecord = store.consumeNotionOAuthState(state);
      if (!stateRecord) {
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("invalid_state")}`
        );
      }

      // Resolve the originating user from the state
      const userId = stateRecord.userId;
      const user = store.findUserById(userId);
      if (!user) {
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("user_not_found")}`
        );
      }

      if (!code) {
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("no_code")}`
        );
      }

      // Exchange authorization code for access token
      try {
        const credentials = Buffer.from(
          `${env.notionClientId}:${env.notionClientSecret}`
        ).toString("base64");

        const tokenResponse = await fetch(NOTION_TOKEN_URL, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28"
          },
          body: JSON.stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: env.notionRedirectUri
          })
        });

        if (!tokenResponse.ok) {
          const errorBody = await tokenResponse.text();
          console.error(`[Notion OAuth] Token exchange failed (${tokenResponse.status}):`, errorBody);
          return res.redirect(
            `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("token_exchange_failed")}`
          );
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string;
          token_type: string;
          bot_id: string;
          workspace_id: string;
          workspace_name?: string;
          workspace_icon?: string;
          owner?: any;
          duplicated_template_id?: string;
          request_id?: string;
        };

        // Encrypt the access token before storage
        const encryptedToken = encryptToken(tokenData.access_token, env.jwtAccessSecret);

        // Store encrypted token for the resolved user ONLY
        store.updateUserNotionTokens(userId, {
          accessToken: encryptedToken,
          workspaceId: tokenData.workspace_id,
          workspaceName: tokenData.workspace_name,
          workspaceIcon: tokenData.workspace_icon,
          botId: tokenData.bot_id
        });

        console.log(
          `[Notion OAuth] Connected for user ${userId} | workspace: ${tokenData.workspace_name ?? tokenData.workspace_id}`
        );

        const successParams = new URLSearchParams({
          status: "success",
          workspace: tokenData.workspace_name || tokenData.workspace_id
        });

        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?${successParams.toString()}`
        );
      } catch (err) {
        console.error("[Notion OAuth] Token exchange error:", err instanceof Error ? err.message : err);
        return res.redirect(
          `${frontendBase}${FRONTEND_CALLBACK_PATH}?error=${encodeURIComponent("token_exchange_failed")}`
        );
      }
    })
  );

  /**
   * GET /api/auth/notion/status
   * Check Notion connection status for the authenticated user.
   */
  router.get(
    "/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const user = store.findUserById(req.user!.id);
      if (!user) {
        throw new HttpError(404, "User not found", "USER_NOT_FOUND");
      }

      const connected = Boolean(user.notionAccessToken);
      res.json({
        connected,
        workspaceId: connected ? user.notionWorkspaceId : undefined,
        workspaceName: connected ? user.notionWorkspaceName : undefined,
        workspaceIcon: connected ? user.notionWorkspaceIcon : undefined,
        connectedAt: connected ? user.notionConnectedAt : undefined
      });
    })
  );

  /**
   * DELETE /api/auth/notion/disconnect
   * Remove Notion tokens for the authenticated user.
   */
  router.delete(
    "/disconnect",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const userId = req.user!.id;
      store.clearUserNotionTokens(userId);
      console.log(`[Notion OAuth] Disconnected for user ${userId}`);
      res.json({ disconnected: true });
    })
  );

  /**
   * GET /api/auth/notion/activity
   * List Notion activity logs for the authenticated user.
   * Logs contain: operation, resourceId, timestamp, success, errorMessage.
   * No page content, database content, tokens, or PII.
   */
  router.get(
    "/activity",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const logs = store.listNotionActivityLogs(req.user!.id, limit);
      res.json({ logs });
    })
  );

  return router;
}
