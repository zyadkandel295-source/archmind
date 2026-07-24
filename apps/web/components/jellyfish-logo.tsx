"use client";

import React from "react";

export function JellyfishIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="jellyBellComponent" x1="20" y1="20" x2="108" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8"/>
          <stop offset="50%" stopColor="#818CF8"/>
          <stop offset="100%" stopColor="#C084FC"/>
        </linearGradient>
        <linearGradient id="jellyGlowComponent" x1="64" y1="10" x2="64" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.2"/>
        </linearGradient>
      </defs>

      {/* Outer Glow */}
      <circle cx="64" cy="50" r="42" fill="url(#jellyGlowComponent)" opacity="0.4"/>

      {/* Dome */}
      <path d="M 28 58 C 28 28, 100 28, 100 58 C 100 66, 88 68, 80 64 C 72 60, 68 66, 64 64 C 60 62, 56 60, 48 64 C 40 68, 28 66, 28 58 Z" 
            fill="url(#jellyBellComponent)" 
            stroke="#E0F2FE" 
            strokeWidth="2.5"/>

      {/* Bioluminescent Dots */}
      <ellipse cx="64" cy="46" rx="22" ry="12" fill="#E0F2FE" opacity="0.6"/>
      <circle cx="52" cy="44" r="3" fill="#FFFFFF"/>
      <circle cx="64" cy="42" r="4" fill="#FFFFFF"/>
      <circle cx="76" cy="44" r="3" fill="#FFFFFF"/>

      {/* Tentacles */}
      <path d="M 36 65 Q 32 82 38 102 T 34 118" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.95"/>
      <path d="M 48 66 Q 54 85 46 104 T 52 120" stroke="#818CF8" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M 64 65 Q 60 88 68 106 T 64 122" stroke="#C084FC" strokeWidth="4" strokeLinecap="round" fill="none"/>
      <path d="M 80 66 Q 74 85 82 104 T 76 120" stroke="#818CF8" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M 92 65 Q 96 82 90 102 T 94 118" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.95"/>
      <path d="M 56 66 Q 64 80 58 98" stroke="#F472B6" strokeWidth="2" strokeDasharray="3 3" fill="none"/>
      <path d="M 72 66 Q 64 80 70 98" stroke="#F472B6" strokeWidth="2" strokeDasharray="3 3" fill="none"/>
    </svg>
  );
}
