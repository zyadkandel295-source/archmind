'use client';

import React from 'react';
import { NeuralNetworkBackground } from '@/components/landing/neural-network';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CreditsPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      <NeuralNetworkBackground />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-20">
        <div className="neural-content-overlay">
          <h1 className="text-4xl font-bold mb-12 text-white">Credits & Acknowledgments</h1>

          {/* Founder */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Founder & Developer</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">Zyad Kandel</p>
              <p className="text-blue-200/80">
                Full-stack developer and architect behind AGENTIA. 
                Designed and developed the entire platform, from frontend to backend, 
                to create an intuitive interface for deploying intelligent agents and system automation.
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Platform capabilities</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">Built for useful work</p>
              <p className="text-blue-200/80 mb-4">
                AGENTIA helps people plan, research, build, and organize work through focused assistants and knowledge bases.
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Focused assistants for different kinds of work</li>
                <li>Knowledge-aware conversations and document synthesis</li>
                <li>Multi-step planning, coding, and technical problem-solving</li>
                <li>Private workspaces with multi-turn conversation support</li>
              </ul>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Workspace experience</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">Make an assistant your own</p>
              <p className="text-blue-200/80 mb-4">
                Start with a role, add clear instructions and sources, then refine the assistant as your work changes.
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Custom instructions, tone, and starter prompts</li>
                <li>Dedicated source collections for grounded answers</li>
                <li>Downloadable code and Markdown files when requested</li>
                <li>Specialist suggestions when a request needs a different focus</li>
              </ul>
            </div>
          </section>

          {/* Community */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Community</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">2000+ Agents Deployed Worldwide</p>
              <p className="text-blue-200/80">
                AGENTIA is built for and powered by our amazing community of users 
                deploying intelligent agents around the world.
              </p>
            </div>
          </section>

          {/* Back Button */}
          <div className="mt-12 text-center">
            <Link href="/">
              <Button variant="secondary" className="border-blue-500/50 text-blue-300">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
