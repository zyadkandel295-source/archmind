"use client";

import * as ga4 from "@/lib/analytics";

const VISITOR_KEY = "agentia_visitor_id";
const SESSION_KEY = "agentia_session_id";
const SESSION_TIMESTAMP_KEY = "agentia_session_last_activity";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 mins

function generateId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "vis_ssr";
  try {
    let vid = localStorage.getItem(VISITOR_KEY);
    if (!vid) {
      vid = generateId("vis");
      localStorage.setItem(VISITOR_KEY, vid);
    }
    return vid;
  } catch {
    return generateId("vis");
  }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ses_ssr";
  try {
    const now = Date.now();
    const lastActStr = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    let sid = localStorage.getItem(SESSION_KEY);

    if (!sid || !lastActStr || now - parseInt(lastActStr, 10) > SESSION_TIMEOUT_MS) {
      sid = generateId("ses");
      localStorage.setItem(SESSION_KEY, sid);
    }
    localStorage.setItem(SESSION_TIMESTAMP_KEY, now.toString());
    return sid;
  } catch {
    return generateId("ses");
  }
}

function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      const val = params.get(key);
      if (val) {
        const camel = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        utm[camel] = val;
      }
    }
    return utm;
  } catch {
    return {};
  }
}

export function sendAnalyticsPayload(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const data = {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    path: window.location.pathname,
    title: document.title,
    referrer: document.referrer || undefined,
    ...getUtmParams(),
    ...payload
  };

  const bodyString = JSON.stringify(data);
  const endpoint = "/api/analytics/track";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    try {
      const blob = new Blob([bodyString], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) return;
    } catch {
      // Fallback to fetch
    }
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyString,
    keepalive: true
  }).catch(() => undefined);
}

export function trackPageView(pathname?: string, title?: string) {
  const currentPath = pathname || (typeof window !== "undefined" ? window.location.pathname : "/");
  const currentTitle = title || (typeof document !== "undefined" ? document.title : undefined);

  // Send to first-party backend analytics
  sendAnalyticsPayload({
    type: "page_view",
    path: currentPath,
    title: currentTitle
  });

  // Automatically broadcast to connected Web Analytics Tools (GA4 / Tag Manager)
  try {
    ga4.pageView(currentPath, currentTitle);
  } catch {
    // Non-blocking
  }
}

export function trackHeartbeat(engagementTimeSeconds: number = 15) {
  sendAnalyticsPayload({
    type: "heartbeat",
    engagementTime: engagementTimeSeconds
  });
}

export function trackEvent(eventName: string, properties: Record<string, unknown> = {}) {
  // Send to first-party backend analytics
  sendAnalyticsPayload({
    type: "event",
    eventName,
    properties
  });

  // Automatically broadcast to connected Web Analytics Tools (GA4 / Tag Manager)
  try {
    ga4.track(eventName, properties);
  } catch {
    // Non-blocking
  }
}
