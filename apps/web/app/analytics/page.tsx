"use client";

import { useSessionStore } from "@/lib/session-store";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Reveal } from "@/components/motion/reveal";
import Link from "next/link";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";

const ADMIN_EMAILS = [
  "zyadkandel295@gmail.com",
  "zyad.2524033@stemelsadat.moe.edu.eg",
  "demo@archmind.dev",
  "demo@archmind.ai"
];

export default function AnalyticsPage() {
  const email = useSessionStore((state) => state.email);
  const cleanEmail = (email || "").toLowerCase().trim();
  const isAdmin = ADMIN_EMAILS.includes(cleanEmail) || cleanEmail.endsWith("@archmind.ai") || cleanEmail.endsWith("@archmind.dev");

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[#2A2555] bg-[#12102A]/90 p-8 md:p-12 text-center backdrop-blur-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-violet-500/30 bg-violet-600/20 text-violet-300">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl md:text-3xl font-black text-white">Private Platform Analytics</h1>
          <p className="mt-3 max-w-lg mx-auto text-sm leading-6 text-[#C4B5FD]">
            Detailed website telemetry and server visitor analytics are restricted to the system administrator account.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <Reveal>
        <div className="flex items-center gap-2">
          <Badge tone="online">Admin Telemetry</Badge>
          <Badge tone="blue">100% Real Backend Data</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-black md:text-5xl text-white">Website Activity & Analytics</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C4B5FD]">
          Live tracking metrics, visitor counters, and custom event telemetry for <strong>zyadkandel295@gmail.com</strong>.
        </p>
      </Reveal>
      <ErrorBoundary name="Analytics">
        <AdminAnalyticsDashboard />
      </ErrorBoundary>
    </main>
  );
}
