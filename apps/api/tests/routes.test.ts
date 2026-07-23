import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import { generateAssistantOpeningExperience } from "@archmind/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/config/env";

const testEnv: Env = {
  nodeEnv: "test",
  appUrl: "http://localhost:3000",
  port: 4000,
  corsOrigin: "http://localhost:3000",
  jwtAccessSecret: "test-access",
  jwtRefreshSecret: "test-refresh",
  jwtAccessTtl: "15m",
  jwtRefreshTtl: "7d",
  demoAuth: false,
  googleCallbackUrl: "http://localhost:4000/api/auth/google/callback",
  llmProvider: "openrouter",
  openRouterApiKey: "test-openrouter-key",
  openRouterDefaultModel: "openrouter/auto",
  openRouterReasoningModel: "deepseek/deepseek-r1:free",
  openRouterCodingModel: "deepseek/deepseek-chat-v3-0324:free",
  openRouterVerifierModel: "openrouter/auto",
  enableAnswerVerification: false,
  verifyMath: true,
  verifyCode: true,
  verifyResearch: true,
  notionClientId: "mock-notion-client-id",
  notionClientSecret: "mock-notion-client-secret",
  notionRedirectUri: "http://localhost:4000/api/auth/notion/callback"
};

function makeApp() {
  return createApp({ env: testEnv }).app;
}

async function register(app: ReturnType<typeof makeApp>, email: string) {
  const response = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123", confirmPassword: "password123" })
    .expect(201);
  return response.body.accessToken as string;
}

async function createAssistant(app: ReturnType<typeof makeApp>, token: string, overrides: Record<string, unknown> = {}) {
  const response = await request(app)
    .post("/api/assistants")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "Test Assistant",
      description: "A test assistant",
      systemPrompt: "You are a test assistant. Always answer with the exact behavior requested by your instructions.",
      tone: "professional",
      isPublic: false,
      model: "openrouter/auto",
      temperature: 0.2,
      ...overrides
    })
    .expect(201);
  return response.body.assistant as { id: string; systemPrompt: string; model: string };
}

function mockOpenRouter(content = "ok") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 }))
  );
}

function extractConversationId(sseText: string) {
  const match = sseText.match(/"conversationId":"([^"]+)"/);
  expect(match?.[1]).toEqual(expect.any(String));
  return match![1]!;
}

