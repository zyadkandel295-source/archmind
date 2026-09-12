"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured, waitForFirebasePersistence } from "@/lib/firebase";
import { establishWorkspaceSession } from "@/lib/session-bridge";
import { useSessionStore } from "@/lib/session-store";

/**
 * Restores Firebase's persistent session exactly once at application startup.
 * The workspace token is intentionally reconstructed in memory from the
 * verified Firebase identity instead of being stored by the application.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useSessionStore((state) => state.setSession);
  const clearSession = useSessionStore((state) => state.clearSession);
  const setAuthStatus = useSessionStore((state) => state.setAuthStatus);

  useEffect(() => {
    let active = true;

    if (!isFirebaseConfigured()) {
      clearSession();
      setAuthStatus("unauthenticated");
      return;
    }

    const auth = getFirebaseAuth();
    void waitForFirebasePersistence();

    const unsubscribe = onIdTokenChanged(auth, (user) => {
      void (async () => {
        if (!user) {
          if (!active) return;
          clearSession();
          setAuthStatus("unauthenticated");
          return;
        }

        if (!active) return;
        setAuthStatus("initializing");
        try {
          const session = await establishWorkspaceSession(user);
          if (!active) return;
          setSession({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            email: session.user.email,
            displayName: session.user.displayName,
            photoURL: session.user.photoUrl
          });
        } catch {
          // Do not clear Firebase persistence here. A transient workspace API
          // outage must not sign a user out of their identity provider.
          if (!active) return;
          clearSession();
          setAuthStatus("unauthenticated");
        }
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [clearSession, setAuthStatus, setSession]);

  return <>{children}</>;
}
