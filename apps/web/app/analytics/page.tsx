"use client";

import { motion } from "framer-motion";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { fadeUp } from "@/lib/motion";

export default function AnalyticsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
        <Badge tone="online">Live Real-Data Engine</Badge>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">Website Activity & Analytics</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#C4B5FD]">
          Monitor real website traffic, session durations, page performance, traffic sources, device breakdowns, and live activity stream.
        </p>
      </motion.div>
      <ErrorBoundary name="Analytics">
        <AdminAnalyticsDashboard />
      </ErrorBoundary>
    </main>
  );
}
