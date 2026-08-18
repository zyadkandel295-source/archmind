"use client";

import { AdminClient } from "@/components/admin-client";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Bot } from "lucide-react";
import { useState } from "react";

export default function AdminPage() {
  const [section, setSection] = useState<"analytics" | "workspace">("analytics");

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
