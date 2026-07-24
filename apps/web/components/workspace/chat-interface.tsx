'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, Zap } from 'lucide-react';
import type { Assistant } from './assistant-world';

interface ChatInterfaceProps {
  assistant: Assistant;
  messages: Array<{ role: string; content: string }>;
  onMessageSend: (message: { role: string; content: string }) => void;
}

export function ChatInterface({
  assistant,
  messages,
  onMessageSend,
}: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    // Add user message
    onMessageSend({ role: 'user', content: userText });
    setInput('');

    // Simulate loading & response
    setIsLoading(true);
    setTimeout(() => {
      onMessageSend({
        role: 'assistant',
        content: `I am ${assistant.name}, powered by Jellyfish LLM (BIA 1 Model) developed by Zyad Kandel. I have received your query: "${userText}". How else may I assist you today?`,
      });
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-full flex items-center justify-center min-h-[300px]"
          >
            <div className="text-center max-w-sm">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl mb-4"
              >
                {assistant.icon}
              </motion.div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Start a conversation with {assistant.name}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Powered by Jellyfish LLM (BIA 1 Model) developed by Zyad Kandel. Ask me anything to begin exploring.
              </p>
            </div>
          </motion.div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-md'
                    : `bg-slate-800/80 border border-slate-700/60 text-slate-100 shadow-md`
                }`}
              >
                {message.content}
              </div>
            </motion.div>
          ))
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 bg-slate-800/50 w-fit rounded-xl border border-slate-700/40"
          >
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-2 h-2 bg-cyan-400 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
              className="w-2 h-2 bg-cyan-400 rounded-full"
            />
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
              className="w-2 h-2 bg-cyan-400 rounded-full"
            />
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/30 p-4 space-y-3 bg-slate-900/60 backdrop-blur">
        <div className="flex gap-2">
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Zap className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Message ${assistant.name}...`}
            className="flex-1 bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl px-4 py-2.5 font-medium hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
