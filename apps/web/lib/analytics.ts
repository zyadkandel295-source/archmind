"use client";

// ---------------------------------------------------------------------------
// Centralized Google Analytics 4 utility for the AGENTIA platform.
//
// Usage:
//   import * as analytics from "@/lib/analytics";
//   analytics.init();                         // call once on app mount
//   analytics.pageView("/dashboard", "Dashboard"); // SPA route changes
//   analytics.identify(email);                // after auth (hashes internally)
//   analytics.clearUser();                    // on logout
//   analytics.track("sign_up", { method: "google" });
//
// Environment:
//   NEXT_PUBLIC_GA_MEASUREMENT_ID  — GA4 Measurement ID (e.g. G-XXXXXXXXXX)
//   NEXT_PUBLIC_GA_DEBUG           — "true" to enable GA4 DebugView
//
// Guards:
//   • No-ops silently when the measurement ID is missing
//   • No-ops during SSR (typeof window === "undefined")
//   • No-ops when NODE_ENV === "test"
//   • Deduplicates consecutive identical page_view events
// ---------------------------------------------------------------------------


// ---------- types ----------------------------------------------------------

/** GA4 event parameter map. Extend as new events are instrumented. */
export interface AnalyticsEventMap {
  // Automatically enhanced
  page_view: { page_path?: string; page_title?: string };

  // Auth lifecycle
  sign_up: { method?: string };
  login: { method?: string };
  logout: Record<string, never>;

  // Product events (AI agent workspace)
  assistant_created: { assistant_name?: string };
  assistant_deleted: { assistant_id?: string };
  chat_started: { assistant_id?: string };
  message_sent: { assistant_id?: string };
  source_uploaded: { assistant_id?: string };

  // Catch-all for ad-hoc events
  [key: string]: Record<string, unknown>;
}

type EventName = keyof AnalyticsEventMap;

// ---------- globals --------------------------------------------------------

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let _initialized = false;
let _measurementId: string | undefined;
let _lastPageView: string | undefined;

// ---------- guards ---------------------------------------------------------

function isDisabled(): boolean {
  if (typeof window === "undefined") return true;
  if (process.env.NODE_ENV === "test") return true;
  return false;
}

function getMeasurementId(): string | undefined {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || undefined;
}

function isDebug(): boolean {
  return process.env.NEXT_PUBLIC_GA_DEBUG === "true";
}

// ---------- SHA-256 helper (Web Crypto) ------------------------------------

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- script loader --------------------------------------------------

function injectGtagScript(id: string) {
  if (document.getElementById("ga4-gtag")) return;

  const script = document.createElement("script");
  script.id = "ga4-gtag";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };

  window.gtag("js", new Date());

  const configParams: Record<string, unknown> = {
    send_page_view: false // we handle SPA page_views manually
  };

  if (isDebug()) {
    configParams.debug_mode = true;
  }

  window.gtag("config", id, configParams);
}

// ---------- public API -----------------------------------------------------

/**
 * Initialize GA4. Safe to call multiple times — only the first call
 * injects the script. No-ops when the measurement ID is missing.
 */
export function init(): void {
  if (isDisabled()) return;
  if (_initialized) return;

  const id = getMeasurementId();
  if (!id) return;

  _measurementId = id;
  injectGtagScript(id);
  _initialized = true;
}

/**
 * Set GA4 User-ID using a SHA-256 hash of the user's email.
 * The raw email is never sent to Google.
 */
export async function identify(email: string): Promise<void> {
  if (isDisabled() || !_initialized || !_measurementId) return;

  const hashedId = await sha256(email.trim().toLowerCase());
  window.gtag("set", { user_id: hashedId });
}

/**
 * Clear User-ID (call on logout).
 */
export function clearUser(): void {
  if (isDisabled() || !_initialized) return;
  window.gtag("set", { user_id: null });
}

/**
 * Track a GA4 page_view event. Deduplicates consecutive identical calls
 * to prevent double-fires from React Strict Mode.
 */
export function pageView(path: string, title?: string): void {
  if (isDisabled() || !_initialized || !_measurementId) return;

  const key = `${path}::${title ?? ""}`;
  if (key === _lastPageView) return;
  _lastPageView = key;

  const params: Record<string, unknown> = {
    page_path: path,
    page_title: title ?? document.title
  };

  if (isDebug()) {
    params.debug_mode = true;
  }

  window.gtag("event", "page_view", params);
}

/**
 * Track a custom GA4 event.
 *
 * @example
 *   analytics.track("sign_up", { method: "google" });
 *   analytics.track("chat_started", { assistant_id: "ast-123" });
 */
export function track<E extends EventName>(
  eventName: E,
  params?: AnalyticsEventMap[E]
): void {
  if (isDisabled() || !_initialized || !_measurementId) return;

  const eventParams: Record<string, unknown> = { ...(params ?? {}) };

  if (isDebug()) {
    eventParams.debug_mode = true;
  }

  window.gtag("event", eventName, eventParams);
}
