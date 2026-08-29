"use client";

import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "amber" | "red" | "slate" | "online" | "warning" | "new" | "neutral";

const tones: Record<BadgeTone, string> = {
  blue: "bg-[#F6E4C9] text-[#8A501E] ring-1 ring-[#E4BD86]",
  green: "bg-[#E5EEE3] text-[#47664E] ring-1 ring-[#BFD1C1]",
  amber: "bg-[#F7E9D0] text-[#855719] ring-1 ring-[#E4C48D]",
  red: "bg-[#F4E1DC] text-[#934237] ring-1 ring-[#DFB7AE]",
  slate: "bg-[#F1E7DA] text-[#62574C] ring-1 ring-[#DDD0BE]",
  online: "bg-[#E5EEE3] text-[#47664E] ring-1 ring-[#BFD1C1]",
  warning: "bg-[#F7E9D0] text-[#855719] ring-1 ring-[#E4C48D]",
  new: "bg-[#F6E4C9] text-[#8A501E] ring-1 ring-[#E4BD86]",
  neutral: "bg-[#F1E7DA] text-[#62574C] ring-1 ring-[#DDD0BE]"
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "blue", ...props }: BadgeProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <span className={cn("inline-flex items-center rounded-full px-[clamp(0.6rem,1.5vw,0.75rem)] py-1 text-[clamp(0.72rem,1.6vw,0.78rem)] font-semibold", tones[tone], className)} {...props} />
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className={cn("inline-flex items-center rounded-full px-[clamp(0.6rem,1.5vw,0.75rem)] py-1 text-[clamp(0.72rem,1.6vw,0.78rem)] font-semibold", tones[tone], className)}
      {...(props as any)}
    />
  );
}
