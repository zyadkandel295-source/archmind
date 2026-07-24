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
            <span className="text-sm text-blue-300">Powered by Jellyfish LLM (BIA 1 Model)</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-300 via-blue-200 to-cyan-300 bg-clip-text text-transparent">
            Create Intelligent Agents & Assistants
          </h1>
          <p className="text-lg md:text-xl text-blue-200/80 max-w-2xl mx-auto leading-relaxed">
            Build powerful AI-driven agents and assistants without coding. 
            Leverage the cutting-edge Jellyfish LLM with BIA 1 model.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 mt-12">
          <div className="text-center neural-card p-6 rounded-lg">
            <Users className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-2">2000+</div>
            <div className="text-blue-300">Users Worldwide</div>
            <div className="text-sm text-blue-400 mt-2">Building agents every day</div>
          </div>

          <div className="text-center neural-card p-6 rounded-lg">
            <Sparkles className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <div className="text-3xl font-bold text-white mb-2">AI-Powered</div>
            <div className="text-blue-300">Jellyfish LLM</div>
            <div className="text-sm text-blue-400 mt-2">BIA 1 Advanced Model</div>
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
              Join 2000+ Users
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
              Create Agents
            </h3>
            <p className="text-blue-200/70">
              Build intelligent agents that understand context, learn from interactions, 
              and adapt to user needs.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Deploy Assistants
            </h3>
            <p className="text-blue-200/70">
              Deploy your creations instantly. No infrastructure, no complexity. 
              Just pure AI power.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Powered by Jellyfish
            </h3>
            <p className="text-blue-200/70">
              Using Jellyfish LLM with BIA 1 Model - developed by Zyad Kandel.
              State-of-the-art AI capabilities.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Full RAG Support
            </h3>
            <p className="text-blue-200/70">
              Integrate knowledge sources, documents, and real-time data into your agents
              with advanced RAG capabilities.
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
            <p className="text-white font-semibold">Jellyfish LLM</p>
            <p className="text-sm text-blue-300/60">Model: BIA 1</p>
          </div>

          {/* Model Credit */}
          <div className="border-t md:border-t-0 md:border-l border-blue-500/20 md:pl-8 pt-6 md:pt-0">
            <p className="text-xs text-blue-400/60 uppercase tracking-widest mb-2">Model Developer</p>
            <p className="text-white font-semibold">Zyad Kandel</p>
            <p className="text-sm text-blue-300/60">BIA 1 Advanced Model</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-blue-500/20 text-center text-xs text-blue-400/40">
          <p>© 2024 ArchMind. Built with Jellyfish LLM (BIA 1 Model) by Zyad Kandel.</p>
          <p className="mt-2">Empowering 2000+ users to create intelligent agents worldwide.</p>
        </div>
      </div>
    </div>
  );
}
