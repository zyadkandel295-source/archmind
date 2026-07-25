'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, Sparkles, Users } from 'lucide-react';

export function HeroSection() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
      {/* Main Content */}
      <div className="neural-content-overlay">
        {/* Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 hover:border-blue-500/50 transition-colors">
            <Brain className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Powered by PHOENIX 1.0</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-300 via-blue-200 to-cyan-300 bg-clip-text text-transparent">
            Deploy Intelligent Agents That Control Your Computer
          </h1>
          <p className="text-lg md:text-xl text-blue-200/80 max-w-2xl mx-auto leading-relaxed">
            Deploy powerful AI agents to automate and control your computer systems without coding.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 mt-12">
          <div className="text-center neural-card p-6 rounded-lg">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-2">2000+</div>
            <div className="text-blue-300">Agents Deployed Worldwide</div>
            <div className="text-sm text-blue-400 mt-2">Building agents every day</div>
          </div>

          <div className="text-center neural-card p-6 rounded-lg">
            <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-2">AI-Powered</div>
            <div className="text-blue-300">PHOENIX 1.0</div>
            <div className="text-sm text-blue-400 mt-2">Advanced Reasoning Engine</div>
          </div>

          <div className="text-center neural-card p-6 rounded-lg">
            <Brain className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-2">Zero Code</div>
            <div className="text-blue-300">Full Control</div>
            <div className="text-sm text-blue-400 mt-2">Visual agent builder</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/auth/login">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 text-white px-8">
              Join 2000+ Users Building with AGENTIA
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button 
              size="lg" 
              variant="secondary" 
              className="border-blue-500/50 text-blue-300 hover:bg-blue-500/10 px-8"
            >
              View Dashboard
            </Button>
          </Link>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-2 gap-6 mt-16 pt-12 border-t border-blue-500/20">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Deploy Agents
            </h3>
            <p className="text-blue-200/70">
              Deploy intelligent agents that automatically control and command your computer systems.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Command Operations
            </h3>
            <p className="text-blue-200/70">
              Deploy your agents instantly. No setup, no complexity. Just pure automation power.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Powered by PHOENIX 1.0
            </h3>
            <p className="text-blue-200/70">
              Leveraging PHOENIX 1.0 for state-of-the-art AI reasoning and system operation.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Full System Integration
            </h3>
            <p className="text-blue-200/70">
              Integrate your systems, documents, and data sources into agents with advanced capabilities.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Credits */}
      <CreditsFooter />
    </div>
  );
}

function CreditsFooter() {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Founder Credit */}
          <div className="border-t md:border-t-0 md:border-l border-blue-500/20 md:pl-8 pt-6 md:pt-0">
            <p className="text-xs text-blue-400/60 uppercase tracking-widest mb-2">Founder & Developer</p>
            <p className="text-white font-semibold">Zyad Kandel</p>
            <p className="text-sm text-blue-300/60">Design & Development</p>
          </div>

          {/* LLM Credit */}
          <div className="border-t md:border-t-0 md:border-l border-blue-500/20 md:pl-8 pt-6 md:pt-0">
            <p className="text-xs text-blue-400/60 uppercase tracking-widest mb-2">AI Engine</p>
            <p className="text-white font-semibold">PHOENIX 1.0</p>
            <p className="text-sm text-blue-300/60">Model Developer: Zyad Kandel</p>
          </div>

          {/* Model Credit */}
          <div className="border-t md:border-t-0 md:border-l border-blue-500/20 md:pl-8 pt-6 md:pt-0">
            <p className="text-xs text-blue-400/60 uppercase tracking-widest mb-2">Model Developer</p>
            <p className="text-white font-semibold">Zyad Kandel</p>
            <p className="text-sm text-blue-300/60">PHOENIX 1.0 Advanced Model</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-blue-500/20 text-center text-xs text-blue-400/40">
          <p>© 2024 AGENTIA. Built with PHOENIX 1.0 by Zyad Kandel.</p>
          <p className="mt-2">Empowering 2000+ users to deploy intelligent agents that control their systems worldwide.</p>
        </div>
      </div>
    </div>
  );
}
