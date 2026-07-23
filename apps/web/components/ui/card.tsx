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
        "rounded-[clamp(0.85rem,2vw,1.1rem)] border border-[#2A3545] bg-[#151B24] text-[#F4F7FB] shadow-soft transition-[box-shadow,border-color,background-color] duration-200 hover:border-[#3A4658]",
        className
      )}
      {...(props as any)}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-[#2A3545] p-[clamp(1rem,2.4vw,1.35rem)]", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-[clamp(1rem,2.4vw,1.35rem)]", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-[clamp(1rem,2.2vw,1.125rem)] font-bold leading-tight tracking-normal text-[#F4F7FB]", className)} {...props} />;
}
