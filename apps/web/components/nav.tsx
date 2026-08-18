"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, LogOut, UserCircle } from "lucide-react";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { toast } from "@/components/ui/toast";
import { fadeDown } from "@/lib/motion";
import * as analytics from "@/lib/analytics";

import { JellyfishIcon } from "@/components/jellyfish-logo";

const ADMIN_EMAILS = [
  "zyadkandel295@gmail.com",
  "zyad.2524033@stemelsadat.moe.edu.eg",
  "demo@archmind.dev",
  "demo@archmind.ai"
];

export function Nav() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const pathname = usePathname();
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);
  const email = useSessionStore((state) => state.email);
  const displayName = useSessionStore((state) => state.displayName);
  const photoURL = useSessionStore((state) => state.photoURL);
  const [loggingOut, setLoggingOut] = useState(false);

  const isAdmin = useMemo(() => {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    return ADMIN_EMAILS.includes(clean) || clean.endsWith("@archmind.ai") || clean.endsWith("@archmind.dev");
  }, [email]);

  const navLinks = useMemo(() => {
    const base = [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/ai-base", label: "AI Base ✨" },
      { href: "/assistants/new", label: "Builder" },
      { href: "/profile", label: "Profile" },
      { href: "/credits", label: "Credits" }
    ];

    if (isAdmin) {
      base.splice(3, 0, { href: "/admin", label: "Analytics" });
    }

    return base;
  }, [isAdmin]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      if (isFirebaseConfigured()) {
        await signOut(getFirebaseAuth());
      }
    } catch {
      // Local session is still cleared below.
    } finally {
      analytics.track("logout");
      analytics.clearUser();
      clearSession();
      toast({ type: "success", title: "Signed out", message: "You have been signed out successfully." });
      router.push("/auth/login");
      setLoggingOut(false);
    }
  }

  return (
    <motion.header
      variants={fadeDown}
      initial="hidden"
      animate="visible"
      className="sticky top-0 z-40 border-b border-[#2A2555] bg-[#0A071E]/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/30 bg-violet-600/20 text-white shadow-lg shadow-violet-600/20 transition-all group-hover:scale-105 group-hover:border-violet-400 group-hover:bg-violet-600/30">
              <JellyfishIcon className="h-6 w-6 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">AGENTIA</span>
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
                  AI PLATFORM
                </span>
              </div>
              <p className="text-[11px] font-medium text-[#C4B5FD]">Autonomous Intelligence</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-[#C4B5FD] hover:bg-[#1A1638] hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {mounted && email ? (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="flex items-center gap-2.5 rounded-xl border border-[#2A2555] bg-[#12102A] px-3 py-1.5 transition-colors hover:border-violet-500/40">
                {photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoURL} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <UserCircle className="h-6 w-6 text-violet-400" />
                )}
                <div className="hidden text-left sm:block">
                  <p className="text-xs font-bold text-white truncate max-w-[120px]">{displayName || email.split("@")[0]}</p>
                  <p className="text-[10px] text-[#C4B5FD] truncate max-w-[120px]">{email}</p>
                </div>
              </Link>
              <button
                onClick={logout}
                disabled={loggingOut}
                className="grid h-9 w-9 place-items-center rounded-xl border border-[#2A2555] bg-[#12102A] text-[#C4B5FD] transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
                title="Sign out"
              >
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-xl border border-[#2A2555] bg-[#12102A] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#1A1638]"
              >
                Sign in
              </Link>
              <Link
                href="/auth/login?mode=signup"
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-violet-600/30 transition-all hover:bg-violet-500"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
}
