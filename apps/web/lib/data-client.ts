import { getPlatformBaseUrl } from "@/lib/platform";
import {
  clearSessionCredentials,
  readRenewalCredential,
  readSessionCredential,
  writeSessionCredentials
} from "@/lib/session-keys";

type ApiErrorPayload = { error?: { code?: string; message?: string; correlationId?: string; retryable?: boolean } };

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "REQUEST_FAILED",
    readonly correlationId?: string,
    readonly retryable = false
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let refreshInFlight: Promise<string | undefined> | undefined;
let redirectedForAuthLoss = false;

async function renewFromIdentityProvider() {
  if (typeof window === "undefined") return undefined;
  try {
    const { renewWorkspaceSession } = await import("@/lib/session-bridge");
    const session = await renewWorkspaceSession();
    return session?.accessToken;
  } catch {
    return undefined;
  }
}

async function renewSessionOnce() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const renewal = readRenewalCredential();
    if (!renewal) return renewFromIdentityProvider();
    try {
      const response = await fetch(`${getPlatformBaseUrl()}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: renewal })
      });
      if (!response.ok) return undefined;
      const data = (await response.json()) as { accessToken?: string; refreshToken?: string; user?: { email?: string } };
      if (!data.accessToken) return undefined;
      writeSessionCredentials(data.accessToken, data.refreshToken);
      if (data.user?.email) window.localStorage.setItem("archmind.email", data.user.email);
      return data.accessToken;
    } catch {
      return undefined;
    }
  })().finally(() => { refreshInFlight = undefined; });
  return refreshInFlight;
}

function redirectToSignInOnce() {
  if (typeof window === "undefined" || redirectedForAuthLoss || window.location.pathname.startsWith("/auth/login")) return;
  redirectedForAuthLoss = true;
  clearSessionCredentials();
  const returnTo = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}

function friendlyMessage(code: string | undefined, fallback: string, status: number) {
  if (code === "AUTH_REQUIRED" || code === "UNAUTHENTICATED") return "Your session expired. Sign in again to continue.";
  if (code === "PLATFORM_STORE_UNAVAILABLE") return "The desktop build service is temporarily unavailable.";
  if (code === "MIGRATION_REQUIRED") return "The desktop build service needs a database migration.";
  if (code === "REDIS_REQUIRED") return "The desktop build worker is temporarily unavailable.";
  if (code === "INSTALLER_NOT_READY") return "The installer is still being prepared.";
  if (code === "DESKTOP_BUILD_NOT_FOUND") return "This installer is no longer available.";
  if (status >= 500) return "The service could not complete this request.";
  return fallback || "The request could not be completed.";
}

function makeHeaders(init?: RequestInit, credential = readSessionCredential()) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (credential && credential.trim()) headers.set("Authorization", `Bearer ${credential}`);
  return headers;
}

async function fetchAuthenticated(path: string, init?: RequestInit) {
  const base = getPlatformBaseUrl();
  let headers = makeHeaders(init);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { ...init, headers, cache: "no-store", credentials: "include" });
  } catch {
    throw new ApiRequestError("Network connection failed.", 0, "NETWORK_ERROR", undefined, true);
  }

  if (response.status !== 401) return response;
  const renewed = await renewSessionOnce();
  if (!renewed) {
    redirectToSignInOnce();
    return response;
  }
  headers = makeHeaders(init, renewed);
  try {
    return await fetch(`${base}${path}`, { ...init, headers, cache: "no-store", credentials: "include" });
  } catch {
    throw new ApiRequestError("Network connection failed.", 0, "NETWORK_ERROR", undefined, true);
  }
}

async function throwForResponse(response: Response): Promise<never> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  const error = payload?.error;
  throw new ApiRequestError(
    friendlyMessage(error?.code, error?.message ?? "", response.status),
    response.status,
    error?.code ?? "REQUEST_FAILED",
    error?.correlationId ?? response.headers.get("X-Correlation-Id") ?? undefined,
    Boolean(error?.retryable) || [429, 502, 503, 504].includes(response.status)
  );
}

export async function requestData<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchAuthenticated(path, init);
  if (!response.ok) return throwForResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function requestFile(path: string): Promise<{ blob: Blob; filename?: string; headers: Headers }> {
  const response = await fetchAuthenticated(path);
  if (!response.ok) return throwForResponse(response);
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return { blob: await response.blob(), filename, headers: response.headers };
}
