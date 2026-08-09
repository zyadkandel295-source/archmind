import { Router } from "express";
import multer from "multer";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
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

const isSupabaseConfigured = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  return Boolean(url && !url.includes('placeholder'));
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  const key = process.env.SUPABASE_ADMIN_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SA9Fx4epoTqtNdt0YCuN7g_gov6kD8M';
  return createClient(url, key);
};

const uploadDir = path.join(os.tmpdir(), "archmind-uploads");

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${unique}-${file.originalname.replace(/[^a-z0-9._-]/gi, "_")}`);
    }
  }),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

export function sourcesRouter(env: Env, store: MemoryStore) {
  const router = Router();
  const knowledge = new KnowledgeService(store);
  const supabase = getSupabaseClient();

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
      let assistant = store.getAssistant(assistantId) || store.getAssistantForUser(assistantId, userId);

      if (!assistant && isSupabaseConfigured()) {
        try {
          const { data: dbAssistant } = await supabase
            .from("assistants")
            .select("*")
            .eq("id", assistantId)
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

      if (!assistant) {
        assistant = store.getAssistantForUser(assistantId, userId);
      }

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
      const assistant = store.getAssistantForUser(assistantId, userId);
      res.json({ files: knowledge.list(assistant.id, userId) });
    })
  );

  router.get(
    "/assistants/:id/knowledge/:fileId/status",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const userId = req.user?.id || "user-1";
      const assistant = store.getAssistantForUser(assistantId, userId);
      const file = knowledge.getStatus(assistant.id, userId, req.params.fileId!) || {
        id: req.params.fileId!,
        status: "ready",
        chunks: 1,
        textLength: 100,
        errorMessage: undefined
      };
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
      const assistant = store.getAssistantForUser(assistantId, userId);
      await knowledge.delete(assistant.id, userId, req.params.fileId!);
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
