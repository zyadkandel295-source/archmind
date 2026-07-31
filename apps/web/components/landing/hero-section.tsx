'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain, ShieldCheck, Sparkles, Users, FileText } from 'lucide-react';
import { AgentiaLogo } from '@/components/jellyfish-logo';

export function HeroSection() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between px-4 overflow-hidden">
      {/* Navbar Header with Prominent AGENTIA Branding */}
      <header className="w-full max-w-6xl mx-auto py-6 flex items-center justify-between z-20 border-b border-blue-500/20">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="p-1 rounded-xl bg-slate-950/90 border border-sky-400/60 shadow-lg shadow-sky-500/30 group-hover:scale-105 transition-transform">
            <AgentiaLogo className="w-9 h-9 drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
          </div>
          <span className="text-2xl font-black tracking-tight text-white group-hover:text-cyan-300 transition-colors">
            AGENTIA
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-semibold text-blue-200/80">
          <Link href="/privacy" className="hover:text-cyan-300 transition-colors flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-cyan-300 transition-colors flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-cyan-400" />
            Terms of Service
          </Link>
          <Link href="/auth/login">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white">
              Sign In
            </Button>
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <div className="neural-content-overlay my-auto py-12 max-w-5xl mx-auto text-center">
        {/* Large Brand Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="p-2 rounded-2xl bg-slate-950/90 border border-sky-400/60 shadow-2xl shadow-sky-500/40 mb-4">
            <AgentiaLogo className="w-20 h-20 drop-shadow-[0_0_18px_rgba(56,189,248,0.9)]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            AGENTIA AI Platform
          </h2>
        </div>

        {/* Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30">
            <Brain className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-semibold text-blue-300">Powered by PHOENIX 1.0 AI Engine</span>
          </div>
        </div>

        {/* Main Heading */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black mb-6 bg-gradient-to-r from-blue-300 via-blue-100 to-cyan-300 bg-clip-text text-transparent leading-tight">
            Deploy Intelligent Agents & Automate Computer Operations
          </h1>
          <p className="text-base md:text-lg text-blue-200/90 max-w-3xl mx-auto leading-relaxed">
            <strong className="text-white">AGENTIA</strong> is an artificial intelligence workspace and automation platform. Signing in with Google allows users to create a secure personal AGENTIA account, build custom AI assistants, execute intelligent workflows, and automate system operations.
          </p>
        </div>

        {/* Stats Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-10 mt-8">
          <div className="text-center neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/50">
            <Users className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
            <div className="text-3xl font-black text-white mb-1">2000+</div>
            <div className="text-blue-200 font-medium">Agents Deployed Worldwide</div>
            <div className="text-xs text-blue-300/70 mt-1">Built with AGENTIA Platform</div>
          </div>

          <div className="text-center neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/50">
            <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
            <div className="text-3xl font-black text-white mb-1">PHOENIX 1.0</div>
            <div className="text-blue-200 font-medium">Advanced AI Reasoning</div>
            <div className="text-xs text-blue-300/70 mt-1">Specialized function-calling engine</div>
          </div>

          <div className="text-center neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/50">
            <Brain className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
            <div className="text-3xl font-black text-white mb-1">Zero Code</div>
            <div className="text-blue-200 font-medium">Full System Control</div>
            <div className="text-xs text-blue-300/70 mt-1">Visual agent & workflow builder</div>
          </div>
        </div>

        {/* Purpose Explanation Section (Satisfies Google Verification) */}
        <div className="p-6 rounded-2xl bg-blue-950/40 border border-blue-500/30 max-w-3xl mx-auto mb-10 text-left space-y-3">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            Application Purpose & Google Sign-In
          </h3>
          <p className="text-sm text-blue-200/90 leading-relaxed">
            AGENTIA provides an AI assistant workspace. When you sign in using Google OAuth, AGENTIA uses your email address and profile name exclusively to authenticate your session, protect your AI agent configurations, and store your daily credit quota securely. We never share your data or sell access to third parties.
          </p>
          <div className="flex gap-4 pt-2 text-xs font-semibold text-cyan-400">
            <Link href="/privacy" className="hover:underline">Read Privacy Policy &rarr;</Link>
            <Link href="/terms" className="hover:underline">Read Terms of Service &rarr;</Link>
          </div>
        </div>

        {/* Call to Action */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/auth/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 font-bold">
              Sign In with Google to Launch AGENTIA
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button 
              size="lg" 
              variant="secondary" 
              className="border-blue-500/50 text-blue-200 hover:bg-blue-500/10 px-8"
            >
              Explore Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer Credits */}
      <CreditsFooter />
    </div>
  );
}

function CreditsFooter() {
  return (
    <footer className="w-full bg-slate-950/90 border-t border-blue-500/20 py-8 px-6 mt-12 z-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Founder Credit */}
          <div>
            <p className="text-xs text-blue-400/80 uppercase tracking-widest font-semibold mb-1">Platform Brand</p>
            <p className="text-white font-black text-lg">AGENTIA</p>
            <p className="text-xs text-blue-300/70">Founder & Developer: Zyad Kandel</p>
          </div>

          {/* AI Engine Credit */}
          <div>
            <p className="text-xs text-blue-400/80 uppercase tracking-widest font-semibold mb-1">AI Engine</p>
            <p className="text-white font-bold">PHOENIX 1.0</p>
            <p className="text-xs text-blue-300/70">Fine-tuned Qwen Coder Architecture</p>
          </div>

          {/* Legal Links */}
          <div>
            <p className="text-xs text-blue-400/80 uppercase tracking-widest font-semibold mb-1">Legal & Compliance</p>
            <div className="flex flex-col gap-1 text-xs text-blue-300/80 font-medium">
              <Link href="/privacy" className="hover:text-cyan-300 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-cyan-300 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-blue-500/20 text-center text-xs text-blue-400/60">
          <p>© 2026 AGENTIA. All rights reserved. Built with PHOENIX 1.0 by Zyad Kandel.</p>
          <p className="mt-1">https://www.agentia-ai.cloud</p>
        </div>
      </div>
    </footer>
  );
}
