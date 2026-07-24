'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, 
  MessageSquare, 
  Zap, 
  Activity
} from 'lucide-react';

interface StatCard {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: string;
  gradient: string;
  animationDelay: number;
}

export function AdvancedStats() {
  const stats: StatCard[] = [
    {
      icon: <Brain className="w-6 h-6" />,
      label: 'Active Assistants',
      value: '1',
      change: '+100%',
      gradient: 'from-blue-500 to-cyan-500',
      animationDelay: 0,
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      label: 'Total Messages',
      value: '24',
      change: '+12%',
      gradient: 'from-purple-500 to-pink-500',
      animationDelay: 0.1,
    },
    {
      icon: <Zap className="w-6 h-6" />,
      label: 'AI Requests',
      value: '128',
      change: '+24%',
      gradient: 'from-yellow-500 to-orange-500',
      animationDelay: 0.2,
    },
    {
      icon: <Activity className="w-6 h-6" />,
      label: 'System Health',
      value: '99.9%',
      change: 'Optimal',
      gradient: 'from-green-500 to-emerald-500',
      animationDelay: 0.3,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.animationDelay, duration: 0.5 }}
          className="group relative"
        >
          {/* Animated background gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-xl opacity-0 group-hover:opacity-10 transition-opacity blur-xl`}></div>

          {/* Card */}
          <div className="relative bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-xl p-6 overflow-hidden group-hover:border-slate-600/50 transition-all">
            {/* Animated top border */}
            <motion.div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`}
              initial={{ width: 0 }}
              whileInView={{ width: '100%' }}
              transition={{ delay: stat.animationDelay + 0.3, duration: 0.8 }}
            />

            {/* Icon with glow */}
            <div className={`relative w-12 h-12 bg-gradient-to-r ${stat.gradient} rounded-lg flex items-center justify-center mb-4 text-white shadow-lg group-hover:shadow-2xl transition-shadow`}>
              {stat.icon}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} rounded-lg opacity-0`}
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <p className="text-sm text-slate-400">{stat.label}</p>
              <div className="flex items-end justify-between">
                <h3 className="text-2xl font-bold text-white">{stat.value}</h3>
                {stat.change && (
                  <motion.span
                    className={`text-xs font-semibold ${
                      stat.change.startsWith('+') ? 'text-green-400' : 'text-blue-400'
                    }`}
                    animate={{ y: [0, -2, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    {stat.change}
                  </motion.span>
                )}
              </div>
            </div>

            {/* Animated line chart preview */}
            <motion.div
              className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
