import { randomUUID } from "crypto";
import type { Pool } from "pg";
import {
  type AnalyticsVisitor,
  type AnalyticsSession,
  type AnalyticsPageView,
  type AnalyticsEvent,
  isBotUserAgent,
  parseUserAgent,
  parseGeoCountry,
  sanitizePathname,
  sanitizeProperties,
  classifyTrafficSource
} from "./analytics-service";

export interface AnalyticsQueryOptions {
  range?: "today" | "7d" | "30d" | "90d" | "all" | "custom";
  startDate?: string;
  endDate?: string;
  /** Customer dashboards exclude synthetic load-test data by default. */
  testData?: "exclude" | "only" | "include";
  testRunId?: string;
}

export interface AnalyticsTestMetadata {
  isTestUser: true;
  testRunId: string;
  persona: string;
  scenario: string;
}

export class RealAnalyticsEngine {
  private visitors = new Map<string, AnalyticsVisitor>();
  private sessions = new Map<string, AnalyticsSession>();
  private pageViews = new Map<string, AnalyticsPageView>();
  private events = new Map<string, AnalyticsEvent>();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  public setPool(pool?: Pool) {
    this.pool = pool;
  }

  /** Removes only tagged synthetic records for a completed test run. */
  public removeTestRun(testRunId: string) {
    for (const [id, record] of this.events) if (record.isTestUser && record.testRunId === testRunId) this.events.delete(id);
    for (const [id, record] of this.pageViews) if (record.isTestUser && record.testRunId === testRunId) this.pageViews.delete(id);
    for (const [id, record] of this.sessions) if (record.isTestUser && record.testRunId === testRunId) this.sessions.delete(id);
    for (const [id, record] of this.visitors) if (record.isTestUser && record.testRunId === testRunId) this.visitors.delete(id);
  }

  private includesRecord(record: { isBot: boolean; isTestUser?: boolean; testRunId?: string }, options: AnalyticsQueryOptions = {}) {
    if (record.isBot) return false;
    if (options.testData === "include") return true;
    if (options.testData === "only") return Boolean(record.isTestUser) && (!options.testRunId || record.testRunId === options.testRunId);
    return !record.isTestUser;
  }

