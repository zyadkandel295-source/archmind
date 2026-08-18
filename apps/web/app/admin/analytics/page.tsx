"use client";

import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Reveal } from "@/components/motion/reveal";

export default function AdminAnalyticsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Reveal className="mb-8">
        <div className="flex items-center gap-2">
          <Badge tone="warning">Private Admin Analytics</Badge>
          <Badge tone="online">Real Data Engine</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">AGÈNTIA Analytics Command Center</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#C4B5FD]">
          Real-time visitor tracking, session metrics, page performance, custom event telemetry, and acquisition channels powered by first-party backend storage.
        </p>
      </Reveal>
      <ErrorBoundary name="AdminAnalytics">
        <AdminAnalyticsDashboard />
      </ErrorBoundary>
    </main>
  );
}
