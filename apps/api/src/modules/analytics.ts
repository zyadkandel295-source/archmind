import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";

export function analyticsRouter(env: Env, store: MemoryStore) {
  const router = Router();
  router.use(authenticate(env, store));

  router.get(
    "/overview",
    asyncHandler(async (req: AuthedRequest, res) => {
      res.json({ overview: store.analyticsOverview(req.user!.id) });
    })
  );

  router.get(
    "/assistant/:id",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      assertFound(store.getAssistantForUser(assistantId, req.user!.id), "Assistant not found");
      res.json({ analytics: store.assistantAnalytics(assistantId) });
    })
  );

  return router;
}
