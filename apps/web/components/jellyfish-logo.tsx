"use client";

import React from "react";

export function JellyfishIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Vibrant Electric Cyan-Indigo-Purple Gradients */}
        <linearGradient id="agentiaCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        <linearGradient id="agentiaNodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        <linearGradient id="agentiaLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0.5" />
        </linearGradient>

        <linearGradient id="agentiaRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.3" />
        </linearGradient>

        <filter id="agentiaGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <style>
          {`
            .agentia-node { animation: agentiaPulse 2s ease-in-out infinite; }
            @keyframes agentiaPulse {
              0%, 100% { r: 8; opacity: 1; }
              50% { r: 11; opacity: 0.75; }
            }
          `}
        </style>
      </defs>

      {/* Outer Glow Halo */}
      <circle cx="256" cy="256" r="120" fill="url(#agentiaRingGrad)" opacity="0.15" filter="url(#agentiaGlow)" />

      {/* Orbital Ring */}
      <circle cx="256" cy="256" r="115" fill="none" stroke="url(#agentiaRingGrad)" strokeWidth="2.5" opacity="0.7" />

      {/* Connecting Lines (System Control) */}
      <line x1="256" y1="256" x2="256" y2="160" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="320" y2="192" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="340" y2="256" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="320" y2="320" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="256" y2="352" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="192" y2="320" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="172" y2="256" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />
      <line x1="256" y1="256" x2="192" y2="192" stroke="url(#agentiaLineGrad)" strokeWidth="2.5" />

      {/* Central Control Node */}
      <circle cx="256" cy="256" r="60" fill="url(#agentiaCoreGrad)" filter="url(#agentiaGlow)" />

      {/* Inner Ring (Command Center) */}
      <circle cx="256" cy="256" r="45" fill="none" stroke="#FFFFFF" strokeWidth="3" opacity="0.9" />

      {/* Command Symbol (Arrow/Direction) */}
      <path d="M 256 218 L 277 245 L 256 267 L 235 245 Z" fill="#030712" opacity="0.95" />

      {/* Agent Nodes (8-point configuration) */}
      <circle className="agentia-node" cx="256" cy="160" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" />
      <circle className="agentia-node" cx="320" cy="192" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.1s" }} />
      <circle className="agentia-node" cx="340" cy="256" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.2s" }} />
      <circle className="agentia-node" cx="320" cy="320" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.3s" }} />
      <circle className="agentia-node" cx="256" cy="352" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.4s" }} />
      <circle className="agentia-node" cx="192" cy="320" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.5s" }} />
      <circle className="agentia-node" cx="172" cy="256" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.6s" }} />
      <circle className="agentia-node" cx="192" cy="192" r="8" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.7s" }} />
    </svg>
  );
}

export function AgentiaLogo({ className = "w-10 h-10" }: { className?: string }) {
  return <JellyfishIcon className={className} />;
}
