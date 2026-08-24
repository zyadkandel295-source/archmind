process.noDeprecation = true;

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { API_ROUTES } from "@archmind/shared";
import type { Env } from "./config/env";
import { loadEnv } from "./config/env";
import { MemoryStore } from "./db/memory";
import type { PlatformStateStore } from "./db/platform-store";
import { PostgresPlatformStore } from "./db/postgres-platform";
import { createRateLimiter } from "./middleware/rate-limit";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { HttpError } from "./lib/http-error";
import { authRouter } from "./modules/auth";
import { assistantsRouter } from "./modules/assistants";
import { sourcesRouter } from "./modules/sources";
import { chatRouter } from "./modules/chat";
import { analyticsRouter } from "./modules/analytics";
import { billingRouter } from "./modules/billing";
import { adminRouter } from "./modules/admin";
import { profileRouter } from "./modules/profile";
import { platformRouter } from "./modules/platform";
import { assistantsV2Router } from "./modules/assistants-v2";
import { chatsV2Router } from "./modules/chats-v2";
import { aiBaseRouter } from "./modules/ai-base";
import { AI_PROVIDERS_UNAVAILABLE_MESSAGE } from "./services/ai-service";
import { generateAiResponse } from "./services/ai-service";
import { aiChatRequestSchema } from "@archmind/shared";

export interface AppOptions {
  env?: Env;
  store?: MemoryStore;
  platformStore?: PlatformStateStore;
}

function corsOrigins(env: Env): string[] {
  const configured = env.corsOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Never permit a credentialed wildcard CORS policy in production. If a
  // wildcard was configured accidentally, fall back to the known web origin.
  if (configured.includes("*") && env.nodeEnv === "production") return [env.appUrl];
  return configured.length > 0 ? configured : [env.appUrl];
}

function createPlatformStore(env: Env, fallback: MemoryStore): PlatformStateStore {
  if (env.nodeEnv === "test") return fallback;
  if (env.nodeEnv === "production" && (!env.databaseUrl || env.platformStore === "memory")) {
    throw new Error("Production requires DATABASE_URL with the PostgreSQL platform store enabled.");
  }
  if (env.databaseUrl && env.platformStore !== "memory") {
    try {
      return new PostgresPlatformStore(env.databaseUrl, { runMigrations: Boolean(env.runMigrations), memoryStore: fallback });
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function createApp(options: AppOptions = {}) {
  const env = options.env ?? loadEnv();
  const store = options.store ?? new MemoryStore({
    databaseSync: env.nodeEnv !== "test",
    diskPersistence: env.nodeEnv !== "test"
  });
  const platformStore = options.platformStore ?? createPlatformStore(env, store);
  const allowedCorsOrigins = corsOrigins(env);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: "cross-origin"
      },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "https://cdn.jsdelivr.net"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com"
          ],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: [
            "'self'",
            env.corsOrigin,
            "https://www.googleapis.com",
            "https://notion.com",
            "https://api.stripe.com"
          ],
          objectSrc: ["'none'"],
          frameSrc: ["'self'"],
          mediaSrc: ["'self'"],
          childSrc: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: env.nodeEnv === "production" ? [] : null
        }
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedCorsOrigins.includes("*") || allowedCorsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new HttpError(403, "This origin is not allowed to access the API.", "CORS_ORIGIN_DENIED"));
        }
      },
      credentials: true
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createRateLimiter(env));

  if (env.nodeEnv !== "test") {
    app.use(morgan("tiny"));
  }

  app.get(["/", "/api"], (_req, res) => {
    res.json({ ok: true, service: "agentia-api", message: "AGENTIA API Backend is live", uptime: Math.floor(process.uptime()) });
  });

  app.get("/api/health", (_req, res) => {
    const base = {
      ok: true,
      service: "agentia-api",
      uptime: Math.floor(process.uptime()),
      assistantReady: Boolean(env.openrouterApiKey)
    };

    // Only expose dependency status in non-production environments
    if (env.nodeEnv !== "production") {
      return res.json({
        ...base,
        mode: env.nodeEnv,
        demoAuth: env.demoAuth,
        routes: API_ROUTES.length,
        dependencies: {
          postgres: Boolean(env.databaseUrl),
          redis: Boolean(env.redisUrl),
          assistantService: Boolean(env.openrouterApiKey),
          firebaseAdmin: Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey),
          stripe: Boolean(env.stripeSecretKey),
          s3: Boolean(env.s3Bucket && env.s3Region)
        }
      });
    }

    res.json(base);
  });

  app.use("/api", analyticsRouter(env, store));

  // Authenticated chat endpoint. Service credentials always remain server-side.
  app.post("/api/ai/chat", (req, res, next) => {
    if (!env.openrouterApiKey || env.llmProvider !== "openrouter") {
      return res.status(503).json({ success: false, errorCode: "ASSISTANT_UNAVAILABLE", message: AI_PROVIDERS_UNAVAILABLE_MESSAGE });
    }
    return authenticate(env, store)(req, res, next);
  }, async (req, res, next) => {
    try {
      const input = aiChatRequestSchema.parse(req.body);
      const answer = await generateAiResponse({
        env,
        messages: input.messages,
        temperature: input.temperature,
        assistantConfig: input.model ? { model: input.model } : undefined
      });
      return res.status(200).json({ success: true, answer });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/auth", authRouter(env, store));
  app.use("/api/assistants", assistantsV2Router(env, store));
  app.use("/api/v1/assistants", assistantsRouter(env, store));

  app.use("/api", sourcesRouter(env, store));
  app.use("/api", chatsV2Router(env, store));
  app.use("/api", chatRouter(env, store));
  app.use("/api/analytics", analyticsRouter(env, store));
  app.use("/api/billing", billingRouter(env, store));
  app.use("/api/admin", adminRouter(env, store));
  app.use("/api/profile", profileRouter(env, store));
  app.use("/api/ai-base", aiBaseRouter());
  app.use("/api/platform", platformRouter(env, store, platformStore));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, env, store };
}

