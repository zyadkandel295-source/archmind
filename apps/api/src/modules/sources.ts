import { Router } from "express";
import multer from "multer";
import { urlSourceSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { enqueueIngestion } from "../services/queue";
import { KnowledgeService } from "../services/knowledge";
import type { AuthedRequest } from "../types";
import { notifyAssistantUpdate } from "../services/events";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "../services/supabase-server";

const isSupabaseConfigured = isSupabaseServerConfigured;

const upload = multer({
  // KnowledgeService owns the durable temporary file lifecycle and requires
  // the uploaded bytes. Memory storage keeps file.buffer available.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

export function sourcesRouter(env: Env, store: MemoryStore) {
  const router = Router();
  const knowledge = new KnowledgeService(store);
  const supabase = createSupabaseServerClient();
  const useSupabase = env.nodeEnv !== "test" && isSupabaseConfigured();

  router.post(
    "/assistants/:id/sources/upload",
    authenticate(env, store),
    upload.single("file"),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const uploadedFile = req.file;
      const bodyText = typeof req.body?.text === "string" ? req.body.text : undefined;

      if (!uploadedFile && !bodyText) {
        throw new HttpError(400, "Provide a file or text body to ingest", "VALIDATION_ERROR");
      }

      if (uploadedFile) {
        const source = await knowledge.createUpload({
          userId: req.user!.id,
          assistantId: assistant.id,
          file: uploadedFile
        });
        notifyAssistantUpdate(assistant.id);
        res.status(201).json({ source, fileId: source.id, status: source.status });
        return;
      }

      const name = req.body?.name ?? "Pasted text";
      const text = bodyText;
      const source = store.createSource(assistant.id, {
        type: "text",
        name,
        text
      });
      const queue = await enqueueIngestion(env, { assistantId: assistant.id, sourceId: source.id });
      notifyAssistantUpdate(assistant.id);
      res.status(201).json({ source, queue });
    })
  );

  router.post(
    "/assistants/:id/knowledge/upload",
    authenticate(env, store),
    upload.single("file"),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const userId = req.user?.id || "user-1";
      let assistant = store.getAssistantForUser(assistantId, userId);

      if (!assistant && useSupabase) {
        try {
          const { data: dbAssistant } = await supabase
            .from("assistants")
            .select("*")
            .eq("id", assistantId)
            .eq("user_id", userId)
            .single();
          if (dbAssistant) {
            assistant = {
              id: dbAssistant.id,
              userId: dbAssistant.user_id || userId,
              createdByUserId: dbAssistant.user_id || userId,
              name: dbAssistant.name || "AGENTIA Assistant",
              description: dbAssistant.description || "",
              systemPrompt: dbAssistant.instructions || dbAssistant.system_prompt || "",
              tone: "professional",
              visibility: dbAssistant.is_public ? "public" : "private",
              version: 1,
              isPublic: dbAssistant.is_public ?? true,
              publicSlug: dbAssistant.slug || assistantId,
              slug: dbAssistant.slug || assistantId,
              model: dbAssistant.model_name || "llama-3.3-70b-versatile",
              temperature: 0.7,
              icon: dbAssistant.icon || "Bot",
              color: dbAssistant.color || "#06b6d4",
              starterPrompts: [],
              enabledTools: [],
              createdAt: dbAssistant.created_at || new Date().toISOString(),
              updatedAt: dbAssistant.updated_at || new Date().toISOString()
            };
            store.createAssistant(userId, assistant);
          }
        } catch {
          // Fall back below
        }
      }

      assistant = assertFound(assistant, "Assistant not found");

      if (!req.file) {
        throw new HttpError(400, "Choose a file to upload.", "VALIDATION_ERROR");
      }

      const source = await knowledge.createUpload({
        userId,
        assistantId: assistant.id,
        file: req.file
      });
      notifyAssistantUpdate(assistant.id);
      res.status(201).json({
        success: true,
        fileId: source.id,
        filename: source.originalFilename ?? source.name,
        status: source.status
      });
    })
  );

  router.get(
    "/assistants/:id/knowledge",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const userId = req.user?.id || "user-1";
      const assistant = assertFound(store.getAssistantForUser(assistantId, userId), "Assistant not found");
      res.json({ files: knowledge.list(assistant.id, userId) });
    })
  );

  router.get(
    "/assistants/:id/knowledge/:fileId/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const userId = req.user?.id || "user-1";
      const assistant = assertFound(store.getAssistantForUser(assistantId, userId), "Assistant not found");
      const file = assertFound(knowledge.getStatus(assistant.id, userId, req.params.fileId!), "Knowledge file not found");
      res.json({
        fileId: file.id,
        status: file.status,
        chunks: file.chunks,
        textLength: file.textLength,
        errorMessage: file.errorMessage
      });
    })
  );

  router.delete(
    "/assistants/:id/knowledge/:fileId",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const userId = req.user?.id || "user-1";
      const assistant = assertFound(store.getAssistantForUser(assistantId, userId), "Assistant not found");
      assertFound(await knowledge.delete(assistant.id, userId, req.params.fileId!), "Knowledge file not found");
      notifyAssistantUpdate(assistant.id);
      res.status(204).send();
    })
  );

  router.post(
    "/assistants/:id/sources/url",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const input = urlSourceSchema.parse(req.body);
      const source = store.createSource(assistant.id, {
        type: "url",
        name: input.name,
        url: input.url,
        text: `Website URL ${input.url} was added to ${assistant.name}. Replace the demo scraper with a production crawler to extract page text.`
      });
      const queue = await enqueueIngestion(env, { assistantId: assistant.id, sourceId: source.id });
      notifyAssistantUpdate(assistant.id);
      res.status(201).json({ source, queue });
    })
  );

  router.get(
    "/sources/:id/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const source = assertFound(store.getSource(req.params.id!), "Source not found");
      const assistant = assertFound(store.getAssistantForUser(source.assistantId, req.user!.id), "Source not found");
      res.json({
        source: {
          id: source.id,
          assistantId: assistant.id,
          status: source.status,
          chunkCount: source.chunkCount,
          tokenCount: source.tokenCount,
          updatedAt: source.updatedAt
        }
      });
    })
  );

  return router;
}
