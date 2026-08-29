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
        "min-h-[2.75rem] w-full rounded-[9px] border border-[#CFBDA6] bg-[#FFF9F1] px-[clamp(0.85rem,2vw,1rem)] text-[clamp(0.88rem,1.8vw,0.95rem)] text-[#29231E] shadow-sm outline-none transition hover:border-[#BCA68B] focus:border-[#D9892B] focus:ring-4 focus:ring-[#D9892B]/15 disabled:cursor-not-allowed disabled:border-[#DDD0BE] disabled:bg-[#EDE1D1] disabled:text-[#8C98AA] [&_option]:bg-[#FFF9F1] [&_option]:text-[#29231E]",
        className
      )}
      {...(props as any)}
    >
      {children}
    </Component>
  );
});
