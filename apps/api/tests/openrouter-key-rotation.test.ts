import { describe, expect, it, vi } from "vitest";
import type { Env } from "../src/config/env";
import { generateAiResponse } from "../src/services/ai-service";

const env: Env = {
  nodeEnv: "test", appUrl: "http://localhost:3000", port: 4000, corsOrigin: "*",
  jwtAccessSecret: "test-access-secret-32-chars-long-key!!", jwtRefreshSecret: "test-refresh-secret-32-chars-long-key!",
  jwtAccessTtl: "15m", jwtRefreshTtl: "7d", demoAuth: false,
  googleCallbackUrl: "http://localhost:4000/api/auth/google/callback",
  llmProvider: "openrouter", openrouterApiKey: "primary-test-key", openrouterApiKeys: ["backup-test-key"],
  openrouterDefaultModel: "openai/gpt-4o-mini", enableAnswerVerification: false, verifyMath: false, verifyCode: false,
  verifyResearch: false, notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

describe("OpenRouter key rotation", () => {
  it("moves to the next key after a rate-limit response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429, headers: { "retry-after": "60" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "Recovered answer" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateAiResponse({ env, userMessage: "Hello" })).resolves.toBe("Recovered answer");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer primary-test-key");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer backup-test-key");
    vi.unstubAllGlobals();
  });
});
