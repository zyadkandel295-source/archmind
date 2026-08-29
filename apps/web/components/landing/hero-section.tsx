'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Boxes, ShieldCheck, Users, FileText, Lock, Cpu, Database } from 'lucide-react';
import { AgentiaLogo } from '@/components/jellyfish-logo';

export function HeroSection() {
  return (
    <div className="relative flex min-h-screen flex-col justify-between overflow-hidden bg-[#EFE3D2] px-4 text-[#29231E]">
      {/* Top Navbar Header */}
      <header className="z-20 mx-auto flex w-full max-w-6xl items-center justify-between border-b border-[#DDD0BE] py-6">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="rounded-[10px] border border-[#D7B77F] bg-[#F6E4C9] p-1.5 text-[#8D501B] transition-transform group-hover:scale-105">
            <AgentiaLogo className="h-9 w-9" />
          </div>
          <span className="text-3xl font-black tracking-tight text-[#29231E] transition-colors group-hover:text-[#9A5B21]">
            AGENTIA
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-semibold text-[#6D6257]">
          <Link href="/privacy" className="flex items-center gap-1.5 transition-colors hover:text-[#9A5B21]">
            <ShieldCheck className="h-4 w-4 text-[#A96342]" />
            Privacy Policy
          </Link>
          <Link href="/terms" className="flex items-center gap-1.5 transition-colors hover:text-[#9A5B21]">
            <FileText className="h-4 w-4 text-[#A96342]" />
            Terms of Service
          </Link>
          <Link href="/auth/login">
            <Button size="sm" className="font-bold">
              Sign In
            </Button>
          </Link>
        </nav>
      </header>

      {/* Main Hero Content */}
      <div className="neural-content-overlay my-auto py-12 max-w-5xl mx-auto text-center">
        {/* Brand Logo & Name */}
        <div className="flex flex-col items-center mb-6">
          <div className="mb-4 rounded-[12px] border border-[#D7B77F] bg-[#F6E4C9] p-3.5 text-[#8D501B] shadow-[0_14px_34px_rgba(82,61,39,0.10)]">
            <AgentiaLogo className="h-20 w-20" />
          </div>
          <h1 className="text-6xl font-black tracking-tight text-[#29231E] md:text-7xl">
            AGENTIA
          </h1>
          <p className="mt-2 text-xl font-bold tracking-wide text-[#9A5B21]">
            AI Agent Workspace & System Automation Platform
          </p>
        </div>

        {/* Workspace badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E2C798] bg-[#F6E4C9] px-4 py-2">
            <Boxes className="h-4 w-4 text-[#A96342]" />
            <span className="text-sm font-semibold text-[#855719]">Your intelligent workspace</span>
          </div>
        </div>

        {/* Clear Purpose & Functionality Description */}
        <div className="max-w-3xl mx-auto mb-10 text-center">
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-100 leading-tight mb-4">
            Build, Deploy, and Execute Intelligent AI Workflows
          </h2>
          <p className="text-base md:text-lg text-blue-200/90 leading-relaxed">
            <strong className="text-white">AGENTIA</strong> is an artificial intelligence workspace platform. Users sign in with Google to create, customize, and deploy AI assistants that execute automated workflows, process complex code and documents, and manage daily tasks securely.
          </p>
        </div>

        {/* Transparency & Capabilities Grid (Directly satisfies Google Guidance) */}
        <div className="grid md:grid-cols-3 gap-6 mb-12 mt-8 text-left">
          <div className="neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/60 shadow-lg space-y-3">
            <Cpu className="w-8 h-8 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">AI Agent Builder</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Build custom AI agents tailored for coding, mathematical analysis, document extraction, and task automation.
            </p>
          </div>

          <div className="neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/60 shadow-lg space-y-3">
            <Lock className="w-8 h-8 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Secure Google Sign-In</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Google OAuth is used exclusively to authenticate user sessions, protect your agent configurations, and track credit quotas safely.
            </p>
          </div>

          <div className="neural-card p-6 rounded-xl border border-blue-500/20 bg-slate-950/60 shadow-lg space-y-3">
            <Database className="w-8 h-8 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Data Privacy Protection</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your profile data is never shared or sold. Learn how we safeguard your information in our <Link href="/privacy" className="text-cyan-400 underline">Privacy Policy</Link>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <Link href="/auth/login">
            <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white px-8 font-bold text-base shadow-lg shadow-blue-500/30">
              Sign In with Google
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button 
              size="lg" 
              variant="secondary" 
              className="border-blue-500/50 text-blue-200 hover:bg-blue-500/10 px-8 text-base font-semibold"
            >
              Explore Workspace Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Clean Footer */}
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
            <p className="text-xs text-blue-400/80 uppercase tracking-widest font-semibold mb-1">Application Name</p>
            <p className="text-white font-black text-xl">AGENTIA</p>
            <p className="text-xs text-blue-300/70">Founder & Developer: Zyad Kandel</p>
          </div>

          {/* Workspace credit */}
          <div>
            <p className="text-xs text-blue-400/80 uppercase tracking-widest font-semibold mb-1">Workspace</p>
            <p className="text-white font-bold">Built for focused assistance</p>
            <p className="text-xs text-blue-300/70">Create, organize, and deploy assistants</p>
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
          <p>© 2026 AGENTIA. All rights reserved. Built by Zyad Kandel.</p>
          <p className="mt-1">https://www.agentia-ai.cloud</p>
        </div>
      </div>
    </footer>
  );
}
