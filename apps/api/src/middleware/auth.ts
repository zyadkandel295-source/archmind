import type { NextFunction, Response } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Env } from "../config/env";
import { HttpError } from "../lib/http-error";
import type { AuthedRequest, AuthUser } from "../types";
import type { MemoryStore } from "../db/memory";

interface JwtPayload {
  sub: string;
  email: string;
  plan: AuthUser["plan"];
  assistantId?: string;
}

export function signAccessToken(env: Env, user: AuthUser) {
  const options: SignOptions = { expiresIn: env.jwtAccessTtl as SignOptions["expiresIn"], algorithm: "HS256" };
  return jwt.sign({ sub: user.id, email: user.email, plan: user.plan }, env.jwtAccessSecret, {
    ...options
  });
}

export function signRefreshToken(env: Env, user: AuthUser) {
  const options: SignOptions = { expiresIn: env.jwtRefreshTtl as SignOptions["expiresIn"], algorithm: "HS256" };
  return jwt.sign({ sub: user.id, email: user.email, plan: user.plan }, env.jwtRefreshSecret, {
    ...options
  });
}

export function authenticate(env: Env, store: MemoryStore) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next(new HttpError(401, "Authorization header required", "UNAUTHORIZED"));
    }

    const matches = authHeader.match(/^Bearer\s+(.+)$/);
    if (!matches || !matches[1]) {
      return next(
        new HttpError(
          401,
          "Invalid authorization header format. Use: Authorization: Bearer <token>",
          "UNAUTHORIZED"
        )
      );
    }

    const token = matches[1];

    try {
      const payload = jwt.verify(token, env.jwtAccessSecret, { algorithms: ["HS256"] }) as JwtPayload;

      if (payload.assistantId) {
        const requestedId = req.params?.assistantId || req.query?.assistantId || req.body?.assistantId;
        if (requestedId && requestedId !== payload.assistantId) {
          return next(new HttpError(403, "Access denied: Scoped token mismatch", "FORBIDDEN"));
        }

        if (req.params?.id && req.path.includes("conversations")) {
          const conv = store.getConversation(req.params.id);
          if (conv && conv.assistantId !== payload.assistantId) {
            return next(new HttpError(403, "Access denied: Conversation scoped mismatch", "FORBIDDEN"));
          }
        }

        if (req.params?.id && req.path.includes("assistants")) {
          if (req.params.id !== payload.assistantId) {
            return next(new HttpError(403, "Access denied: Scoped assistant mismatch", "FORBIDDEN"));
          }
        }

        const fullPath = req.originalUrl || req.path;
        const isAllowedRoute =
          fullPath.includes("/chat") ||
          fullPath.includes("/conversations") ||
          (fullPath.includes("/assistants") && fullPath.includes(payload.assistantId)) ||
          (fullPath.includes("/devices") && fullPath.includes("/revoke"));

        if (!isAllowedRoute) {
          return next(new HttpError(403, "Access denied: Scoped token restricted route", "FORBIDDEN"));
        }
      }

      req.user = {
        id: payload.sub,
        email: payload.email,
        plan: payload.plan,
        assistantId: payload.assistantId
      };
      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return next(new HttpError(401, "Token expired. Use refresh endpoint to get new token.", "TOKEN_EXPIRED"));
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new HttpError(401, "Invalid token", "INVALID_TOKEN"));
      }
      return next(new HttpError(401, "Authentication failed", "UNAUTHENTICATED"));
    }
  };
}

export function optionalAuth(env: Env, store: MemoryStore) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header) return next();
    return authenticate(env, store)(req, res, next);
  };
}
