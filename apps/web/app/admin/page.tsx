"use client";

import { useSessionStore } from "@/lib/session-store";
import { AdminClient } from "@/components/admin-client";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Bot, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

const ADMIN_EMAILS = [
  "zyadkandel295@gmail.com",
  "zyad.2524033@stemelsadat.moe.edu.eg",
  "demo@archmind.dev",
  "demo@archmind.ai"
];

export default function AdminPage() {
  const [section, setSection] = useState<"analytics" | "workspace">("analytics");
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
          <h1 className="mt-6 text-2xl md:text-3xl font-black text-white">Administrator Access Required</h1>
          <p className="mt-3 max-w-lg mx-auto text-sm leading-6 text-[#C4B5FD]">
            The platform command center is restricted to the administrator account (zyadkandel295@gmail.com).
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="warning">Admin Restricted</Badge>
              <Badge tone="online">Live Platform Data</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-black md:text-5xl text-white">AGÈNTIA Admin Command Center</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#C4B5FD]">
              Real-time website traffic analytics, visitor counters, and AI workspace telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-[#2A2555] bg-[#12102A] p-1.5 text-xs font-semibold text-[#DDD6FE]">
            <button
              onClick={() => setSection("analytics")}
              className={"flex items-center gap-2 rounded-lg px-4 py-2 transition-all " + (section === "analytics" ? "bg-violet-600 font-bold text-white shadow-md shadow-violet-600/30" : "hover:bg-[#1A1638] hover:text-white")}
            >
              <BarChart3 className="h-4 w-4" />
              Website Analytics
            </button>
            <button
              onClick={() => setSection("workspace")}
              className={"flex items-center gap-2 rounded-lg px-4 py-2 transition-all " + (section === "workspace" ? "bg-violet-600 font-bold text-white shadow-md shadow-violet-600/30" : "hover:bg-[#1A1638] hover:text-white")}
            >
              <Bot className="h-4 w-4" />
              Workspace AI Overview
            </button>
          </div>
        </div>
      </Reveal>

      {section === "analytics" ? (
        <AdminAnalyticsDashboard />
      ) : (
        <div className="space-y-6">
          <Card className="border-[#2A2555] bg-[#12102A] p-6">
            <CardContent className="p-0">
              <h2 className="text-xl font-bold text-white mb-2">AI Assistants & Conversation Metrics</h2>
              <p className="text-sm text-[#C4B5FD] mb-6">Live usage counters across all configured agents and user sessions.</p>
              <AdminClient />
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
