import { describe, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "../app";
import { signAccessToken } from "../middleware/auth";
import { loadEnv } from "../config/env";
import { MemoryStore } from "../db/memory";

describe("Data Persistence API (v2)", () => {
  const env = loadEnv();
  const store = new MemoryStore();
  const { app } = createApp({ env, store });

  const testUser = {
    id: "user-12345678-1234-1234-1234-123456789012",
    email: "test@archmind.ai",
    plan: "free" as const,
  };

  const authToken = signAccessToken(env, testUser);

  describe("Assistants v2 CRUD", () => {
    let createdAssistantId: string;

    test("GET /api/assistants returns assistant list", async () => {
      const res = await request(app)
        .get("/api/assistants")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("POST /api/assistants creates a new assistant", async () => {
      const res = await request(app)
        .post("/api/assistants")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Test Persistent Assistant",
          description: "Testing persistence",
          instructions: "Help user with tests",
          icon: "🤖",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Test Persistent Assistant");
      createdAssistantId = res.body.data.id;
    });

    test("GET /api/assistants/:id retrieves single assistant", async () => {
      if (!createdAssistantId) return;

      const res = await request(app)
        .get(`/api/assistants/${createdAssistantId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdAssistantId);
    });

    test("PUT /api/assistants/:id updates assistant details", async () => {
      if (!createdAssistantId) return;

      const res = await request(app)
        .put(`/api/assistants/${createdAssistantId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "Updated Assistant Name",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test("DELETE /api/assistants/:id soft deletes assistant", async () => {
      if (!createdAssistantId) return;

      const res = await request(app)
        .delete(`/api/assistants/${createdAssistantId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Chats & Messages v2 CRUD", () => {
    let createdChatId: string;

    test("GET /api/chats returns chat list", async () => {
      const res = await request(app)
        .get("/api/chats")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("POST /api/chats creates a new chat session", async () => {
      const res = await request(app)
        .post("/api/chats")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          assistant_id: "ast-test-1",
          title: "Test Conversation",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      createdChatId = res.body.data.id;
    });

    test("POST /api/messages adds a message to chat", async () => {
      if (!createdChatId) return;

      const res = await request(app)
        .post("/api/messages")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          chat_id: createdChatId,
          assistant_id: "ast-test-1",
          content: "Hello AI Assistant!",
          role: "user",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toBe("Hello AI Assistant!");
    });

    test("GET /api/chats/:id/messages fetches chat message history", async () => {
      if (!createdChatId) return;

      const res = await request(app)
        .get(`/api/chats/${createdChatId}/messages`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });
});
