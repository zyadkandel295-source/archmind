"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import * as analytics from "@/lib/analytics";
import { trackPageView, trackHeartbeat } from "@/lib/first-party-analytics";

export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordActivity("page_view", { title: typeof document !== "undefined" ? document.title : "" });
    analytics.pageView(pathname, typeof document !== "undefined" ? document.title : "");
    trackPageView(pathname, typeof document !== "undefined" ? document.title : "");
  }, [pathname]);

  useEffect(() => {
    // 30-second active heartbeat
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        trackHeartbeat(30);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
