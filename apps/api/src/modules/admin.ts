import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";

/** Restrict route to admin-level users (enterprise plan). */
function authorizeAdmin(req: AuthedRequest, _res: import("express").Response, next: import("express").NextFunction) {
  const plan = req.user?.plan;
  if (plan !== "enterprise") {
    return next(new HttpError(403, "Administrator access required.", "ADMIN_ACCESS_REQUIRED"));
  }
  return next();
}

export function adminRouter(env: Env, store: MemoryStore) {
  const router = Router();
  router.use(authenticate(env, store));
  router.use(authorizeAdmin);

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
          llm: Boolean(env.openRouterApiKey),
          openRouter: Boolean(env.openRouterApiKey),
          stripe: Boolean(env.stripeSecretKey),
          s3: Boolean(env.s3Bucket)
        }
      });
    })
  );

  return router;
}
