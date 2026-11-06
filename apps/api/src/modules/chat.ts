import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Router } from "express";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { aiChatRequestSchema, chatRequestSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { LlmService } from "../services/llm";
import { RagService } from "../services/rag";
import { getAssistantOpeningExperience } from "../services/assistant-opening";
import type { AuthedRequest, RetrievedChunk } from "../types";
import { sanitizeUserInput, sanitizeLLMResponse, validateMessageLength } from "../lib/sanitization";
import { buildAgentiaSystemPrompt } from "../services/agentia-system-prompt";
import { resolveAuthoritativeAssistant } from "../services/authoritative-assistant";
import {
  formatWebSearchPrompt,
  performWebSearch,
  shouldPerformWebSearch,
  webResultsToRetrievedChunks,
  type WebSearchResult
} from "../services/web-search";

function estimateTokens(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
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

const exportChatPdfSchema = z.object({
  title: z.string().trim().min(1).max(200).default("AGENTIA Chat Export"),
  assistantName: z.string().trim().max(120).optional(),
  conversationId: z.string().optional(),
  assistantId: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
        createdAt: z.union([z.number(), z.string()]).optional()
      })
    )
    .default([])
});

function toWinAnsiSafeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\n\r\t]/g, " ")
    .replace(/\r\n/g, "\n");
}

async function generateChatExportPdfBytes(input: z.infer<typeof exportChatPdfSchema>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const wrapLines = (raw: string, font: typeof regularFont, fontSize: number, maxWidth: number): string[] => {
    const clean = toWinAnsiSafeText(raw);
    const paragraphs = clean.split("\n");
    const wrapped: string[] = [];

    for (const para of paragraphs) {
      const words = para.split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        wrapped.push("");
        continue;
      }
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
          wrapped.push(current);
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) wrapped.push(current);
    }
    return wrapped.length > 0 ? wrapped : [""];
  };

  // Document Header
  const headerTitle = toWinAnsiSafeText(input.title || "AGENTIA Chat Transcript");
  page.drawText("AGENTIA - EXPORTED CHAT ARCHIVE", {
    x: margin,
    y,
    font: boldFont,
    size: 10,
    color: rgb(0.02, 0.55, 0.78)
  });
  y -= 22;

  const titleLines = wrapLines(headerTitle, boldFont, 18, contentWidth);
  for (const line of titleLines) {
    ensureSpace(24);
    page.drawText(line, {
      x: margin,
      y,
      font: boldFont,
      size: 18,
      color: rgb(0.08, 0.1, 0.18)
    });
    y -= 22;
  }

  const metaLine = toWinAnsiSafeText(
    `Assistant: ${input.assistantName || "AGENTIA Agent"}   |   Exported: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`
  );
  ensureSpace(20);
  page.drawText(metaLine, {
    x: margin,
    y,
    font: regularFont,
    size: 9,
    color: rgb(0.4, 0.45, 0.55)
  });
  y -= 14;

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.82, 0.85, 0.9)
  });
  y -= 20;

  for (const message of input.messages) {
    const isUser = message.role === "user";
    const speakerLabel = isUser ? "You" : input.assistantName || "Assistant";
    ensureSpace(32);

    page.drawText(toWinAnsiSafeText(speakerLabel.toUpperCase()), {
      x: margin,
      y,
      font: boldFont,
      size: 10,
      color: isUser ? rgb(0.35, 0.22, 0.8) : rgb(0.04, 0.48, 0.62)
    });
    y -= 15;

    const bodyLines = wrapLines(message.content || "", regularFont, 10.5, contentWidth - 12);
    for (const line of bodyLines) {
      ensureSpace(15);
      if (line) {
        page.drawText(line, {
          x: margin + 8,
          y,
          font: regularFont,
          size: 10.5,
          color: rgb(0.15, 0.18, 0.24)
        });
      }
      y -= 14;
    }

    y -= 10;
  }

  return pdf.save();
}

function savePdfToAgentiaFolder(filename: string, pdfBytes: Uint8Array): string[] {
  const savedLocations: string[] = [];
  const candidateFolders = [
    path.join(os.homedir(), "agentia files data"),
    path.resolve(process.cwd(), "agentia files data")
  ];
  const workspaceRootCandidate = path.resolve(process.cwd(), "..", "..");
  if (fs.existsSync(path.join(workspaceRootCandidate, "package.json"))) {
    candidateFolders.push(path.join(workspaceRootCandidate, "agentia files data"));
  }

  for (const dir of [...new Set(candidateFolders)]) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, Buffer.from(pdfBytes));
      savedLocations.push(filePath);
    } catch {
      // Ignore read-only serverless filesystem paths
    }
  }
  return savedLocations;
}

