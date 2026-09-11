import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { RealAnalyticsEngine } from "./analytics-engine";

export const MAX_LOAD_TEST_USERS = 2000;
export const LOAD_TEST_STAGES = [50, 100, 250, 500, 1000, 1500, 2000] as const;

export type TestPersona =
  | "new_visitor"
  | "curious_visitor"
  | "signup_user"
  | "returning_user"
  | "heavy_user"
  | "agent_creator"
  | "agent_chatter"
  | "knowledge_uploader"
  | "agent_editor"
  | "search_browser"
  | "onboarding_abandoner"
  | "error_encounterer"
  | "existing_login"
  | "conversion_abandoner"
  | "conversion_completed";

type Action = { event: string; path: string; feature: string };
type PersonaDefinition = { weight: number; scenario: string; actions: Action[] };

// These actions are telemetry only. The runner never creates real accounts,
// agents, files, payments, or destructive records while it applies HTTP load.
const PERSONAS: Record<TestPersona, PersonaDefinition> = {
  new_visitor: { weight: 18, scenario: "explore", actions: [{ event: "page_view", path: "/", feature: "home" }, { event: "feature_opened", path: "/features", feature: "features" }] },
  curious_visitor: { weight: 10, scenario: "short_visit", actions: [{ event: "page_view", path: "/", feature: "home" }] },
  signup_user: { weight: 9, scenario: "signup", actions: [{ event: "page_view", path: "/", feature: "home" }, { event: "signup_started", path: "/auth/login", feature: "auth" }, { event: "signup_completed", path: "/dashboard", feature: "auth" }] },
  returning_user: { weight: 8, scenario: "return", actions: [{ event: "login", path: "/auth/login", feature: "auth" }, { event: "dashboard_opened", path: "/dashboard", feature: "dashboard" }, { event: "session_ended", path: "/dashboard", feature: "dashboard" }] },
  heavy_user: { weight: 7, scenario: "heavy_usage", actions: [{ event: "dashboard_opened", path: "/dashboard", feature: "dashboard" }, { event: "agent_created", path: "/assistants/new", feature: "agents" }, { event: "chat_started", path: "/assistants/test/chat", feature: "chat" }, { event: "message_sent", path: "/assistants/test/chat", feature: "chat" }, { event: "ai_response_received", path: "/assistants/test/chat", feature: "chat" }, { event: "file_upload_completed", path: "/assistants/test/sources", feature: "knowledge" }] },
  agent_creator: { weight: 7, scenario: "agent_creation", actions: [{ event: "agent_creation_started", path: "/assistants/new", feature: "agents" }, { event: "agent_created", path: "/assistants/test", feature: "agents" }] },
  agent_chatter: { weight: 8, scenario: "chat", actions: [{ event: "chat_started", path: "/assistants/test/chat", feature: "chat" }, { event: "message_sent", path: "/assistants/test/chat", feature: "chat" }, { event: "ai_response_received", path: "/assistants/test/chat", feature: "chat" }, { event: "message_sent", path: "/assistants/test/chat", feature: "chat" }, { event: "ai_response_received", path: "/assistants/test/chat", feature: "chat" }] },
  knowledge_uploader: { weight: 5, scenario: "knowledge", actions: [{ event: "file_upload_started", path: "/assistants/test/sources", feature: "knowledge" }, { event: "file_upload_completed", path: "/assistants/test/sources", feature: "knowledge" }, { event: "knowledge_added", path: "/assistants/test/sources", feature: "knowledge" }] },
  agent_editor: { weight: 4, scenario: "edit_agent", actions: [{ event: "agent_edited", path: "/assistants/test/settings", feature: "agents" }, { event: "agent_deleted", path: "/assistants/test/settings", feature: "agents" }] },
  search_browser: { weight: 5, scenario: "search", actions: [{ event: "search_used", path: "/ai-base", feature: "search" }, { event: "feature_opened", path: "/ai-base/research", feature: "knowledge" }] },
  onboarding_abandoner: { weight: 5, scenario: "onboarding_abandon", actions: [{ event: "signup_started", path: "/auth/login", feature: "auth" }, { event: "session_ended", path: "/auth/login", feature: "auth" }] },
  error_encounterer: { weight: 3, scenario: "recoverable_error", actions: [{ event: "chat_started", path: "/assistants/test/chat", feature: "chat" }, { event: "ai_response_failed", path: "/assistants/test/chat", feature: "chat" }, { event: "error_seen", path: "/assistants/test/chat", feature: "chat" }] },
  existing_login: { weight: 4, scenario: "existing_login", actions: [{ event: "login", path: "/auth/login", feature: "auth" }, { event: "dashboard_opened", path: "/dashboard", feature: "dashboard" }] },
  conversion_abandoner: { weight: 4, scenario: "conversion_abandon", actions: [{ event: "conversion_started", path: "/pricing", feature: "conversion" }, { event: "session_ended", path: "/pricing", feature: "conversion" }] },
  conversion_completed: { weight: 3, scenario: "conversion_complete", actions: [{ event: "conversion_started", path: "/pricing", feature: "conversion" }, { event: "conversion_completed", path: "/pricing", feature: "conversion" }] }
};

