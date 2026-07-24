'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Settings } from 'lucide-react';
import { useSessionStore } from '@/lib/session-store';
import Link from 'next/link';

export function UserProfile() {
  const email = useSessionStore((state) => state.email) || 'user@archmind.dev';
  const displayName = useSessionStore((state) => state.displayName) || 'Architect';
  const clearSession = useSessionStore((state) => state.clearSession);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-4"
    >
      {/* User Avatar and Info */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-lg font-bold text-white shadow-md"
        >
          {displayName.slice(0, 1).toUpperCase()}
        </motion.div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate text-sm">{displayName}</h3>
          <p className="text-xs text-slate-400 truncate">{email}</p>
        </div>
      </div>

      {/* User Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-slate-800/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800 border border-slate-700/30"
        >
          <p className="text-lg font-bold text-cyan-400">1</p>
          <p className="text-[10px] text-slate-400">Assistants</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-slate-800/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800 border border-slate-700/30"
        >
          <p className="text-lg font-bold text-blue-400">12</p>
          <p className="text-[10px] text-slate-400">Chats</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-slate-800/50 rounded-lg p-2 cursor-pointer hover:bg-slate-800 border border-slate-700/30"
        >
          <p className="text-lg font-bold text-purple-400">1.2k</p>
          <p className="text-[10px] text-slate-400">Tokens</p>
        </motion.div>
      </div>

      {/* User Actions */}
      <div className="space-y-1">
        <Link href="/profile" className="block">
          <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors text-xs font-medium text-left">
            <Settings className="w-4 h-4 text-slate-400" />
            Profile & Settings
          </button>
        </Link>
        <button
          onClick={() => clearSession()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-red-400 transition-colors text-xs font-medium text-left"
        >
          <LogOut className="w-4 h-4 text-slate-400" />
          Logout
        </button>
      </div>
    </motion.div>
  );
}
