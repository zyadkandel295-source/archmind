import { Router } from "express";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { assertFound } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import { assistantEvents, type AssistantEvent } from "../services/events";
import type { AuthedRequest } from "../types";

export function assistantEventsRouter(env: Env, store: MemoryStore) {
  const router = Router();

  router.get(
    "/:id/events",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const assistantId = req.params.id!;
      const assistant = assertFound(
        store.getAssistantForUser(assistantId, req.user!.id),
        "Assistant not found"
      );

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      });

      const writeEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      writeEvent("sync", { assistant });

      const heartbeat = setInterval(() => {
        writeEvent("heartbeat", { occurredAt: new Date().toISOString() });
      }, 25000);

      const onAssistantEvent = (event: AssistantEvent) => {
        if (event.assistantId !== assistantId) return;

        if (event.type === "assistant.deleted") {
          writeEvent("assistant.deleted", event);
          return;
        }

        const updated = store.getAssistantForUser(assistantId, req.user!.id);
        writeEvent(event.type, {
          ...event,
          assistant: updated
        });
      };

      assistantEvents.on("assistant-event", onAssistantEvent);

      req.on("close", () => {
        clearInterval(heartbeat);
        assistantEvents.off("assistant-event", onAssistantEvent);
      });
    })
  );

  return router;
}
