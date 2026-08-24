import Link from "next/link";
import { ArrowRight, BookOpen, BookMarked, CheckCircle2, ChevronRight, ExternalLink, FlaskConical, ListChecks, Target } from "lucide-react";
import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import { FormulaDisplay } from "@/components/ai-base/formula-display";
import { PaperCard } from "@/components/ai-base/paper-card";
import { AI_BASE_SECTIONS, type AIBaseSection } from "@/lib/ai-base-library";

export function AcademicSectionPage({ section }: { section: AIBaseSection }) {
  const Icon = section.icon;
  const currentIndex = AI_BASE_SECTIONS.findIndex((item) => item.slug === section.slug);
  const related = AI_BASE_SECTIONS.filter((item) => item.slug !== section.slug).slice(Math.max(0, currentIndex - 1), currentIndex + 2).slice(0, 2);
  const studyModules = [
    {
      title: "Conceptual map",
      body: `${section.description} Start by naming the representation, objective, and source of evidence in any system you study. This habit separates a useful model explanation from a list of buzzwords.`
    },
    {
      title: "Technical reasoning",
      body: `Use the learning outcomes as checks for understanding: ${section.outcomes.join("; ")}. For each claim, ask what assumptions make it true, what data it needs, and how it could fail.`
    },
    {
      title: "Equations to implementation",
      body: `Translate each equation into a small experiment before treating it as memorized knowledge. ${section.formulas.map((formula) => `${formula.name}: ${formula.explanation}`).join(" ")}`
    },
    {
      title: "Evidence and research practice",
      body: `Read primary work with a repeatable lens: problem, method, data, measurement, limits, and what would change your mind. This section starts with ${section.papers.map((paper) => `“${paper.title}”`).join(", ")}. Follow citations outward only after you can explain the central claim in your own words.`
    }
  ];
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AIBaseHeader />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-2 text-xs text-slate-500"><Link href="/ai-base" className="hover:text-cyan-300">AI Base</Link><ChevronRight className="h-3 w-3" /><span>{section.title}</span></div>
        <section className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 via-cyan-950/30 to-slate-950 p-7 sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="relative max-w-4xl">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Icon className="h-4 w-4" /> {section.eyebrow}</div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{section.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">{section.description}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-300"><span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">Academic pathway</span><span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">{section.papers.length} curated papers</span><span className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5">Readable formulas</span></div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_1.95fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><BookOpen className="h-4 w-4 text-cyan-400" /> Learning outcomes</div><ul className="mt-5 space-y-4">{section.outcomes.map((outcome) => <li key={outcome} className="flex gap-3 text-sm leading-6 text-slate-300"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />{outcome}</li>)}</ul></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><FlaskConical className="h-4 w-4 text-cyan-400" /> Core equations <span className="text-xs font-normal text-slate-500">· rendered for reading, not code</span></div><div className="mt-5 grid gap-5">{section.formulas.map((formula) => <div key={formula.name}><div className="mb-2 text-sm font-semibold text-slate-200">{formula.name}</div><FormulaDisplay expression={formula.expression} /><p className="mt-2 text-xs leading-5 text-slate-400">{formula.explanation}</p></div>)}</div></div>
        </section>

        <section className="mt-8 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-white"><BookMarked className="h-4 w-4 text-cyan-400" /> Deep study guide</div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">A reusable technical reading framework for moving from vocabulary to working understanding. Use it alongside the formulas and papers below.</p>
            </div>
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">4-part knowledge map</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {studyModules.map((module, index) => (
              <article key={module.title} className="rounded-xl border border-slate-800 bg-slate-950/65 p-5">
                <div className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-md bg-cyan-400/10 font-mono text-xs font-bold text-cyan-300">0{index + 1}</span><h3 className="text-sm font-bold text-slate-100">{module.title}</h3></div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{module.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 grid gap-4 border-t border-slate-800 pt-6 md:grid-cols-3">
            {[
              { icon: Target, title: "Build", body: `Implement a minimal example using ${section.formulas[0]?.name ?? "the first core concept"}; record inputs, outputs, and a failure case.` },
              { icon: ListChecks, title: "Evaluate", body: "Define a baseline, a success metric, a stress test, and the evidence required before you trust an improvement." },
              { icon: FlaskConical, title: "Extend", body: "Choose one paper from the library, reproduce a small claim, then write down the questions its evaluation leaves open." }
            ].map(({ icon: PracticeIcon, title, body }) => (
              <div key={title} className="flex gap-3 rounded-xl bg-slate-900/45 p-4"><PracticeIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /><div><h3 className="text-sm font-bold text-slate-100">{title} exercise</h3><p className="mt-1 text-xs leading-5 text-slate-400">{body}</p></div></div>
            ))}
          </div>
        </section>

        <section className="mt-12"><div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4"><div><div className="flex items-center gap-2 text-sm font-bold text-white"><BookOpen className="h-4 w-4 text-cyan-400" /> Research library</div><p className="mt-1 text-sm text-slate-400">Primary sources and peer-reviewed work to deepen this page.</p></div><span className="text-xs text-slate-500">Each card includes a summary and direct paper link</span></div><div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{section.papers.map((paper) => <PaperCard key={paper.title} paper={paper} />)}</div></section>

        <section className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><ArrowRight className="h-4 w-4 text-cyan-400" /> Continue your pathway</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{related.map((item) => <Link key={item.slug} href={`/ai-base/${item.slug}`} className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 hover:border-cyan-500/40"><span><span className="block text-sm font-semibold text-slate-200 group-hover:text-cyan-300">{item.title}</span><span className="mt-1 block text-xs text-slate-500">{item.eyebrow}</span></span><ExternalLink className="h-4 w-4 text-slate-600 group-hover:text-cyan-300" /></Link>)}</div></section>
      </main>
    </div>
  );
}
