'use client';

import React, { useEffect, useRef } from 'react';

interface NeuralNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  connections: string[];
  activity: number;
  type: 'input' | 'hidden' | 'output';
}

export function AIBrainVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<NeuralNode[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.offsetWidth;
        canvas.height = canvas.parentElement.offsetHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = 400;
      }
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Initialize nodes in brain-like pattern
    const nodes: NeuralNode[] = [];
    const layers = [
      { count: 8, type: 'input' as const },
      { count: 15, type: 'hidden' as const },
      { count: 12, type: 'hidden' as const },
      { count: 6, type: 'output' as const },
    ];

    let nodeId = 0;
    const layerPositions: NeuralNode[][] = [];

    layers.forEach((layer, layerIndex) => {
      const layerNodes: NeuralNode[] = [];
      const layerX = (canvas.width / (layers.length + 1)) * (layerIndex + 1);

      for (let i = 0; i < layer.count; i++) {
        const layerY = (canvas.height / (layer.count + 1)) * (i + 1);

        layerNodes.push({
          id: `node-${nodeId++}`,
          x: layerX,
          y: layerY,
          radius: layer.type === 'hidden' ? 4 : 3,
          connections: [],
          activity: Math.random(),
          type: layer.type,
        });
      }

      layerPositions.push(layerNodes);
      nodes.push(...layerNodes);
    });

    // Create connections between layers
    for (let i = 0; i < layerPositions.length - 1; i++) {
      const currentLayer = layerPositions[i];
      const nextLayer = layerPositions[i + 1];

      if (!currentLayer || !nextLayer) continue;

      currentLayer.forEach((node) => {
        // Connect to 3-4 random nodes in next layer
        const connectionCount = Math.floor(Math.random() * 2) + 3;
        for (let j = 0; j < connectionCount; j++) {
          const randomIndex = Math.floor(Math.random() * nextLayer.length);
          const targetNode = nextLayer[randomIndex];
          if (targetNode) {
            node.connections.push(targetNode.id);
          }
        }
      });
    }

    nodesRef.current = nodes;

    // Animation loop
    const animate = () => {
      // Clear with fade
      ctx.fillStyle = 'rgba(255, 249, 241, 0.14)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update activities
      nodes.forEach((node) => {
        node.activity = Math.max(0, node.activity - 0.02);
        if (Math.random() > 0.95) {
          node.activity = Math.min(1, node.activity + Math.random() * 0.5);
        }
      });

      // Draw connections first
      nodes.forEach((node) => {
        node.connections.forEach((connectionId) => {
          const connectedNode = nodes.find((n) => n.id === connectionId);
          if (!connectedNode) return;

          const gradient = ctx.createLinearGradient(
            node.x,
            node.y,
            connectedNode.x,
            connectedNode.y
          );

          const nodeActivity = Math.max(node.activity, connectedNode.activity);
          const color = nodeActivity > 0.5 ? 0.8 : 0.3;

          gradient.addColorStop(0, `rgba(169, 99, 66, ${color * 0.24})`);
          gradient.addColorStop(0.5, `rgba(217, 137, 43, ${color * 0.52})`);
          gradient.addColorStop(1, `rgba(169, 99, 66, ${color * 0.24})`);

          ctx.strokeStyle = gradient;
          ctx.lineWidth = nodeActivity * 2;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(connectedNode.x, connectedNode.y);
          ctx.stroke();
        });
      });

      // Draw nodes
      nodes.forEach((node) => {
        const gradient = ctx.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 2
        );

        const color = node.activity > 0.5 ? '217, 137, 43' : '169, 99, 66';
        gradient.addColorStop(0, `rgba(${color}, ${node.activity})`);
        gradient.addColorStop(1, `rgba(182, 139, 99, ${node.activity * 0.4})`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (1 + node.activity * 0.5), 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.strokeStyle = `rgba(217, 137, 43, ${node.activity * 0.42})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * (2 + node.activity), 0, Math.PI * 2);
        ctx.stroke();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full rounded-lg bg-[#F7EBDD]"
    />
  );
}
