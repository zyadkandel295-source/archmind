import { Router, type Response } from "express";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate, optionalAuth } from "../middleware/auth";
import type { AuthedRequest } from "../types";
import { isPlatformAdmin } from "./admin";

function authorizeAdminAccess(env: Env) {
  return (req: AuthedRequest, _res: import("express").Response, next: import("express").NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "Authentication required for private analytics.", "UNAUTHORIZED"));
    }
    const email = req.user.email;
    const plan = req.user.plan;
    if (!isPlatformAdmin(email, plan, env.demoAuth)) {
      return next(new HttpError(403, "Administrator access required.", "ADMIN_ACCESS_REQUIRED"));
    }
    return next();
  };
}

export function analyticsRouter(env: Env, store: MemoryStore) {
  const router = Router();

  // ---------------------------------------------------------------------------
  // PUBLIC TRACKING ENDPOINTS (Non-blocking tracking for site visitors)
  // ---------------------------------------------------------------------------

  const handleTrack = asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body || {};

    const visitorId = typeof body.visitorId === "string" ? body.visitorId : undefined;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
    const type = typeof body.type === "string" ? body.type : "page_view";
    const path = typeof body.path === "string" ? body.path : typeof body.pathname === "string" ? body.pathname : "/";
    const title = typeof body.title === "string" ? body.title : undefined;
    const referrer = typeof body.referrer === "string" ? body.referrer : undefined;
    const userAgent = req.headers["user-agent"] as string | undefined;
    const userId = req.user?.id || body.userId;

    if (type === "heartbeat") {
      if (visitorId && sessionId) {
        store.analyticsEngine.trackHeartbeat({
          visitorId,
          sessionId,
          engagementTime: Number(body.engagementTime || 15)
        });
      }
      return res.json({ recorded: true });
    }

    if (type === "event" || body.eventName) {
      const eventName = body.eventName || type;
      const event = store.analyticsEngine.trackEvent({
        visitorId,
        sessionId,
        userId,
        eventName,
        pathname: path,
        properties: typeof body.properties === "object" ? body.properties : body.metadata || {},
        userAgent
      });
      return res.status(201).json({ recorded: true, eventId: event.id });
    }

    // Default: Page View
    const result = store.analyticsEngine.trackPageView({
      visitorId,
      sessionId,
      userId,
      pathname: path,
      title,
      referrer,
      userAgent,
      headers: req.headers as Record<string, string | string[] | undefined>,
      utmSource: typeof body.utmSource === "string" ? body.utmSource : undefined,
      utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : undefined,
      utmCampaign: typeof body.utmCampaign === "string" ? body.utmCampaign : undefined,
      utmTerm: typeof body.utmTerm === "string" ? body.utmTerm : undefined,
      utmContent: typeof body.utmContent === "string" ? body.utmContent : undefined
    });

    return res.status(201).json({ recorded: true, ...result });
  });

  // Dual route aliases for tracking
  router.post("/track", optionalAuth(env, store), handleTrack);
  router.post("/site-activity", optionalAuth(env, store), handleTrack);

  router.post(
    "/heartbeat",
    asyncHandler(async (req, res) => {
      const { visitorId, sessionId, engagementTime } = req.body || {};
      if (visitorId && sessionId) {
        store.analyticsEngine.trackHeartbeat({
          visitorId,
          sessionId,
          engagementTime: Number(engagementTime || 15)
        });
      }
      res.json({ recorded: true });
    })
  );

  // ---------------------------------------------------------------------------
  // USER OVERVIEW ENDPOINT (Available to ALL authenticated users for their dashboard)
  // ---------------------------------------------------------------------------
  router.get(
    "/overview",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const userOverview = store.analyticsOverview(req.user!.id);
      const email = req.user?.email;
      const plan = req.user?.plan;

      // If user is admin (zyadkandel295@gmail.com), also include site-wide analytics
      if (isPlatformAdmin(email, plan, env.demoAuth)) {
        const range = (req.query.range as any) || "30d";
        const startDate = req.query.startDate as string | undefined;
        const endDate = req.query.endDate as string | undefined;
        const siteData = store.analyticsEngine.getOverview({ range, startDate, endDate });
        return res.json({ ...siteData, overview: userOverview });
      }

      // For standard users, return their personal dashboard metrics cleanly
      return res.json({ overview: userOverview });
    })
  );

  // ---------------------------------------------------------------------------
  // PRIVATE ADMIN DASHBOARD ANALYTICS ENDPOINTS (Restricted to zyadkandel295@gmail.com)
  // ---------------------------------------------------------------------------
  const adminAuth = [authenticate(env, store), authorizeAdminAccess(env)];

  router.get(
    "/admin/overview",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const data = store.analyticsEngine.getOverview({ range, startDate, endDate });
      res.json({ ...data, overview: store.analyticsOverview(req.user!.id) });
    })
  );

  router.get(
    "/pages",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const data = store.analyticsEngine.getPagesAnalytics({ range, startDate, endDate });
      res.json(data);
    })
  );

  router.get(
    "/sources",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const data = store.analyticsEngine.getTrafficSources({ range });
      res.json(data);
    })
  );

  router.get(
    "/events",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const data = store.analyticsEngine.getEventsAnalytics({ range });
      res.json(data);
    })
  );

  router.get(
    "/devices",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const data = store.analyticsEngine.getDevicesAnalytics({ range });
      res.json(data);
    })
  );

  router.get(
    "/geo",
    adminAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const range = (req.query.range as any) || "30d";
      const data = store.analyticsEngine.getGeoAnalytics({ range });
      res.json(data);
    })
  );

  router.get(
    "/live",
    adminAuth,
    asyncHandler(async (_req: AuthedRequest, res) => {
      const data = store.analyticsEngine.getLiveActivity();
      res.json(data);
    })
  );

  // ---------------------------------------------------------------------------
  // GUARDED LOAD TEST CONTROL PLANE
  // ---------------------------------------------------------------------------
  // The runner emits tagged telemetry and only permits localhost or an
  // explicitly configured test origin. It never creates customer accounts or
  // mutates assistants, files, billing, or external systems.
  const loadTestSchema = z.object({
    targetUrl: z.string().url(),
    stages: z.array(z.number().int().min(1).max(2000)).min(1).max(20).optional(),
    maxFailureRate: z.number().min(1).max(100).optional(),
    maxP95Ms: z.number().min(100).max(120000).optional(),
    requestTimeoutMs: z.number().min(100).max(120000).optional(),
    thinkTimeMinMs: z.number().min(0).max(10000).optional(),
    thinkTimeMaxMs: z.number().min(0).max(10000).optional(),
    maxInFlightRequests: z.number().int().min(1).max(1000).optional()
  });

  router.get("/load-tests", adminAuth, (_req: AuthedRequest, res: Response) => {
    res.json({ runs: store.loadTestService.list(), maxVirtualUsers: 2000 });
  });

  router.post("/load-tests", adminAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
    const input = loadTestSchema.parse(req.body);
    try {
      const run = store.loadTestService.start(input, { appUrl: env.appUrl, nodeEnv: env.nodeEnv, createdByUserId: req.user!.id });
      res.status(202).json({ run });
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "Load test configuration is invalid.", "LOAD_TEST_CONFIGURATION_INVALID");
    }
  }));

  router.get("/load-tests/:id", adminAuth, (req: AuthedRequest, res: Response) => {
    const run = store.loadTestService.get(req.params.id!);
    if (!run) throw new HttpError(404, "Load test not found.", "LOAD_TEST_NOT_FOUND");
    res.json({ run, report: store.loadTestService.report(run.id) });
  });

  router.post("/load-tests/:id/stop", adminAuth, (req: AuthedRequest, res: Response) => {
    const run = store.loadTestService.stop(req.params.id!);
    if (!run) throw new HttpError(404, "Load test not found.", "LOAD_TEST_NOT_FOUND");
    res.json({ run });
  });

  router.delete("/load-tests/:id", adminAuth, asyncHandler(async (req: AuthedRequest, res: Response) => {
    try {
      await store.loadTestService.cleanup(req.params.id!);
      res.status(204).end();
    } catch (error) {
      throw new HttpError(409, error instanceof Error ? error.message : "Load-test cleanup failed.", "LOAD_TEST_CLEANUP_FAILED");
    }
  }));

  // Per-assistant analytics endpoint
  router.get(
    "/assistant/:id",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      assertFound(store.getAssistantForUser(assistantId, req.user!.id), "Assistant not found");
      res.json({ analytics: store.assistantAnalytics(assistantId) });
    })
  );

  return router;
}
