"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, BookOpen, Atom, Library, Wrench, Search, Rocket } from "lucide-react";

export function AIBaseHeader() {
  const pathname = usePathname();

  const isDeployActive = pathname.startsWith("/dashboard") || pathname.startsWith("/assistants");

  const categories = [
    { href: "/ai-base", label: "Overview", icon: BookOpen },
    { href: "/ai-base/fundamentals", label: "Fundamentals", icon: Sparkles },
    { href: "/ai-base/math", label: "Mathematics", icon: BookOpen },
    { href: "/ai-base/machine-learning", label: "Machine Learning", icon: Wrench },
    { href: "/ai-base/deep-learning", label: "Deep Learning", icon: Sparkles },
    { href: "/ai-base/llms", label: "LLMs & Transformers", icon: Sparkles },
    { href: "/ai-base/computer-vision", label: "Computer Vision", icon: BookOpen },
    { href: "/ai-base/nlp", label: "NLP & RAG", icon: BookOpen },
    { href: "/ai-base/agents", label: "AI Agents", icon: Wrench },
    { href: "/ai-base/science", label: "AI in Science", icon: Atom },
    { href: "/ai-base/research", label: "Research & Library", icon: Library },
    { href: "/ai-base/build", label: "Build AI Guides", icon: Wrench }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-cyan-900/40">
      {/* Dual Core Service Switcher Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-slate-300">
            <span className="text-cyan-400 font-extrabold text-sm">AGENTIA</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 font-medium">ECOSYSTEM</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <Link
              href="/dashboard"
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                isDeployActive
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              DEPLOY YOUR AI
            </Link>

            <Link
              href="/ai-base"
              className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                !isDeployActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              AGENTIA AI BASE
            </Link>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 text-slate-400">
          <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            AI Knowledge Engine Active
          </span>
        </div>
      </div>

      {/* AI Base Navigation Sub-Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = pathname === cat.href;
            return (
              <Link
                key={cat.href}
                href={cat.href}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
                    : "text-slate-300 hover:text-white hover:bg-slate-900"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