export interface LoadTestConfig {
  targetUrl: string;
  stages?: number[];
  maxFailureRate?: number;
  maxP95Ms?: number;
  requestTimeoutMs?: number;
  thinkTimeMinMs?: number;
  thinkTimeMaxMs?: number;
  /** Caps request sockets while virtual sessions remain concurrent. */
  maxInFlightRequests?: number;
}

export interface LoadTestError {
  name: string;
  endpoint: string;
  feature: string;
  count: number;
  status?: number;
  firstOccurrence: string;
  lastOccurrence: string;
  severity: "critical" | "high" | "medium" | "low";
  likelyCause: string;
  recommendedFix: string;
}

type FunnelCounts = {
  visitors: number; interested_users: number; signups: number; activated_users: number;
  agents_created: number; ai_used: number; high_intent_users: number; test_conversions_completed: number;
};

export interface LoadTestRun {
  id: string;
  status: "queued" | "running" | "stopped" | "completed" | "failed";
  isTestRun: true;
  createdByUserId: string;
  targetUrl: string;
  startedAt?: string;
  endedAt?: string;
  requestedUsers: number;
  virtualUsers: number;
  concurrentUsers: number;
  activeSessions: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  peakRequestsPerSecond: number;
  latencyMs: number[];
  aiLatencyMs: number[];
  databaseLatencyMs: number[];
  statusCodes: Record<string, number>;
  requestsPerSecond: Record<string, number>;
  errors: LoadTestError[];
  personas: Record<string, number>;
  features: Record<string, number>;
  funnel: FunnelCounts;
  maximumStableUsers: number;
  stopReason?: string;
  stopped: boolean;
}

const quantile = (values: number[], q: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))]!);
};

const safeTarget = (target: string, appUrl: string, nodeEnv: string) => {
  const url = new URL(target);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  const explicitlyAllowed = process.env.ALLOW_LOAD_TESTS === "true" && process.env.LOAD_TEST_ALLOWED_ORIGIN === url.origin;
  if (!local && !explicitlyAllowed) throw new Error("Load tests may target localhost or the explicit LOAD_TEST_ALLOWED_ORIGIN only.");
  if (nodeEnv === "production" && (!explicitlyAllowed || url.origin === new URL(appUrl).origin))
    throw new Error("Production load tests must target a separately allow-listed test environment, never the live application.");
  return url.origin.replace(/\/$/, "");
};

export class LoadTestService {
  private readonly runs = new Map<string, LoadTestRun>();
  private pool?: Pool;
  private inFlightRequests = 0;
  private readonly requestWaiters: Array<() => void> = [];
  constructor(private readonly analytics: RealAnalyticsEngine) {}

  setPool(pool?: Pool) { this.pool = pool; }

  /** Restores finished report summaries after a process or browser refresh. */
  async hydrateFromPg() {
    if (!this.pool) return;
    const result = await this.pool.query("SELECT id, created_by_user_id, target_origin, status, metrics, stop_reason, started_at, ended_at FROM analytics_load_test_runs ORDER BY created_at DESC LIMIT 100");
    for (const row of result.rows as Record<string, unknown>[]) {
      const rawMetrics = typeof row.metrics === "string" ? JSON.parse(row.metrics) : (row.metrics || {});
      const metrics = rawMetrics as Partial<LoadTestRun>;
      const run: LoadTestRun = {
        id: String(row.id), status: row.status as LoadTestRun["status"], isTestRun: true, createdByUserId: String(row.created_by_user_id), targetUrl: String(row.target_origin),
        requestedUsers: Number(metrics.requestedUsers || 0), virtualUsers: Number(metrics.virtualUsers || 0), concurrentUsers: 0, activeSessions: 0,
        totalRequests: Number(metrics.totalRequests || 0), successfulRequests: Number(metrics.successfulRequests || 0), failedRequests: Number(metrics.failedRequests || 0), peakRequestsPerSecond: Number(metrics.peakRequestsPerSecond || 0),
        latencyMs: Array.isArray(metrics.latencyMs) ? metrics.latencyMs : [], aiLatencyMs: Array.isArray(metrics.aiLatencyMs) ? metrics.aiLatencyMs : [], databaseLatencyMs: Array.isArray(metrics.databaseLatencyMs) ? metrics.databaseLatencyMs : [], statusCodes: metrics.statusCodes || {}, requestsPerSecond: metrics.requestsPerSecond || {}, errors: metrics.errors || [], personas: metrics.personas || {}, features: metrics.features || {}, funnel: metrics.funnel || { visitors: 0, interested_users: 0, signups: 0, activated_users: 0, agents_created: 0, ai_used: 0, high_intent_users: 0, test_conversions_completed: 0 }, maximumStableUsers: Number(metrics.maximumStableUsers || 0), stopReason: row.stop_reason ? String(row.stop_reason) : undefined, stopped: row.status === "stopped", startedAt: row.started_at ? new Date(row.started_at as string).toISOString() : undefined, endedAt: row.ended_at ? new Date(row.ended_at as string).toISOString() : undefined
      };
      this.runs.set(run.id, run);
    }
  }

