import { createHash, randomUUID } from "crypto";

export interface AnalyticsVisitor {
  id: string;
  visitorId: string;
  firstUserId?: string;
  latestUserId?: string;
  firstSeen: string;
  lastSeen: string;
  totalVisits: number;
  totalPageviews: number;
  isBot: boolean;
  browser: string;
  os: string;
  deviceCategory: "desktop" | "mobile" | "tablet";
  country: string;
  region: string;
  firstReferrer?: string;
  firstUtmSource?: string;
  firstUtmMedium?: string;
  firstUtmCampaign?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsSession {
  id: string;
  sessionId: string;
  visitorId: string;
  userId?: string;
  startedAt: string;
  lastActivity: string;
  endedAt?: string;
  entryPage: string;
  exitPage: string;
  pageViewCount: number;
  eventCount: number;
  engagementDuration: number; // in seconds
  isEngaged: boolean;
  referrer?: string;
  referrerDomain?: string;
  trafficSource: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  browser: string;
  os: string;
  deviceCategory: "desktop" | "mobile" | "tablet";
  country: string;
  region: string;
  isBot: boolean;
  createdAt: string;
}

export interface AnalyticsPageView {
  id: string;
  visitorId: string;
  sessionId: string;
  userId?: string;
  pathname: string;
  title: string;
  referrer?: string;
  engagementTime: number;
  isEntry: boolean;
  isExit: boolean;
  isBounce: boolean;
  deviceCategory: string;
  browser: string;
  os: string;
  country: string;
  isBot: boolean;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  eventName: string;
  visitorId: string;
  sessionId: string;
  userId?: string;
  pathname: string;
  properties: Record<string, unknown>;
  isBot: boolean;
  createdAt: string;
}

// Helper: Bot Detection
const BOT_USER_AGENTS_REGEX =
  /googlebot|bingbot|yandexbot|slurp|duckduckbot|baiduspider|sogou|exabot|facebot|facebookexternalhit|ia_archiver|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest|slackbot|vkShare|W3C_Validator|headlesschrome|lighthouse|pingdom|uptimerobot|curl|wget|python-requests|axios|go-http-client|bot|spider|crawler|scraper/i;

export function isBotUserAgent(userAgent?: string): boolean {
  if (!userAgent) return false;
  return BOT_USER_AGENTS_REGEX.test(userAgent);
}

// Helper: User-Agent Parser
export function parseUserAgent(userAgent?: string) {
  const ua = userAgent || "";

  // Device Category
  let deviceCategory: "desktop" | "mobile" | "tablet" = "desktop";
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    deviceCategory = "tablet";
  } else if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) {
    deviceCategory = "mobile";
  }

  // Browser
  let browser = "Other";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/brave/i.test(ua)) browser = "Brave";

  // OS
  let os = "Other";
  if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os x|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "ChromeOS";

  return { deviceCategory, browser, os };
}

// Helper: Geo Country Header Extractor
export function parseGeoCountry(headers: Record<string, string | string[] | undefined>): { country: string; region: string } {
  const getHeader = (key: string): string | undefined => {
    const val = headers[key] || headers[key.toLowerCase()];
    if (Array.isArray(val)) return val[0];
    return val;
  };

  const country =
    getHeader("cf-ipcountry") ||
    getHeader("x-vercel-ip-country") ||
    getHeader("x-country") ||
    getHeader("cloudfront-viewer-country") ||
    getHeader("x-appengine-country") ||
    "Unknown";

  const region = getHeader("x-vercel-ip-country-region") || getHeader("x-region") || "Unknown";

  return {
    country: country === "XX" || country === "T1" ? "Unknown" : country.toUpperCase(),
    region
  };
}

// Helper: URL & Property Sanitization
const SENSITIVE_PARAM_REGEX = /([?&])(token|password|pass|pwd|code|secret|key|auth|access_token|refresh_token|jwt|api_key)=[^&]*/gi;

export function sanitizePathname(pathname?: string): string {
  if (!pathname) return "/";
  const cleaned = pathname.replace(SENSITIVE_PARAM_REGEX, "$1$2=[REDACTED]");
  return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
}

export function sanitizeProperties(props?: Record<string, unknown>): Record<string, unknown> {
  if (!props) return {};
  const sanitized: Record<string, unknown> = {};
  const forbidden = ["password", "pass", "pwd", "token", "secret", "apiKey", "api_key", "auth", "accessToken", "refreshToken", "creditCard"];

  for (const [key, value] of Object.entries(props)) {
    if (forbidden.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 500) {
      sanitized[key] = `${value.slice(0, 500)}... (truncated)`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Helper: Traffic Source Classification
export function classifyTrafficSource(referrer?: string, utmSource?: string): { source: string; domain?: string } {
  if (utmSource) {
    const lowerUtm = utmSource.toLowerCase();
    if (lowerUtm.includes("google")) return { source: "Google" };
    if (lowerUtm.includes("reddit")) return { source: "Reddit" };
    if (lowerUtm.includes("discord")) return { source: "Discord" };
    if (lowerUtm.includes("linkedin")) return { source: "LinkedIn" };
    if (lowerUtm.includes("twitter") || lowerUtm === "x") return { source: "X/Twitter" };
    if (lowerUtm.includes("facebook")) return { source: "Facebook" };
    if (lowerUtm.includes("github")) return { source: "GitHub" };
    if (lowerUtm.includes("producthunt")) return { source: "Product Hunt" };
    return { source: utmSource };
  }

  if (!referrer || referrer.trim() === "") {
    return { source: "Direct" };
  }

  try {
    const parsed = new URL(referrer);
    const host = parsed.hostname.toLowerCase();

    if (/google\./i.test(host)) return { source: "Google", domain: host };
    if (/bing\.|duckduckgo\.|yahoo\.|baidu\.|ecosia\./i.test(host)) return { source: "Search", domain: host };
    if (/reddit\./i.test(host)) return { source: "Reddit", domain: host };
    if (/discord\./i.test(host)) return { source: "Discord", domain: host };
    if (/linkedin\.|lnkd\./i.test(host)) return { source: "LinkedIn", domain: host };
    if (/t\.co|twitter\.|x\.com/i.test(host)) return { source: "X/Twitter", domain: host };
    if (/facebook\.|fb\./i.test(host)) return { source: "Facebook", domain: host };
    if (/github\./i.test(host)) return { source: "GitHub", domain: host };
    if (/producthunt\./i.test(host)) return { source: "Product Hunt", domain: host };

    return { source: "Other Referral", domain: host };
  } catch {
    return { source: "Direct" };
  }
}
