import type { Env } from "../config/env"; import type { MemoryStore } from "../db/memory"; import { HttpError } from "../lib/http-error"; import type { RagService } from "./rag"; import { publishAssistantEvent } from "./events";
export const estimateTokens = (text: string) => Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
export async function runAssistantChat(input: { env: Env; store: MemoryStore; rag: RagService; assistantId: string; userId: string; message: string; sessionId?: string; conversationId?: string; responseLength: string; language: string; allowPublicAssistant?: boolean }) {
  const assistant = input.store.getAssistantForUser(input.assistantId, input.userId) 
    ?? (input.allowPublicAssistant ? input.store.getPublicAssistantBySlug(input.assistantId) : undefined)
    ?? input.store.getDefaultAssistantForUser(input.userId);
  if (!assistant) throw new HttpError(404, "Assistant not found. Create or select an assistant from your dashboard.", "ASSISTANT_NOT_FOUND");
  const conversation = input.store.ensureConversation({ assistantId: assistant.id, userId: input.userId, sessionId: input.sessionId, conversationId: input.conversationId });
  const chunks = input.rag.retrieve(assistant.id, input.message);
  const chatHistory = input.store.listMessages(conversation.id).slice(-12).map(({ role, content }) => ({ role, content })).filter((item): item is { role: "user" | "assistant"; content: string } => item.role === "user" || item.role === "assistant");
  input.store.addMessage({ conversationId: conversation.id, role: "user", content: input.message, tokensUsed: estimateTokens(input.message), sources: [] });
  const answer = await input.rag.generateAnswer({ assistant, question: input.message, chunks, responseLength: input.responseLength, language: input.language, chatHistory });
  const tokensUsed = estimateTokens(answer); input.store.addMessage({ conversationId: conversation.id, role: "assistant", content: answer, tokensUsed, sources: chunks });
  input.store.recordEvent(assistant.id, "chat_message", tokensUsed, { conversationId: conversation.id, sourceCount: chunks.length }); publishAssistantEvent(assistant.id, "conversation.updated");
  return { assistant, conversation, chunks, answer, tokensUsed };
}
