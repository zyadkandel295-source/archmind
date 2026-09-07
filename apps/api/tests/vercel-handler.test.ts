import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers = new Map<string, string>();
  body = "";

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  end(value?: string) {
    if (value) this.body += value;
    this.emit("finish");
  }
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("../src/app");
  vi.unstubAllEnvs();
});

describe("Vercel serverless handler", () => {
  it("redirects Google sign-in to the app when API boot config is broken", async () => {
    vi.stubEnv("APP_URL", "https://archmind.vercel.app");
    vi.doMock("../src/app", () => ({
      createApp: () => {
        throw new Error("Production requires DATABASE_URL");
      },
    }));

    const { default: handler } = await import("../api/index");
    const response = new MockResponse();

    await handler({ url: "/api/auth/google?state=%2Fprofile" }, response);

    expect(response.statusCode).toBe(302);
    const location = new URL(response.headers.get("location")!);
    expect(location.origin).toBe("https://archmind.vercel.app");
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("error")).toBe("server_config");
    expect(location.searchParams.get("returnTo")).toBe("/profile");
  });

  it("returns an actionable JSON error when API boot fails on ordinary routes", async () => {
    vi.doMock("../src/app", () => ({
      createApp: () => {
        throw new Error("JWT_ACCESS_SECRET must be set");
      },
    }));

    const { default: handler } = await import("../api/index");
    const response = new MockResponse();

    await handler({ url: "/api/health" }, response);

    expect(response.statusCode).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(response.body).error.code).toBe("API_BOOT_FAILED");
  });
});
