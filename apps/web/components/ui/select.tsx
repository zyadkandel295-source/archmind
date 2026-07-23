"use client";

import type { SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref
) {
  const reduceMotion = useReducedMotion();
  const Component = reduceMotion ? "select" : motion.select;

  return (
    <Component
      ref={ref}
      whileFocus={reduceMotion ? undefined : { scale: 1.005 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "min-h-[2.75rem] w-full rounded-[clamp(0.65rem,1.6vw,0.85rem)] border border-[#3A4658] bg-[#0F141C] px-[clamp(0.85rem,2vw,1rem)] text-[clamp(0.88rem,1.8vw,0.95rem)] text-[#F4F7FB] shadow-sm outline-none transition hover:border-blue-400/70 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:border-[#2A3545] disabled:bg-[#111720] disabled:text-[#8C98AA] [&_option]:bg-[#0F141C] [&_option]:text-[#F4F7FB]",
        className
      )}
      {...(props as any)}
    >
      {children}
    </Component>
  );
});
