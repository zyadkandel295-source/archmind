"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[Component Error Boundary] Crash in ${this.props.name || "Component"}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="rounded-xl border border-red-400/45 bg-[#2D1115] p-4 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-200" />
          <h3 className="mt-2 text-sm font-bold text-white">Something went wrong</h3>
          <p className="mt-1 text-xs text-red-100/85">This section couldn&apos;t be loaded.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
