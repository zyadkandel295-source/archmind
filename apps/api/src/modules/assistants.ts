import { Router } from "express";
import { assistantActionSchema, assistantActionUpdateSchema, assistantCreateSchema, assistantUpdateSchema } from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound, HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";
import { notifyAssistantUpdate, publishAssistantEvent, assistantEvents } from "../services/events";
import { getAssistantOpeningExperience } from "../services/assistant-opening";

export function assistantsRouter(env: Env, store: MemoryStore) {
  const router = Router();
  router.use(authenticate(env, store));

  router.get(
    "/",
    asyncHandler(async (req: AuthedRequest, res) => {
      let existing = store.listAssistants(req.user!.id);
      if (existing.length === 0) {
        store.getDefaultAssistantForUser(req.user!.id);
        existing = store.listAssistants(req.user!.id);
      }
      const assistants = existing.map((assistant) => {
        const analytics = store.assistantAnalytics(assistant.id);
        return {
          ...assistant,
          sourceCount: store.listSources(assistant.id).length,
          messageCount: analytics.messageCount,
          tokenUsage: analytics.tokens
        };
      });
      res.json({ assistants });
    })
  );

  router.post(
    "/",
    asyncHandler(async (req: AuthedRequest, res) => {
      const user = req.user!;
      const existingAssistants = store.listAssistants(user.id);
      const userRecord = store.findUserById(user.id);
      const isPro = userRecord?.plan === "pro";
      if (!isPro && existingAssistants.length >= 3) {
        throw new HttpError(
          403,
          "Assistant limit reached. Free accounts can create up to 3 assistants. Please upgrade to Pro to create more.",
          "ASSISTANT_LIMIT_EXCEEDED"
        );
      }
      const input = assistantCreateSchema.parse(req.body);
      const assistant = store.createAssistant(user.id, input);
      res.status(201).json({ assistant });
    })
  );

  router.get(
    "/:id",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      res.json({
        assistant,
        openingExperience: getAssistantOpeningExperience(assistant),
        sources: store.listSources(assistant.id),
        actions: store.listActions(assistant.id)
      });
    })
  );

  router.put(
    "/:id",
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = assistantUpdateSchema.parse(req.body);
      const assistant = assertFound(store.updateAssistant(req.params.id!, req.user!.id, input), "Assistant not found");
      notifyAssistantUpdate(assistant.id);
      res.json({ assistant });
    })
  );

  router.post(
    "/:id/duplicate",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.duplicateAssistant(req.params.id!, req.user!.id), "Assistant not found");
      res.status(201).json({ assistant });
    })
  );

  router.post(
    "/:id/conversations/clear",
    asyncHandler(async (req: AuthedRequest, res) => {
      const cleared = store.clearConversationsForAssistant(req.params.id!, req.user!.id);
      if (!cleared) {
        assertFound(undefined, "Assistant not found");
      }
      res.json({ ok: true });
    })
  );

  router.get(
    "/:id/actions",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      res.json({ actions: store.listActions(assistant.id) });
    })
  );

  router.post(
    "/:id/actions",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const input = assistantActionSchema.parse(req.body);
      const action = store.createAction(assistant.id, input);
      notifyAssistantUpdate(assistant.id);
      res.status(201).json({ action });
    })
  );

  router.put(
    "/:id/actions/:actionId",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const input = assistantActionUpdateSchema.parse(req.body);
      const action = assertFound(store.updateAction(assistant.id, req.params.actionId!, input), "Action not found");
      notifyAssistantUpdate(assistant.id);
      res.json({ action });
    })
  );

  router.delete(
    "/:id/actions/:actionId",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistant = assertFound(store.getAssistantForUser(req.params.id!, req.user!.id), "Assistant not found");
      const deleted = store.deleteAction(assistant.id, req.params.actionId!);
      if (!deleted) {
        assertFound(undefined, "Action not found");
      }
      notifyAssistantUpdate(assistant.id);
      res.status(204).send();
    })
  );

  router.get(
    "/:id/sync",
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const assistant = assertFound(
        store.getAssistantForUser(assistantId, req.user!.id),
        "Assistant not found"
      );

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      // Send initial state
      res.write(`data: ${JSON.stringify({ type: "sync", assistant })}\n\n`);

      const onUpdate = (updatedId: string) => {
        if (updatedId === assistantId) {
          const updated = store.getAssistantForUser(assistantId, req.user!.id);
          if (updated) {
            res.write(`data: ${JSON.stringify({ type: "sync", assistant: updated })}\n\n`);
          }
        }
      };

      assistantEvents.on("update", onUpdate);

      req.on("close", () => {
        assistantEvents.off("update", onUpdate);
      });
    })
  );

  router.delete(
    "/:id",
    asyncHandler(async (req: AuthedRequest, res) => {
      const deleted = store.deleteAssistant(req.params.id!, req.user!.id);
      if (!deleted) {
        assertFound(undefined, "Assistant not found");
      }
      publishAssistantEvent(req.params.id!, "assistant.deleted");
      res.status(204).send();
    })
  );

  return router;
}
