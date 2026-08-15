import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema, passwordResetConfirmSchema, passwordResetRequestSchema, registerSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { signAccessToken, signRefreshToken, authenticate } from "../middleware/auth";
import { verifyFirebaseIdToken } from "../services/firebase-admin";
import type { AuthUser, AuthedRequest } from "../types";
import { z } from "zod";
import { encryptToken, generateOAuthState } from "../lib/notion-crypto";

/* ---------- Login attempt tracking for account lockout ---------- */
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttempt {
  count: number;
  firstAttempt: number;
  lockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

function trackFailedLogin(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing || now - existing.firstAttempt > LOGIN_LOCKOUT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return;
  }

  existing.count += 1;
  if (existing.count >= MAX_LOGIN_ATTEMPTS) {
    existing.lockedUntil = now + LOGIN_LOCKOUT_WINDOW_MS;
  }
  loginAttempts.set(key, existing);
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email.toLowerCase());
}

function isLoginLocked(email: string): boolean {
  const key = email.toLowerCase();
  const existing = loginAttempts.get(key);
  if (!existing?.lockedUntil) return false;
  if (Date.now() > existing.lockedUntil) {
    loginAttempts.delete(key);
    return false;
  }
  return true;
}

const firebaseSessionSchema = z.object({
  idToken: z.string().min(20),
  provider: z.string().optional(),
  displayName: z.string().optional(),
  photoURL: z.string().optional()
});

const authHandoffExchangeSchema = z.object({
  code: z.string().min(8).max(4096)
});

function toAuthUser(user: {
  id: string;
  firebaseUid?: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  plan: AuthUser["plan"];
}): AuthUser {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoUrl,
    plan: user.plan
  };
}

function tokenResponse(env: Env, user: AuthUser) {
  return {
    user,
    accessToken: signAccessToken(env, user),
    refreshToken: signRefreshToken(env, user)
  };
}