  list() { return [...this.runs.values()].sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || "")); }
  get(id: string) { return this.runs.get(id); }

  start(config: LoadTestConfig, context: { appUrl: string; nodeEnv: string; createdByUserId?: string }) {
    if (this.list().some((existing) => existing.status === "queued" || existing.status === "running")) {
      throw new Error("Only one load test may run at a time.");
    }
    const targetUrl = safeTarget(config.targetUrl, context.appUrl, context.nodeEnv);
    const stages = (config.stages?.length ? config.stages : [...LOAD_TEST_STAGES]).map(Number);
    if (stages.some((value) => !Number.isInteger(value) || value < 1 || value > MAX_LOAD_TEST_USERS))
      throw new Error(`Each load-test stage must be between 1 and ${MAX_LOAD_TEST_USERS} users.`);
    const run: LoadTestRun = {
      id: randomUUID(), status: "queued", isTestRun: true, createdByUserId: context.createdByUserId || "system-test-runner", targetUrl,
      requestedUsers: Math.max(...stages), virtualUsers: 0, concurrentUsers: 0, activeSessions: 0,
      totalRequests: 0, successfulRequests: 0, failedRequests: 0, peakRequestsPerSecond: 0,
      latencyMs: [], aiLatencyMs: [], databaseLatencyMs: [], statusCodes: {}, requestsPerSecond: {}, errors: [], personas: {}, features: {},
      funnel: { visitors: 0, interested_users: 0, signups: 0, activated_users: 0, agents_created: 0, ai_used: 0, high_intent_users: 0, test_conversions_completed: 0 },
      maximumStableUsers: 0, stopped: false
    };
    this.runs.set(run.id, run);
    void this.persist(run, config);
    void this.execute(run, stages, config);
    return run;
  }

  stop(id: string) {
    const run = this.runs.get(id);
    if (!run) return undefined;
    run.stopped = true;
    run.stopReason = "Stopped by administrator";
    return run;
  }

  async cleanup(id: string) {
    const run = this.runs.get(id);
    if (!run || run.status === "running") throw new Error("Stop a running test before cleanup.");
    this.runs.delete(id);
    this.analytics.removeTestRun(id);
    if (this.pool) {
      await this.pool.query("DELETE FROM analytics_events WHERE is_test_user AND test_run_id = $1", [id]);
      await this.pool.query("DELETE FROM analytics_pageviews WHERE is_test_user AND test_run_id = $1", [id]);
      await this.pool.query("DELETE FROM analytics_sessions WHERE is_test_user AND test_run_id = $1", [id]);
      await this.pool.query("DELETE FROM analytics_visitors WHERE is_test_user AND test_run_id = $1", [id]);
      await this.pool.query("DELETE FROM analytics_load_test_runs WHERE id = $1", [id]);
    }
    return true;
  }

  report(id: string) {
    const run = this.runs.get(id);
    if (!run) return undefined;
    const successRate = run.totalRequests ? (run.successfulRequests / run.totalRequests) * 100 : 0;
    const errorRate = run.totalRequests ? (run.failedRequests / run.totalRequests) * 100 : 0;
    const p95 = quantile(run.latencyMs, 0.95);
    const verdict = run.maximumStableUsers >= 2000 && errorRate < 1 && p95 < 1500 ? "READY FOR 2,000 USERS" : "NOT READY FOR 2,000 USERS";
    return {
      title: "AGENTIA LOAD TEST REPORT", run, metrics: {
        durationSeconds: run.startedAt ? Math.max(0, ((Date.parse(run.endedAt || new Date().toISOString()) - Date.parse(run.startedAt)) / 1000)) : 0,
        successRate, errorRate, p50: quantile(run.latencyMs, 0.5), p75: quantile(run.latencyMs, 0.75), p90: quantile(run.latencyMs, 0.9), p95, p99: quantile(run.latencyMs, 0.99),
        aiP95: quantile(run.aiLatencyMs, 0.95), databaseP95: quantile(run.databaseLatencyMs, 0.95)
      },
      verdict,
      primaryBottleneck: run.errors[0]?.likelyCause || (p95 > 1500 ? "High response latency" : "No critical bottleneck detected"),
      optimizationOpportunities: run.errors.slice(0, 10).map((error) => error.recommendedFix)
    };
  }

  private choosePersona(index: number): TestPersona {
    const ticket = (index * 37 + 17) % 100;
    let total = 0;
    for (const [persona, definition] of Object.entries(PERSONAS) as [TestPersona, PersonaDefinition][]) {
      total += definition.weight;
      if (ticket < total) return persona;
    }
    return "new_visitor";
  }

  private async execute(run: LoadTestRun, stages: number[], config: LoadTestConfig) {
    run.status = "running";
    run.startedAt = new Date().toISOString();
    const failureLimit = Math.min(100, Math.max(1, config.maxFailureRate ?? 5));
    const latencyLimit = Math.max(100, config.maxP95Ms ?? 5000);
    try {
      for (const stage of stages) {
        if (run.stopped) break;
        // Each stage represents its own concurrent cohort. This preserves the
        // requested 50 → … → 2,000 ramp instead of merely adding a small batch
        // to an already-finished cohort.
        const users = Array.from({ length: stage }, (_, index) => index);
        run.virtualUsers = Math.max(run.virtualUsers, stage);
        await Promise.all(users.map((index) => this.simulateUser(run, index, config)));
        const errorRate = run.totalRequests ? (run.failedRequests / run.totalRequests) * 100 : 0;
        if (errorRate > failureLimit) { run.stopReason = `Stopped: error rate ${errorRate.toFixed(1)}% exceeded ${failureLimit}%`; break; }
        if (quantile(run.latencyMs, 0.95) > latencyLimit) { run.stopReason = `Stopped: p95 latency exceeded ${latencyLimit}ms`; break; }
        run.maximumStableUsers = stage;
      }
      run.status = run.stopped || run.stopReason ? "stopped" : "completed";
    } catch (error) {
      run.status = "failed";
      run.stopReason = error instanceof Error ? error.message : "Load test failed";
    } finally {
      run.concurrentUsers = 0;
      run.activeSessions = 0;
      run.endedAt = new Date().toISOString();
      await this.persist(run, config);
    }
  }

  private async persist(run: LoadTestRun, config: LoadTestConfig) {
    if (!this.pool) return;
    const report = this.report(run.id);
    try {
      await this.pool.query(
        `INSERT INTO analytics_load_test_runs (id, created_by_user_id, target_origin, status, configuration, metrics, report, stop_reason, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, metrics = EXCLUDED.metrics, report = EXCLUDED.report, stop_reason = EXCLUDED.stop_reason, started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at, updated_at = NOW()`,
        [run.id, run.createdByUserId, run.targetUrl, run.status, JSON.stringify(config), JSON.stringify(run), JSON.stringify(report), run.stopReason || null, run.startedAt || null, run.endedAt || null]
      );
    } catch (error) {
      console.warn("[LoadTestService] run persistence failed:", error instanceof Error ? error.message : error);
    }
  }

  private async simulateUser(run: LoadTestRun, index: number, config: LoadTestConfig) {
    if (run.stopped) return;
    const persona = this.choosePersona(index);
    const definition = PERSONAS[persona];
    const visitorId = `test_${run.id}_${run.virtualUsers}_${index}`;
    const sessionId = `test_session_${run.id}_${run.virtualUsers}_${index}`;
    run.concurrentUsers += 1; run.activeSessions += 1;
    run.personas[persona] = (run.personas[persona] || 0) + 1;
    run.funnel.visitors += 1;
    try {
      for (const action of definition.actions) {
        if (run.stopped) break;
        this.analytics.trackPageView({ visitorId, sessionId, pathname: action.path, title: action.path, userAgent: "Mozilla/5.0 AGENTIA-Test", test: { isTestUser: true, testRunId: run.id, persona, scenario: definition.scenario } });
        this.analytics.trackEvent({ visitorId, sessionId, eventName: action.event, pathname: action.path, properties: { is_test_user: true, test_run_id: run.id, test_persona: persona, test_scenario: definition.scenario, feature: action.feature, simulated_action: true }, userAgent: "Mozilla/5.0 AGENTIA-Test", test: { isTestUser: true, testRunId: run.id, persona, scenario: definition.scenario } });
        run.features[action.feature] = (run.features[action.feature] || 0) + 1;
        this.advanceFunnel(run, action.event);
        await this.measure(run, `${run.targetUrl}/api/health`, action.feature, config.requestTimeoutMs ?? 10000, config.maxInFlightRequests ?? 250);
        const min = Math.max(0, config.thinkTimeMinMs ?? 5); const max = Math.max(min, config.thinkTimeMaxMs ?? 25);
        await new Promise((resolve) => setTimeout(resolve, min + ((index * 13 + action.event.length) % (max - min + 1))));
      }
    } finally { run.concurrentUsers -= 1; run.activeSessions -= 1; }
  }

  private advanceFunnel(run: LoadTestRun, event: string) {
    if (event === "feature_opened" || event === "signup_started") run.funnel.interested_users += 1;
    if (event === "signup_completed") run.funnel.signups += 1;
    if (event === "dashboard_opened" || event === "login") run.funnel.activated_users += 1;
    if (event === "agent_created") run.funnel.agents_created += 1;
    if (["chat_started", "message_sent", "ai_response_received"].includes(event)) run.funnel.ai_used += 1;
    if (event === "conversion_started") run.funnel.high_intent_users += 1;
    if (event === "conversion_completed") run.funnel.test_conversions_completed += 1;
  }

  private async measure(run: LoadTestRun, url: string, feature: string, timeoutMs: number, maxInFlightRequests: number) {
    await this.acquireRequestSlot(Math.min(1000, Math.max(1, maxInFlightRequests)));
    const started = performance.now();
    try {
      const targetOrigin = new URL(url).origin;
      const headers: Record<string, string> = {
        "x-agentia-load-test": run.id,
        "user-agent": "AGENTIA-Load-Test/1.0"
      };

      // The bypass secret is never sent to a caller-provided URL. It is used only
      // when the request is headed to the exact staging origin allow-listed by the
      // server, and the secret itself is configured only in the staging preview.
      const stagingBypass = process.env.STAGING_VERCEL_PROTECTION_BYPASS_TOKEN?.trim();
      if (stagingBypass && process.env.LOAD_TEST_ALLOWED_ORIGIN === targetOrigin) {
        headers["x-vercel-protection-bypass"] = stagingBypass;
      }

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
      const elapsed = Math.round(performance.now() - started);
      run.latencyMs.push(elapsed); run.totalRequests += 1;
      run.statusCodes[String(response.status)] = (run.statusCodes[String(response.status)] || 0) + 1;
      if (response.ok) run.successfulRequests += 1; else this.recordError(run, `HTTP ${response.status}`, url, feature, response.status);
    } catch (error) {
      run.latencyMs.push(Math.round(performance.now() - started)); run.totalRequests += 1;
      this.recordError(run, error instanceof Error ? error.name : "RequestError", url, feature);
    } finally {
      this.releaseRequestSlot();
    }
    const second = String(Math.floor(Date.now() / 1000));
    run.requestsPerSecond[second] = (run.requestsPerSecond[second] || 0) + 1;
    run.peakRequestsPerSecond = Math.max(run.peakRequestsPerSecond, run.requestsPerSecond[second]);
  }

  private async acquireRequestSlot(limit: number) {
    if (this.inFlightRequests < limit) { this.inFlightRequests += 1; return; }
    await new Promise<void>((resolve) => this.requestWaiters.push(resolve));
    this.inFlightRequests += 1;
  }

  private releaseRequestSlot() {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1);
    this.requestWaiters.shift()?.();
  }

  private recordError(run: LoadTestRun, name: string, endpoint: string, feature: string, status?: number) {
    run.failedRequests += 1;
    const now = new Date().toISOString();
    const existing = run.errors.find((error) => error.name === name && error.endpoint === endpoint);
    if (existing) { existing.count += 1; existing.lastOccurrence = now; return; }
    const severity = status && status >= 500 ? "high" : name === "TimeoutError" ? "critical" : "medium";
    run.errors.push({ name, endpoint, feature, count: 1, status, firstOccurrence: now, lastOccurrence: now, severity, likelyCause: status && status >= 500 ? "Server endpoint returned an error" : "Request timeout or network failure", recommendedFix: status && status >= 500 ? "Inspect server logs and dependency health for this endpoint." : "Review capacity, timeout, and network configuration." });
  }
}
