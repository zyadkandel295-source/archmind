import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { GroqService, resetCreditStore, getUserCredits, deductUserCredits, setUserCredits } from "../src/services/groq-service";
import type { Env } from "../src/config/env";
import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/memory";

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
  llmProvider: "groq",
  groqApiKey: "gsk_mockKey1_1234567890abcdef1234567890",
  groqApiKeys: [
    "gsk_mockKey1_1234567890abcdef1234567890",
    "gsk_mockKey2_1234567890abcdef1234567890",
    "gsk_mockKey3_1234567890abcdef1234567890",
    "gsk_mockKey4_1234567890abcdef1234567890",
    "gsk_mockKey5_1234567890abcdef1234567890"
  ],
  groqDefaultModel: "llama-3.1-8b-instant",
  groqCodingModel: "qwen/qwen3-32b",
  groqMathModel: "openai/gpt-oss-120b",
  groqVisionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
  groqFallbackModel: "llama-3.3-70b-versatile",
  enableAnswerVerification: false,
  verifyMath: false,
  verifyCode: false,
  verifyResearch: false,
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

function mockGroqFetchSuccess(answer = "Hello from Groq!") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: answer } }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    })
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  resetCreditStore();
});

describe("Groq AI Engine & Service", () => {
  describe("Request Classification", () => {
    const service = new GroqService(testEnv);

    it("classifies normal_chat requests", () => {
      expect(service.classifyRequest({ message: "Hello, how are you?" })).toBe("normal_chat");
    });

    it("classifies coding requests", () => {
      expect(service.classifyRequest({ message: "Can you fix this function and debug the typescript code?" })).toBe("coding");
      expect(service.classifyRequest({ message: "```js\nconsole.log(1);\n```" })).toBe("coding");
    });

    it("classifies math requests", () => {
      expect(service.classifyRequest({ message: "Calculate the integral \\int x^2 dx and solve equation" })).toBe("math");
    });

    it("classifies vision requests", () => {
      expect(service.classifyRequest({ message: "What is in this picture?", imageUrl: "https://example.com/image.png" })).toBe("vision");
    });

    it("classifies file_text_analysis requests", () => {
      expect(service.classifyRequest({ message: "Analyze document", fileText: "Sample file content" })).toBe("file_text_analysis");
    });

    it("respects explicit request types", () => {
      expect(service.classifyRequest({ message: "Solve 2+2", type: "coding" })).toBe("coding");
    });
  });

  describe("Model Routing & Fallbacks", () => {
    const service = new GroqService(testEnv);

    it("routes normal_chat to default model with coding fallback", () => {
      const chain = service.getModelChain("normal_chat");
      expect(chain[0]).toBe("llama-3.1-8b-instant");
      expect(chain[1]).toBe("qwen/qwen3-32b");
    });

    it("routes coding to coding model with versatile fallback", () => {
      const chain = service.getModelChain("coding");
      expect(chain[0]).toBe("qwen/qwen3-32b");
      expect(chain[1]).toBe("llama-3.3-70b-versatile");
    });

    it("routes math to math model with fallbacks", () => {
      const chain = service.getModelChain("math");
      expect(chain[0]).toBe("openai/gpt-oss-120b");
      expect(chain[1]).toBe("qwen/qwen3-32b");
      expect(chain[2]).toBe("llama-3.3-70b-versatile");
    });

    it("routes vision to vision model", () => {
      const chain = service.getModelChain("vision");
      expect(chain[0]).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    });

    it("routes file_text_analysis to fallback model", () => {
      const chain = service.getModelChain("file_text_analysis");
      expect(chain[0]).toBe("llama-3.3-70b-versatile");
    });
  });

  describe("5-Key Rotation & 429 Failover Loop", () => {
    it("cycles through Groq API keys when 429 rate limit is encountered", async () => {
      const service = new GroqService(testEnv);
      const usedKeys: string[] = [];

      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: string, init?: RequestInit) => {
          const authHeader = (init?.headers as Record<string, string>)?.[
            "Authorization"
          ];
          if (authHeader) {
            usedKeys.push(authHeader.replace("Bearer ", ""));
          }
          if (usedKeys.length < 3) {
            return new Response(JSON.stringify({ error: { message: "Rate limit exceeded" } }), { status: 429 });
          }
          return new Response(JSON.stringify({ choices: [{ message: { content: "Success after rotation!" } }] }), { status: 200 });
        })
      );

      const result = await service.chat({ userId: "rotation_user", message: "Test rotation" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.answer).toBe("Success after rotation!");
      }
      expect(usedKeys.length).toBeGreaterThanOrEqual(3);
      // Ensure different keys from testEnv.groqApiKeys were used
      expect(usedKeys[0]).not.toBe(usedKeys[1]);
    });
  });

  describe("User Daily Credit System", () => {
    it("deducts correct credits per task type", async () => {
      const service = new GroqService(testEnv);
      mockGroqFetchSuccess("Response 1");

      const res1 = await service.chat({ userId: "credit_test_user", message: "Hi", type: "normal_chat" });
      expect(res1.success).toBe(true);
      if (res1.success) {
        expect(res1.creditsUsed).toBe(1);
        expect(res1.remainingCredits).toBe(49);
      }

      const res2 = await service.chat({ userId: "credit_test_user", message: "Write python code", type: "coding" });
      expect(res2.success).toBe(true);
      if (res2.success) {
        expect(res2.creditsUsed).toBe(2);
        expect(res2.remainingCredits).toBe(47);
      }
    });

    it("rejects requests when user has insufficient credits", async () => {
      const service = new GroqService(testEnv);
      setUserCredits("broke_user", 0);

      const res = await service.chat({ userId: "broke_user", message: "Hi" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorCode).toBe("NO_CREDITS");
      }
    });
  });

  describe("Server Errors & Missing Keys", () => {
    it("returns SERVER_ERROR if no Groq API key is configured", async () => {
      const emptyEnv = { ...testEnv, groqApiKey: undefined, groqApiKeys: [] };
      const service = new GroqService(emptyEnv);
      const res = await service.chat({ userId: "u1", message: "test" });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.errorCode).toBe("SERVER_ERROR");
        expect(res.message).toContain("GROQ_API_KEY");
      }
    });
  });

  describe("POST /api/ai/chat Endpoint", () => {
    it("handles valid chat request over HTTP API", async () => {
      mockGroqFetchSuccess("Backend Groq Response");
      const store = new MemoryStore();
      const app = createApp({ env: testEnv, store, platformStore: store }).app;

      const res = await request(app)
        .post("/api/ai/chat")
        .send({
          userId: "api_user",
          message: "Explain recursion in python",
          type: "coding"
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.modelUsed).toBe("qwen/qwen3-32b");
      expect(res.body.requestType).toBe("coding");
      expect(res.body.answer).toBe("Backend Groq Response");
      expect(res.body.creditsUsed).toBe(2);
    });

    it("returns 402 status when user has NO_CREDITS", async () => {
      setUserCredits("api_broke_user", 0);
      const store = new MemoryStore();
      const app = createApp({ env: testEnv, store, platformStore: store }).app;

      const res = await request(app)
        .post("/api/ai/chat")
        .send({
          userId: "api_broke_user",
          message: "Hello",
          type: "normal_chat"
        })
        .expect(402);

      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe("NO_CREDITS");
    });
  });
});