async function exchangeGoogleCode(env: Env, code: string) {
  const clientId = env.googleClientId?.trim();
  const clientSecret = env.googleClientSecret?.trim();
  const redirectUri = (env.googleCallbackUrl || `${env.appUrl}/api/auth/google/callback`).trim();

  if (!clientId || !clientSecret) {
    throw new HttpError(501, "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google sign-in.", "GOOGLE_OAUTH_NOT_CONFIGURED");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text().catch(() => "");
    console.error("[Google Token Exchange Failed]", tokenResponse.status, errorBody, "Using redirect_uri:", redirectUri);
    throw new HttpError(502, `Google sign-in could not be completed: ${errorBody}`, "GOOGLE_OAUTH_ERROR");
  }

  const tokens = (await tokenResponse.json()) as { 
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  
  if (!tokens.access_token) {
    throw new HttpError(502, "Google did not return an access token.", "GOOGLE_OAUTH_ERROR");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!profileResponse.ok) {
    throw new HttpError(502, "Google profile could not be loaded.", "GOOGLE_OAUTH_ERROR");
  }

  const profile = (await profileResponse.json()) as { sub?: string; email?: string; email_verified?: boolean };
  if (!profile.sub || !profile.email || profile.email_verified === false) {
    throw new HttpError(401, "Google account email is not verified.", "GOOGLE_EMAIL_NOT_VERIFIED");
  }

  return { 
    googleId: profile.sub, 
    email: profile.email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in
  };
}

export function authRouter(env: Env, store: MemoryStore) {
  const router = Router();

  router.post(
    "/firebase/session",
    asyncHandler(async (req, res) => {
      const input = firebaseSessionSchema.parse(req.body);
      const decoded = await verifyFirebaseIdToken(env, input.idToken);
      const email = decoded.email;
      if (!email || (decoded.email_verified === false && env.nodeEnv === "production")) {
        throw new HttpError(401, "Firebase account email is not verified.", "FIREBASE_EMAIL_NOT_VERIFIED");
      }

      const identityProvider = Object.keys(decoded.firebase?.identities ?? {})[0];
      const provider = input.provider ?? decoded.firebase?.sign_in_provider ?? identityProvider ?? "firebase";

      const user = store.upsertFirebaseUser({
        firebaseUid: decoded.uid,
        email,
        displayName: input.displayName ?? decoded.name,
        photoUrl: input.photoURL ?? decoded.picture,
        provider
      });

      res.json(tokenResponse(env, toAuthUser(user)));
    })
  );

  router.post(
    "/register",
    asyncHandler(async (req, res) => {
      const input = registerSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(input.password, 12);
      const user = store.createUser(input.email, passwordHash);
      res.status(201).json(tokenResponse(env, toAuthUser(user)));
    })
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      const input = loginSchema.parse(req.body);

      // Check lockout before any database lookup
      if (isLoginLocked(input.email)) {
        throw new HttpError(429, "Too many failed login attempts. Please try again later.", "ACCOUNT_LOCKED");
      }

      const user = store.findUserByEmail(input.email);
      if (!user?.passwordHash) {
        trackFailedLogin(input.email);
        throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        trackFailedLogin(input.email);
        throw new HttpError(401, "Invalid email or password", "INVALID_CREDENTIALS");
      }

      clearLoginAttempts(input.email);
      res.json(tokenResponse(env, toAuthUser(user)));
    })
  );

  router.get("/google", (req, res) => {
    if (!env.googleClientId || !env.googleClientSecret) {
      return res.status(501).json({
        error: {
          code: "GOOGLE_OAUTH_NOT_CONFIGURED",
          message: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google OAuth."
        }
      });
    }

    const state = req.query.state?.toString() ?? "login";
    // Request scopes for user identity only (email & profile)
    const scopes = [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];
    
    const clientId = env.googleClientId.trim();
    const redirectUri = (env.googleCallbackUrl || `${env.appUrl}/api/auth/google/callback`).trim();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      state
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  router.get(
    "/google/callback",
    asyncHandler(async (req, res) => {
      const redirect = new URL("/auth/login", env.appUrl);
      try {
        const code = req.query.code?.toString();
        if (!code) {
          throw new HttpError(400, "Google authorization code is missing.", "GOOGLE_OAUTH_ERROR");
        }

        const profile = await exchangeGoogleCode(env, code);
        const user = store.upsertGoogleUser(profile);
        const auth = tokenResponse(env, toAuthUser(user));
        // The callback must not put reusable credentials in the redirect. The
        // opaque handoff code is consumed exactly once by the web client.
        redirect.searchParams.set("handoff", store.createWebAuthHandoff(auth));
        redirect.searchParams.set("provider", "google");

        const isValidReturnPath = (pathStr: string): boolean => {
          if (!pathStr.startsWith("/") || pathStr.startsWith("//") || pathStr.includes("://")) {
            return false;
          }
          const allowedPaths = ["/", "/dashboard", "/assistants", "/settings", "/billing", "/auth"];
          return allowedPaths.some((p) => pathStr === p || pathStr.startsWith(`${p}/`) || pathStr.startsWith(`${p}?`));
        };

        const state = req.query.state?.toString();
        if (state && isValidReturnPath(state)) {
          redirect.searchParams.set("returnTo", state);
        } else {
          redirect.searchParams.set("returnTo", "/dashboard");
        }
        return res.redirect(redirect.toString());
      } catch (error) {
        console.error("[Google OAuth Callback Error]", error instanceof Error ? error.message : "Unknown error");
        redirect.searchParams.set("error", "google_oauth_error");
        return res.redirect(redirect.toString());
      }
    })
  );

  router.post(
    "/handoff/exchange",
    asyncHandler(async (req, res) => {
      const input = authHandoffExchangeSchema.parse(req.body);
      const handoff = store.consumeWebAuthHandoff(input.code);

      if (!handoff || !handoff.accessToken || !handoff.refreshToken) {
        console.error("[Handoff Exchange Failed] Invalid handoff payload or missing tokens");
        throw new HttpError(400, "Sign-in handoff is invalid or expired.", "INVALID_AUTH_HANDOFF");
      }
      res.json(handoff);
    })
  );

  router.post(
    "/password-reset/request",
    asyncHandler(async (req, res) => {
      const input = passwordResetRequestSchema.parse(req.body);
      store.createPasswordResetToken(input.email);

      // Always return the same message to prevent user enumeration
      res.json({
        ok: true,
        message: "If an account exists for this email, a password reset link has been sent."
      });
    })
  );

  router.post(
    "/password-reset/confirm",
    asyncHandler(async (req, res) => {
      const input = passwordResetConfirmSchema.parse(req.body);
      const user = store.consumePasswordResetToken(input.token);
      if (!user) {
        throw new HttpError(400, "Password reset token is invalid or expired", "INVALID_RESET_TOKEN");
      }
      const passwordHash = await bcrypt.hash(input.password, 12);
      const updated = store.updateUserPassword(user.id, passwordHash);
      if (!updated) {
        throw new HttpError(400, "Password reset token is invalid or expired", "INVALID_RESET_TOKEN");
      }
      res.json(tokenResponse(env, toAuthUser(updated)));
    })
  );

  router.post(
    "/refresh",
    asyncHandler(async (req, res) => {
      const refreshToken = req.body?.refreshToken;
      if (!refreshToken || typeof refreshToken !== "string") {
        throw new HttpError(400, "refreshToken is required", "VALIDATION_ERROR");
      }

      try {
        const payload = jwt.verify(refreshToken, env.jwtRefreshSecret, { algorithms: ["HS256"] }) as { sub: string; tokenGen?: number };
        const user = store.findUserById(payload.sub);
        if (!user) {
          throw new HttpError(401, "User no longer exists", "UNAUTHENTICATED");
        }

        // Reject refresh tokens issued before the last password change
        const userTokenGen = (user as unknown as Record<string, unknown>).tokenGeneration as number | undefined;
        if (typeof payload.tokenGen === "number" && typeof userTokenGen === "number" && payload.tokenGen < userTokenGen) {
          throw new HttpError(401, "Refresh token has been revoked due to a password change.", "TOKEN_REVOKED");
        }

        return res.json(tokenResponse(env, toAuthUser(user)));
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(401, "Invalid or expired refresh token", "UNAUTHENTICATED");
      }
    })
  );

  // Logout — client should clear tokens; server-side blocklisting requires Redis
  router.post(
    "/logout",
    authenticate(env, store),
    asyncHandler(async (req, res) => {
      // In a Redis-backed deployment, add the access token to a blocklist here:
      // await redis.setex(`blocklist:${token}`, env.jwtAccessTtl, '1');
      res.json({ ok: true, message: "Session invalidated. Clear tokens on the client." });
    })
  );

  router.get(
    "/notion/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const user = store.findUserById(req.user!.id);
      res.json({
        connected: Boolean(user?.notionAccessToken),
        workspaceId: user?.notionWorkspaceId,
        workspaceName: user?.notionWorkspaceName,
        workspaceIcon: user?.notionWorkspaceIcon,
        connectedAt: user?.notionConnectedAt
      });
    })
  );

  router.get(
    "/notion",
    (req, _res, next) => {
      const token = typeof req.query.token === "string" ? req.query.token : undefined;
      if (token && !req.header("Authorization")) req.headers.authorization = `Bearer ${token}`;
      next();
    },
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      if (!env.notionClientId) throw new HttpError(503, "Notion integration is not configured.", "NOTION_NOT_CONFIGURED");
      const state = generateOAuthState();
      store.createNotionOAuthState(state, req.user!.id);
      const authorize = new URL("https://api.notion.com/v1/oauth/authorize");
      authorize.searchParams.set("client_id", env.notionClientId);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("owner", "user");
      authorize.searchParams.set("redirect_uri", env.notionRedirectUri);
      authorize.searchParams.set("state", state);
      res.redirect(authorize.toString());
    })
  );

  router.get(
    "/notion/callback",
    asyncHandler(async (req, res) => {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const oauthState = store.consumeNotionOAuthState(state);
      const callback = new URL("/auth/notion/callback", env.appUrl);
      if (!oauthState || !code) {
        callback.searchParams.set("error", "invalid_state");
        return res.redirect(callback.toString());
      }
      if (!env.notionClientId || !env.notionClientSecret) {
        callback.searchParams.set("error", "not_configured");
        return res.redirect(callback.toString());
      }

      const basic = Buffer.from(`${env.notionClientId}:${env.notionClientSecret}`).toString("base64");
      const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: env.notionRedirectUri })
      });
      if (!tokenResponse.ok) {
        callback.searchParams.set("error", "token_exchange_failed");
        return res.redirect(callback.toString());
      }
      const token = await tokenResponse.json() as {
        access_token: string;
        workspace_id?: string;
        workspace_name?: string;
        workspace_icon?: string;
        bot_id?: string;
      };
      store.updateUserNotionTokens(oauthState.userId, {
        accessToken: encryptToken(token.access_token, env.jwtAccessSecret),
        workspaceId: token.workspace_id,
        workspaceName: token.workspace_name,
        workspaceIcon: token.workspace_icon,
        botId: token.bot_id
      });
      callback.searchParams.set("success", "true");
      if (token.workspace_name) callback.searchParams.set("workspace", token.workspace_name);
      return res.redirect(callback.toString());
    })
  );

  return router;
}
