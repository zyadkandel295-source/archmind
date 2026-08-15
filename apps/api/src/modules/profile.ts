import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import type { AuthedRequest, UserRecord } from "../types";
import { createSupabaseServerClient, isSupabaseServerConfigured } from "../services/supabase-server";

const isSupabaseConfigured = isSupabaseServerConfigured;

const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  photoURL: z.string().trim().url().max(1000).optional().or(z.literal("")),
  photoUrl: z.string().trim().url().max(1000).optional().or(z.literal(""))
});

function getOrCreateUser(store: MemoryStore, userId: string, email?: string): UserRecord {
  let user = store.findUserById(userId);
  if (!user) {
    const resolvedEmail = email || "user@agentia-ai.cloud";
    const nameFromEmail = resolvedEmail.split("@")[0] || "User";
    user = {
      id: userId,
      email: resolvedEmail,
      displayName: nameFromEmail,
      photoUrl: "",
      provider: "password",
      plan: "free",
      tokenUsage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    (store as any).users.set(userId, user);
  } else if (email && user.email !== email) {
    user.email = email;
    if (!user.displayName) user.displayName = email.split("@")[0] || "User";
  }
  return user;
}

function profileResponse(user: UserRecord) {
  const displayEmail = user.email || "user@agentia-ai.cloud";
  const displayName = user.displayName || displayEmail.split("@")[0] || "User";
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: displayEmail,
    displayName: displayName,
    photoURL: user.photoUrl || "",
    provider: user.provider ?? (user.googleId ? "google.com" : "password"),
    plan: user.plan || "free",
    tokenUsage: user.tokenUsage || 0,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || new Date().toISOString()
  };
}

export function profileRouter(env: Env, store: MemoryStore) {
  const router = Router();
  const supabase = createSupabaseServerClient();
  const useSupabase = env.nodeEnv !== "test" && isSupabaseConfigured();

  router.get(
    "/",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const userId = req.user?.id || "user-1";
      const email = req.user?.email || undefined;
      const user = getOrCreateUser(store, userId, email);

      let stats = store.userProfileStats(user.id);

      if (useSupabase) {
        try {
          const { data: dbProfile } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("id", userId)
            .single();

          if (dbProfile) {
            if (dbProfile.full_name) user.displayName = dbProfile.full_name;
            if (dbProfile.avatar_url) user.photoUrl = dbProfile.avatar_url;
          }

          const [assistantsRes, chatsRes] = await Promise.all([
            supabase.from("assistants").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
            supabase.from("chats").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null)
          ]);

          stats = {
            assistants: assistantsRes.count ?? stats.assistants,
            conversations: chatsRes.count ?? stats.conversations,
            messages: stats.messages,
            sources: stats.sources
          };
        } catch {
          // Fall back to memory stats
        }
      }

      res.json({
        profile: profileResponse(user),
        stats
      });
    })
  );

  router.put(
    "/",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = profileUpdateSchema.parse(req.body);
      const userId = req.user?.id || "user-1";
      const email = req.user?.email || undefined;
      const user = getOrCreateUser(store, userId, email);

      const updatedName = input.displayName ?? user.displayName;
      const updatedPhoto = input.photoURL ?? input.photoUrl ?? user.photoUrl;

      user.displayName = updatedName;
      user.photoUrl = updatedPhoto;
      user.updatedAt = new Date().toISOString();

      if (useSupabase) {
        try {
          await supabase
            .from("user_profiles")
            .upsert({
              id: userId,
              full_name: updatedName,
              avatar_url: updatedPhoto,
              updated_at: new Date().toISOString()
            });
        } catch {
          // Fall back to memory update
        }
      }

      res.json({ profile: profileResponse(user) });
    })
  );

  return router;
}
