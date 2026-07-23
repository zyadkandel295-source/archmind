"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type StatusTone = "online" | "warning" | "offline" | "info";

const toneClass: Record<StatusTone, string> = {
  online: "bg-[#22C55E] text-[#052E16]",
  warning: "bg-[#F59E0B] text-[#2C1700]",
  offline: "bg-[#EF4444] text-[#450A0A]",
  info: "bg-[#3B82F6] text-white"
};

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  pulse?: boolean;
}

export function StatusBadge({ className, tone = "online", pulse = false, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#2A3545] bg-[#151B24] px-[clamp(0.6rem,1.6vw,0.8rem)] py-1 text-[clamp(0.72rem,1.6vw,0.8rem)] font-semibold text-[#D6DCE6]",
        className
      )}
      {...props}
    >
      <span className={cn("aspect-square min-h-[0.55rem] rounded-full", toneClass[tone], pulse && "animate-pulse")} />
      {children}
    </span>
  );
}