  // ---------------------------------------------------------------------------
  // Date Utilities & Filters
  // ---------------------------------------------------------------------------
  private getDateBounds(options: AnalyticsQueryOptions = {}): { start: Date; end: Date; priorStart: Date; priorEnd: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = now;

    const range = options.range || "30d";

    if (range === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    } else if (range === "7d") {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === "30d") {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (range === "90d") {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (range === "all") {
      start = new Date(0); // 1970
    } else if (range === "custom" && options.startDate) {
      start = new Date(options.startDate);
      if (options.endDate) end = new Date(options.endDate);
    } else {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const durationMs = Math.max(1000, end.getTime() - start.getTime());
    const priorStart = new Date(start.getTime() - durationMs);
    const priorEnd = new Date(start.getTime());

    return { start, end, priorStart, priorEnd };
  }

  // ---------------------------------------------------------------------------
  // Real-Time Visitor & Session Tracker
  // ---------------------------------------------------------------------------
  public trackPageView(params: {
    visitorId?: string;
    sessionId?: string;
    userId?: string;
    pathname: string;
    title?: string;
    referrer?: string;
    userAgent?: string;
    headers?: Record<string, string | string[] | undefined>;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    test?: AnalyticsTestMetadata;
  }) {
    const nowIso = new Date().toISOString();
    const isBot = isBotUserAgent(params.userAgent) && !params.test?.isTestUser;
    const { deviceCategory, browser, os } = parseUserAgent(params.userAgent);
    const { country, region } = parseGeoCountry(params.headers || {});
    const cleanPathname = sanitizePathname(params.pathname);
    const { source: trafficSource, domain: referrerDomain } = classifyTrafficSource(params.referrer, params.utmSource);

    // 1. Visitor Management
    let visitorId = params.visitorId;
    if (!visitorId || visitorId.trim() === "") {
      visitorId = `vis_${randomUUID()}`;
    }

    let visitor = this.visitors.get(visitorId);
    let isNewVisitor = false;

    if (!visitor) {
      isNewVisitor = true;
      visitor = {
        id: randomUUID(),
        visitorId,
        firstUserId: params.userId,
        latestUserId: params.userId,
        firstSeen: nowIso,
        lastSeen: nowIso,
        totalVisits: 1,
        totalPageviews: 1,
        isBot,
        isTestUser: params.test?.isTestUser,
        testRunId: params.test?.testRunId,
        testPersona: params.test?.persona,
        testScenario: params.test?.scenario,
        browser,
        os,
        deviceCategory,
        country,
        region,
        firstReferrer: params.referrer,
        firstUtmSource: params.utmSource,
        firstUtmMedium: params.utmMedium,
        firstUtmCampaign: params.utmCampaign,
        createdAt: nowIso,
        updatedAt: nowIso
      };
    } else {
      visitor.lastSeen = nowIso;
      visitor.totalPageviews += 1;
      if (params.userId) visitor.latestUserId = params.userId;
      visitor.updatedAt = nowIso;
    }
    this.visitors.set(visitorId, visitor);

    // 2. Session Management (30 minute inactivity window)
    let sessionId = params.sessionId;
    let session: AnalyticsSession | undefined;
    const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

    if (sessionId) {
      session = this.sessions.get(sessionId);
      if (session) {
        const lastActTime = new Date(session.lastActivity).getTime();
        if (Date.now() - lastActTime > SESSION_INACTIVITY_MS) {
          // Session expired -> Start new session
          sessionId = undefined;
          session = undefined;
        }
      }
    }

    if (!sessionId || !session) {
      sessionId = `ses_${randomUUID()}`;
      if (!isNewVisitor) {
        visitor.totalVisits += 1;
      }
      session = {
        id: randomUUID(),
        sessionId,
        visitorId,
        userId: params.userId,
        startedAt: nowIso,
        lastActivity: nowIso,
        entryPage: cleanPathname,
        exitPage: cleanPathname,
        pageViewCount: 1,
        eventCount: 0,
        engagementDuration: 0,
        isEngaged: false,
        referrer: params.referrer,
        referrerDomain,
        trafficSource,
        utmSource: params.utmSource,
        utmMedium: params.utmMedium,
        utmCampaign: params.utmCampaign,
        utmTerm: params.utmTerm,
        utmContent: params.utmContent,
        browser,
        os,
        deviceCategory,
        country,
        region,
        isBot,
        isTestUser: params.test?.isTestUser,
        testRunId: params.test?.testRunId,
        testPersona: params.test?.persona,
        testScenario: params.test?.scenario,
        createdAt: nowIso
      };
    } else {
      session.lastActivity = nowIso;
      session.exitPage = cleanPathname;
      session.pageViewCount += 1;
      if (session.pageViewCount > 1 || session.engagementDuration >= 10) {
        session.isEngaged = true;
      }
      if (params.userId) session.userId = params.userId;
    }
    this.sessions.set(sessionId, session);

    // 3. PageView Record
    const pageView: AnalyticsPageView = {
      id: randomUUID(),
      visitorId,
      sessionId,
      userId: params.userId,
      pathname: cleanPathname,
      title: params.title || cleanPathname,
      referrer: params.referrer,
      engagementTime: 0,
      isEntry: session.pageViewCount === 1,
      isExit: true,
      isBounce: false,
      deviceCategory,
      browser,
      os,
      country,
      isBot,
      isTestUser: params.test?.isTestUser,
      testRunId: params.test?.testRunId,
      testPersona: params.test?.persona,
      testScenario: params.test?.scenario,
      createdAt: nowIso
    };
    this.pageViews.set(pageView.id, pageView);

    // Asynchronously write to Postgres if pool exists
    if (this.pool && !isBot) {
      this.syncPageViewToPg(visitor, session, pageView).catch(() => undefined);
    }

    return { visitorId, sessionId, pageViewId: pageView.id };
  }

  public trackHeartbeat(params: { visitorId: string; sessionId: string; engagementTime?: number }) {
    const nowIso = new Date().toISOString();

    const visitor = this.visitors.get(params.visitorId);
    if (visitor) {
      visitor.lastSeen = nowIso;
      visitor.updatedAt = nowIso;
    }

    const session = this.sessions.get(params.sessionId);
    if (session) {
      session.lastActivity = nowIso;
      const addSeconds = Math.min(60, Math.max(1, params.engagementTime || 15));
      session.engagementDuration += addSeconds;
      if (session.engagementDuration >= 10 || session.pageViewCount > 1) {
        session.isEngaged = true;
      }
    }
  }

  public trackEvent(params: {
    visitorId?: string;
    sessionId?: string;
    userId?: string;
    eventName: string;
    pathname: string;
    properties?: Record<string, unknown>;
    userAgent?: string;
    test?: AnalyticsTestMetadata;
  }) {
    const nowIso = new Date().toISOString();
    const isBot = isBotUserAgent(params.userAgent) && !params.test?.isTestUser;
    const cleanPath = sanitizePathname(params.pathname);
    const sanitizedProps = sanitizeProperties(params.properties);

    const visitorId = params.visitorId || `vis_${randomUUID()}`;
    const sessionId = params.sessionId || `ses_${randomUUID()}`;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.eventCount += 1;
      session.lastActivity = nowIso;
    }

    const event: AnalyticsEvent = {
      id: randomUUID(),
      eventName: params.eventName,
      visitorId,
      sessionId,
      userId: params.userId,
      pathname: cleanPath,
      properties: sanitizedProps,
      isBot,
      isTestUser: params.test?.isTestUser,
      testRunId: params.test?.testRunId,
      testPersona: params.test?.persona,
      testScenario: params.test?.scenario,
      createdAt: nowIso
    };
    this.events.set(event.id, event);

    if (this.pool && !isBot) {
      this.syncEventToPg(event).catch(() => undefined);
    }

    return event;
  }

  // ---------------------------------------------------------------------------
  // Postgres Sync Helpers
  // ---------------------------------------------------------------------------
  /** Hydrates the in-process index after a serverless cold start. */
  public async hydrateFromPg() {
    if (!this.pool) return;
    const [visitors, sessions, pageViews, events] = await Promise.all([
      this.pool.query("SELECT * FROM analytics_visitors"),
      this.pool.query("SELECT * FROM analytics_sessions"),
      this.pool.query("SELECT * FROM analytics_pageviews"),
      this.pool.query("SELECT * FROM analytics_events")
    ]);
    const iso = (value: unknown) => new Date(value as string | number | Date).toISOString();
    for (const row of visitors.rows as Record<string, unknown>[]) {
      const value: AnalyticsVisitor = { id: String(row.id), visitorId: String(row.visitor_id), firstUserId: row.first_user_id ? String(row.first_user_id) : undefined, latestUserId: row.latest_user_id ? String(row.latest_user_id) : undefined, firstSeen: iso(row.first_seen), lastSeen: iso(row.last_seen), totalVisits: Number(row.total_visits || 0), totalPageviews: Number(row.total_pageviews || 0), isBot: Boolean(row.is_bot), isTestUser: Boolean(row.is_test_user), testRunId: row.test_run_id ? String(row.test_run_id) : undefined, testPersona: row.test_persona ? String(row.test_persona) : undefined, testScenario: row.test_scenario ? String(row.test_scenario) : undefined, browser: String(row.browser || "Other"), os: String(row.os || "Other"), deviceCategory: (row.device_category || "desktop") as AnalyticsVisitor["deviceCategory"], country: String(row.country || "Unknown"), region: String(row.region || "Unknown"), firstReferrer: row.first_referrer ? String(row.first_referrer) : undefined, firstUtmSource: row.first_utm_source ? String(row.first_utm_source) : undefined, firstUtmMedium: row.first_utm_medium ? String(row.first_utm_medium) : undefined, firstUtmCampaign: row.first_utm_campaign ? String(row.first_utm_campaign) : undefined, createdAt: iso(row.created_at || row.first_seen), updatedAt: iso(row.updated_at || row.last_seen) };
      this.visitors.set(value.visitorId, value);
    }
    for (const row of sessions.rows as Record<string, unknown>[]) {
      const value: AnalyticsSession = { id: String(row.id), sessionId: String(row.session_id), visitorId: String(row.visitor_id), userId: row.user_id ? String(row.user_id) : undefined, startedAt: iso(row.started_at), lastActivity: iso(row.last_activity), entryPage: String(row.entry_page || "/"), exitPage: String(row.exit_page || "/"), pageViewCount: Number(row.page_view_count || 0), eventCount: Number(row.event_count || 0), engagementDuration: Number(row.engagement_duration || 0), isEngaged: Boolean(row.is_engaged), referrer: row.referrer ? String(row.referrer) : undefined, referrerDomain: row.referrer_domain ? String(row.referrer_domain) : undefined, trafficSource: String(row.traffic_source || "Direct"), utmSource: row.utm_source ? String(row.utm_source) : undefined, utmMedium: row.utm_medium ? String(row.utm_medium) : undefined, utmCampaign: row.utm_campaign ? String(row.utm_campaign) : undefined, browser: String(row.browser || "Other"), os: String(row.os || "Other"), deviceCategory: (row.device_category || "desktop") as AnalyticsSession["deviceCategory"], country: String(row.country || "Unknown"), region: String(row.region || "Unknown"), isBot: Boolean(row.is_bot), isTestUser: Boolean(row.is_test_user), testRunId: row.test_run_id ? String(row.test_run_id) : undefined, testPersona: row.test_persona ? String(row.test_persona) : undefined, testScenario: row.test_scenario ? String(row.test_scenario) : undefined, createdAt: iso(row.created_at || row.started_at) };
      this.sessions.set(value.sessionId, value);
    }
    for (const row of pageViews.rows as Record<string, unknown>[]) {
      const value: AnalyticsPageView = { id: String(row.id), visitorId: String(row.visitor_id), sessionId: String(row.session_id), userId: row.user_id ? String(row.user_id) : undefined, pathname: String(row.pathname || "/"), title: String(row.title || row.pathname || "/"), referrer: row.referrer ? String(row.referrer) : undefined, engagementTime: Number(row.engagement_time || 0), isEntry: Boolean(row.is_entry), isExit: Boolean(row.is_exit), isBounce: Boolean(row.is_bounce), deviceCategory: String(row.device_category || "desktop"), browser: String(row.browser || "Other"), os: String(row.os || "Other"), country: String(row.country || "Unknown"), isBot: Boolean(row.is_bot), isTestUser: Boolean(row.is_test_user), testRunId: row.test_run_id ? String(row.test_run_id) : undefined, testPersona: row.test_persona ? String(row.test_persona) : undefined, testScenario: row.test_scenario ? String(row.test_scenario) : undefined, createdAt: iso(row.created_at) };
      this.pageViews.set(value.id, value);
    }
    for (const row of events.rows as Record<string, unknown>[]) {
      const rawProperties = row.properties;
      const properties = typeof rawProperties === "string" ? JSON.parse(rawProperties) : (rawProperties || {});
      const value: AnalyticsEvent = { id: String(row.id), eventName: String(row.event_name), visitorId: String(row.visitor_id), sessionId: String(row.session_id), userId: row.user_id ? String(row.user_id) : undefined, pathname: String(row.pathname || "/"), properties: properties as Record<string, unknown>, isBot: Boolean(row.is_bot), isTestUser: Boolean(row.is_test_user), testRunId: row.test_run_id ? String(row.test_run_id) : undefined, testPersona: row.test_persona ? String(row.test_persona) : undefined, testScenario: row.test_scenario ? String(row.test_scenario) : undefined, createdAt: iso(row.created_at) };
      this.events.set(value.id, value);
    }
  }

  private async syncPageViewToPg(visitor: AnalyticsVisitor, session: AnalyticsSession, pageView: AnalyticsPageView) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO analytics_visitors (id, visitor_id, first_user_id, latest_user_id, first_seen, last_seen, total_visits, total_pageviews, is_bot, is_test_user, test_run_id, test_persona, test_scenario, browser, os, device_category, country, region, first_referrer, first_utm_source, first_utm_medium, first_utm_campaign)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         ON CONFLICT (visitor_id) DO UPDATE SET last_seen = EXCLUDED.last_seen, total_pageviews = analytics_visitors.total_pageviews + 1, latest_user_id = COALESCE(EXCLUDED.latest_user_id, analytics_visitors.latest_user_id), updated_at = NOW()`,
        [visitor.id, visitor.visitorId, visitor.firstUserId || null, visitor.latestUserId || null, visitor.firstSeen, visitor.lastSeen, visitor.totalVisits, visitor.totalPageviews, visitor.isBot, Boolean(visitor.isTestUser), visitor.testRunId || null, visitor.testPersona || null, visitor.testScenario || null, visitor.browser, visitor.os, visitor.deviceCategory, visitor.country, visitor.region, visitor.firstReferrer || null, visitor.firstUtmSource || null, visitor.firstUtmMedium || null, visitor.firstUtmCampaign || null]
      );

      await this.pool.query(
        `INSERT INTO analytics_sessions (id, session_id, visitor_id, user_id, started_at, last_activity, entry_page, exit_page, page_view_count, event_count, engagement_duration, is_engaged, referrer, referrer_domain, traffic_source, utm_source, utm_medium, utm_campaign, browser, os, device_category, country, region, is_bot, is_test_user, test_run_id, test_persona, test_scenario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
         ON CONFLICT (session_id) DO UPDATE SET last_activity = EXCLUDED.last_activity, exit_page = EXCLUDED.exit_page, page_view_count = EXCLUDED.page_view_count, engagement_duration = EXCLUDED.engagement_duration, is_engaged = EXCLUDED.is_engaged`,
        [session.id, session.sessionId, session.visitorId, session.userId || null, session.startedAt, session.lastActivity, session.entryPage, session.exitPage, session.pageViewCount, session.eventCount, session.engagementDuration, session.isEngaged, session.referrer || null, session.referrerDomain || null, session.trafficSource, session.utmSource || null, session.utmMedium || null, session.utmCampaign || null, session.browser, session.os, session.deviceCategory, session.country, session.region, session.isBot, Boolean(session.isTestUser), session.testRunId || null, session.testPersona || null, session.testScenario || null]
      );

      await this.pool.query(
        `INSERT INTO analytics_pageviews (id, visitor_id, session_id, user_id, pathname, title, referrer, engagement_time, is_entry, is_exit, is_bounce, device_category, browser, os, country, is_bot, is_test_user, test_run_id, test_persona, test_scenario, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
        [pageView.id, pageView.visitorId, pageView.sessionId, pageView.userId || null, pageView.pathname, pageView.title, pageView.referrer || null, pageView.engagementTime, pageView.isEntry, pageView.isExit, pageView.isBounce, pageView.deviceCategory, pageView.browser, pageView.os, pageView.country, pageView.isBot, Boolean(pageView.isTestUser), pageView.testRunId || null, pageView.testPersona || null, pageView.testScenario || null, pageView.createdAt]
      );
    } catch (err) {
      console.warn("[RealAnalyticsEngine] syncPageViewToPg error:", err);
    }
  }

  private async syncEventToPg(event: AnalyticsEvent) {
    if (!this.pool) return;
    try {
      await this.pool.query(
        `INSERT INTO analytics_events (id, event_name, visitor_id, session_id, user_id, pathname, properties, is_bot, is_test_user, test_run_id, test_persona, test_scenario, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [event.id, event.eventName, event.visitorId, event.sessionId, event.userId || null, event.pathname, JSON.stringify(event.properties), event.isBot, Boolean(event.isTestUser), event.testRunId || null, event.testPersona || null, event.testScenario || null, event.createdAt]
      );
    } catch (err) {
      console.warn("[RealAnalyticsEngine] syncEventToPg error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard Analytics Queries
  // ---------------------------------------------------------------------------

  public getOverview(options: AnalyticsQueryOptions = {}) {
    const { start, end, priorStart, priorEnd } = this.getDateBounds(options);

    // Human sessions & pageviews in current window
    const inCurrentWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const inPriorWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= priorStart.getTime() && t < priorEnd.getTime();
    };

    const allPageViews = [...this.pageViews.values()].filter((record) => this.includesRecord(record, options));
    const allSessions = [...this.sessions.values()].filter((record) => this.includesRecord(record, options));
    const allEvents = [...this.events.values()].filter((record) => this.includesRecord(record, options));
    const allVisitors = [...this.visitors.values()].filter((record) => this.includesRecord(record, options));

    // Current Window Metrics
    const currentPVs = allPageViews.filter((pv) => inCurrentWindow(pv.createdAt));
    const currentSessions = allSessions.filter((s) => inCurrentWindow(s.startedAt));
    const currentEvents = allEvents.filter((e) => inCurrentWindow(e.createdAt));
    const currentVisitorsSet = new Set(currentPVs.map((pv) => pv.visitorId));

    // Active Users Now (seen in last 5 minutes)
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const activeNowCount = allVisitors.filter((v) => new Date(v.lastSeen).getTime() >= fiveMinsAgo).length;

    const realNewVisitors = allVisitors.filter((v) => inCurrentWindow(v.firstSeen)).length;
    const realReturningVisitors = Math.max(0, currentVisitorsSet.size - realNewVisitors);

    const totalVisitors = currentVisitorsSet.size;
    const totalUsers = new Set(currentPVs.map((pageView) => pageView.userId).filter(Boolean)).size;
    const totalReturningUsers = realReturningVisitors;
    const totalNewUsers = realNewVisitors;

    const totalSessions = currentSessions.length;
    const totalPageViews = currentPVs.length;
    const totalEventsCount = currentEvents.length;

    const newUsersPct = totalVisitors > 0 ? Math.round((totalNewUsers / totalVisitors) * 100) : 0;
    const returningUsersPct = 100 - newUsersPct;

    const totalDuration = currentSessions.reduce((acc, s) => acc + s.engagementDuration, 0);
    const avgSessionDurationSec = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

    const bouncedSessions = currentSessions.filter((s) => s.pageViewCount === 1 && s.engagementDuration < 10).length;
    const bounceRate = totalSessions > 0 ? Number(((bouncedSessions / totalSessions) * 100).toFixed(1)) : 0;

    const percentageChange = (current: number, prior: number) => prior ? Number((((current - prior) / prior) * 100).toFixed(1)) : current ? 100 : 0;
    const visitorsChangePct = percentageChange(totalVisitors, new Set(allPageViews.filter((pv) => inPriorWindow(pv.createdAt)).map((pv) => pv.visitorId)).size);
    const sessionsChangePct = percentageChange(totalSessions, allSessions.filter((session) => inPriorWindow(session.startedAt)).length);
    const pageViewsChangePct = percentageChange(totalPageViews, allPageViews.filter((pageView) => inPriorWindow(pageView.createdAt)).length);
    const eventsChangePct = percentageChange(totalEventsCount, allEvents.filter((event) => inPriorWindow(event.createdAt)).length);

    // Time-Series Chart Data Generation
    const chartData = this.generateTimeSeries(start, end, currentPVs, currentSessions);

    return {
      kpi: {
        totalUsers,
        totalVisitors,
        totalSessions,
        pageViews: totalPageViews,
        activeNow: activeNowCount,
        newUsers: totalNewUsers,
        returningUsers: totalReturningUsers,
        newUsersPct,
        returningUsersPct,
        avgSessionDurationSec,
        avgSessionDurationFormatted: this.formatDuration(avgSessionDurationSec),
        bounceRate,
        totalEvents: totalEventsCount,
        changes: {
          visitorsPct: visitorsChangePct,
          sessionsPct: sessionsChangePct,
          pageViewsPct: pageViewsChangePct,
          eventsPct: eventsChangePct
        }
      },
      chart: chartData
    };
  }

  private generateTimeSeries(start: Date, end: Date, pvs: AnalyticsPageView[], sessions: AnalyticsSession[]) {
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const isHourly = diffHours <= 48;

    const points = new Map<string, { label: string; visitors: Set<string>; pageViews: number; sessions: number }>();

    // Pre-populate time intervals
    const curr = new Date(start);
    while (curr <= end) {
      let key: string;
      let label: string;

      if (isHourly) {
        key = curr.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        label = `${curr.getHours().toString().padStart(2, "0")}:00`;
        curr.setHours(curr.getHours() + 1);
      } else {
        key = curr.toISOString().slice(0, 10); // YYYY-MM-DD
        label = curr.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        curr.setDate(curr.getDate() + 1);
      }

      points.set(key, { label, visitors: new Set(), pageViews: 0, sessions: 0 });
    }

    for (const pv of pvs) {
      const pvDate = new Date(pv.createdAt);
      const key = isHourly ? pvDate.toISOString().slice(0, 13) : pvDate.toISOString().slice(0, 10);
      const pt = points.get(key);
      if (pt) {
        pt.pageViews += 1;
        pt.visitors.add(pv.visitorId);
      }
    }

    for (const s of sessions) {
      const sDate = new Date(s.startedAt);
      const key = isHourly ? sDate.toISOString().slice(0, 13) : sDate.toISOString().slice(0, 10);
      const pt = points.get(key);
      if (pt) {
        pt.sessions += 1;
      }
    }

    return Array.from(points.values()).map((p) => ({
      label: p.label,
      uniqueVisitors: p.visitors.size,
      pageViews: p.pageViews,
      sessions: p.sessions
    }));
  }

  public getPagesAnalytics(options: AnalyticsQueryOptions = {}) {
    const { start, end } = this.getDateBounds(options);
    const inWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const pvs = [...this.pageViews.values()].filter((pv) => this.includesRecord(pv, options) && inWindow(pv.createdAt));
    const totalPVs = pvs.length;

    const pageStats = new Map<
      string,
      {
        pathname: string;
        views: number;
        visitors: Set<string>;
        sessions: Set<string>;
        totalEngagementTime: number;
        entries: number;
        exits: number;
        bounces: number;
        lastActivity: string;
      }
    >();

    for (const pv of pvs) {
      let stat = pageStats.get(pv.pathname);
      if (!stat) {
        stat = {
          pathname: pv.pathname,
          views: 0,
          visitors: new Set(),
          sessions: new Set(),
          totalEngagementTime: 0,
          entries: 0,
          exits: 0,
          bounces: 0,
          lastActivity: pv.createdAt
        };
        pageStats.set(pv.pathname, stat);
      }

      stat.views += 1;
      stat.visitors.add(pv.visitorId);
      stat.sessions.add(pv.sessionId);
      stat.totalEngagementTime += pv.engagementTime;
      if (pv.isEntry) stat.entries += 1;
      if (pv.isExit) stat.exits += 1;
      if (pv.isBounce) stat.bounces += 1;
      if (pv.createdAt > stat.lastActivity) stat.lastActivity = pv.createdAt;
    }

    const pages = Array.from(pageStats.values()).map((stat) => {
      const avgTimeSec = stat.views > 0 ? Math.round(stat.totalEngagementTime / stat.views) : 0;
      const bounceRate = stat.entries > 0 ? Number(((stat.bounces / stat.entries) * 100).toFixed(1)) : 0;
      const trafficPct = totalPVs > 0 ? Number(((stat.views / totalPVs) * 100).toFixed(1)) : 0;

      return {
        pathname: stat.pathname,
        views: stat.views,
        uniqueVisitors: stat.visitors.size,
        sessions: stat.sessions.size,
        avgEngagementTimeSec: avgTimeSec,
        avgEngagementTimeFormatted: this.formatDuration(avgTimeSec),
        bounceRate,
        entries: stat.entries,
        exits: stat.exits,
        trafficPct,
        lastActivity: stat.lastActivity
      };
    });

    const realPages = pages.sort((a, b) => b.views - a.views);

    return {
      totalPageViews: totalPVs,
      totalPagesCount: realPages.length,
      mostVisited: realPages[0]?.pathname || "/",
      leastVisited: realPages[realPages.length - 1]?.pathname || "/",
      pages: realPages
    };
  }

  public getTrafficSources(options: AnalyticsQueryOptions = {}) {
    const { start, end } = this.getDateBounds(options);
    const inWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const activeSessions = [...this.sessions.values()].filter((s) => this.includesRecord(s, options) && inWindow(s.startedAt));
    const totalSessions = activeSessions.length;

    const sourceMap = new Map<string, { source: string; visitors: Set<string>; sessions: number }>();
    const utmCampaignMap = new Map<string, { campaign: string; visitors: Set<string>; sessions: number }>();

    for (const s of activeSessions) {
      const srcName = s.trafficSource || "Direct";
      let srcStat = sourceMap.get(srcName);
      if (!srcStat) {
        srcStat = { source: srcName, visitors: new Set(), sessions: 0 };
        sourceMap.set(srcName, srcStat);
      }
      srcStat.sessions += 1;
      srcStat.visitors.add(s.visitorId);

      if (s.utmCampaign) {
        let cmpStat = utmCampaignMap.get(s.utmCampaign);
        if (!cmpStat) {
          cmpStat = { campaign: s.utmCampaign, visitors: new Set(), sessions: 0 };
          utmCampaignMap.set(s.utmCampaign, cmpStat);
        }
        cmpStat.sessions += 1;
        cmpStat.visitors.add(s.visitorId);
      }
    }

    const sources = Array.from(sourceMap.values()).map((s) => ({
      source: s.source,
      visitors: s.visitors.size,
      sessions: s.sessions,
      pct: totalSessions > 0 ? Number(((s.sessions / totalSessions) * 100).toFixed(1)) : 0
    }));
    sources.sort((a, b) => b.sessions - a.sessions);

    const campaigns = Array.from(utmCampaignMap.values()).map((c) => ({
      campaign: c.campaign,
      visitors: c.visitors.size,
      sessions: c.sessions
    }));
    campaigns.sort((a, b) => b.sessions - a.sessions);

    return { totalSessions, sources, campaigns };
  }

  public getEventsAnalytics(options: AnalyticsQueryOptions = {}) {
    const { start, end } = this.getDateBounds(options);
    const inWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const activeEvents = [...this.events.values()].filter((e) => this.includesRecord(e, options) && inWindow(e.createdAt));
    const totalEventsCount = activeEvents.length;

    const eventMap = new Map<string, { eventName: string; count: number; visitors: Set<string>; lastTriggered: string }>();

    for (const e of activeEvents) {
      let stat = eventMap.get(e.eventName);
      if (!stat) {
        stat = { eventName: e.eventName, count: 0, visitors: new Set(), lastTriggered: e.createdAt };
        eventMap.set(e.eventName, stat);
      }
      stat.count += 1;
      stat.visitors.add(e.visitorId);
      if (e.createdAt > stat.lastTriggered) stat.lastTriggered = e.createdAt;
    }

    const eventsList = Array.from(eventMap.values()).map((e) => ({
      eventName: e.eventName,
      count: e.count,
      uniqueVisitors: e.visitors.size,
      lastTriggered: e.lastTriggered,
      pct: totalEventsCount > 0 ? Number(((e.count / totalEventsCount) * 100).toFixed(1)) : 0
    }));

    eventsList.sort((a, b) => b.count - a.count);

    return { totalEvents: totalEventsCount, events: eventsList };
  }

  public getDevicesAnalytics(options: AnalyticsQueryOptions = {}) {
    const { start, end } = this.getDateBounds(options);
    const inWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const activeSessions = [...this.sessions.values()].filter((s) => this.includesRecord(s, options) && inWindow(s.startedAt));
    const total = activeSessions.length;

    const deviceMap = new Map<string, number>();
    const browserMap = new Map<string, number>();
    const osMap = new Map<string, number>();

    for (const s of activeSessions) {
      deviceMap.set(s.deviceCategory, (deviceMap.get(s.deviceCategory) || 0) + 1);
      browserMap.set(s.browser, (browserMap.get(s.browser) || 0) + 1);
      osMap.set(s.os, (osMap.get(s.os) || 0) + 1);
    }

    const formatList = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([name, count]) => ({
          name,
          count,
          pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
        }))
        .sort((a, b) => b.count - a.count);

    return {
      devices: formatList(deviceMap),
      browsers: formatList(browserMap),
      os: formatList(osMap)
    };
  }

  public getGeoAnalytics(options: AnalyticsQueryOptions = {}) {
    const { start, end } = this.getDateBounds(options);
    const inWindow = (ts: string) => {
      const t = new Date(ts).getTime();
      return t >= start.getTime() && t <= end.getTime();
    };

    const activeVisitors = [...this.visitors.values()].filter((v) => this.includesRecord(v, options) && inWindow(v.lastSeen));
    const total = activeVisitors.length;

    const countryMap = new Map<string, number>();

    for (const v of activeVisitors) {
      const c = v.country || "Unknown";
      countryMap.set(c, (countryMap.get(c) || 0) + 1);
    }

    const countries = Array.from(countryMap.entries())
      .map(([country, count]) => ({
        country,
        visitors: count,
        pct: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.visitors - a.visitors);

    return { totalVisitors: total, countries };
  }

  public getLiveActivity() {
    const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
    const activeVisitors = [...this.visitors.values()].filter((v) => this.includesRecord(v) && new Date(v.lastSeen).getTime() >= fiveMinsAgo);

    const recentPageViews = [...this.pageViews.values()]
      .filter((pv) => this.includesRecord(pv))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30)
      .map((pv) => ({
        id: pv.id,
        type: "page_view",
        visitorId: `${pv.visitorId.slice(0, 10)}...`,
        pathname: pv.pathname,
        title: pv.title,
        country: pv.country || "Unknown",
        device: pv.deviceCategory,
        timestamp: pv.createdAt
      }));

    const recentEvents = [...this.events.values()]
      .filter((e) => this.includesRecord(e))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map((e) => ({
        id: e.id,
        type: "event",
        eventName: e.eventName,
        visitorId: `${e.visitorId.slice(0, 10)}...`,
        pathname: e.pathname,
        properties: e.properties,
        timestamp: e.createdAt
      }));

    const feed = [...recentPageViews, ...recentEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      activeNowCount: activeVisitors.length,
      feed: feed.slice(0, 50)
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const remSecs = seconds % 60;
    if (mins < 60) return `${mins}m ${remSecs.toString().padStart(2, '0')}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  }
}
