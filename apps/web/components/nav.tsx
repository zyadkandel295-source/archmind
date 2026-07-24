"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, LogOut, UserCircle } from "lucide-react";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { toast } from "@/components/ui/toast";
import { fadeDown } from "@/lib/motion";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assistants/new", label: "Builder" },
  { href: "/analytics", label: "Activity" },
  { href: "/profile", label: "Profile" },
  { href: "/credits", label: "Credits" }
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
      className="sticky top-0 z-40 border-b border-[#2A3545] bg-[#0F141C] text-[#F4F7FB] shadow-lg shadow-black/20"
    >
      <div className="mx-auto flex min-h-[4rem] max-w-7xl flex-wrap items-center justify-between gap-3 px-[clamp(1rem,3vw,2rem)] py-3">
        <Link href="/" className="interactive-lift flex min-w-0 items-center gap-3 text-[clamp(1.05rem,2.4vw,1.25rem)] font-black tracking-normal">
          <motion.span
            whileHover={{ rotate: 8, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 400, damping: 16 }}
            className="grid size-[clamp(2.25rem,4vw,2.75rem)] shrink-0 place-items-center overflow-hidden rounded-lg border border-[#3A4658] bg-[#F4F7FB]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/archmind-logo.png" alt="" className="h-full w-full object-cover" />
          </motion.span>
          <span>
            Arch<span className="text-[#93C5FD]">Mind</span>
          </span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative rounded-lg px-[clamp(0.7rem,1.8vw,0.9rem)] py-2 text-[clamp(0.82rem,1.7vw,0.9rem)] font-semibold transition duration-200",
                  active
                    ? "border border-blue-400/60 bg-[#10233F] text-[#D9E8FF] nav-link-active"
                    : "text-[#B7C0CE] hover:bg-[#232D3B] hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className={cn(
              "interactive-lift flex min-w-0 items-center gap-2 rounded-lg border border-[#2A3545] bg-[#151B24] px-2 py-1.5 text-sm font-bold text-[#B7C0CE] transition hover:border-[#3A4658] hover:bg-[#232D3B] hover:text-white sm:px-2.5",
              pathname === "/profile" && "border-blue-400/60 bg-[#10233F] text-[#D9E8FF]"
            )}
            title={mounted ? (displayName || email || "My profile") : "My profile"}
          >
            {mounted && photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt="" className="size-7 shrink-0 rounded-full object-cover" />
            ) : (
              <UserCircle className="h-7 w-7" />
            )}
            <span className="hidden max-w-[120px] truncate sm:inline">{mounted ? (displayName || email || "Profile") : "Profile"}</span>
          </Link>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => void logout()}
            disabled={loggingOut}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#2A3545] bg-[#151B24] text-[#B7C0CE] transition hover:border-[#3A4658] hover:bg-[#232D3B] hover:text-white disabled:text-[#8C98AA]"
            aria-label="Log out"
          >
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}
