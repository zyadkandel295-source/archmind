'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus } from 'lucide-react';
import type { Assistant } from '@/lib/context/data-persistence-context';

interface AssistantWorldProps {
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
  onCreateAssistant?: () => void;
}

export function AssistantWorld({
  assistants,
  selectedAssistant,
  onSelectAssistant,
  onCreateAssistant,
}: AssistantWorldProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      <div className="flex items-center justify-between px-2 mb-3">
        <h3 className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">
          Your AI World Assistants
        </h3>
        {onCreateAssistant && (
          <button
            onClick={onCreateAssistant}
            className="p-1 hover:bg-slate-700/50 text-cyan-400 rounded-md transition-colors flex items-center gap-1 text-xs"
            title="Create Assistant"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        )}
      </div>

      {assistants.map((assistant, index) => {
        const icon = assistant.icon || '🤖';
        const color = assistant.color || 'from-blue-500 to-cyan-500';
        const status = assistant.status || 'idle';
        const isSelected = selectedAssistant?.id === assistant.id;

        return (
          <motion.button
            key={assistant.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => onSelectAssistant(assistant)}
            className={`w-full text-left overflow-hidden rounded-lg p-3 transition-all group relative border ${
              isSelected
                ? `bg-gradient-to-r ${color} shadow-lg border-transparent`
                : 'bg-slate-800/30 hover:bg-slate-800/50 border-slate-700/30'
            }`}
          >
            {/* Animated Background */}
            {isSelected && (
              <motion.div
                layoutId="selectedBg"
                className="absolute inset-0 bg-white/10"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}

            <div className="relative flex items-start gap-3">
              {/* Assistant Icon */}
              <motion.div
                animate={{
                  scale: isSelected ? 1.1 : 1,
                  rotate: status === 'thinking' ? 360 : 0,
                }}
                transition={{
                  rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
                }}
                className={`text-2xl flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg ${
                  isSelected
                    ? 'bg-white/20'
                    : 'bg-slate-700/50 group-hover:bg-slate-600/50'
                }`}
              >
                {icon}
              </motion.div>

              {/* Assistant Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`font-semibold text-sm ${
                      isSelected
                        ? 'text-white'
                        : 'text-slate-200 group-hover:text-white'
                    }`}
                  >
                    {assistant.name}
                  </p>

                  {/* Status Indicator */}
                  <motion.div
                    animate={{
                      scale: status === 'thinking' ? [1, 1.2, 1] : 1,
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      status === 'thinking'
                        ? 'bg-yellow-400'
                        : 'bg-green-400'
                    }`}
                  />
                </div>

                <p
                  className={`text-xs ${
                    isSelected
                      ? 'text-white/80'
                      : 'text-slate-400 group-hover:text-slate-300'
                  } line-clamp-1 mt-0.5`}
                >
                  {assistant.description || 'AI Assistant'}
                </p>
              </div>

              {/* Sparkle on hover */}
              {isSelected && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="w-4 h-4 text-white/70 flex-shrink-0" />
                </motion.div>
              )}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export type { Assistant };
