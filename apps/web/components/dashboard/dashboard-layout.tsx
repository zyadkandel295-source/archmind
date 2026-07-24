'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AIBrainVisualization } from './ai-brain-viz';
import { AdvancedStats } from './advanced-stats';
import { Plus, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function AdvancedDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'brain'>('overview');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 p-8"
    >
      {/* Header with gradient */}
      <div className="mb-12">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent mb-2">
              Command Center
            </h1>
            <p className="text-slate-400">Manage your AI ecosystem & assistants</p>
          </div>

          <div className="flex gap-4">
            <Button
              variant="secondary"
              size="icon"
              className="border-slate-700/50 hover:bg-slate-800"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Link href="/settings">
              <Button
                variant="secondary"
                size="icon"
                className="border-slate-700/50 hover:bg-slate-800"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/assistants/new">
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Assistant
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Tab navigation */}
        <div className="flex gap-2 border-b border-slate-700/30">
          {(['overview', 'analytics', 'brain'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative px-4 py-2 text-sm font-medium capitalize text-slate-400 hover:text-slate-200 transition-colors"
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <h2 className="text-xl font-bold text-white mb-6">System Overview</h2>
          <AdvancedStats />

          {/* AI Brain and Assistants Grid */}
          <div className="grid lg:grid-cols-3 gap-8 mt-12">
            {/* Brain Visualization */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2 h-96 rounded-xl overflow-hidden border border-slate-700/50"
            >
              <AIBrainVisualization />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link href="/assistants/new" className="block">
                    <button className="w-full py-2 px-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg text-blue-300 hover:bg-blue-500/20 transition-colors text-left font-medium">
                      + Create New Assistant
                    </button>
                  </Link>
                  <Link href="/dashboard" className="block">
                    <button className="w-full py-2 px-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg text-purple-300 hover:bg-purple-500/20 transition-colors text-left font-medium">
                      View All Assistants
                    </button>
                  </Link>
                  <Link href="/analytics" className="block">
                    <button className="w-full py-2 px-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-lg text-yellow-300 hover:bg-yellow-500/20 transition-colors text-left font-medium">
                      Analytics Report
                    </button>
                  </Link>
                </div>
              </div>

              {/* System Status */}
              <div className="bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-4">System Status</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">API Status</span>
                    <motion.span
                      animate={{ color: ['#22c55e', '#22c55e'] }}
                      className="text-green-500 font-semibold"
                    >
                      Online
                    </motion.span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Response Time</span>
                    <span className="text-cyan-400 font-semibold">142ms</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Uptime</span>
                    <span className="text-green-400 font-semibold">99.9%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-slate-300 space-y-6"
        >
          <h2 className="text-xl font-bold text-white mb-4">Analytics Dashboard</h2>
          <AdvancedStats />
          <div className="h-64 rounded-xl border border-slate-700/50 bg-slate-800/40 flex items-center justify-center">
            <p className="text-slate-400">Real-time interaction telemetry active</p>
          </div>
        </motion.div>
      )}

      {/* Brain Tab */}
      {activeTab === 'brain' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="h-96 rounded-xl overflow-hidden border border-slate-700/50"
        >
          <AIBrainVisualization />
        </motion.div>
      )}
    </motion.div>
  );
}
