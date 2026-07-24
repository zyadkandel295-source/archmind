'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Share2, MoreVertical, Zap } from 'lucide-react';
import { UserProfile } from './user-profile';
import { AssistantWorld, type Assistant } from './assistant-world';
import { ChatInterface } from './chat-interface';
import { InstructionsPanel } from './instructions-panel';

export function ImmersiveWorkspace() {
  const [showAssistantBrowser, setShowAssistantBrowser] = useState(true);
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  // Default assistants list
  const assistants: Assistant[] = [
    {
      id: '1',
      name: 'Customer Support Assistant',
      icon: '🤖',
      description: 'Ready to assist with questions',
      instructions: 'You are Customer Support Assistant powered by Jellyfish LLM (BIA 1 Model) developed by Zyad Kandel. Help users with clear, precise steps.',
      color: 'from-blue-500 to-cyan-500',
      status: 'idle',
    },
    {
      id: '2',
      name: 'Research Specialist',
      icon: '🔍',
      description: 'Deep research and analysis',
      instructions: 'You are a research specialist focused on gathering and analyzing complex information.',
      color: 'from-purple-500 to-pink-500',
      status: 'idle',
    },
    {
      id: '3',
      name: 'Creative Writer',
      icon: '✍️',
      description: 'Engaging content creation',
      instructions: 'You are a creative writer specializing in engaging stories and marketing content.',
      color: 'from-yellow-500 to-orange-500',
      status: 'idle',
    },
    {
      id: '4',
      name: 'Code Engineer',
      icon: '💻',
      description: 'Code generation and debugging',
      instructions: 'You are an expert software engineer capable of writing, auditing, and debugging code.',
      color: 'from-green-500 to-emerald-500',
      status: 'idle',
    },
  ];

  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(assistants[0] || null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-screen"
      >
        {/* Left Sidebar - User Profile + Assistant Browser */}
        <motion.div
          animate={{ width: showAssistantBrowser ? 320 : 80 }}
          className="bg-slate-900/50 backdrop-blur border-r border-slate-700/50 flex flex-col overflow-hidden transition-all duration-300"
        >
          {/* User Profile Section */}
          {showAssistantBrowser && <UserProfile />}

          {/* Divider */}
          {showAssistantBrowser && (
            <div className="h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent mx-4 my-2"></div>
          )}

          {/* Assistant Browser */}
          <AnimatePresence>
            {showAssistantBrowser && (
              <AssistantWorld
                assistants={assistants}
                selectedAssistant={selectedAssistant}
                onSelectAssistant={(ast) => {
                  setSelectedAssistant(ast);
                  setMessages([]);
                }}
              />
            )}
          </AnimatePresence>

          {/* Collapse Button */}
          <motion.button
            onClick={() => setShowAssistantBrowser(!showAssistantBrowser)}
            className="p-4 text-slate-400 hover:text-slate-200 transition-colors border-t border-slate-700/30 flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5 text-cyan-400" />
            {showAssistantBrowser && <span className="text-xs font-medium">Collapse Sidebar</span>}
          </motion.button>
        </motion.div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedAssistant ? (
            <>
              {/* Chat Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-800/30 backdrop-blur border-b border-slate-700/50 px-8 py-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${selectedAssistant.color} flex items-center justify-center text-2xl shadow-lg border border-white/10`}
                  >
                    {selectedAssistant.icon}
                  </motion.div>

                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedAssistant.name}</h2>
                    <motion.p
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`text-xs ${
                        selectedAssistant.status === 'thinking'
                          ? 'text-yellow-400'
                          : 'text-green-400 font-medium'
                      }`}
                    >
                      {selectedAssistant.status === 'thinking' ? '⚡ Thinking...' : '● Online - Ready to assist'}
                    </motion.p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-slate-200">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>

              {/* Content Area - Split View */}
              <div className="flex-1 flex overflow-hidden gap-4 p-4">
                {/* Chat Interface */}
                <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-slate-800/20 border border-slate-700/30">
                  <ChatInterface
                    assistant={selectedAssistant}
                    messages={messages}
                    onMessageSend={(msg) => setMessages((prev) => [...prev, msg])}
                  />
                </div>

                {/* Instructions Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-80 hidden xl:flex flex-col rounded-xl overflow-hidden bg-slate-800/20 border border-slate-700/30"
                >
                  <InstructionsPanel assistant={selectedAssistant} />
                </motion.div>
              </div>
            </>
          ) : (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl mb-4"
                >
                  🤖
                </motion.div>
                <h3 className="text-2xl font-bold text-white mb-2">Welcome to Your AI World</h3>
                <p className="text-slate-400 text-sm">
                  Select an assistant from the left panel to get started
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
