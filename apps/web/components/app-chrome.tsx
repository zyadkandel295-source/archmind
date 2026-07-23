"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Nav } from "@/components/nav";
import { ToastViewport } from "@/components/ui/toast";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { establishWorkspaceSession } from "@/lib/session-bridge";
import { readSessionCredential } from "@/lib/session-keys";
import { useSessionStore } from "@/lib/session-store";

const PUBLIC_PATHS = ["/", "/auth/login"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const setSession = useSessionStore((state) => state.setSession);
  const immersive =
    pathname === "/" ||
    (pathname.startsWith("/assistants/") && pathname.endsWith("/chat")) ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/a/");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.includes(pathname);
    if (isPublic) return;

    // Dashboard shows its own account-required screen instead of redirecting away.
    if (pathname === "/dashboard" && !readSessionCredential()) return;

    if (readSessionCredential()) return;

    if (!isFirebaseConfigured()) {
      router.replace("/auth/login");
      return;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (user) => {
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      establishWorkspaceSession(user)
        .then((session) =>
          setSession({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            email: session.user.email,
            displayName: session.user.displayName,
            photoURL: session.user.photoUrl
          })
        )
        .catch(() => router.replace("/auth/login"));
    });

    return unsubscribe;
  }, [pathname, router, setSession]);

  return (
    <>
      {immersive ? null : <Nav />}
      {immersive ? (
        <div className="w-full">{children}</div>
      ) : (
        <div className="arch-shell neural-grid min-h-screen text-[#F0EAFF]">
          <div className="flex min-h-screen w-full min-w-0 flex-col">{children}</div>
        </div>
      )}
      <ToastViewport />
    </>
  );
}
