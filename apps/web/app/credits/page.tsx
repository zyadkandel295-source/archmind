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
                Full-stack developer and architect behind ArchMind. 
                Designed and developed the entire platform, from frontend to backend, 
                to create an intuitive interface for building AI agents and assistants.
              </p>
            </div>
          </section>

          {/* Jellyfish LLM */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">AI Engine</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">Jellyfish LLM</p>
              <p className="text-blue-200/80 mb-4">
                Jellyfish is an advanced Large Language Model powering all AI capabilities in ArchMind.
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Advanced natural language understanding</li>
                <li>Conversational AI capabilities</li>
                <li>Context-aware responses</li>
                <li>Multi-turn dialogue support</li>
              </ul>
            </div>
          </section>

          {/* BIA 1 Model */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Model</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">BIA 1 Model</p>
              <p className="text-blue-200/80 mb-4">
                Developed by Zyad Kandel, BIA 1 is a specialized model optimized for:
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Agent and assistant creation</li>
                <li>Complex reasoning tasks</li>
                <li>Knowledge integration (RAG)</li>
                <li>Real-time processing</li>
                <li>Multi-domain understanding</li>
              </ul>
            </div>
          </section>

          {/* Community */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Community</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">2000+ Users Worldwide</p>
              <p className="text-blue-200/80">
                ArchMind is built for and powered by our amazing community of users 
                creating intelligent agents and assistants around the world.
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
