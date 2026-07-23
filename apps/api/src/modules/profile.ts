import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import type { AuthedRequest, UserRecord } from "../types";

const profileUpdateSchema = z.object({
  displayName: z.string().trim().max(120).optional(),
  photoURL: z.string().trim().url().max(1000).optional().or(z.literal("")),
  photoUrl: z.string().trim().url().max(1000).optional().or(z.literal(""))
});

function profileResponse(user: UserRecord) {
  return {
    id: user.id,
    firebaseUid: user.firebaseUid,
    email: user.email,
    displayName: user.displayName ?? "",
    photoURL: user.photoUrl ?? "",
    provider: user.provider ?? (user.googleId ? "google.com" : user.passwordHash ? "password" : "unknown"),
    plan: user.plan,
    tokenUsage: user.tokenUsage,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt
  };
}

export function profileRouter(env: Env, store: MemoryStore) {
  const router = Router();

  router.get(
    "/profile",
    authenticate(env, store),
    asyncHandler(async (req, res) => {
      const userId = (req as AuthedRequest).user!.id;
      const user = store.findUserById(userId);
      if (!user) throw new HttpError(404, "Profile not found", "PROFILE_NOT_FOUND");
      res.json({
        profile: profileResponse(user),
        stats: store.userProfileStats(user.id)
      });
    })
  );

  router.put(
    "/profile",
    authenticate(env, store),
    asyncHandler(async (req, res) => {
      const input = profileUpdateSchema.parse(req.body);
      const userId = (req as AuthedRequest).user!.id;
      const user = store.updateUserProfile(userId, {
        displayName: input.displayName,
        photoUrl: input.photoURL ?? input.photoUrl
      });
      if (!user) throw new HttpError(404, "Profile not found", "PROFILE_NOT_FOUND");
      res.json({ profile: profileResponse(user) });
    })
  );

  return router;
}
