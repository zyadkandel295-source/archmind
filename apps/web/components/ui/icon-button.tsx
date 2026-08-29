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
        "inline-grid aspect-square min-h-[2.5rem] place-items-center rounded-[clamp(0.65rem,1.6vw,0.85rem)] border border-[#DDD0BE] bg-[#FFF9F1] text-[#62574C] shadow-sm transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D9892B]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#EFE3D2] disabled:cursor-not-allowed disabled:border-[#DDD0BE] disabled:bg-[#EDE1D1] disabled:text-[#9A8E80]",
        active
          ? "border-[#D7B77F] bg-[#F6E4C9] text-[#7D481C]"
          : "hover:border-[#CDB99F] hover:bg-[#F6EAD9] hover:text-[#29231E]",
        className
      )}
      {...props}
    />
  );
}
