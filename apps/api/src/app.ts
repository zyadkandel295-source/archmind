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
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { authRouter } from "./modules/auth";
import { assistantsRouter } from "./modules/assistants";
import { sourcesRouter } from "./modules/sources";
import { chatRouter } from "./modules/chat";
import { analyticsRouter } from "./modules/analytics";
import { billingRouter } from "./modules/billing";
import { adminRouter } from "./modules/admin";
import { profileRouter } from "./modules/profile";
import { executionBridgeRouter } from "./modules/execution-bridge";
import { notionAuthRouter } from "./modules/notion-auth";
import { notionRouter } from "./modules/notion";
import { platformRouter } from "./modules/platform";

export interface AppOptions {
  env?: Env;
  store?: MemoryStore;
  platformStore?: PlatformStateStore;
}

function createPlatformStore(env: Env, fallback: MemoryStore): PlatformStateStore {
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
  const store = options.store ?? new MemoryStore();
  const platformStore = options.platformStore ?? createPlatformStore(env, store);
  const app = express();

  app.disable("x-powered-by");
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
            "https://api.openrouter.ai",
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
      origin: env.corsOrigin,
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

  app.get("/api/health", (_req, res) => {
    const base = { ok: true, service: "archmind-api", uptime: Math.floor(process.uptime()) };

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
          llmProvider: env.llmProvider,
          llm: Boolean(env.openRouterApiKey),
          firebaseAdmin: Boolean(env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey),
          stripe: Boolean(env.stripeSecretKey),
          s3: Boolean(env.s3Bucket && env.s3Region)
        }
      });
    }

    res.json(base);
  });

  // Handle site activity tracking events from the frontend
  app.post("/api/site-activity", (req, res) => {
    // Activity tracking could be wired to a DB or analytics service here
    res.status(201).json({ recorded: true });
  });

  app.use("/api/auth", authRouter(env, store));
  app.use("/api/auth/notion", notionAuthRouter(env, store));
  app.use("/api/notion", notionRouter(env, store));
  app.use("/api/assistants", assistantsRouter(env, store));
  app.use("/api/assistants", executionBridgeRouter(env, store));

  app.use("/api", sourcesRouter(env, store));
  app.use("/api", chatRouter(env, store));
  app.use("/api/analytics", analyticsRouter(env, store));
  app.use("/api", profileRouter(env, store));
  app.use("/api", billingRouter(env, store));
  app.use("/api/admin", adminRouter(env, store));
  app.use("/api/platform", platformRouter(env, store, platformStore));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, env, store };
}