export function chatRouter(env: Env, store: MemoryStore, rag = new RagService(env, store), llm = new LlmService(env)) {
  const router = Router();

  router.post(
    "/chat",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = aiChatRequestSchema.parse(req.body);
      const assistant = {
        id: "default-agent",
        userId: req.user!.id,
        name: "AGENTIA Agent",
        description: "Intelligent multidisciplinary AI assistant",
        systemPrompt: "",
        model: input.model || "standard",
        temperature: input.temperature ?? 0.7,
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

      const sanitizedHistory = input.messages.map((message) => ({
        role: (message.role === "system" ? "user" : message.role) as "user" | "assistant",
        content: sanitizeUserInput(message.content)
      }));

      const lastUserMessage = sanitizedHistory.filter((message) => message.role === "user").at(-1)?.content ?? "";

      let webSearchPromptContext = "";
      let webChunks: RetrievedChunk[] = [];
      if (lastUserMessage && shouldPerformWebSearch(lastUserMessage, input.webSearch)) {
        const searchResults = await performWebSearch(lastUserMessage, 6, {
          timeRange: input.timeRange,
          chatHistory: sanitizedHistory.slice(0, -1)
        });
        if (searchResults.length > 0) {
          webSearchPromptContext = "\n\n" + formatWebSearchPrompt(searchResults, lastUserMessage);
          webChunks = webResultsToRetrievedChunks(searchResults);
        }
      }

      const systemPrompt = `${buildAgentiaSystemPrompt({
        assistantName: assistant.name,
        roleInstructions: assistant.systemPrompt
      })}

For requested code projects, provide complete files in fenced code blocks, beginning each with a line formatted exactly as FILE: filename.ext. You can interpret, improve, and generate Markdown documents while preserving their structure.${webSearchPromptContext}`;

      const answer = await llm.chat({
        temperature: input.temperature ?? assistant.temperature,
        assistantConfig: assistant,
        messages: [
          { role: "system" as const, content: systemPrompt },
          ...sanitizedHistory
        ]
      });

      const sanitizedAnswer = sanitizeLLMResponse(answer);

      writeSseResponse(res, {
        token: sanitizedAnswer,
        sources: webChunks.length > 0 ? webChunks : undefined,
        specialistSuggestion: getSpecialistSuggestion(assistant, lastUserMessage)
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
    const ownedAssistant = await resolveAuthoritativeAssistant(env, store, assistantId, req.user!.id);
    const publicAssistant = store.getPublicAssistantBySlug(assistantId);
    const assistant = ownedAssistant ?? publicAssistant;

    if (!assistant) {
      throw new HttpError(404, "Assistant not found. Create or select an assistant from your dashboard.", "ASSISTANT_NOT_FOUND");
    }

    const isEphemeral = Boolean(input.ephemeral);
    const conversation = isEphemeral
      ? {
          id: input.conversationId || `ephemeral-${randomUUID()}`,
          assistantId: assistant.id,
          userId: req.user!.id,
          sessionId: input.sessionId,
          title: sanitizedUserMessage.slice(0, 80),
          messageCount: 0,
          createdAt: new Date().toISOString()
        }
      : store.ensureConversation({
          assistantId: assistant.id,
          userId: req.user!.id,
          sessionId: input.sessionId,
          conversationId: input.conversationId
        });

    const chunks = await rag.retrieve(assistant.id, sanitizedUserMessage, req.user!.id);
    const chatHistory = isEphemeral
      ? (input.chatHistory ?? []).slice(-12).map((m) => ({
          role: m.role,
          content: sanitizeUserInput(m.content)
        }))
      : store
          .listMessages(conversation.id)
          .slice(-12)
          .map((message) => ({ role: message.role, content: message.content }))
          .filter((message): message is { role: "user" | "assistant"; content: string } => message.role === "user" || message.role === "assistant");

    if (!isEphemeral) {
      store.addMessage({
        conversationId: conversation.id,
        role: "user",
        content: sanitizedUserMessage,
        tokensUsed: estimateTokens(sanitizedUserMessage),
        sources: []
      });
    }

    let webSearchResults: WebSearchResult[] = [];
    const answer = await rag.generateAnswer({
      assistant,
      question: sanitizedUserMessage,
      chunks,
      responseLength: input.responseLength,
      language: input.language,
      webSearch: input.webSearch,
      timeRange: input.timeRange,
      onWebResults: (results) => {
        webSearchResults = results;
      },
      chatHistory
    });

    const combinedSources: RetrievedChunk[] = [
      ...chunks,
      ...webResultsToRetrievedChunks(webSearchResults)
    ];

    const sanitizedAnswer = sanitizeLLMResponse(answer);
    const tokensUsed = estimateTokens(sanitizedAnswer);
    if (!isEphemeral) {
      store.addMessage({
        conversationId: conversation.id,
        role: "assistant",
        content: sanitizedAnswer,
        tokensUsed,
        sources: combinedSources
      });
      store.recordEvent(assistant.id, "chat_message", tokensUsed, {
        conversationId: conversation.id,
        sourceCount: combinedSources.length
      });
    }

    writeSseResponse(res, {
      conversationId: conversation.id,
      sources: combinedSources,
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

  router.delete(
    ["/conversations/:id", "/assistants/:assistantId/conversations/:id"],
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const conversationId = req.params.id!;
      const deleted = store.deleteConversation(conversationId, req.user!.id);
      res.json({ ok: true, deleted, conversationId });
    })
  );

  router.post(
    "/chat/export-pdf",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = exportChatPdfSchema.parse(req.body);
      const pdfBytes = await generateChatExportPdfBytes(input);

      const safeTitle =
        input.title
          .replace(/[^\w\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 64) || "agentia-chat";
      const filename = `${safeTitle}-${Date.now()}.pdf`;

      const savedLocations = savePdfToAgentiaFolder(filename, pdfBytes);

      if (input.conversationId) {
        store.deleteConversation(input.conversationId, req.user!.id);
      }

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", String(pdfBytes.byteLength));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Chat-Removed", "true");
      res.setHeader("X-Saved-Folder", "agentia files data");
      if (savedLocations[0]) {
        res.setHeader("X-Saved-Path", savedLocations[0]);
      }
      res.send(Buffer.from(pdfBytes));
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
