import { Router } from "express";
import { z } from "zod";
import type { MemoryStore } from "../db/memory";
import type { AuthedRequest } from "../types";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import {
  FileGenerationService,
  likelyFileRequest,
} from "../services/files/generator";
import { authorizeFileContext, verifyFileUser } from "../services/files/access";
import { fileRequestSchema, fileView, MIME } from "../services/files/types";
import { validateFile } from "../services/files/render";

export function filesRouter(
  service: FileGenerationService,
  store: MemoryStore,
) {
  const router = Router();
  router.use(
    ["/files", "/conversations/:conversationId/files"],
    asyncHandler(async (req: AuthedRequest, _res, next) => {
      await verifyFileUser(req, service.env);
      next();
    }),
  );
  router.post(
    "/files/generate",
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = fileRequestSchema.parse(req.body);
      await authorizeFileContext(
        service,
        store,
        req.user!.id,
        input.conversationId,
        input.assistantId,
      );
      if (input.assistantId && !input.conversationId) {
        input.conversationId = store.ensureConversation({
          assistantId: input.assistantId,
          userId: req.user!.id,
        }).id;
      }
      const file = await service.submit(req.user!.id, input);
      if (
        file.assistantId &&
        !store
          .listMessages(file.conversationId)
          .some((m) => m.generatedFileId === file.id)
      ) {
        store.addMessage({
          conversationId: file.conversationId,
          role: "user",
          content: input.description,
          tokensUsed: 0,
          sources: [],
        });
        store.addMessage({
          conversationId: file.conversationId,
          role: "assistant",
          content: "Your generated file",
          generatedFileId: file.id,
          tokensUsed: 0,
          sources: [],
        });
      }
      res.status(202).json({ file: fileView(file) });
    }),
  );
  router.get(
    "/files",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = z
        .string()
        .max(150)
        .optional()
        .parse(req.query.assistantId);
      const files = (await service.repository.list(req.user!.id)).filter(
        (f) => !assistantId || f.assistantId === assistantId,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ files: files.map(fileView) });
    }),
  );
  router.get(
    "/conversations/:conversationId/files",
    asyncHandler(async (req: AuthedRequest, res) => {
      const id = z.string().uuid().parse(req.params.conversationId);
      const files = await service.repository.list(req.user!.id, id);
      if (!files.length && store.getConversation(id)?.userId !== req.user!.id)
        throw new HttpError(
          404,
          "Conversation not found.",
          "CONVERSATION_NOT_FOUND",
        );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ files: files.map(fileView) });
    }),
  );
  router.get(
    "/files/:id/status",
    asyncHandler(async (req: AuthedRequest, res) => {
      const file = await service.repository.owned(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ file: fileView(file) });
    }),
  );
  router.get(
    "/files/:id/download",
    asyncHandler(async (req: AuthedRequest, res) => {
      const file = await service.repository.owned(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
      );
      const bytes = await service.repository.download(file);
      await validateFile(bytes, file.format, file.count);
      res.setHeader("Content-Type", MIME[file.format]);
      res.setHeader("Content-Length", bytes.length);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader(
        "Content-Disposition",
        `${req.query.inline === "true" && file.format === "pdf" ? "inline" : "attachment"}; filename="${file.filename.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      );
      res.send(bytes);
    }),
  );
  router.post(
    "/files/:id/regenerate",
    asyncHandler(async (req: AuthedRequest, res) => {
      const parent = await service.repository.owned(
        z.string().uuid().parse(req.params.id),
        req.user!.id,
      );
      const input = fileRequestSchema.parse({
        ...req.body,
        description: req.body.description ?? "Retry generation",
        parentId: parent.id,
        conversationId: parent.conversationId,
        assistantId: parent.assistantId,
      });
      const file = await service.submit(req.user!.id, input);
      res.status(202).json({ file: fileView(file) });
    }),
  );
  return router;
}

// Runs before the existing chat handlers. Ordinary conversation continues unchanged.
export function fileChatRouter(
  service: FileGenerationService,
  store: MemoryStore,
) {
  const router = Router();
  router.post(
    ["/chat", "/chat/:assistantId", "/assistants/:assistantId/chat"],
    asyncHandler(async (req: AuthedRequest, res, next) => {
      const description =
        typeof req.body.message === "string"
          ? req.body.message
          : Array.isArray(req.body.messages)
            ? [...req.body.messages].reverse().find((m) => m.role === "user")
                ?.content
            : undefined;
      if (typeof description !== "string") return next();
      const conversationId = z
        .string()
        .uuid()
        .optional()
        .safeParse(req.body.conversationId);
      let previous: Awaited<ReturnType<typeof service.repository.list>> = [];
      if (
        conversationId.success &&
        conversationId.data &&
        /^(?:please\s+)?(?:add|remove|shorten|expand|change|revise|edit|rewrite|make|export|convert|create|retry|regenerate)\b/i.test(
          description,
        )
      ) {
        // Only look up history after cryptographic authentication.
        try {
          const user = await verifyFileUser(req, service.env);
          previous = await service.repository.list(
            user.id,
            conversationId.data,
          );
        } catch {
          if (!likelyFileRequest(description)) return next();
        }
      }
      if (!likelyFileRequest(description, previous.length > 0)) return next();
      const user = await verifyFileUser(req, service.env);
      const assistantId = req.params.assistantId;
      const input = fileRequestSchema.parse({
        description,
        conversationId: req.body.conversationId,
        assistantId,
        requestId: req.body.requestId,
      });
      await authorizeFileContext(
        service,
        store,
        user.id,
        input.conversationId,
        assistantId,
      );
      const parent = previous.find((f) => f.status === "completed");
      const edit =
        parent &&
        likelyFileRequest(description, true) &&
        !/\b(?:create|make|generate)\b.*\b(?:about|on|explaining)\b/i.test(
          description,
        );
      if (edit) input.parentId = parent.id;
      if (assistantId && !input.conversationId)
        input.conversationId = store.ensureConversation({
          assistantId,
          userId: user.id,
        }).id;
      const file = await service.submit(user.id, input);
      if (assistantId) {
        store.addMessage({
          conversationId: file.conversationId,
          role: "user",
          content: description,
          tokensUsed: 0,
          sources: [],
        });
        store.addMessage({
          conversationId: file.conversationId,
          role: "assistant",
          content: "Your generated file",
          generatedFileId: file.id,
          tokensUsed: 0,
          sources: [],
        });
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      });
      res.write(
        `event: meta\ndata: ${JSON.stringify({ conversationId: file.conversationId, generatedFile: fileView(file) })}\n\n`,
      );
      res.write(
        `event: token\ndata: ${JSON.stringify({ token: "Your file is queued. You can continue chatting while it generates." })}\n\n`,
      );
      res.end(
        `event: done\ndata: ${JSON.stringify({ conversationId: file.conversationId })}\n\n`,
      );
    }),
  );
  return router;
}
