"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-[9px] border border-[#CFBDA6] bg-[#FFF9F1] text-[clamp(0.88rem,1.8vw,0.95rem)] text-[#29231E] shadow-sm outline-none transition placeholder:text-[#83776B] hover:border-[#BCA68B] focus:border-[#D9892B] focus:ring-4 focus:ring-[#D9892B]/15 disabled:cursor-not-allowed disabled:border-[#DDD0BE] disabled:bg-[#EDE1D1] disabled:text-[#8A7D6F]";

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
