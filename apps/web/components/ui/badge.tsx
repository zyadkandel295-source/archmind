"use client";

import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type BadgeTone = "blue" | "green" | "amber" | "red" | "slate" | "online" | "warning" | "new" | "neutral";

const tones: Record<BadgeTone, string> = {
  blue: "bg-[#10233F] text-[#D9E8FF] ring-1 ring-[#3B82F6]/60",
  green: "bg-[#10291B] text-[#CFFADE] ring-1 ring-[#22C55E]/55",
  amber: "bg-[#2C210C] text-[#FFE7B0] ring-1 ring-[#F59E0B]/55",
  red: "bg-[#321417] text-[#FFD4D8] ring-1 ring-[#EF4444]/55",
  slate: "bg-[#1B2330] text-[#D6DCE6] ring-1 ring-[#3A4658]",
  online: "bg-[#10291B] text-[#CFFADE] ring-1 ring-[#22C55E]/55",
  warning: "bg-[#2C210C] text-[#FFE7B0] ring-1 ring-[#F59E0B]/55",
  new: "bg-[#10233F] text-[#D9E8FF] ring-1 ring-[#3B82F6]/60",
  neutral: "bg-[#1B2330] text-[#D6DCE6] ring-1 ring-[#3A4658]"
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
