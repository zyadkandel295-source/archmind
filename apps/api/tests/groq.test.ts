import { describe, it, expect } from "vitest";
import request from "supertest";
import type { Env } from "../src/config/env";
import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/memory";
import { AI_PROVIDERS_UNAVAILABLE_MESSAGE, chooseAiModel, generateAiResponse, detectTaskType } from "../src/services/ai-service";

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
  llmProvider: "under_development",
  openrouterApiKey: "",
  openrouterDefaultModel: "",
  enableAnswerVerification: false,
  verifyMath: false,
  verifyCode: false,
  verifyResearch: false,
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

describe("AI Engine & Service", () => {
  describe("Task Detection", () => {
    it("detects task types from prompt strings", () => {
      expect(detectTaskType("calculate integral")).toBe("math");
      expect(detectTaskType("write python function")).toBe("coding");
      expect(detectTaskType("hello world")).toBe("normal");
    });
  });

  it("routes the retired Groq model alias through the configured OpenRouter default", () => {
    const choice = chooseAiModel("Hello AI", { ...testEnv, openrouterDefaultModel: "qwen/qwen3-coder" }, { model: "llama-3.1-8b-instant" });
    expect(choice.model).toBe("qwen/qwen3-coder");
  });

  describe("Assistant service fallback", () => {
    it("returns a service-unavailable message when generating a response", async () => {
      const response = await generateAiResponse({
        env: testEnv,
        userMessage: "Hello AI"
      });
      expect(response).toBe(AI_PROVIDERS_UNAVAILABLE_MESSAGE);
    });

    it("returns 503 ASSISTANT_UNAVAILABLE on POST /api/ai/chat", async () => {
      const store = new MemoryStore();
      const app = createApp({ env: testEnv, store, platformStore: store }).app;

      const res = await request(app)
        .post("/api/ai/chat")
        .send({
          userId: "api_user",
          message: "Explain recursion in python"
        })
        .expect(503);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe("ASSISTANT_UNAVAILABLE");
      expect(res.body.message).toBe(AI_PROVIDERS_UNAVAILABLE_MESSAGE);
    });
  });
});
