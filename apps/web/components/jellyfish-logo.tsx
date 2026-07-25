"use client";

import React from "react";

export function JellyfishIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          {`
            .agentia-node { animation: agentiaPulse 2s ease-in-out infinite; }
            @keyframes agentiaPulse {
              0%, 100% { r: 8; opacity: 1; }
              50% { r: 10; opacity: 0.7; }
            }
          `}
        </style>
      </defs>
      
      {/* Central Control Node */}
      <circle cx="256" cy="256" r="60" fill="white" opacity="1"/>
      
      {/* Inner Circle (Command Center) */}
      <circle cx="256" cy="256" r="45" fill="none" stroke="white" strokeWidth="3"/>
      
      {/* Command Symbol (Arrow/Direction) */}
      <path d="M 256 220 L 275 245 L 256 265 L 237 245 Z" fill="#06050F" opacity="0.9"/>
      
      {/* Orbital Ring */}
      <circle cx="256" cy="256" r="115" fill="none" stroke="white" strokeWidth="1.5" opacity="0.4"/>
      
      {/* Agent Nodes (8-point configuration) */}
      <circle className="agentia-node" cx="256" cy="160" r="8" fill="white"/>
      <circle className="agentia-node" cx="320" cy="192" r="8" fill="white" style={{ animationDelay: "0.1s" }}/>
      <circle className="agentia-node" cx="340" cy="256" r="8" fill="white" style={{ animationDelay: "0.2s" }}/>
      <circle className="agentia-node" cx="320" cy="320" r="8" fill="white" style={{ animationDelay: "0.3s" }}/>
      <circle className="agentia-node" cx="256" cy="352" r="8" fill="white" style={{ animationDelay: "0.4s" }}/>
      <circle className="agentia-node" cx="192" cy="320" r="8" fill="white" style={{ animationDelay: "0.5s" }}/>
      <circle className="agentia-node" cx="172" cy="256" r="8" fill="white" style={{ animationDelay: "0.6s" }}/>
      <circle className="agentia-node" cx="192" cy="192" r="8" fill="white" style={{ animationDelay: "0.7s" }}/>
      
      {/* Connecting Lines (System Control) */}
      <line x1="256" y1="256" x2="256" y2="160" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="320" y2="192" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="340" y2="256" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="320" y2="320" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="256" y2="352" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="192" y2="320" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="172" y2="256" stroke="white" strokeWidth="2" opacity="0.6"/>
      <line x1="256" y1="256" x2="192" y2="192" stroke="white" strokeWidth="2" opacity="0.6"/>
    </svg>
  );
}

export function AgentiaLogo({ className = "w-8 h-8" }: { className?: string }) {
  return <JellyfishIcon className={className} />;
}
