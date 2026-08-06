import { Router } from "express";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import type { AuthedRequest, UserRecord } from "../types";

const isSupabaseConfigured = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  return Boolean(url && !url.includes('placeholder'));
};

const getSupabaseClient = () => {
  const url = process.env.SUPABASE_URL || 'https://irjvqukildhucqbfotux.supabase.co';
  const key = process.env.SUPABASE_ADMIN_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_SA9Fx4epoTqtNdt0YCuN7g_gov6kD8M';
  return createClient(url, key);
};

const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  photoURL: z.string().trim().url().max(1000).optional().or(z.literal("")),
  photoUrl: z.string().trim().url().max(1000).optional().or(z.literal(""))
});

function getOrCreateUser(store: MemoryStore, userId: string, email?: string): UserRecord {
  let user = store.findUserById(userId);
  if (!user) {
    const resolvedEmail = email || "zyadkandel295@gmail.com";
    const nameFromEmail = resolvedEmail.split("@")[0] || "Zyad Kandel";
    user = {
      id: userId,
      email: resolvedEmail,
      displayName: nameFromEmail,
      photoUrl: "",
      provider: "google.com",
      plan: "pro",
      tokenUsage: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    (store as any).users.set(userId, user);
  }
  return user;
}

function profileResponse(user: UserRecord) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email || "zyadkandel295@gmail.com",
    displayName: user.displayName || user.email?.split("@")[0] || "Zyad Kandel",
    photoURL: user.photoUrl || "",
    provider: user.provider ?? (user.googleId ? "google.com" : user.passwordHash ? "password" : "google.com"),
    plan: user.plan || "pro",
    tokenUsage: user.tokenUsage || 0,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || new Date().toISOString()
  };
}

export function profileRouter(env: Env, store: MemoryStore) {
  const router = Router();
  const supabase = getSupabaseClient();

  router.get(
    "/profile",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const userId = req.user?.id || "user-1";
      const email = req.user?.email || "zyadkandel295@gmail.com";
      const user = getOrCreateUser(store, userId, email);

      let stats = store.userProfileStats(user.id);

      if (isSupabaseConfigured()) {
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
    "/profile",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = profileUpdateSchema.parse(req.body);
      const userId = req.user?.id || "user-1";
      const email = req.user?.email || "zyadkandel295@gmail.com";
      const user = getOrCreateUser(store, userId, email);

      const updatedName = input.displayName ?? user.displayName;
      const updatedPhoto = input.photoURL ?? input.photoUrl ?? user.photoUrl;

      user.displayName = updatedName;
      user.photoUrl = updatedPhoto;
      user.updatedAt = new Date().toISOString();

      if (isSupabaseConfigured()) {
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
