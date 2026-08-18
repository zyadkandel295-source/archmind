import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate, optionalAuth } from "../middleware/auth";
import type { AuthedRequest } from "../types";

function authorizeAdminAccess(env: Env) {
  return (req: AuthedRequest, _res: import("express").Response, next: import("express").NextFunction) => {
    if (!req.user) {
      return next(new HttpError(401, "Authentication required for private analytics.", "UNAUTHORIZED"));
    }
    const email = req.user.email?.toLowerCase() || "";
    const plan = req.user.plan;
    const isAllowed =
      Boolean(env.demoAuth) ||
      plan === "enterprise" ||
      plan === "pro" ||
      email.endsWith("@archmind.ai") ||
      email.endsWith("@archmind.dev") ||
      email.includes("admin");

    if (!isAllowed) {
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
  // PRIVATE ADMIN DASHBOARD ANALYTICS ENDPOINTS (Authenticated & Authorized)
  // ---------------------------------------------------------------------------
  const adminAuth = [authenticate(env, store), authorizeAdminAccess(env)];

  router.get(
    "/overview",
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
