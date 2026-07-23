"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export function IconButton({ className, active, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-grid aspect-square min-h-[2.5rem] place-items-center rounded-[clamp(0.65rem,1.6vw,0.85rem)] border transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B10] disabled:cursor-not-allowed disabled:border-[#2A3545] disabled:bg-[#111720] disabled:text-[#8C98AA]",
        active
          ? "border-blue-400/80 bg-[#10233F] text-[#D9E8FF]"
          : "border-[#2A3545] bg-[#151B24] text-[#B7C0CE] hover:border-[#3B82F6] hover:bg-[#232D3B] hover:text-white",
        className
      )}
      {...props}
    />
  );
}