function makePdfBuffer(text: string) {
  const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const stream = `BT\n/F1 24 Tf\n72 720 Td\n(${escaped}) Tj\nET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

async function waitForKnowledgeStatus(
  app: ReturnType<typeof makeApp>,
  token: string,
  assistantId: string,
  fileId: string,
  terminal: Array<"ready" | "failed"> = ["ready"]
) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await request(app)
      .get(`/api/assistants/${assistantId}/knowledge/${fileId}/status`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    if (terminal.includes(response.body.status)) return response.body as {
      fileId: string;
      status: "processing" | "ready" | "failed";
      chunks: number;
      textLength: number;
      errorMessage?: string;
    };
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error("Knowledge file did not reach a terminal status");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("ArchMind API", () => {
  describe("Google OAuth handoff", () => {
    it("redirects with a single-use handoff code instead of tokens", async () => {
      const app = createApp({
        env: {
          ...testEnv,
          googleClientId: "google-client",
          googleClientSecret: "google-secret"
        }
      }).app;

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ access_token: "google-access", refresh_token: "google-refresh", expires_in: 3600 }), {
              status: 200
            })
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ sub: "google-user-1", email: "google@example.com", email_verified: true }), {
              status: 200
            })
          )
      );

      const callback = await request(app)
        .get("/api/auth/google/callback?code=mock-code&state=%2Fdashboard")
        .expect(302);

      const redirectUrl = new URL(callback.headers.location);
      expect(redirectUrl.pathname).toBe("/auth/login");
      expect(redirectUrl.searchParams.get("accessToken")).toBeNull();
      expect(redirectUrl.searchParams.get("refreshToken")).toBeNull();
      expect(redirectUrl.searchParams.get("handoff")).toEqual(expect.any(String));
      expect(redirectUrl.searchParams.get("returnTo")).toBe("/dashboard");

      const code = redirectUrl.searchParams.get("handoff")!;
      const exchange = await request(app).post("/api/auth/handoff/exchange").send({ code }).expect(200);
      expect(exchange.body.accessToken).toEqual(expect.any(String));
      expect(exchange.body.refreshToken).toEqual(expect.any(String));
      expect(exchange.body.user.email).toBe("google@example.com");

      await request(app).post("/api/auth/handoff/exchange").send({ code }).expect(400);
    });
  });

  describe("Assistant opening experience", () => {
    it("generates a useful fallback for an assistant with name only", () => {
      const opening = generateAssistantOpeningExperience({ name: "Helper" });
      expect(opening.greeting).toContain("Helper");
      expect(opening.recommendedMessages).toHaveLength(4);
      expect(opening.recommendedMessages).toContain("How can you help me?");
    });

    it("generates math-specific greeting and recommendations", () => {
      const opening = generateAssistantOpeningExperience({
        name: "Math Tutor",
        instructions: "Help students solve math problems step by step and explain mistakes clearly."
      });
      expect(opening.greeting).toContain("Math Tutor");
      expect(opening.greeting.toLowerCase()).toContain("math");
      expect(opening.recommendedMessages.join(" ")).toContain("practice question");
      expect(opening.recommendedMessages.join(" ")).toContain("Check my solution");
    });

    it("prioritizes custom starter prompts", () => {
      const opening = generateAssistantOpeningExperience({
        name: "Planner",
        instructions: "Help plan projects.",
        starterPrompts: ["Plan my week.", "Prioritize these tasks.", "Turn this into milestones."]
      });
      expect(opening.recommendedMessages.slice(0, 3)).toEqual([
        "Plan my week.",
        "Prioritize these tasks.",
        "Turn this into milestones."
      ]);
    });

    it("handles long, Arabic, coding, and customer support instructions", () => {
      const longOpening = generateAssistantOpeningExperience({
        name: "Research Assistant",
        instructions: "Help summarize papers, compare sources, and extract key ideas. ".repeat(20)
      });
      expect(longOpening.recommendedMessages).toContain("Summarize this document.");

      const arabicOpening = generateAssistantOpeningExperience({
        name: "المساعد",
        instructions: "ساعد المستخدمين في شرح الدروس وتلخيص النصوص باللغة العربية."
      });
      expect(arabicOpening.recommendedMessages.some((message) => /[\u0600-\u06ff]/.test(message))).toBe(true);

      const codingOpening = generateAssistantOpeningExperience({
        name: "CODER",
        instructions: "Help debug code, explain errors, and build full-stack app features."
      });
      expect(codingOpening.greeting).toContain("CODER");
      expect(codingOpening.recommendedMessages).toContain("Help me debug this error.");

      const supportOpening = generateAssistantOpeningExperience({
        name: "Support Bot",
        instructions: "Answer customer questions politely using company knowledge."
      });
      expect(supportOpening.recommendedMessages).toContain("Draft a support reply.");
    });
  });

  it("exposes OpenRouter-only health metadata", async () => {
    const response = await request(makeApp()).get("/api/health").expect(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.dependencies.llmProvider).toBe("openrouter");
    expect(response.body.dependencies.openRouter).toBe(true);
  });

  it("blocks unauthenticated assistant access", async () => {
    await request(makeApp()).get("/api/assistants").expect(401);
  });

  it("logs in the seeded demo user only with credentials", async () => {
    const response = await request(makeApp())
      .post("/api/auth/login")
      .send({ email: "demo@archmind.dev", password: "password123" })
      .expect(200);

    expect(response.body.user.email).toBe("demo@archmind.dev");
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it("registers a user with password confirmation", async () => {
    const response = await request(makeApp())
      .post("/api/auth/register")
      .send({ email: "new-user@archmind.dev", password: "password123", confirmPassword: "password123" })
      .expect(201);

    expect(response.body.user.email).toBe("new-user@archmind.dev");
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it("creates, edits, duplicates, and deletes an assistant", async () => {
    const app = makeApp();
    const token = await register(app, "crud-user@archmind.dev");
    const assistant = await createAssistant(app, token);

    const edited = await request(app)
      .put(`/api/assistants/${assistant.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Edited Assistant", icon: "Brain", color: "#14b8a6" })
      .expect(200);
    expect(edited.body.assistant.name).toBe("Edited Assistant");

    const duplicate = await request(app)
      .post(`/api/assistants/${assistant.id}/duplicate`)
      .set("Authorization", `Bearer ${token}`)
      .expect(201);
    expect(duplicate.body.assistant.name).toContain("Copy");

    await request(app).delete(`/api/assistants/${assistant.id}`).set("Authorization", `Bearer ${token}`).expect(204);
  });

  it("does not let one user delete another user's assistant", async () => {
    const app = makeApp();
    const ownerToken = await register(app, "owner@archmind.dev");
    const otherToken = await register(app, "other@archmind.dev");
    const assistant = await createAssistant(app, ownerToken);

    await request(app).delete(`/api/assistants/${assistant.id}`).set("Authorization", `Bearer ${otherToken}`).expect(404);
  });

  it("includes assistant instructions in the OpenRouter system message", async () => {
    const app = makeApp();
    const token = await register(app, "chat-user@archmind.dev");
    const assistant = await createAssistant(app, token, {
      systemPrompt: "You are ChefBot. Every answer must mention saffron once."
    });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[0].content).toContain("ChefBot");
      return new Response(JSON.stringify({ choices: [{ message: { content: "Use saffron carefully." } }] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post(`/api/assistants/${assistant.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "What should I cook?" })
      .expect(200);

    expect(response.text).toContain("Use saffron carefully.");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("routes math to the reasoning model and code to the coding model", async () => {
    const app = makeApp();
    const token = await register(app, "routing-user@archmind.dev");
    const models: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        models.push(body.model);
        return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
      })
    );

    await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "Solve this integral: integral of x dx" }] })
      .expect(200);

    await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "Fix this React TypeScript error" }] })
      .expect(200);

    expect(models).toContain("deepseek/deepseek-r1:free");
    expect(models).toContain("deepseek/deepseek-chat-v3-0324:free");
  });

  it("returns a clean invalid assistant error", async () => {
    const app = makeApp();
    const token = await register(app, "missing-assistant@archmind.dev");
    const response = await request(app)
      .post("/api/assistants/not-real/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Hello" })
      .expect(404);

    expect(response.body.error.message).toContain("Assistant not found");
  });

  it("Assistant A chat does not appear in Assistant B", async () => {
    const app = makeApp();
    const token = await register(app, "isolation-a@archmind.dev");
    const assistantA = await createAssistant(app, token, { name: "Assistant A" });
    const assistantB = await createAssistant(app, token, { name: "Assistant B" });
    mockOpenRouter("answer A");

    await request(app)
      .post(`/api/assistants/${assistantA.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Hello from A" })
      .expect(200);

    const aConversations = await request(app)
      .get(`/api/assistants/${assistantA.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const bConversations = await request(app)
      .get(`/api/assistants/${assistantB.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(aConversations.body.conversations).toHaveLength(1);
    expect(aConversations.body.conversations[0].assistantId).toBe(assistantA.id);
    expect(bConversations.body.conversations).toHaveLength(0);
  });

  it("Assistant B chat does not appear in Assistant A", async () => {
    const app = makeApp();
    const token = await register(app, "isolation-b@archmind.dev");
    const assistantA = await createAssistant(app, token, { name: "Assistant A" });
    const assistantB = await createAssistant(app, token, { name: "Assistant B" });
    mockOpenRouter("answer B");

    await request(app)
      .post(`/api/assistants/${assistantB.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Hello from B" })
      .expect(200);

    const aConversations = await request(app)
      .get(`/api/assistants/${assistantA.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const bConversations = await request(app)
      .get(`/api/assistants/${assistantB.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(aConversations.body.conversations).toHaveLength(0);
    expect(bConversations.body.conversations).toHaveLength(1);
    expect(bConversations.body.conversations[0].assistantId).toBe(assistantB.id);
  });

  it("rejects sending to a conversation under a different assistant", async () => {
    const app = makeApp();
    const token = await register(app, "cross-conversation@archmind.dev");
    const assistantA = await createAssistant(app, token, { name: "Assistant A" });
    const assistantB = await createAssistant(app, token, { name: "Assistant B" });
    mockOpenRouter("answer A");

    const first = await request(app)
      .post(`/api/assistants/${assistantA.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Create conversation A" })
      .expect(200);
    const conversationId = extractConversationId(first.text);

    const response = await request(app)
      .post(`/api/assistants/${assistantB.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Try to reuse A conversation", conversationId })
      .expect(403);

    expect(response.body.error.message).toContain("another assistant");
  });

  it("New Chat creates a conversation with the correct assistantId", async () => {
    const app = makeApp();
    const token = await register(app, "new-chat@archmind.dev");
    const assistant = await createAssistant(app, token);
    mockOpenRouter("new answer");

    const response = await request(app)
      .post(`/api/assistants/${assistant.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "This is a new chat" })
      .expect(200);
    const conversationId = extractConversationId(response.text);

    const conversations = await request(app)
      .get(`/api/assistants/${assistant.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(conversations.body.conversations[0].id).toBe(conversationId);
    expect(conversations.body.conversations[0].assistantId).toBe(assistant.id);
  });

  it("sidebar conversation endpoint filters by assistantId", async () => {
    const app = makeApp();
    const token = await register(app, "sidebar-filter@archmind.dev");
    const assistantA = await createAssistant(app, token, { name: "Sidebar A" });
    const assistantB = await createAssistant(app, token, { name: "Sidebar B" });
    mockOpenRouter("sidebar answer");

    await request(app)
      .post(`/api/assistants/${assistantA.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "A sidebar item" })
      .expect(200);
    await request(app)
      .post(`/api/assistants/${assistantB.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "B sidebar item" })
      .expect(200);

    const aSidebar = await request(app)
      .get(`/api/assistants/${assistantA.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const bSidebar = await request(app)
      .get(`/api/assistants/${assistantB.id}/conversations`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(aSidebar.body.conversations).toHaveLength(1);
    expect(bSidebar.body.conversations).toHaveLength(1);
    expect(aSidebar.body.conversations[0].assistantId).toBe(assistantA.id);
    expect(bSidebar.body.conversations[0].assistantId).toBe(assistantB.id);
    expect(aSidebar.body.conversations[0].messages[0].content).toBe("A sidebar item");
    expect(bSidebar.body.conversations[0].messages[0].content).toBe("B sidebar item");
  });

  it("returns assistant opening content from assistant config", async () => {
    const app = makeApp();
    const token = await register(app, "opening-api@archmind.dev");
    const assistant = await createAssistant(app, token, {
      name: "CODER",
      systemPrompt: "Help debug code, explain errors, and build full-stack app features.",
      starterPrompts: []
    });

    const response = await request(app)
      .get(`/api/assistants/${assistant.id}`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.openingExperience.greeting).toContain("CODER");
    expect(response.body.openingExperience.recommendedMessages).toContain("Help me debug this error.");
  });

  describe("Assistant knowledge files", () => {
    it("returns 401 when uploading knowledge without auth", async () => {
      const app = makeApp();
      await request(app)
        .post("/api/assistants/not-real/knowledge/upload")
        .attach("file", Buffer.from("private notes"), "notes.txt")
        .expect(401);
    });

    it("does not allow uploading knowledge to another user's assistant", async () => {
      const app = makeApp();
      const ownerToken = await register(app, "knowledge-owner@archmind.dev");
      const otherToken = await register(app, "knowledge-other@archmind.dev");
      const assistant = await createAssistant(app, ownerToken);

      await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${otherToken}`)
        .attach("file", Buffer.from("private notes"), "notes.txt")
        .expect(404);
    });

    it("rejects unsupported and oversized knowledge files", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-validation@archmind.dev");
      const assistant = await createAssistant(app, token);

      const unsupported = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("binary"), "malware.exe")
        .expect(400);
      expect(unsupported.body.error.message).toContain("Unsupported file type");

      const oversized = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.alloc(15 * 1024 * 1024 + 1), "huge.txt")
        .expect(413);
      expect(oversized.body.error.message).toContain("File is too large");
    });

    it("stores, extracts, lists, and deletes a TXT knowledge file", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-txt@archmind.dev");
      const assistant = await createAssistant(app, token);

      const upload = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("Algebra chapter two explains quadratic equations."), "algebra-notes.txt")
        .expect(201);
      expect(upload.body.status).toBe("processing");

      const ready = await waitForKnowledgeStatus(app, token, assistant.id, upload.body.fileId);
      expect(ready.status).toBe("ready");
      expect(ready.chunks).toBeGreaterThan(0);
      expect(ready.textLength).toBeGreaterThan(20);

      const list = await request(app)
        .get(`/api/assistants/${assistant.id}/knowledge`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(list.body.files[0].filename).toBe("algebra-notes.txt");
      expect(list.body.files[0].status).toBe("ready");

      await request(app)
        .delete(`/api/assistants/${assistant.id}/knowledge/${upload.body.fileId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
      const afterDelete = await request(app)
        .get(`/api/assistants/${assistant.id}/knowledge`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(afterDelete.body.files).toHaveLength(0);
    });

    it("extracts PDF and DOCX knowledge files", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-docs@archmind.dev");
      const assistant = await createAssistant(app, token);

      const pdf = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", makePdfBuffer("ArchMind PDF extraction phrase"), "notes.pdf")
        .expect(201);
      const pdfReady = await waitForKnowledgeStatus(app, token, assistant.id, pdf.body.fileId);
      expect(pdfReady.status).toBe("ready");
      expect(pdfReady.textLength).toBeGreaterThan(20);

      const docxPath = path.resolve(process.cwd(), "..", "..", "node_modules", "mammoth", "test", "test-data", "single-paragraph.docx");
      const docx = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", fs.readFileSync(docxPath), "single-paragraph.docx")
        .expect(201);
      const docxReady = await waitForKnowledgeStatus(app, token, assistant.id, docx.body.fileId);
      expect(docxReady.status).toBe("ready");
      expect(docxReady.textLength).toBeGreaterThan(10);
    });

    it("marks parsing failures as failed", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-failed@archmind.dev");
      const assistant = await createAssistant(app, token);

      const upload = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("not a real pdf"), "broken.pdf")
        .expect(201);
      const failed = await waitForKnowledgeStatus(app, token, assistant.id, upload.body.fileId, ["failed"]);
      expect(failed.status).toBe("failed");
      expect(failed.errorMessage).toEqual(expect.any(String));
    });

    it("uses uploaded knowledge during assistant chat", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-chat@archmind.dev");
      const assistant = await createAssistant(app, token);
      const uniqueFact = "The launch code is RIVER-DELTA-42.";

      const upload = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from(uniqueFact), "launch.md")
        .expect(201);
      await waitForKnowledgeStatus(app, token, assistant.id, upload.body.fileId);

      const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(JSON.stringify(body.messages)).toContain(uniqueFact);
        return new Response(JSON.stringify({ choices: [{ message: { content: "The launch code is RIVER-DELTA-42." } }] }), { status: 200 });
      });
      vi.stubGlobal("fetch", fetchMock);

      const response = await request(app)
        .post(`/api/assistants/${assistant.id}/chat`)
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "What is the launch code?" })
        .expect(200);

      expect(response.text).toContain("RIVER-DELTA-42");
      expect(response.text).toContain("launch.md");
    });

    it("sanitizes path traversal filenames", async () => {
      const app = makeApp();
      const token = await register(app, "knowledge-path@archmind.dev");
      const assistant = await createAssistant(app, token);

      const upload = await request(app)
        .post(`/api/assistants/${assistant.id}/knowledge/upload`)
        .set("Authorization", `Bearer ${token}`)
        .attach("file", Buffer.from("safe path traversal content"), "../../secret.txt")
        .expect(201);
      await waitForKnowledgeStatus(app, token, assistant.id, upload.body.fileId);

      const list = await request(app)
        .get(`/api/assistants/${assistant.id}/knowledge`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(list.body.files[0].filename).toBe("secret.txt");
      expect(JSON.stringify(list.body.files[0])).not.toContain("..");
      expect(JSON.stringify(list.body.files[0])).not.toContain("storage");
    });
  });



  describe("Notion Integration", () => {
    it("returns 401 when accessing Notion status without token", async () => {
      await request(makeApp()).get("/api/auth/notion/status").expect(401);
    });

    it("returns connected: false when Notion is not connected", async () => {
      const app = makeApp();
      const token = await register(app, "notion-test-1@archmind.dev");
      const statusRes = await request(app)
        .get("/api/auth/notion/status")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(statusRes.body.connected).toBe(false);
    });

    it("starts OAuth flow by redirecting to Notion with state parameter", async () => {
      const app = makeApp();
      const token = await register(app, "notion-test-2@archmind.dev");
      const response = await request(app)
        .get("/api/auth/notion?token=" + encodeURIComponent(token))
        .expect(302);
      
      const redirectUrl = response.headers.location;
      expect(redirectUrl).toContain("api.notion.com/v1/oauth/authorize");
      expect(redirectUrl).toContain("client_id=");
      expect(redirectUrl).toContain("state=");
    });

    it("rejects callback with invalid state parameter", async () => {
      const response = await request(makeApp())
        .get("/api/auth/notion/callback?code=mock-code&state=invalid-state")
        .expect(302);
      expect(response.headers.location).toContain("error=invalid_state");
    });
  });
});

