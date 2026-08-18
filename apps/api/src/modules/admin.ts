import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";

const ADMIN_EMAILS = [
  "zyadkandel295@gmail.com",
  "zyad.2524033@stemelsadat.moe.edu.eg",
  "demo@archmind.dev",
  "demo@archmind.ai"
];

export function isPlatformAdmin(email?: string, plan?: string, demoAuth?: boolean): boolean {
  if (demoAuth) return true;
  const clean = (email || "").toLowerCase().trim();
  if (ADMIN_EMAILS.includes(clean)) return true;
  if (clean.endsWith("@archmind.ai") || clean.endsWith("@archmind.dev")) return true;
  if (plan === "enterprise" || plan === "admin" || plan === "pro") return true;
  return false;
}

/** Restrict route to admin-level users (zyadkandel295@gmail.com or enterprise). */
function authorizeAdmin(env: Env) {
  return (req: AuthedRequest, _res: import("express").Response, next: import("express").NextFunction) => {
    const email = req.user?.email;
    const plan = req.user?.plan;
    if (!isPlatformAdmin(email, plan, env.demoAuth)) {
      return next(new HttpError(403, "Administrator access required.", "ADMIN_ACCESS_REQUIRED"));
    }
    return next();
  };
}

export function adminRouter(env: Env, store: MemoryStore) {
  const router = Router();
  router.use(authenticate(env, store));
  router.use(authorizeAdmin(env));

  router.get(
    "/overview",
    asyncHandler(async (req: AuthedRequest, res) => {
      const overview = store.analyticsOverview(req.user!.id);
      res.json({
        overview,
        services: {
          postgres: Boolean(env.databaseUrl),
          redis: Boolean(env.redisUrl),
          llmProvider: env.llmProvider,
          llm: false,
          openrouter: false,
          stripe: Boolean(env.stripeSecretKey),
          s3: Boolean(env.s3Bucket)
        }
      });
    })
  );

  return router;
}
