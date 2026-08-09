import { describe, it, expect } from "vitest";
import { routeRequest, OpenRouterService, TEXT_MODEL_PRIMARY, VISION_MODEL_PRIMARY } from "../src/services/openrouter-service";
import type { Env } from "../src/config/env";

const testEnv: Env = {
  nodeEnv: "test",
  appUrl: "http://localhost:3000",
  port: 4000,
  corsOrigin: "*",
  platformStore: "memory",
  databaseUrl: undefined,
  jwtAccessSecret: "test-access-secret-32-chars-long-key!!",
  jwtRefreshSecret: "test-refresh-secret-32-chars-long-key!",
  jwtAccessTtl: "15m",
  jwtRefreshTtl: "7d",
  demoAuth: false,
  googleCallbackUrl: "http://localhost:4000/api/auth/google/callback",
  llmProvider: "openrouter",
  openrouterApiKey: "sk-or-v1-mock-test-key-1234567890",
  openrouterDefaultModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
  enableAnswerVerification: false,
  verifyMath: false,
  verifyCode: false,
  verifyResearch: false,
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

describe("Dynamic OpenRouter Model Router", () => {
  it("routes text queries to NVIDIA NEMOTRON 3 ULTRA", () => {
    const decision = routeRequest({ message: "Explain quantum computing fundamentals" });
    expect(decision.selected_model).toBe(TEXT_MODEL_PRIMARY);
    expect(decision.is_vision).toBe(false);
    expect(decision.routing_reason).toContain("NVIDIA Nemotron 3 Ultra");
  });

  it("routes requests with images to GOOGLE GEMMA 4 31B", () => {
    const decision = routeRequest({
      message: "Analyze this image",
      imageUrl: "https://example.com/diagram.png"
    });
    expect(decision.selected_model).toBe(VISION_MODEL_PRIMARY);
    expect(decision.is_vision).toBe(true);
    expect(decision.routing_reason).toContain("Google Gemma 4 31B");
  });

  it("instantiates OpenRouterService cleanly", () => {
    const service = new OpenRouterService(testEnv);
    expect(service).toBeDefined();
  });
});
