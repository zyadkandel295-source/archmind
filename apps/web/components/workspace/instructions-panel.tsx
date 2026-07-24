'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Copy, Edit2, Settings } from 'lucide-react';
import type { Assistant } from './assistant-world';

interface InstructionsPanelProps {
  assistant: Assistant;
}

export function InstructionsPanel({ assistant }: InstructionsPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full bg-gradient-to-b from-slate-800/30 to-slate-900/30 overflow-y-auto"
    >
      {/* Header */}
      <div className="border-b border-slate-700/30 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-white text-sm">System Instructions</h3>
          <div className="flex gap-1">
            <button 
              className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200"
              onClick={() => navigator.clipboard.writeText(assistant.instructions)}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          {assistant.name}'s behavior and personality guidelines
        </p>
      </div>

      {/* Instructions Content */}
      <div className="flex-1 p-4 space-y-4">
        {/* Main Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4"
        >
          <h4 className="text-[10px] font-semibold text-blue-300 mb-2 uppercase tracking-wider">
            Primary Instruction
          </h4>
          <p className="text-xs text-blue-100/90 leading-relaxed">
            {assistant.instructions}
          </p>
        </motion.div>

        {/* Model Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4"
        >
          <h4 className="text-[10px] font-semibold text-cyan-300 mb-3 uppercase tracking-wider">
            AI Engine
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Model:</span>
              <span className="text-cyan-300 font-semibold">Jellyfish LLM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Version:</span>
              <span className="text-cyan-300 font-semibold">BIA 1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Developer:</span>
              <span className="text-cyan-300 font-semibold">Zyad Kandel</span>
            </div>
          </div>
        </motion.div>

        {/* Capabilities */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4"
        >
          <h4 className="text-[10px] font-semibold text-purple-300 mb-3 uppercase tracking-wider">
            Capabilities
          </h4>
          <ul className="space-y-2 text-xs text-purple-100/90">
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">✓</span>
              <span>Advanced reasoning & analysis</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">✓</span>
              <span>Context awareness across sessions</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">✓</span>
              <span>Knowledge base integration (RAG)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-purple-400 mt-0.5">✓</span>
              <span>Real-time processing</span>
            </li>
          </ul>
        </motion.div>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700/30 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-white text-xs font-medium border border-slate-700/40"
        >
          <Settings className="w-4 h-4 text-slate-400" />
          Advanced Settings
        </motion.button>
      </div>
    </motion.div>
  );
}
