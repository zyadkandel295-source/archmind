import Link from "next/link";
import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { GradientDescentVisualizer, AttentionMatrixVisualizer, RagPipelineVisualizer } from "@/components/ai-base/interactive-visualizers";
import { ResearchAgentUI } from "@/components/ai-base/research-agent-ui";
import { Sparkles, BookOpen, Atom, Library, Wrench, ArrowRight, Brain, Zap, Terminal } from "lucide-react";

export const metadata = {
  title: "AGENTIA AI BASE | Comprehensive AI Knowledge & Research Engine",
  description: "Technical AI Knowledge Base, Mathematics, ML, Deep Learning, Transformers, AI in Science, and Research Library."
};

export default function AIBasePortalPage() {
  const learningPillars = [
    { href: "/ai-base/fundamentals", title: "1. Fundamentals", desc: "History of AI, Symbolic AI, ML vs DL, Foundation Models, Multimodal AI, AGI Concepts.", icon: Sparkles, color: "from-cyan-500/20 to-blue-500/20 text-cyan-300" },
    { href: "/ai-base/math", title: "2. Mathematics for AI", desc: "Linear Algebra, Calculus, Probability, Statistics, Optimization, Derivations & LaTeX.", icon: BookOpen, color: "from-blue-500/20 to-indigo-500/20 text-blue-300" },
    { href: "/ai-base/machine-learning", title: "3. Machine Learning", desc: "Supervised & Unsupervised Algorithms, Pseudocode, Python, Complexity, Failure Modes.", icon: Wrench, color: "from-indigo-500/20 to-violet-500/20 text-indigo-300" },
    { href: "/ai-base/deep-learning", title: "4. Deep Learning", desc: "MLPs, Backpropagation, CNNs, RNNs, LSTMs, VAEs, GANs, Diffusion Models, GNNs, MoE.", icon: Brain, color: "from-violet-500/20 to-fuchsia-500/20 text-violet-300" },
    { href: "/ai-base/llms", title: "5. Transformers & LLMs", desc: "Self-Attention, Embeddings, RLHF, DPO, Fine-Tuning (LoRA/QLoRA), KV Cache, Temperature.", icon: Zap, color: "from-fuchsia-500/20 to-pink-500/20 text-fuchsia-300" },
    { href: "/ai-base/agents", title: "6. AI Agents", desc: "ReAct Loop, Planning, Memory, Function Calling, Multi-Agent Swarms, Tool Orchestration.", icon: Terminal, color: "from-emerald-500/20 to-teal-500/20 text-emerald-300" },
    { href: "/ai-base/science", title: "7. AI + Scientific Research", desc: "Biology, Drug Discovery, Clinical Medicine, Chemistry, Physics, Astronomy, Climate Science.", icon: Atom, color: "from-teal-500/20 to-cyan-500/20 text-teal-300" },
    { href: "/ai-base/research", title: "8. Research Library & Agent", desc: "Research Paper Database, ArXiv/DOI search, Historical Timeline, Autonomous Research Agent.", icon: Library, color: "from-cyan-500/20 to-blue-600/20 text-cyan-300" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Hero Banner */}
        <section className="relative rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950/40 to-slate-950 border border-cyan-500/30 p-8 md:p-12 overflow-hidden shadow-2xl">
          <div className="absolute -right-20 -bottom-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              AGENTIA CORE SERVICE #2
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              AGENTIA <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">AI BASE</span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 leading-relaxed">
              A comprehensive technical AI knowledge engine, interactive textbook, scientific research library, and engineering reference. Explore fundamental mathematics, machine learning algorithms, transformer architectures, STEM research applications, and autonomous agents.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-mono font-bold">
              <span className="bg-slate-900/90 text-cyan-300 px-3 py-1.5 rounded-md border border-slate-800">
                LEARN AI
              </span>
              <span className="text-slate-600">→</span>
              <span className="bg-slate-900/90 text-cyan-300 px-3 py-1.5 rounded-md border border-slate-800">
                UNDERSTAND AI
              </span>
              <span className="text-slate-600">→</span>
              <span className="bg-slate-900/90 text-cyan-300 px-3 py-1.5 rounded-md border border-slate-800">
                BUILD AI
              </span>
              <span className="text-slate-600">→</span>
              <span className="bg-slate-900/90 text-cyan-300 px-3 py-1.5 rounded-md border border-slate-800">
                APPLY TO SCIENCE
              </span>
            </div>
          </div>
        </section>

        {/* Core Pillars Grid */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" />
              Knowledge Pillars & Learning Paths
            </h2>
            <span className="text-xs text-slate-400 font-mono">8 Core Technical Domains</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {learningPillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  className="group bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${p.color} border border-white/10 w-fit`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {p.desc}
                    </p>
                  </div>

                  <div className="pt-4 flex items-center justify-between text-xs font-semibold text-cyan-400 group-hover:translate-x-1 transition-transform">
                    <span>Explore Section</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Interactive Visualizers Section */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              Interactive Learning & Algorithmic Simulators
            </h2>
            <p className="text-xs text-slate-400">
              Experiment with parameters and observe loss decay, attention weight heatmaps, and retrieval pipeline steps in real time.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GradientDescentVisualizer />
            <AttentionMatrixVisualizer />
          </div>

          <RagPipelineVisualizer />
        </section>

        {/* AI Research Agent Section */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Library className="w-5 h-5 text-cyan-400" />
              AI Research Agent & Technical Synthesis
            </h2>
            <p className="text-xs text-slate-400">
              Generate structured technical research reports with equations, literature citations, and open research problems.
            </p>
          </div>

          <ResearchAgentUI />
        </section>
      </main>
    </div>
  );
}
