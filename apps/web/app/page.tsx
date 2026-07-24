'use client';

import React from 'react';
import { NeuralNetworkBackground } from '@/components/landing/neural-network';
import { HeroSection } from '@/components/landing/hero-section';

export default function LandingPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Neural Network Background Animation */}
      <NeuralNetworkBackground />

      {/* Hero Section with Content */}
      <HeroSection />
    </main>
  );
}
