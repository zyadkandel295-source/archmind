import jwt from "jsonwebtoken";
import type { Env } from "../../config/env";
import type { MemoryStore } from "../../db/memory";
import type { AuthedRequest, AuthUser } from "../../types";
import { HttpError } from "../../lib/http-error";
import { verifyFirebaseIdToken } from "../firebase-admin";
import { resolveAuthoritativeAssistant } from "../authoritative-assistant";
import type { FileGenerationService } from "./generator";

export async function verifyFileUser(req: AuthedRequest, env: Env) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/)?.[1];
  if (!token)
    throw new HttpError(
      401,
      "Sign in to generate or download private files.",
      "UNAUTHORIZED",
    );
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret, {
      algorithms: ["HS256"],
    }) as jwt.JwtPayload;
    if (!payload.sub || !payload.exp || payload.assistantId)
      throw new Error("A full signed-in account is required.");
    req.user = {
      id: payload.sub,
      email: payload.email ?? "",
      plan: (payload.plan ?? "free") as AuthUser["plan"],
    };
    return req.user;
  } catch {
    if (env.firebaseProjectId && env.firebasePrivateKey) {
      try {
        const user = await verifyFirebaseIdToken(env, token);
        req.user = { id: user.uid, email: user.email ?? "", plan: "free" };
        return req.user;
      } catch {
        /* fail closed */
      }
    }
    throw new HttpError(
      401,
      "Your login could not be verified. Sign in again to use private files.",
      "FILE_LOGIN_REQUIRED",
    );
  }
}
export async function authorizeFileContext(
  service: FileGenerationService,
  store: MemoryStore,
  userId: string,
  conversationId?: string,
  assistantId?: string,
) {
  if (assistantId) {
    const assistant = await resolveAuthoritativeAssistant(
      service.env,
      store,
      assistantId,
      userId,
    );
    if (!assistant)
      throw new HttpError(404, "Assistant not found.", "ASSISTANT_NOT_FOUND");
  }
  if (!conversationId) return;
  // A persisted file history can restore a conversation after server restart.
  const previous = await service.repository.list(userId, conversationId);
  if (previous.length) {
    if (previous.some((f) => f.assistantId !== assistantId))
      throw new HttpError(
        404,
        "Conversation not found.",
        "CONVERSATION_NOT_FOUND",
      );
    return;
  }
  const local = store.getConversation(conversationId);
  if (local?.userId === userId && local.assistantId === assistantId) return;
  if (service.repository.pool) {
    const existing = await service.repository.pool.query(
      "select id from conversations where id=$1 and user_id::text=$2 and assistant_id::text=$3",
      [conversationId, userId, assistantId ?? null],
    );
    if (existing.rows.length) return;
  }
  throw new HttpError(404, "Conversation not found.", "CONVERSATION_NOT_FOUND");
}
