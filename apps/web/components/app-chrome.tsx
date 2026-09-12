"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { ToastViewport } from "@/components/ui/toast";
import { useSessionStore } from "@/lib/session-store";
import * as analytics from "@/lib/analytics";

const PROTECTED_PATHS = ["/dashboard", "/assistants", "/profile", "/settings", "/analytics", "/admin", "/credits", "/billing", "/knowledge", "/files", "/chats"];

function needsAuthentication(pathname: string) {
  return PROTECTED_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#FFF9F1] px-6 text-[#29231E]">
      <div className="flex items-center gap-3 rounded-2xl border border-[#E3D4C2] bg-white px-5 py-4 shadow-sm">
        <span className="agentia-mark" aria-hidden="true" />
        <div>
          <p className="text-sm font-black">AGENTIA</p>
          <p className="text-xs text-[#83776B]">Restoring your secure session…</p>
        </div>
      </div>
    </main>
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const authStatus = useSessionStore((state) => state.authStatus);
  const accessToken = useSessionStore((state) => state.accessToken);
  const sessionEmail = useSessionStore((state) => state.email);

  // Initialize GA4 once on mount
  useEffect(() => {
    analytics.init();
  }, []);

  // Set or clear GA4 User-ID when the session changes
  useEffect(() => {
    if (accessToken && sessionEmail) {
      void analytics.identify(sessionEmail);
    } else {
      analytics.clearUser();
    }
  }, [accessToken, sessionEmail]);
  const immersive =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    (pathname.startsWith("/assistants/") && pathname.endsWith("/chat")) ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/a/");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "initializing") return;
    if (authStatus === "authenticated" && (pathname === "/" || pathname === "/auth/login")) {
      router.replace("/dashboard");
      return;
    }
    if (authStatus === "unauthenticated" && needsAuthentication(pathname)) {
      const returnTo = `${pathname}${window.location.search}`;
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authStatus, pathname, router]);

  const mustWaitForAuth = pathname === "/" || pathname === "/auth/login" || needsAuthentication(pathname);
  if (authStatus === "initializing" && mustWaitForAuth) return <AuthLoadingScreen />;
  if (authStatus === "authenticated" && (pathname === "/" || pathname === "/auth/login")) return <AuthLoadingScreen />;
  if (authStatus === "unauthenticated" && needsAuthentication(pathname)) return <AuthLoadingScreen />;

  return (
    <>
      {immersive ? null : <Nav />}
      {immersive ? (
        <div className="relative z-10 w-full">{children}</div>
      ) : (
        <div className="app-main-shell relative z-10 arch-shell min-h-screen text-[#29231E]">
          <div className="flex min-h-screen w-full min-w-0 flex-col">{children}</div>
        </div>
      )}
      <ToastViewport />
    </>
  );
}
