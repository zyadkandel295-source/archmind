"use client";

import React from "react";

/** A quiet, modular AGENTIA mark used wherever the former decorative logo appeared. */
export function JellyfishIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="6" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="2.4" />
      <rect x="26" y="26" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="2.4" />
      <path d="M26 14H32C35.314 14 38 16.686 38 20V22M22 34H16C12.686 34 10 31.314 10 28V26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M22 22L26 26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function AgentiaLogo({ className = "w-10 h-10" }: { className?: string }) {
  return <JellyfishIcon className={className} />;
}
