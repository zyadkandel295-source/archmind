import { describe, expect, it, beforeEach } from "vitest";
import { RealAnalyticsEngine } from "../src/services/analytics-engine";
import { isBotUserAgent, parseUserAgent, parseGeoCountry, classifyTrafficSource, sanitizePathname, sanitizeProperties } from "../src/services/analytics-service";

describe("RealAnalyticsEngine & Analytics Services", () => {
  let engine: RealAnalyticsEngine;

  beforeEach(() => {
    engine = new RealAnalyticsEngine();
  });

  it("identifies and filters bot user agents", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe(true);
    expect(isBotUserAgent("curl/7.68.0")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
  });

  it("parses user agents for device, browser, and OS", () => {
    const desktop = parseUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    expect(desktop.deviceCategory).toBe("desktop");
    expect(desktop.browser).toBe("Chrome");
    expect(desktop.os).toBe("Windows");

    const mobile = parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
    expect(mobile.deviceCategory).toBe("mobile");
    expect(mobile.browser).toBe("Safari");
    expect(mobile.os).toBe("iOS");
  });

  it("parses geographic country headers", () => {
    const geo = parseGeoCountry({ "cf-ipcountry": "US", "x-vercel-ip-country-region": "CA" });
    expect(geo.country).toBe("US");
    expect(geo.region).toBe("CA");
  });

  it("classifies traffic sources correctly", () => {
    expect(classifyTrafficSource("https://www.google.com/search?q=agentia").source).toBe("Google");
    expect(classifyTrafficSource("https://www.reddit.com/r/artificial").source).toBe("Reddit");
    expect(classifyTrafficSource("https://github.com/agentia/agentia").source).toBe("GitHub");
    expect(classifyTrafficSource(undefined, "campaign_newsletter").source).toBe("campaign_newsletter");
    expect(classifyTrafficSource("").source).toBe("Direct");
  });

  it("sanitizes pathnames and properties removing sensitive credentials", () => {
    expect(sanitizePathname("/auth/callback?code=secret_123&state=abc")).toBe("/auth/callback?code=[REDACTED]&state=abc");

    const sanitizedProps = sanitizeProperties({
      action: "login",
      password: "mySecretPassword123",
      apiKey: "sk-or-v1-12345"
    });
    expect(sanitizedProps.password).toBe("[REDACTED]");
    expect(sanitizedProps.apiKey).toBe("[REDACTED]");
    expect(sanitizedProps.action).toBe("login");
  });

  it("tracks pageviews, sessions, and calculates real KPI metrics", () => {
    // Visitor 1 Page View
    const pv1 = engine.trackPageView({
      visitorId: "vis_user_1",
      pathname: "/ai-base",
      title: "AI Base",
      referrer: "https://google.com",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
    });

    expect(pv1.visitorId).toBe("vis_user_1");
    expect(pv1.sessionId).toBeDefined();

    // Heartbeat
    engine.trackHeartbeat({ visitorId: "vis_user_1", sessionId: pv1.sessionId, engagementTime: 45 });

    // Event
    engine.trackEvent({
      visitorId: "vis_user_1",
      sessionId: pv1.sessionId,
      eventName: "ai_base_paper_search",
      pathname: "/ai-base",
      properties: { query: "Transformer architecture" }
    });

    // Overview Check
    const overview = engine.getOverview({ range: "30d" });
    expect(overview.kpi.totalVisitors).toBe(1);
    expect(overview.kpi.totalSessions).toBe(1);
    expect(overview.kpi.pageViews).toBe(1);
    expect(overview.kpi.totalEvents).toBe(1);
    expect(overview.kpi.activeNow).toBe(1);
    expect(overview.kpi.avgSessionDurationSec).toBeGreaterThanOrEqual(15);

    // Pages Check
    const pages = engine.getPagesAnalytics({ range: "30d" });
    expect(pages.totalPageViews).toBe(1);
    expect(pages.pages[0].pathname).toBe("/ai-base");

    // Events Check
    const events = engine.getEventsAnalytics({ range: "30d" });
    expect(events.totalEvents).toBe(1);
    expect(events.events[0].eventName).toBe("ai_base_paper_search");

    // Traffic Sources Check
    const sources = engine.getTrafficSources({ range: "30d" });
    expect(sources.sources[0].source).toBe("Google");

    // Live Stream Check
    const live = engine.getLiveActivity();
    expect(live.activeNowCount).toBe(1);
    expect(live.feed.length).toBeGreaterThanOrEqual(2);
  });
});
