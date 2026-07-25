"use client";

import React from "react";

export function JellyfishIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg className={className} viewBox="110 110 292 292" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* High-Contrast Electric Cyan-Indigo-Purple Gradients */}
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
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#818CF8" stopOpacity="0.7" />
        </linearGradient>

        <linearGradient id="agentiaRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#A855F7" stopOpacity="0.5" />
        </linearGradient>

        <filter id="agentiaGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>

        <style>
          {`
            .agentia-node { animation: agentiaPulse 2s ease-in-out infinite; }
            @keyframes agentiaPulse {
              0%, 100% { r: 12; opacity: 1; }
              50% { r: 15; opacity: 0.85; }
            }
          `}
        </style>
      </defs>

      {/* Outer Glow Halo */}
      <circle cx="256" cy="256" r="135" fill="url(#agentiaRingGrad)" opacity="0.25" filter="url(#agentiaGlow)" />

      {/* Orbital Ring */}
      <circle cx="256" cy="256" r="125" fill="none" stroke="url(#agentiaRingGrad)" strokeWidth="4.5" opacity="0.85" />

      {/* Connecting Lines (System Control) */}
      <line x1="256" y1="256" x2="256" y2="150" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="330" y2="182" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="362" y2="256" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="330" y2="330" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="256" y2="362" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="182" y2="330" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="150" y2="256" stroke="url(#agentiaLineGrad)" strokeWidth="4" />
      <line x1="256" y1="256" x2="182" y2="182" stroke="url(#agentiaLineGrad)" strokeWidth="4" />

      {/* Central Control Node */}
      <circle cx="256" cy="256" r="68" fill="url(#agentiaCoreGrad)" filter="url(#agentiaGlow)" />

      {/* Inner Ring (Command Center) */}
      <circle cx="256" cy="256" r="50" fill="none" stroke="#FFFFFF" strokeWidth="4" opacity="0.95" />

      {/* Command Symbol (Arrow/Direction) */}
      <path d="M 256 214 L 280 245 L 256 270 L 232 245 Z" fill="#030712" opacity="0.98" />

      {/* Agent Nodes (8-point configuration) */}
      <circle className="agentia-node" cx="256" cy="150" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" />
      <circle className="agentia-node" cx="330" cy="182" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.1s" }} />
      <circle className="agentia-node" cx="362" cy="256" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.2s" }} />
      <circle className="agentia-node" cx="330" cy="330" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.3s" }} />
      <circle className="agentia-node" cx="256" cy="362" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.4s" }} />
      <circle className="agentia-node" cx="182" cy="330" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.5s" }} />
      <circle className="agentia-node" cx="150" cy="256" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.6s" }} />
      <circle className="agentia-node" cx="182" cy="182" r="12" fill="url(#agentiaNodeGrad)" filter="url(#agentiaGlow)" style={{ animationDelay: "0.7s" }} />
    </svg>
  );
}

export function AgentiaLogo({ className = "w-10 h-10" }: { className?: string }) {
  return <JellyfishIcon className={className} />;
}
