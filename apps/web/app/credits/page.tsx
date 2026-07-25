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

          {/* PHOENIX 1.0 */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">AI Engine</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">PHOENIX 1.0</p>
              <p className="text-blue-200/80 mb-4">
                PHOENIX 1.0 is an advanced Large Language Model powering all AI capabilities in AGENTIA.
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Advanced natural language understanding and system reasoning</li>
                <li>Conversational AI and system command capabilities</li>
                <li>Context-aware operation execution</li>
                <li>Multi-turn operation session support</li>
              </ul>
            </div>
          </section>

          {/* PHOENIX 1.0 Model */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold text-blue-300 mb-4">Model</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
              <p className="text-lg font-semibold text-white mb-2">PHOENIX 1.0 Advanced Model</p>
              <p className="text-blue-200/80 mb-4">
                Developed by Zyad Kandel, PHOENIX 1.0 is a specialized model optimized for:
              </p>
              <ul className="list-disc list-inside text-blue-200/70 space-y-2">
                <li>Agent deployment and system control</li>
                <li>Complex system reasoning tasks</li>
                <li>System integration (RAG)</li>
                <li>Real-time system operation processing</li>
                <li>Multi-domain understanding</li>
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
