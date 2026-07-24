"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { JellyfishIcon } from "@/components/jellyfish-logo";

interface JellyfishParticle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function FloatingJellyfishBackground() {
  const particles: JellyfishParticle[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: (i * 8.5 + (i % 3) * 2) % 92 + 4,
      size: Math.floor(Math.random() * 24) + 24, // 24px - 48px
      duration: Math.floor(Math.random() * 12) + 16, // 16s - 28s floating cycle
      delay: Math.random() * 8,
      opacity: Math.random() * 0.35 + 0.15 // Subtle bioluminescence opacity
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#06050F]">
      {/* Deep Dark Ambient Glow Orbs */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-sky-600/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-[120px]" />

      {/* Floating Animated Jellyfish */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            bottom: "-10%",
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity
          }}
          animate={{
            y: ["0vh", "-120vh"],
            x: ["0px", p.id % 2 === 0 ? "24px" : "-24px", "0px"],
            rotate: [0, p.id % 2 === 0 ? 8 : -8, 0]
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay
          }}
        >
          <JellyfishIcon className="h-full w-full drop-shadow-[0_0_12px_rgba(56,189,248,0.6)]" />
        </motion.div>
      ))}
    </div>
  );
}
