import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { Sparkles, Brain, Cpu, Globe, ArrowRight } from "lucide-react";

export const metadata = {
  title: "AI Fundamentals | AGENTIA AI BASE",
  description: "What is Artificial Intelligence, History of AI, Symbolic AI, ML, Deep Learning, Foundation Models, Agents, AGI."
};

export default function FundamentalsPage() {
  const topics = [
    { title: "What is Artificial Intelligence?", desc: "Formal definition of computational agents perceiving environments and taking optimal actions to achieve goals." },
    { title: "Symbolic AI & Expert Systems", desc: "Rule-based logic programming (Prolog, Lisp) relying on explicit human-engineered knowledge bases." },
    { title: "Machine Learning Paradigm Shift", desc: "Transition from explicit hardcoded rules to learning statistical pattern mappings directly from data." },
    { title: "Deep Learning & Representation Learning", desc: "Hierarchical neural representation learning automatically extracting features across multiple abstraction layers." },
    { title: "Generative AI & Foundation Models", desc: "Ultra-large transformer models trained on internet-scale multimodal datasets exhibiting emergent reasoning capabilities." },
    { title: "Artificial General Intelligence (AGI) Concepts", desc: "Theoretical milestones, evaluation frameworks, benchmark bounds, and alignment safety guarantees for human-level general intelligence." }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AIBaseHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="border-b border-slate-800 pb-5">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold mb-2">
            <Sparkles className="w-4 h-4" />
            SECTION 01
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white">
            Artificial Intelligence Fundamentals
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
            Essential concepts from early symbolic logic and statistical decision theory to modern deep representation learning and Artificial General Intelligence (AGI) paradigms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {topics.map((t, idx) => (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-cyan-500/50 transition-all space-y-3">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                TOPIC 0{idx + 1}
              </span>
              <h3 className="text-sm font-bold text-slate-100">{t.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
