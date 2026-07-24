'use client';

import React, { useEffect, useRef } from 'react';
import '../../styles/neural-network.css';

interface NeuralNode {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  active: boolean;
  connections: number[];
}

export function NeuralNetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NeuralNode[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize neural nodes
    const nodeCount = 30;
    const nodes: NeuralNode[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 3 + 2,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        active: Math.random() > 0.7,
        connections: [],
      });
    }

    // Create connections (each node connects to 3-5 nearest nodes)
    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      if (!currentNode) continue;

      const distances = nodes.map((node, index) => ({
        index,
        distance: Math.hypot(
          currentNode.x - node.x,
          currentNode.y - node.y
        ),
      }));

      distances.sort((a, b) => a.distance - b.distance);

      const connectionCount = Math.floor(Math.random() * 3) + 3;
      for (let j = 1; j <= Math.min(connectionCount, distances.length - 1); j++) {
        const item = distances[j];
        if (item && item.distance < 200) {
          currentNode.connections.push(item.index);
        }
      }
    }

    nodesRef.current = nodes;

    // Animation loop
    let animationId: number;
    const animate = () => {
      // Clear canvas with semi-transparent background (trail effect)
      ctx.fillStyle = 'rgba(15, 15, 30, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw nodes
      nodes.forEach((node) => {
        // Update position
        node.x += node.vx;
        node.y += node.vy;

        // Bounce off edges
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Keep in bounds
        node.x = Math.max(0, Math.min(canvas.width, node.x));
        node.y = Math.max(0, Math.min(canvas.height, node.y));

        // Random activation
        if (Math.random() > 0.99) {
          node.active = !node.active;
        }

        // Draw node
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius);
        gradient.addColorStop(0, node.active ? 'rgba(150, 220, 255, 1)' : 'rgba(100, 200, 255, 0.8)');
        gradient.addColorStop(1, node.active ? 'rgba(50, 100, 200, 0.6)' : 'rgba(50, 100, 200, 0.3)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (node.active ? 1.5 : 1), 0, Math.PI * 2);
        ctx.fill();

        // Draw glow
        ctx.strokeStyle = node.active 
          ? 'rgba(100, 200, 255, 0.8)' 
          : 'rgba(100, 200, 255, 0.4)';
        ctx.lineWidth = node.active ? 3 : 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (node.active ? 2 : 1.5), 0, Math.PI * 2);
        ctx.stroke();
      });

      // Draw connections
      nodes.forEach((node) => {
        node.connections.forEach((connectionIndex) => {
          const connectedNode = nodes[connectionIndex];
          if (!connectedNode) return;
          
          ctx.strokeStyle = node.active || connectedNode.active 
            ? 'rgba(100, 200, 255, 0.8)' 
            : 'rgba(100, 200, 255, 0.3)';
          ctx.lineWidth = node.active || connectedNode.active ? 2 : 1;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(connectedNode.x, connectedNode.y);
          ctx.stroke();
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="neural-network-bg">
      <canvas
        ref={canvasRef}
        className="neural-network-canvas"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black opacity-20"></div>
    </div>
  );
}
