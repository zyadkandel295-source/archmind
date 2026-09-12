"use client";

import { create } from "zustand";
import {
  clearSessionCredentials,
  readProfileFromStorage,
  readRenewalCredential,
  readSessionCredential,
  writeProfileToStorage,
  writeSessionCredentials
} from "@/lib/session-keys";

interface SessionState {
  authStatus: "initializing" | "authenticated" | "unauthenticated";
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  setSession: (input: SessionInput) => void;
  clearSession: () => void;
  setAuthStatus: (status: SessionState["authStatus"]) => void;
}

export interface SessionInput {
  accessToken: string;
  refreshToken?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export function persistSession({ accessToken, refreshToken, email, displayName, photoURL }: SessionInput) {
  writeSessionCredentials(accessToken, refreshToken);
  writeProfileToStorage(email, displayName, photoURL);
}

export function clearStoredSession() {
  clearSessionCredentials();
}

export const useSessionStore = create<SessionState>((set) => {
  const stored = typeof window !== "undefined" ? readProfileFromStorage() : { email: undefined, displayName: undefined, photoURL: undefined };
  return {
    authStatus: "initializing",
    accessToken: typeof window !== "undefined" ? readSessionCredential() : undefined,
    refreshToken: typeof window !== "undefined" ? readRenewalCredential() : undefined,
    email: stored.email,
    displayName: stored.displayName,
    photoURL: stored.photoURL,
    setSession: (input) => {
      persistSession(input);
      set({ ...input, authStatus: "authenticated" });
    },
    clearSession: () => {
      clearStoredSession();
      set({ authStatus: "unauthenticated", accessToken: undefined, refreshToken: undefined, email: undefined, displayName: undefined, photoURL: undefined });
    },
    setAuthStatus: (authStatus) => set({ authStatus })
  };
});
