'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Paperclip, Zap, WifiOff, Globe } from 'lucide-react';
import { useDataPersistence, type Assistant, type Message } from '@/lib/context/data-persistence-context';
import { readSessionCredential } from '@/lib/session-keys';

interface ChatInterfaceProps {
  assistant: Assistant;
  chatId?: string;
  messages?: Message[];
  onMessageSend?: (message: { role: string; content: string }) => void;
}

function parseSseChunks(raw: string): string {
  let combined = '';
  const blocks = raw.split('\n\n');
  for (const block of blocks) {
    const eventLine = block.split('\n').find((l) => l.startsWith('event:'))?.replace('event:', '').trim();
    const dataLine = block.split('\n').find((l) => l.startsWith('data:'))?.replace('data:', '').trim();
    if (eventLine === 'token' && dataLine) {
      try {
        const parsed = JSON.parse(dataLine) as { token?: string };
        if (parsed.token) combined += parsed.token;
      } catch {}
    }
  }
  return combined;
}

export function ChatInterface({
  assistant,
  chatId,
  messages: propMessages,
  onMessageSend,
}: ChatInterfaceProps) {
  const { messages: contextMessages, addMessage, isOnline, createChat, selectedChat } = useDataPersistence();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Messages display source (prop vs context)
  const displayMessages = propMessages || contextMessages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [displayMessages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    // Ensure chat session exists
    let activeChatId = chatId || selectedChat?.id;
    if (!activeChatId) {
      const newChat = await createChat(assistant.id, `Chat with ${assistant.name}`);
      activeChatId = newChat.id;
    }

    if (onMessageSend) {
      onMessageSend({ role: 'user', content: userText });
    } else if (activeChatId) {
      await addMessage(activeChatId, assistant.id, userText, 'user');
    }

    setIsLoading(true);

    try {
      const credential = readSessionCredential();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (credential) headers.Authorization = `Bearer ${credential}`;

      const historyPayload = [
        ...displayMessages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userText },
      ];

      let response = await fetch(`/api/workspace/assistants/${encodeURIComponent(assistant.id)}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          requestId: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
          message: userText,
          conversationId: activeChatId,
          responseLength: 'balanced',
          language: 'English',
          webSearch,
        }),
      });

      if (!response.ok) {
        response = await fetch('/api/workspace/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: historyPayload,
            webSearch,
          }),
        });
      }

      let assistantReply = '';
      if (response.ok) {
        const rawText = await response.text();
        assistantReply = parseSseChunks(rawText).trim();
      }

      if (!assistantReply) {
        assistantReply = `Unable to reach the live AI stream right now. Your request ("${userText}") has been recorded.`;
      }

      if (onMessageSend) {
        onMessageSend({ role: 'assistant', content: assistantReply });
      } else if (activeChatId) {
        await addMessage(activeChatId, assistant.id, assistantReply, 'assistant');
      }
    } catch {
      const fallbackReply = `Connection error while processing "${userText}". Please check your network and try again.`;
      if (onMessageSend) {
        onMessageSend({ role: 'assistant', content: fallbackReply });
      } else if (activeChatId) {
        await addMessage(activeChatId, assistant.id, fallbackReply, 'assistant');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/40 relative">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs text-amber-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>OFFLINE MODE — Agent commands queued for sync</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {displayMessages.length === 0 ? (
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
                {assistant.icon || '🤖'}
              </motion.div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Start commanding {assistant.name}
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Send a request and I&apos;ll help with your workspace tasks using live web &amp; news search.
              </p>
            </div>
          </motion.div>
        ) : (
          displayMessages.map((message, index) => (
            <motion.div
              key={message.id || index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-md'
                    : 'bg-slate-800/80 border border-slate-700/60 text-slate-100 shadow-md'
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/30 p-4 space-y-3 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Paperclip className="w-4 h-4" />
          </button>
          <button className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Zap className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setWebSearch((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              webSearch
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{webSearch ? 'Live Web & News ON' : 'Web Search OFF'}</span>
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Send command to ${assistant.name}...`}
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
