"use client";

import { ASSISTANT_ICON_OPTIONS } from "@/lib/assistant-icons";
import { cn } from "@/lib/utils";

interface AssistantIconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export function AssistantIconPicker({ value, onChange }: AssistantIconPickerProps) {
  const normalizedValue = value === "Sparkles" ? "Bot" : value;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {ASSISTANT_ICON_OPTIONS.map(({ value: optionValue, label, Icon }) => {
        const active = normalizedValue === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={cn(
              "flex min-h-[3.25rem] items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B10]",
              active
                ? "border-blue-400/70 bg-[#10233F] text-[#D9E8FF]"
                : "border-[#2A3545] bg-[#151B24] text-[#B7C0CE] hover:border-[#3A4658] hover:bg-[#1B2330] hover:text-white"
            )}
            aria-pressed={active}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg border", active ? "border-blue-300/50 bg-[#1B2330]" : "border-[#2A3545] bg-[#0F141C]")}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
