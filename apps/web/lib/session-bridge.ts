"use client";

import type { User } from "firebase/auth";
import { getFirebaseAuth, waitForFirebasePersistence } from "@/lib/firebase";
import { persistSession } from "@/lib/session-store";
import { getPlatformBaseUrl } from "@/lib/platform";

interface WorkspaceSessionResponse {
  user: {
    email: string;
    displayName?: string;
    photoUrl?: string;
  };
  accessToken: string;
  refreshToken: string;
}

function identityProviderFromUser(user: User) {
  return user.providerData[0]?.providerId ?? "password";
}

export async function establishWorkspaceSession(user: User, provider = identityProviderFromUser(user)) {
  await waitForFirebasePersistence();
  const idCredential = await user.getIdToken();
  const response = await fetch(`${getPlatformBaseUrl()}/api/auth/firebase/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: idCredential,
      provider,
      displayName: user.displayName ?? undefined,
      photoURL: user.photoURL ?? undefined
    })
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(error?.error?.message ?? "Could not sign in to your workspace.");
  }

  const session = (await response.json()) as WorkspaceSessionResponse;
  persistSession({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    email: session.user.email,
    displayName: session.user.displayName,
    photoURL: session.user.photoUrl
  });
  return session;
}

export async function renewWorkspaceSession() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return undefined;
  return establishWorkspaceSession(user);
}
