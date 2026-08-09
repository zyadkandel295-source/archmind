"use client";

import { useState } from "react";
import { Sliders, Play, RefreshCw, Zap, Sparkles, Layers, Database, ArrowRight } from "lucide-react";

export function GradientDescentVisualizer() {
  const [lr, setLr] = useState<number>(0.1);
  const [iterations, setIterations] = useState<number>(10);
  const [initialX, setInitialX] = useState<number>(4.0);

  // Compute quadratic loss L(x) = x^2, derivative L'(x) = 2x
  const computeSteps = () => {
    const steps = [];
    let currentX = initialX;
    for (let i = 0; i <= iterations; i++) {
      const loss = currentX * currentX;
      const grad = 2 * currentX;
      steps.push({ step: i, x: currentX, loss, grad });
      currentX = currentX - lr * grad;
    }
    return steps;
  };

  const steps = computeSteps();
  const finalStep = steps[steps.length - 1]!;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-bold text-slate-100">Interactive Gradient Descent Simulator</h4>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
          Loss Function: L(x) = x²
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">
            Learning Rate (η): <span className="text-cyan-300 font-mono">{lr}</span>
          </label>
          <input
            type="range"
            min="0.01"
            max="1.1"
            step="0.01"
            value={lr}
            onChange={(e) => setLr(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-950 rounded cursor-pointer"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">
            Start Position (x₀): <span className="text-cyan-300 font-mono">{initialX}</span>
          </label>
          <input
            type="range"
            min="-5"
            max="5"
            step="0.5"
            value={initialX}
            onChange={(e) => setInitialX(parseFloat(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-950 rounded cursor-pointer"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1.5">
            Total Steps: <span className="text-cyan-300 font-mono">{iterations}</span>
          </label>
          <input
            type="range"
            min="1"
            max="25"
            step="1"
            value={iterations}
            onChange={(e) => setIterations(parseInt(e.target.value))}
            className="w-full accent-cyan-500 bg-slate-950 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Step Convergence Progress Bar */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-4 font-mono text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-400">Final Position x_{iterations}: <strong className="text-cyan-300">{finalStep.x.toFixed(4)}</strong></span>
          <span className="text-slate-400">Final Loss: <strong className="text-cyan-300">{finalStep.loss.toFixed(4)}</strong></span>
        </div>
        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full transition-all duration-300 ${
              finalStep.loss < 0.05
                ? "bg-cyan-400"
                : lr > 0.95
                ? "bg-rose-500"
                : "bg-amber-400"
            }`}
            style={{ width: `${Math.min(100, Math.max(5, (1 - finalStep.loss / (initialX * initialX || 1)) * 100))}%` }}
          />
        </div>
        {lr >= 1.0 && (
          <span className="text-rose-400 text-[11px] block mt-1.5 font-sans font-medium">
            ⚠️ Warning: Learning rate η ≥ 1.0 causes gradient divergence!
          </span>
        )}
      </div>

      {/* Numerical Step Table */}
      <div className="max-h-36 overflow-y-auto bg-slate-950/60 rounded-lg border border-slate-800 text-xs font-mono">
        <table className="w-full text-left">
          <thead className="bg-slate-900/80 text-slate-400 text-[11px] sticky top-0">
            <tr>
              <th className="p-2">Step</th>
              <th className="p-2">x Value</th>
              <th className="p-2">Gradient ∇L</th>
              <th className="p-2">Loss L(x)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {steps.slice(0, 10).map((s) => (
              <tr key={s.step} className="hover:bg-slate-900/50">
                <td className="p-2 text-cyan-400 font-bold">#{s.step}</td>
                <td className="p-2">{s.x.toFixed(4)}</td>
                <td className="p-2">{s.grad.toFixed(4)}</td>
                <td className="p-2 text-amber-300">{s.loss.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AttentionMatrixVisualizer() {
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);

  const words = ["The", "animal", "did", "not", "cross", "because", "it", "was", "tired"];

  // Mock self-attention weights for "it" connecting strongly to "animal"
  const attentionWeights = [
    [0.7, 0.1, 0.05, 0.05, 0.05, 0.05, 0.0, 0.0, 0.0],
    [0.1, 0.8, 0.05, 0.02, 0.01, 0.01, 0.01, 0.0, 0.0],
    [0.05, 0.1, 0.75, 0.05, 0.02, 0.01, 0.01, 0.01, 0.0],
    [0.02, 0.02, 0.1, 0.8, 0.03, 0.01, 0.01, 0.01, 0.0],
    [0.01, 0.05, 0.1, 0.04, 0.7, 0.05, 0.02, 0.02, 0.01],
    [0.01, 0.02, 0.02, 0.05, 0.1, 0.75, 0.03, 0.01, 0.01],
    [0.02, 0.85, 0.02, 0.01, 0.02, 0.02, 0.02, 0.02, 0.02], // "it" attends 0.85 to "animal"
    [0.01, 0.01, 0.01, 0.01, 0.02, 0.02, 0.02, 0.8, 0.1],
    [0.01, 0.02, 0.01, 0.01, 0.02, 0.02, 0.02, 0.1, 0.79]
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-bold text-slate-100">Self-Attention Softmax Heatmap Visualizer</h4>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
          Softmax(QKᵀ / √d_k)
        </span>
      </div>

      <p className="text-xs text-slate-300 mb-4 leading-relaxed">
        Observe how the pronoun <strong className="text-cyan-300 font-mono">&quot;it&quot;</strong> places 85% of its attention weight on <strong className="text-cyan-300 font-mono">&quot;animal&quot;</strong> in the attention matrix.
      </p>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-xs">
          <div className="grid grid-cols-10 gap-1 text-center">
            <div className="text-[10px] text-slate-500 font-bold">Query \ Key</div>
            {words.map((w, i) => (
              <div key={i} className="text-[10px] text-cyan-400 font-bold truncate p-1">
                {w}
              </div>
            ))}

            {words.map((rowWord, rIdx) => (
              <>
                <div key={`row-${rIdx}`} className="text-[10px] text-cyan-400 font-bold truncate p-1 self-center text-left">
                  {rowWord}
                </div>
                {words.map((_, cIdx) => {
                  const val = attentionWeights[rIdx]![cIdx]!;
                  const opacity = Math.min(1, val * scaleFactor);
                  return (
                    <div
                      key={`cell-${rIdx}-${cIdx}`}
                      className="h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all border border-slate-800/40"
                      style={{
                        backgroundColor: `rgba(6, 182, 212, ${opacity})`,
                        color: opacity > 0.4 ? "#020617" : "#cbd5e1"
                      }}
                      title={`Query '${rowWord}' -> Key '${words[cIdx]}': ${(val * 100).toFixed(1)}%`}
                    >
                      {(val * 100).toFixed(0)}%
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RagPipelineVisualizer() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    { step: 1, title: "Documents & Chunking", desc: "Split raw PDF/text docs into overlapping 512-token chunks." },
    { step: 2, title: "Embedding Generation", desc: "Pass chunks through embedding model (bge-large-en) to generate 1024-dim vectors." },
    { step: 3, title: "Vector DB Indexing", desc: "Store vector embeddings in HNSW index for fast nearest neighbor search." },
    { step: 4, title: "Cosine Similarity Query", desc: "Compute cos(θ) = (A·B)/(||A||||B||) between user query and chunk vectors." },
    { step: 5, title: "LLM Context Synthesis", desc: "Inject top-k retrieved chunks into prompt context and generate grounded answer." }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          <h4 className="text-sm font-bold text-slate-100">Interactive RAG Pipeline Simulator</h4>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
          Retrieval Augmented Generation
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4">
        {steps.map((s) => (
          <button
            key={s.step}
            onClick={() => setActiveStep(s.step)}
            className={`p-3 rounded-lg border text-left transition-all text-xs font-semibold ${
              activeStep === s.step
                ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20"
                : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="text-[10px] opacity-80 uppercase tracking-wider mb-1">Step 0{s.step}</div>
            <div className="truncate">{s.title}</div>
          </button>
        ))}
      </div>

      {/* Active Step Breakdown Box */}
      <div className="bg-slate-950 p-4 rounded-lg border border-cyan-500/30 flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h5 className="text-sm font-bold text-cyan-300 mb-1">
            Step {activeStep}: {steps[activeStep - 1]?.title}
          </h5>
          <p className="text-xs text-slate-300 leading-relaxed">
            {steps[activeStep - 1]?.desc}
          </p>
        </div>
      </div>
    </div>
  );
}
