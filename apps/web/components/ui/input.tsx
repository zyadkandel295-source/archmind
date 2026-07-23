"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-[clamp(0.65rem,1.6vw,0.85rem)] border border-[#3A4658] bg-[#0F141C] text-[clamp(0.88rem,1.8vw,0.95rem)] text-[#F4F7FB] shadow-sm outline-none transition placeholder:text-[#7D899A] hover:border-[#4B5A70] focus:border-[#3B82F6] focus:ring-4 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:border-[#2A3545] disabled:bg-[#111720] disabled:text-[#8C98AA]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  const reduceMotion = useReducedMotion();
  const Component = reduceMotion ? "input" : motion.input;

  return (
    <Component
      ref={ref}
      whileFocus={reduceMotion ? undefined : { scale: 1.005 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn("min-h-[2.75rem] px-[clamp(0.85rem,2vw,1rem)]", fieldClass, className)}
      {...(props as any)}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref
) {
  const reduceMotion = useReducedMotion();
  const Component = reduceMotion ? "textarea" : motion.textarea;

  return (
    <Component
      ref={ref}
      whileFocus={reduceMotion ? undefined : { scale: 1.002 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn("min-h-[7rem] px-[clamp(0.85rem,2vw,1rem)] py-[clamp(0.75rem,2vw,1rem)]", fieldClass, className)}
      {...(props as any)}
    />
  );
});
