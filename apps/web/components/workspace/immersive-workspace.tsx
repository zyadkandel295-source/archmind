'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Share2, MoreVertical, Zap, RefreshCw } from 'lucide-react';
import { UserProfile } from './user-profile';
import { AssistantWorld } from './assistant-world';
import { ChatInterface } from './chat-interface';
import { InstructionsPanel } from './instructions-panel';
import { useDataPersistence } from '@/lib/context/data-persistence-context';

export function ImmersiveWorkspace() {
  const [showAssistantBrowser, setShowAssistantBrowser] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newAssistantName, setNewAssistantName] = useState('');
  const [newAssistantDesc, setNewAssistantDesc] = useState('');

  const {
    assistants,
    selectedAssistant,
    setSelectedAssistant,
    createAssistant,
    isLoadingAssistants,
    syncAllData,
    isOnline,
  } = useDataPersistence();

  const handleCreateAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssistantName.trim()) return;

    await createAssistant({
      name: newAssistantName.trim(),
      description: newAssistantDesc.trim() || 'Custom AI Assistant',
      instructions: `You are ${newAssistantName.trim()} powered by Jellyfish LLM (BIA 1 Model) developed by Zyad Kandel. Help users with precision.`,
      icon: '✨',
      color: 'from-cyan-500 to-indigo-500',
    });

    setNewAssistantName('');
    setNewAssistantDesc('');
    setIsCreating(false);
  };

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
          className="bg-slate-900/50 backdrop-blur border-r border-slate-700/50 flex flex-col overflow-hidden transition-all duration-300 relative"
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
                onSelectAssistant={(ast) => setSelectedAssistant(ast)}
                onCreateAssistant={() => setIsCreating(true)}
              />
            )}
          </AnimatePresence>

          {/* Sync Button & Collapse */}
          <div className="p-2 border-t border-slate-700/30 flex items-center justify-between gap-1">
            {showAssistantBrowser && (
              <button
                onClick={syncAllData}
                className="p-2 text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1.5 transition-colors"
                title="Sync with cloud"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAssistants ? 'animate-spin' : ''}`} />
                <span>{isOnline ? 'Synced' : 'Local Mode'}</span>
              </button>
            )}

            <motion.button
              onClick={() => setShowAssistantBrowser(!showAssistantBrowser)}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-2 ml-auto"
            >
              <Zap className="w-5 h-5 text-cyan-400" />
              {showAssistantBrowser && <span className="text-xs font-medium">Collapse</span>}
            </motion.button>
          </div>
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
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${selectedAssistant.color || 'from-blue-500 to-cyan-500'} flex items-center justify-center text-2xl shadow-lg border border-white/10`}
                  >
                    {selectedAssistant.icon || '🤖'}
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
                  <ChatInterface assistant={selectedAssistant} />
                </div>

                {/* Instructions Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="w-80 hidden xl:flex flex-col rounded-xl overflow-hidden bg-slate-800/20 border border-slate-700/30"
                >
                  <InstructionsPanel assistant={selectedAssistant as any} />
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

      {/* New Assistant Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-lg font-bold text-white mb-4">Create New AI Assistant</h3>
            <form onSubmit={handleCreateAssistant} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">Assistant Name</label>
                <input
                  type="text"
                  required
                  value={newAssistantName}
                  onChange={(e) => setNewAssistantName(e.target.value)}
                  placeholder="e.g. Data Analyst"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1 font-medium">Description</label>
                <input
                  type="text"
                  value={newAssistantDesc}
                  onChange={(e) => setNewAssistantDesc(e.target.value)}
                  placeholder="e.g. Specializes in dataset insights"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg transition-all"
                >
                  Create Assistant
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
