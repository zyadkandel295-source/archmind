import {
  readSessionCredential,
  readRenewalCredential,
  writeSessionCredentials,
} from "./session-keys";

export interface GeneratedFileView {
  id: string;
  conversationId: string;
  assistantId?: string;
  parentId?: string;
  filename: string;
  format: "pdf" | "docx" | "pptx";
  status: "queued" | "generating" | "rendering" | "completed" | "failed";
  stage: string;
  completedUnits: number;
  totalUnits: number;
  count: number;
  size: number;
  countIsEstimate?: boolean;
  error?: string;
  createdAt: string;
  request: { description: string };
}
let renewal: Promise<void> | undefined;
async function refreshFileSession() {
  if (!renewal)
    renewal = (async () => {
      const token = readRenewalCredential();
      if (!token) return;
      const response = await fetch("/api/workspace/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: token }),
      });
      if (response.ok) {
        const session = await response.json();
        writeSessionCredentials(session.accessToken, session.refreshToken);
      }
    })().finally(() => {
      renewal = undefined;
    });
  return renewal;
}
export async function fileFetch(
  route: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = readSessionCredential();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api/workspace${route}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (response.status === 401 && retry && readRenewalCredential()) {
    await refreshFileSession();
    return fileFetch(route, init, false);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.error?.message || "The file request failed. Please try again.",
    );
  }
  return response;
}
