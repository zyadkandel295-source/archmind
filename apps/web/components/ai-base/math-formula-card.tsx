"use client";

import { useState } from "react";
import { Code, Play, Variable, HelpCircle, CheckCircle2, ChevronRight } from "lucide-react";

export interface VariableBreakdown {
  variable: string;
  meaning: string;
}

export interface NumericalExample {
  input: string;
  stepByStep: string;
  output: string;
}

export interface MathFormulaProps {
  equation: string;
  latexName: string;
  variableBreakdown: VariableBreakdown[];
  whyItExists: string;
  howDerived: string;
  numericalExample?: NumericalExample;
  pythonCode?: string;
}

export function MathFormulaCard({
  equation,
  latexName,
  variableBreakdown,
  whyItExists,
  howDerived,
  numericalExample,
  pythonCode
}: MathFormulaProps) {
  const [activeTab, setActiveTab] = useState<"math" | "example" | "code">("math");

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg shadow-black/40 hover:border-cyan-500/50 transition-all group">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Variable className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
            {latexName}
          </h4>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("math")}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              activeTab === "math"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Formulation
          </button>
          {numericalExample && (
            <button
              onClick={() => setActiveTab("example")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === "example"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Play className="w-3 h-3" />
              Example
            </button>
          )}
          {pythonCode && (
            <button
              onClick={() => setActiveTab("code")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1 ${
                activeTab === "code"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code className="w-3 h-3" />
              Code
            </button>
          )}
        </div>
      </div>

      {/* Main Equation Box */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 mb-4 text-center overflow-x-auto">
        <span className="font-mono text-cyan-300 text-base md:text-lg tracking-wide font-bold">
          {equation}
        </span>
      </div>

      {/* Content Tabs */}
      {activeTab === "math" && (
        <div className="space-y-4 text-xs">
          {/* Why it exists */}
          <div>
            <span className="text-slate-400 font-semibold flex items-center gap-1 mb-1">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" /> Why this equation exists:
            </span>
            <p className="text-slate-300 leading-relaxed pl-4 border-l-2 border-cyan-500/40">
              {whyItExists}
            </p>
          </div>

          {/* How derived */}
          <div>
            <span className="text-slate-400 font-semibold flex items-center gap-1 mb-1">
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400" /> How it is derived:
            </span>
            <p className="text-slate-300 leading-relaxed pl-4 border-l-2 border-slate-700">
              {howDerived}
            </p>
          </div>

          {/* Variable Breakdown Grid */}
          {variableBreakdown.length > 0 && (
            <div>
              <span className="text-slate-400 font-semibold block mb-2">Variable Breakdown:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {variableBreakdown.map((item, idx) => (
                  <div key={idx} className="bg-slate-950/50 p-2 rounded-md border border-slate-800/80 flex items-start gap-2">
                    <span className="font-mono font-bold text-cyan-400 bg-cyan-950/50 px-1.5 py-0.5 rounded text-[11px]">
                      {item.variable}
                    </span>
                    <span className="text-slate-300 text-[11px] leading-tight">
                      {item.meaning}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "example" && numericalExample && (
        <div className="space-y-3 text-xs">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
            <span className="text-slate-400 block mb-1 text-[10px] font-sans font-bold uppercase">Input Parameters:</span>
            <div className="text-cyan-300">{numericalExample.input}</div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-mono">
            <span className="text-slate-400 block mb-1 text-[10px] font-sans font-bold uppercase">Step-by-Step Numerical Walkthrough:</span>
            <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">{numericalExample.stepByStep}</pre>
          </div>

          <div className="bg-cyan-950/30 p-3 rounded-lg border border-cyan-500/30 font-mono flex items-center justify-between">
            <span className="text-cyan-400 font-sans font-bold text-[10px] uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Output Result:
            </span>
            <span className="text-cyan-200 font-bold">{numericalExample.output}</span>
          </div>
        </div>
      )}

      {activeTab === "code" && pythonCode && (
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs overflow-x-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 text-[10px] text-slate-500 font-sans">
            <span>Python 3.11 Implementation</span>
            <span>NumPy / PyTorch</span>
          </div>
          <pre className="text-cyan-300 leading-relaxed">{pythonCode}</pre>
        </div>
      )}
    </div>
  );
}
