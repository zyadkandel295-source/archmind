'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface Assistant {
  id: string;
  name: string;
  icon: string;
  description: string;
  instructions: string;
  color: string;
  status: 'active' | 'idle' | 'thinking';
}

interface AssistantWorldProps {
  assistants: Assistant[];
  selectedAssistant: Assistant | null;
  onSelectAssistant: (assistant: Assistant) => void;
}

export function AssistantWorld({
  assistants,
  selectedAssistant,
  onSelectAssistant,
}: AssistantWorldProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto p-4 space-y-3"
    >
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 px-2 mb-3">
        Your AI World Assistants
      </h3>

      {assistants.map((assistant, index) => (
        <motion.button
          key={assistant.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onSelectAssistant(assistant)}
          className={`w-full text-left overflow-hidden rounded-lg p-3 transition-all group relative border ${
            selectedAssistant?.id === assistant.id
              ? `bg-gradient-to-r ${assistant.color} shadow-lg border-transparent`
              : 'bg-slate-800/30 hover:bg-slate-800/50 border-slate-700/30'
          }`}
        >
          {/* Animated Background */}
          {selectedAssistant?.id === assistant.id && (
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
                scale: selectedAssistant?.id === assistant.id ? 1.1 : 1,
                rotate: assistant.status === 'thinking' ? 360 : 0,
              }}
              transition={{
                rotate: { duration: 3, repeat: Infinity, ease: 'linear' },
              }}
              className={`text-2xl flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg ${
                selectedAssistant?.id === assistant.id
                  ? 'bg-white/20'
                  : 'bg-slate-700/50 group-hover:bg-slate-600/50'
              }`}
            >
              {assistant.icon}
            </motion.div>

            {/* Assistant Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`font-semibold text-sm ${
                    selectedAssistant?.id === assistant.id
                      ? 'text-white'
                      : 'text-slate-200 group-hover:text-white'
                  }`}
                >
                  {assistant.name}
                </p>

                {/* Status Indicator */}
                <motion.div
                  animate={{
                    scale: assistant.status === 'thinking' ? [1, 1.2, 1] : 1,
                  }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    assistant.status === 'thinking'
                      ? 'bg-yellow-400'
                      : 'bg-green-400'
                  }`}
                />
              </div>

              <p
                className={`text-xs ${
                  selectedAssistant?.id === assistant.id
                    ? 'text-white/80'
                    : 'text-slate-400 group-hover:text-slate-300'
                } line-clamp-1 mt-0.5`}
              >
                {assistant.description}
              </p>
            </div>

            {/* Sparkle on hover */}
            {selectedAssistant?.id === assistant.id && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-4 h-4 text-white/70 flex-shrink-0" />
              </motion.div>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}
