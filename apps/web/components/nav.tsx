"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bot, CreditCard, LayoutDashboard, LibraryBig, Loader2, LogOut, UserCircle, UserRound, Wrench } from "lucide-react";
import { signOut } from "firebase/auth";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/lib/session-store";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { toast } from "@/components/ui/toast";
import * as analytics from "@/lib/analytics";

const ADMIN_EMAILS = ["zyadkandel295@gmail.com", "zyad.2524033@stemelsadat.moe.edu.eg", "demo@archmind.dev", "demo@archmind.ai"];

export function Nav() {
  const [mounted, setMounted] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);
  const email = useSessionStore((state) => state.email);
  const displayName = useSessionStore((state) => state.displayName);
  const photoURL = useSessionStore((state) => state.photoURL);

  useEffect(() => setMounted(true), []);

  const isAdmin = useMemo(() => {
    const clean = email?.toLowerCase().trim();
    return Boolean(clean && (ADMIN_EMAILS.includes(clean) || clean.endsWith("@archmind.ai") || clean.endsWith("@archmind.dev")));
  }, [email]);

  const navLinks = useMemo(() => {
    const base = [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/ai-base", label: "AI Base", icon: LibraryBig },
      { href: "/assistants/new", label: "Builder", icon: Wrench },
      { href: "/profile", label: "Profile", icon: UserRound },
      { href: "/credits", label: "Credits", icon: CreditCard }
    ];
    if (isAdmin) base.splice(3, 0, { href: "/admin", label: "Analytics", icon: BarChart3 });
    return base;
  }, [isAdmin]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try { if (isFirebaseConfigured()) await signOut(getFirebaseAuth()); } catch { /* local session is cleared below */ }
    finally {
      analytics.track("logout");
      analytics.clearUser();
      clearSession();
      toast({ type: "success", title: "Signed out", message: "You have been signed out successfully." });
      router.push("/auth/login");
      setLoggingOut(false);
    }
  }

  const accountName = displayName || email?.split("@")[0] || "Account";

  return (
    <>
      <aside className="agentia-sidebar fixed inset-y-0 left-0 z-40 hidden w-[15.5rem] flex-col p-4 md:flex">
        <Link href="/" className="flex items-center gap-3 px-2 py-2" aria-label="AGENTIA home">
          <span className="agentia-mark" aria-hidden="true" />
          <span>
            <span className="block text-[15px] font-extrabold tracking-[-.04em] text-[#29231E]">AGENTIA</span>
            <span className="block pt-0.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[#83776B]">Workspace</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#83776B]">Workspace</p>
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} data-active={active} className="agentia-nav-link"><Icon className="h-4 w-4" /><span>{item.label}</span></Link>;
          })}
        </nav>

        <div className="mt-auto border-t border-[#DDD0BE] pt-4">
          {mounted && email ? (
            <div className="rounded-[10px] border border-[#E3D4C2] bg-[#FFF9F1] p-2">
              <Link href="/profile" className="flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 hover:bg-[#F6EAD9]">
                {photoURL ? <img src={photoURL} alt="" className="h-8 w-8 rounded-full object-cover" /> : <UserCircle className="h-8 w-8 text-[#A96342]" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#29231E]">{accountName}</span><span className="block truncate pt-0.5 text-[11px] text-[#83776B]">{email}</span></span>
              </Link>
              <button onClick={logout} disabled={loggingOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-[#6B5344] transition hover:bg-[#F4E1DC] hover:text-[#934237]">
                {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <Link href="/auth/login" className="agentia-nav-link"><Bot className="h-4 w-4" /> Sign in</Link>
              <Link href="/auth/login?mode=signup" className="agentia-nav-link bg-[#D9892B] text-[#FFF9F1] hover:bg-[#BF7223]"><UserRound className="h-4 w-4" /> Get started</Link>
            </div>
          )}
        </div>
      </aside>

      <header className="agentia-sidebar sticky top-0 z-40 flex min-h-[3.7rem] items-center gap-3 border-b px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2" aria-label="AGENTIA home"><span className="agentia-mark scale-75" aria-hidden="true" /><span className="text-sm font-extrabold tracking-[-.04em]">AGENTIA</span></Link>
        <nav className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Mobile navigation">
          {navLinks.map((item) => { const Icon = item.icon; const active = pathname === item.href || pathname.startsWith(item.href); return <Link key={item.href} href={item.href} data-active={active} className={cn("agentia-nav-link shrink-0 px-2", active && "bg-[#F6E4C9]")} aria-label={item.label}><Icon className="h-4 w-4" /></Link>; })}
        </nav>
      </header>
    </>
  );
}
