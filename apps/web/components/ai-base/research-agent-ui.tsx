"use client";

import { useState } from "react";
import { Bot, Sparkles, Send, FileText, CheckCircle2, Search, BookOpen, ExternalLink, Loader2 } from "lucide-react";

export function ResearchAgentUI() {
  const [topic, setTopic] = useState<string>("Latest LLM Reasoning & Test-Time Compute Models");
  const [loading, setLoading] = useState<boolean>(false);
  const [report, setReport] = useState<{
    topic: string;
    reportMarkdown: string;
    retrievedArticles: { title: string; slug: string }[];
    retrievedPapers: { title: string; year: number; arxivId?: string; doi?: string }[];
  } | null>(null);

  const handleRunAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/ai-base/research-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic })
      });
      const data = await res.json();
      if (data.success) {
        setReport(data.report);
      }
    } catch {
      // Fallback response
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
          <Bot className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            AGENTIA AI Research Agent
            <span className="bg-cyan-500/20 text-cyan-300 text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-cyan-500/40">
              Autonomous Synthesis
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Deconstructs research questions, queries AI Base literature, extracts equations & code, and compiles structured technical reports.
          </p>
        </div>
      </div>

      <form onSubmit={handleRunAgent} className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter research topic (e.g. 'Transformer Attention vs State Space Models' or 'AI in Drug Discovery')..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 transition-all placeholder:text-slate-500 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Synthesizing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Synthesize Report
            </>
          )}
        </button>
      </form>

      {report && (
        <div className="space-y-6 border-t border-slate-800 pt-6">
          {/* Metadata Citation Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" /> Grounded Knowledge Articles:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {report.retrievedArticles.map((a, i) => (
                  <span key={i} className="text-[11px] bg-cyan-950/60 text-cyan-300 px-2 py-0.5 rounded border border-cyan-800 font-mono">
                    {a.title}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> Cited Research Papers:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {report.retrievedPapers.map((p, i) => (
                  <span key={i} className="text-[11px] bg-blue-950/60 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">
                    {p.title} ({p.year})
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Generated Markdown Report Display */}
          <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans overflow-x-auto">
            <pre className="whitespace-pre-wrap font-sans text-slate-200 text-xs leading-relaxed">
              {report.reportMarkdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
