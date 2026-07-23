"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordActivity } from "@/lib/activity";

export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    recordActivity("page_view", { title: document.title });
  }, [pathname]);

  return null;
}
