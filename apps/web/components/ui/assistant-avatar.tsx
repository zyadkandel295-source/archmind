"use client";

import { Bot } from "lucide-react";
import { getAssistantIcon } from "@/lib/assistant-icons";
import { cn } from "@/lib/utils";

interface AssistantAvatarProps {
  name?: string;
  icon?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: "size-8 text-sm",
  md: "size-10 text-base",
  lg: "size-[3.25rem] text-lg"
};

export function AssistantAvatar({ name = "ArchMind", icon, className, size = "md" }: AssistantAvatarProps) {
  const Icon = getAssistantIcon(icon).Icon;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-[clamp(0.7rem,1.7vw,0.95rem)] border border-blue-400/60 bg-blue-600 text-white shadow-sm",
        sizes[size],
        className
      )}
      aria-hidden="true"
    >
      {icon ? (
        <Icon className="h-[1.15em] w-[1.15em]" />
      ) : initials ? (
        <span className="font-black leading-none">{initials}</span>
      ) : (
        <Bot className="h-[1em] w-[1em]" />
      )}
    </div>
  );
}
