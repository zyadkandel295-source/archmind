"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type StatusTone = "online" | "warning" | "offline" | "info";

const toneClass: Record<StatusTone, string> = {
  online: "bg-[#58785F] text-[#F7F0E7]",
  warning: "bg-[#A16B27] text-[#FFF8EC]",
  offline: "bg-[#A54F41] text-[#FFF4EF]",
  info: "bg-[#D9892B] text-[#2D2117]"
};

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  pulse?: boolean;
}

export function StatusBadge({ className, tone = "online", pulse = false, children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[#DDD0BE] bg-[#FFF9F1] px-[clamp(0.6rem,1.6vw,0.8rem)] py-1 text-[clamp(0.72rem,1.6vw,0.8rem)] font-semibold text-[#62574C]",
        className
      )}
      {...props}
    >
      <span className={cn("aspect-square min-h-[0.55rem] rounded-full", toneClass[tone], pulse && "animate-pulse")} />
      {children}
    </span>
  );
}
