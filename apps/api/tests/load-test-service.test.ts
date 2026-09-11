import { afterEach, describe, expect, it, vi } from "vitest";
import { LoadTestService, MAX_LOAD_TEST_USERS } from "../src/services/load-test-service";
import { RealAnalyticsEngine } from "../src/services/analytics-engine";

async function waitForCompletion(service: LoadTestService, id: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = service.get(id);
    if (run && run.status !== "queued" && run.status !== "running") return run;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("load test did not finish");
}

describe("LoadTestService", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("runs varied, tagged synthetic personas while excluding them from customer data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200 })));
    const analytics = new RealAnalyticsEngine();
    const service = new LoadTestService(analytics);
    const started = service.start({ targetUrl: "http://localhost:4000", stages: [10], thinkTimeMinMs: 0, thinkTimeMaxMs: 0 }, { appUrl: "http://localhost:3000", nodeEnv: "test" });
    const run = await waitForCompletion(service, started.id);

    expect(run.status).toBe("completed");
    expect(run.virtualUsers).toBe(10);
    expect(run.totalRequests).toBeGreaterThan(10);
    expect(Object.keys(run.personas).length).toBeGreaterThan(2);
    expect(run.funnel.visitors).toBe(10);
    expect(analytics.getOverview({ range: "30d" }).kpi.totalVisitors).toBe(0);
    expect(analytics.getOverview({ range: "30d", testData: "only", testRunId: run.id }).kpi.totalVisitors).toBe(10);
    expect(service.report(run.id)?.title).toBe("AGENTIA LOAD TEST REPORT");
  });

  it("rejects live production origins and concurrency above the hard safety limit", () => {
    const service = new LoadTestService(new RealAnalyticsEngine());
    expect(() => service.start({ targetUrl: "https://agentia-ai.cloud", stages: [1] }, { appUrl: "https://agentia-ai.cloud", nodeEnv: "production" })).toThrow(/explicit LOAD_TEST_ALLOWED_ORIGIN/);
    expect(() => service.start({ targetUrl: "http://localhost:4000", stages: [MAX_LOAD_TEST_USERS + 1] }, { appUrl: "http://localhost:3000", nodeEnv: "test" })).toThrow(/between 1 and 2000/);
  });
});
