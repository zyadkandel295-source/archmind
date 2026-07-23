"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface ToastInput {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dedupeKey?: string;
}

interface ToastItem extends Required<Omit<ToastInput, "duration">> {
  id: string;
}

let currentToasts: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function notify() {
  listeners.forEach((listener) => listener(currentToasts));
}

export function toast({ type = "info", title, message = "", duration = 3600 }: ToastInput) {
  // Suppress unauthenticated and non-critical auth redirection errors
  const isAuthError =
    type === "error" &&
    (message === "UNAUTHENTICATED" ||
     message.includes("Missing bearer token") ||
     message.includes("Invalid or expired access token") ||
     message.includes("Unauthenticated") ||
     message.includes("Firebase: Error") ||
     title.toLowerCase().includes("unauthenticated") ||
     title.toLowerCase().includes("auth"));

  if (isAuthError) {
    console.warn(`[Toast Filtered] Suppressed unauthenticated toast: ${title} - ${message}`);
    return;
  }

  const dedupeKey = arguments[0].dedupeKey;
  if (dedupeKey) {
    const existing = currentToasts.find((item) => item.dedupeKey === dedupeKey);
    if (existing) {
      currentToasts = currentToasts.map((item) => item.id === existing.id ? { ...item, type, title, message, dedupeKey } : item);
      notify();
      return;
    }
  }
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  currentToasts = [{ id, type, title, message, dedupeKey: dedupeKey ?? "" }, ...currentToasts].slice(0, 4);
  notify();
  window.setTimeout(() => dismissToast(id), duration);
}

function dismissToast(id: string) {
  currentToasts = currentToasts.filter((item) => item.id !== id);
  notify();
}

const toastStyles: Record<ToastType, string> = {
  success: "border-[#22C55E]/60 bg-[#151B24] text-[#F4F7FB]",
  error: "border-[#EF4444]/60 bg-[#151B24] text-[#F4F7FB]",
  info: "border-[#3B82F6]/60 bg-[#151B24] text-[#F4F7FB]"
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

export function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    setItems(currentToasts);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
      <AnimatePresence initial={false}>
        {items.map((item) => {
          const Icon = icons[item.type];
          return (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: 28, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 18, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className={cn(
                "pointer-events-auto overflow-hidden rounded-[clamp(0.85rem,2vw,1.1rem)] border p-[clamp(0.85rem,2vw,1rem)] shadow-lift",
                toastStyles[item.type]
              )}
            >
              <div className="flex gap-3">
                <div className="mt-0.5 grid aspect-square min-h-[2rem] shrink-0 place-items-center rounded-lg border border-[#3A4658] bg-[#1B2330] text-current">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[clamp(0.86rem,1.8vw,0.92rem)] font-black">{item.title}</div>
                  {item.message ? <div className="mt-1 text-[clamp(0.82rem,1.8vw,0.9rem)] leading-5 text-[#B7C0CE]">{item.message}</div> : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(item.id)}
                  className="rounded-lg p-1 text-[#B7C0CE] transition hover:bg-[#232D3B] hover:text-white"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

