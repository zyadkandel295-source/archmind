'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ModernAssistantIconProps {
  name: string;
  emoji: string;
  color: string;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ModernAssistantIcon({
  name,
  emoji,
  color,
  isActive = false,
  size = 'md',
}: ModernAssistantIconProps) {
  const sizeMap = {
    sm: { container: 'w-8 h-8', emoji: 'text-lg', shadow: 'shadow-md' },
    md: { container: 'w-12 h-12', emoji: 'text-2xl', shadow: 'shadow-lg' },
    lg: { container: 'w-16 h-16', emoji: 'text-4xl', shadow: 'shadow-xl' },
  };

  const sizeClass = sizeMap[size];

  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      animate={{
        scale: isActive ? 1.05 : 1,
        boxShadow: isActive
          ? `0 0 30px rgba(100, 200, 255, 0.5)`
          : `0 0 10px rgba(100, 200, 255, 0.2)`,
      }}
      className={`relative ${sizeClass.container} rounded-xl bg-gradient-to-br ${color} flex items-center justify-center ${sizeClass.shadow} cursor-pointer group transition-all`}
    >
      {/* Animated background layers */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`absolute inset-0 bg-gradient-to-br ${color} rounded-xl blur-md -z-10`}
      />

      {/* Core Icon */}
      <motion.div
        animate={{
          scale: isActive ? [1, 1.2, 1] : 1,
          rotate: isActive ? 360 : 0,
        }}
        transition={{
          scale: { duration: 2, repeat: Infinity },
          rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
        }}
        className={sizeClass.emoji}
      >
        {emoji}
      </motion.div>

      {/* Status indicator */}
      {isActive && (
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [1, 0.6, 1],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
          className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"
        />
      )}

      {/* Tooltip on hover */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileHover={{ opacity: 1, y: -35 }}
        className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-slate-900 text-white text-xs font-semibold px-2 py-1 rounded whitespace-nowrap pointer-events-none z-50 shadow-md border border-slate-700/50"
      >
        {name}
      </motion.div>
    </motion.div>
  );
}
