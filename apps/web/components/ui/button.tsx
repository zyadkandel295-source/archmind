"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "framer-motion";
import { springSnappy } from "@/lib/motion";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-blue-400/60 bg-blue-600 text-white shadow-sm hover:border-blue-300 hover:bg-blue-700 focus-visible:ring-blue-400",
  secondary:
    "border border-[#3A4658] bg-[#1B2330] text-[#F4F7FB] shadow-sm hover:border-blue-400/70 hover:bg-[#232D3B] hover:text-white focus-visible:ring-blue-400",
  ghost: "border border-transparent text-[#B7C0CE] hover:border-[#3A4658] hover:bg-[#232D3B] hover:text-white focus-visible:ring-blue-400",
  danger: "border border-red-500/60 bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500"
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-[2rem] px-[clamp(0.7rem,1.8vw,0.95rem)] text-[clamp(0.78rem,1.8vw,0.875rem)]",
  md: "min-h-[2.5rem] px-[clamp(0.9rem,2vw,1.15rem)] text-[clamp(0.82rem,1.8vw,0.9rem)]",
  lg: "min-h-[3rem] px-[clamp(1.1rem,2.4vw,1.45rem)] text-[clamp(0.95rem,2vw,1rem)]",
  icon: "aspect-square min-h-[2.5rem] p-0"
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className, variant = "primary", size = "md", onClick, children, ...props }: ButtonProps) {
  const reduceMotion = useReducedMotion();
  const rippleHost = useRef<HTMLButtonElement>(null);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!reduceMotion && rippleHost.current) {
      const rect = rippleHost.current.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "pointer-events-none absolute rounded-full bg-white/30 animate-[ripple_0.55s_ease-out_forwards]";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      rippleHost.current.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    }
    onClick?.(event);
  }

  return (
    <motion.button
      ref={rippleHost}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={springSnappy}
      onClick={handleClick}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[clamp(0.65rem,1.6vw,0.85rem)] font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B10] disabled:pointer-events-none disabled:translate-y-0 disabled:border-[#2A3545] disabled:bg-[#111720] disabled:text-[#8C98AA] disabled:opacity-100",
        variants[variant],
        sizes[size],
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
