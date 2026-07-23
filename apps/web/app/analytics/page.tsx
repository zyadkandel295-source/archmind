"use client";

import { motion } from "framer-motion";
import { ActivityDashboard } from "@/components/activity-dashboard";
import { Badge } from "@/components/ui/badge";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { fadeUp } from "@/lib/motion";

export default function AnalyticsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8">
        <Badge tone="online">Live activity</Badge>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">Website Activity</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#C4B5FD]">
          Track page views, sign-ins, sign-ups, and product events. The dashboard works locally and syncs when cloud activity tracking is enabled.
        </p>
      </motion.div>
      <ErrorBoundary name="Analytics">
        <ActivityDashboard />
      </ErrorBoundary>
    </main>
  );
}
