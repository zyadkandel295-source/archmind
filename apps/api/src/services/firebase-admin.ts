import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { Env } from "../config/env";
import { HttpError } from "../lib/http-error";

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  return value.replace(/\\n/g, "\n");
}

export function ensureFirebaseAdmin(env: Env) {
  if (!env.firebaseProjectId || !env.firebaseClientEmail || !env.firebasePrivateKey) {
    throw new HttpError(
      501,
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
      "FIREBASE_ADMIN_NOT_CONFIGURED"
    );
  }

  const existing = getApps()[0];
  if (existing) return existing;

  return initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: normalizePrivateKey(env.firebasePrivateKey)
    })
  });
}

export async function verifyFirebaseIdToken(env: Env, idToken: string) {
  const app = ensureFirebaseAdmin(env);
  try {
    return await getAuth(app).verifyIdToken(idToken);
  } catch {
    throw new HttpError(401, "Invalid or expired Firebase ID token", "INVALID_FIREBASE_ID_TOKEN");
  }
}

