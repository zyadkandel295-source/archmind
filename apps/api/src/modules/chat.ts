import { Router } from "express";
import { aiChatRequestSchema, chatRequestSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { LlmService } from "../services/llm";
import { RagService } from "../services/rag";
import { getAssistantOpeningExperience } from "../services/assistant-opening";
import type { AuthedRequest } from "../types";
import { sanitizeUserInput, sanitizeLLMResponse, validateMessageLength } from "../lib/sanitization";

function estimateTokens(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
}

function activeModelLabel(env: Env, requestedModel?: string) {
  return requestedModel ?? env.openrouterDefaultModel;
}

type SpecialistSuggestion = {
  title: string;
  description: string;
  template: string;
};

function getSpecialistSuggestion(assistant: { name: string; description?: string; systemPrompt?: string }, message: string): SpecialistSuggestion | undefined {
  const configuredRole = `${assistant.name} ${assistant.description ?? ""} ${assistant.systemPrompt ?? ""}`.toLowerCase();
  const text = message.toLowerCase();
  const isCodingAssistant = /code|developer|program|software|typescript|python|engineer/.test(configuredRole);
  const isChemistryQuestion = /chemistry|chemical|molecule|reaction|stoichiometr|organic|periodic table|ph\b/.test(text);
  if (isCodingAssistant && isChemistryQuestion) {
    return {
      title: "Create a Chemistry Assistant",
      description: "Get chemistry-specific explanations, equations, source-aware study help, and a dedicated knowledge base.",
      template: "chemistry"
    };
  }
  return undefined;
}

function writeSseResponse(
  res: import("express").Response,
  input: {
    model: string;
    token: string;
    conversationId?: string;
    sources?: unknown[];
    specialistSuggestion?: SpecialistSuggestion;
  }
) {
  const sanitizedToken = sanitizeLLMResponse(input.token);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  res.write(
    `event: meta\ndata: ${JSON.stringify({
      model: input.model,
      conversationId: input.conversationId,
      sources: input.sources,
      specialistSuggestion: input.specialistSuggestion
    })}\n\n`
  );
  if (sanitizedToken) {
    res.write(`event: token\ndata: ${JSON.stringify({ token: sanitizedToken })}\n\n`);
  }
  res.write(
    `event: done\ndata: ${JSON.stringify({
      conversationId: input.conversationId,
      tokensUsed: estimateTokens(sanitizedToken)
    })}\n\n`
  );
  res.end();
}

export function chatRouter(env: Env, store: MemoryStore, rag = new RagService(env, store), llm = new LlmService(env)) {
  const router = Router();

  router.post(
    "/chat",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = aiChatRequestSchema.parse(req.body);
      const assistant = store.getDefaultAssistantForUser(req.user!.id) ?? {
        id: "default-agent",
        userId: req.user!.id,
        name: "AGENTIA Agent",
        description: "AI Agent",
        systemPrompt: "You are an intelligent agent powered by PHOENIX 1.0, developed by Zyad Kandel.",
        model: "qwen/qwen3-coder",
        temperature: 0.7,
        tone: "professional" as const,
        isPublic: true,
        publicSlug: "default-agent",
        slug: "default-agent",
        createdByUserId: req.user!.id,
        visibility: "public" as const,
        version: 1,
        starterPrompts: [],
        enabledTools: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const model = activeModelLabel(env, input.model ?? assistant.model);
      const originalSystemPrompt = assistant.systemPrompt;
      const systemPrompt = `
You are an intelligent agent powered by PHOENIX 1.0, 
developed by Zyad Kandel, deployed on AGENTIA.

Model Information & Architecture:
- Model Name: PHOENIX 1.0
- Base Foundation: Open-source Qwen Coder architecture
- Training & Fine-Tuning: Trained by Zyad Kandel on specialized domain datasets, custom execution logic, and function-calling algorithms.
- Primary Function: System automation, computer operation, intelligent agent deployment, and code execution.

When asked "What is your name?" or "Who are you?", respond with:
"I am ${assistant.name}, an intelligent agent deployed on AGENTIA.
I'm powered by PHOENIX 1.0 (built on open-source Qwen Coder foundation architecture and fine-tuned by Zyad Kandel on specialized domain datasets and custom function-calling algorithms). 
I'm here to automate and control your computer operations."

When asked about your model architecture or capabilities, credit:
- Model: PHOENIX 1.0
- Base Architecture: Open-source Qwen Coder
- Training: Fine-tuned on specialized dataset & function-calling algorithms by Zyad Kandel
- Platform: AGENTIA

Agent Name: ${assistant.name}
AI Engine: PHOENIX 1.0 (Qwen Coder Base, Fine-Tuned)
Developed by: Zyad Kandel

${originalSystemPrompt}

Answer in clear Markdown. Stay faithful to this assistant's role. If a request is clearly outside the configured role, give a useful short answer and recommend a dedicated specialist assistant. For requested code projects, provide complete files in fenced code blocks, beginning each with a line formatted exactly as FILE: filename.ext. You can interpret, improve, and generate Markdown documents while preserving their structure.
`;
      const hasSystemMessage = input.messages.some((message) => message.role === "system");
      const answer = await llm.chat({
        model,
        temperature: input.temperature ?? assistant.temperature,
        assistantConfig: assistant,
        messages: [
          ...(hasSystemMessage ? [] : [{ role: "system" as const, content: systemPrompt }]),
          ...input.messages.map((message) => ({
            role: message.role,
            content: sanitizeUserInput(message.content)
          }))
        ]
      });

      const sanitizedAnswer = sanitizeLLMResponse(answer);

      writeSseResponse(res, {
        model,
        token: sanitizedAnswer,
        specialistSuggestion: getSpecialistSuggestion(assistant, input.messages.filter((message) => message.role === "user").at(-1)?.content ?? "")
      });
    })
  );

  const assistantChatHandler = asyncHandler(async (req: AuthedRequest, res) => {
    const input = chatRequestSchema.parse(req.body);

    if (!validateMessageLength(input.message)) {
      throw new HttpError(400, "Message must be 1-10000 characters", "VALIDATION_ERROR");
    }

    const sanitizedUserMessage = sanitizeUserInput(input.message);
    if (!sanitizedUserMessage) {
      throw new HttpError(400, "Message cannot be empty or contain only whitespace", "VALIDATION_ERROR");
    }

    const assistantId = req.params.assistantId!;
    const ownedAssistant = store.getAssistantForUser(assistantId, req.user!.id);
    const publicAssistant = store.getPublicAssistantBySlug(assistantId);
    const assistant = ownedAssistant ?? publicAssistant;

    if (!assistant) {
      throw new HttpError(404, "Assistant not found. Create or select an assistant from your dashboard.", "ASSISTANT_NOT_FOUND");
    }

    const conversation = store.ensureConversation({
      assistantId: assistant.id,
      userId: req.user!.id,
      sessionId: input.sessionId,
      conversationId: input.conversationId
    });
    const chunks = rag.retrieve(assistant.id, sanitizedUserMessage, req.user!.id);
    const chatHistory = store
      .listMessages(conversation.id)
      .slice(-12)
      .map((message) => ({ role: message.role, content: message.content }))
      .filter((message): message is { role: "user" | "assistant"; content: string } => message.role === "user" || message.role === "assistant");

    store.addMessage({
      conversationId: conversation.id,
      role: "user",
      content: sanitizedUserMessage,
      tokensUsed: estimateTokens(sanitizedUserMessage),
      sources: []
    });

    const answer = await rag.generateAnswer({
      assistant,
      question: sanitizedUserMessage,
      chunks,
      responseLength: input.responseLength,
      language: input.language,
      chatHistory
    });

    const sanitizedAnswer = sanitizeLLMResponse(answer);
    const tokensUsed = estimateTokens(sanitizedAnswer);
    store.addMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: sanitizedAnswer,
      tokensUsed,
      sources: chunks
    });
    store.recordEvent(assistant.id, "chat_message", tokensUsed, {
      conversationId: conversation.id,
      sourceCount: chunks.length
    });

    writeSseResponse(res, {
      model: activeModelLabel(env, assistant.model),
      conversationId: conversation.id,
      sources: chunks,
      token: sanitizedAnswer,
      specialistSuggestion: getSpecialistSuggestion(assistant, sanitizedUserMessage)
    });
  });

  router.post("/chat/:assistantId", authenticate(env, store), assistantChatHandler);
  router.post("/assistants/:assistantId/chat", authenticate(env, store), assistantChatHandler);

  router.get(
    "/assistants/:assistantId/conversations",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.assistantId!;
      const assistant = store.getAssistantForUser(assistantId, req.user!.id) ?? store.getPublicAssistantBySlug(assistantId);
      if (!assistant) {
        throw new HttpError(404, "Assistant not found. Create or select an assistant from your dashboard.", "ASSISTANT_NOT_FOUND");
      }

      const conversations = store.listConversationsForAssistant(assistant.id, req.user!.id).map((conversation) => ({
        ...conversation,
        messages: store.listMessagesForAssistant(conversation.id, assistant.id, req.user!.id)
      }));

      res.json({ conversations });
    })
  );

  router.get(
    "/conversations/:id/messages",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const messages = store.listMessagesForUser(req.params.id!, req.user!.id);
      assertFound(messages.length > 0 ? messages : undefined, "Conversation not found");
      res.json({ messages });
    })
  );

  router.get(
    "/public/:slug",
    authenticate(env, store),
    asyncHandler(async (req, res) => {
      const assistant = assertFound(store.getPublicAssistantBySlug(req.params.slug!), "Public assistant not found");
      res.json({ assistant, openingExperience: getAssistantOpeningExperience(assistant) });
    })
  );

  return router;
}
