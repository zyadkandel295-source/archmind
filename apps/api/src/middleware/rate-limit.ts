import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import Redis from "ioredis";
import type { Env } from "../config/env";

let sharedRedisClient: Redis | undefined;

function getRedisClient(env?: Env): Redis | undefined {
  if (sharedRedisClient) return sharedRedisClient;
  const redisUrl = env?.redisUrl ?? process.env.REDIS_URL;
  if (!redisUrl) return undefined;
  try {
    sharedRedisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false
    });
    sharedRedisClient.on("error", (err) => {
      // Suppress connection errors in development mode
      if (env?.nodeEnv === "production") {
        console.warn("⚠️  Redis rate limiter connection error:", err.message);
      }
    });
    return sharedRedisClient;
  } catch {
    return undefined;
  }
}

function createStore(env?: Env, prefix = "global") {
  const client = getRedisClient(env);
  if (!client) return undefined;
  try {
    return new RedisStore({
      sendCommand: async (...args: string[]) => {
        if (client.status !== "ready") {
          const cmd = args[0]?.toUpperCase();
          if (cmd === "SCRIPT") {
            return "0000000000000000000000000000000000000000";
          }
          if (cmd === "EVALSHA" || cmd === "EVAL") {
            return [1, 60000];
          }
          return 0;
        }
        // Allow NOSCRIPT errors to propagate so rate-limit-redis can auto-reload scripts
        return (client.call as any)(...args);
      },
      prefix: `archmind:rl:${prefix}:`
    });
  } catch {
    return undefined;
  }
}

export function createRateLimiter(env: Env) {
  const store = createStore(env, "global");
  return rateLimit({
    windowMs: 60 * 1000,
    limit: env.nodeEnv === "production" ? 120 : 1000,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: store ?? undefined,
    passOnStoreError: true,
    keyGenerator: (req) => req.ip ?? "unknown",
    message: {
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please retry shortly."
      }
    }
  });
}

/** Strict rate limiter for authentication endpoints (login). */
export function createAuthRateLimiter(env?: Env) {
  const store = createStore(env, "auth");
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: store ?? undefined,
    passOnStoreError: true,
    keyGenerator: (req) => req.ip ?? "unknown",
    message: {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Too many authentication attempts. Please wait a minute."
      }
    }
  });
}

/** Strict rate limiter for registration. */
export function createRegistrationRateLimiter(env?: Env) {
  const store = createStore(env, "register");
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: store ?? undefined,
    passOnStoreError: true,
    keyGenerator: (req) => req.ip ?? "unknown",
    message: {
      error: {
        code: "REGISTRATION_RATE_LIMITED",
        message: "Too many registration attempts. Please wait."
      }
    }
  });
}

/** Strict rate limiter for unauthenticated desktop endpoints. */
export function createDesktopClaimRateLimiter(env?: Env) {
  const store = createStore(env, "desktop");
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    store: store ?? undefined,
    passOnStoreError: true,
    keyGenerator: (req) => req.ip ?? "unknown",
    message: {
      error: {
        code: "DESKTOP_RATE_LIMITED",
        message: "Too many desktop claim attempts. Please wait."
      }
    }
  });
}
