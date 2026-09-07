import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../../web/app/api/workspace/[...path]/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const req = (route: string, method = "GET", body?: string) =>
  new Request(`https://workspace.example/api/workspace/${route}`, {
    method,
    headers: {
      Authorization: "Bearer test-session",
      "Content-Type": "application/json",
    },
    ...(body ? { body } : {}),
  });
const context = (...path: string[]) => ({ params: { path } });
describe("same-origin chat and file relay", () => {
  it("streams an actual upstream binary without CORS or content-length assumptions", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.example");
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const upstream = vi
      .fn()
      .mockResolvedValue(
        new Response(bytes, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=Guide.pdf",
            "Content-Length": "999",
          },
        }),
      );
    vi.stubGlobal("fetch", upstream);
    const result = await GET(
      req("files/abc/download?inline=true"),
      context("files", "abc", "download"),
    );
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes);
    expect(result.headers.get("Content-Disposition")).toContain("Guide.pdf");
    expect(result.headers.get("Content-Length")).toBeNull();
    expect(String(upstream.mock.calls[0]![0])).toBe(
      "https://api.example/api/files/abc/download?inline=true",
    );
    expect(upstream.mock.calls[0]![1].headers.get("authorization")).toBe(
      "Bearer test-session",
    );
  });
  it("preserves SSE and backend setup errors", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.example");
    const stream = 'event: token\ndata: {"token":"hello"}\n\n';
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
          }),
        )
        .mockResolvedValueOnce(
          Response.json(
            {
              error: {
                code: "FILES_MIGRATION_REQUIRED",
                message: "Apply migration 016",
              },
            },
            { status: 503 },
          ),
        ),
    );
    expect(
      await (await POST(req("chat", "POST", "{}"), context("chat"))).text(),
    ).toBe(stream);
    const failed = await POST(
      req("files/generate", "POST", "{}"),
      context("files", "generate"),
    );
    expect(failed.status).toBe(503);
    expect((await failed.json()).error.code).toBe("FILES_MIGRATION_REQUIRED");
  });
  it("turns connection failure into an actionable JSON error", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.example");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const response = await POST(req("chat", "POST", "{}"), context("chat"));
    expect(response.status).toBe(502);
    expect((await response.json()).error.message).toContain(
      "could not be reached",
    );
  });
  it("rejects arbitrary destinations, unauthenticated requests, redirects and relay loops", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("API_INTERNAL_URL", "https://workspace.example");
    expect((await GET(req("admin"), context("admin"))).status).toBe(404);
    expect(
      (
        await GET(
          new Request("https://workspace.example/api/workspace/files"),
          context("files"),
        )
      ).status,
    ).toBe(401);
    expect((await GET(req("files"), context("files"))).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("API_INTERNAL_URL", "https://api.example");
    fetcher.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://another.example" },
      }),
    );
    expect((await GET(req("files"), context("files"))).status).toBe(502);
  });
  it("starts Google auth without a bearer token and passes through the provider redirect", async () => {
    vi.stubEnv("API_INTERNAL_URL", "https://api.example");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { Location: "https://accounts.google.com/o/oauth2/v2/auth?state=%2Fprofile" },
      }),
    );
    vi.stubGlobal("fetch", fetcher);

    const response = await GET(
      new Request("https://workspace.example/api/workspace/auth/google?state=%2Fprofile"),
      context("auth", "google"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("accounts.google.com");
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.example/api/auth/google?state=%2Fprofile");
  });
});
