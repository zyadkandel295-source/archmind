"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { springSoft } from "@/lib/motion";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={springSoft}
      className={cn(
        "rounded-[12px] border border-[#DDD0BE] bg-[#FFF9F1] text-[#29231E] shadow-[0_10px_30px_rgba(82,61,39,0.08)] transition-[box-shadow,border-color,background-color] duration-200 hover:border-[#CDB99F]",
        className
      )}
      {...(props as any)}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-[#E7DBCB] p-[clamp(1rem,2.4vw,1.35rem)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[clamp(1rem,2.4vw,1.35rem)]", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[clamp(1rem,2.2vw,1.125rem)] font-bold leading-tight tracking-normal text-[#29231E]", className)} {...props} />;
}
