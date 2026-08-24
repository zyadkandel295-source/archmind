import Link from "next/link";
import { ArrowRight, BookOpen, Compass, Layers3, SearchCheck } from "lucide-react";
import { AIBaseHeader } from "@/components/ai-base/ai-base-header";
import type { KnowledgeField } from "@/lib/knowledge-catalog";
import { getFieldResources, getKnowledgeField } from "@/lib/knowledge-catalog";

export function FieldHub({ field }: { field: KnowledgeField }) {
  const resources = getFieldResources(field);
  const related = field.related.map(getKnowledgeField).filter((item): item is KnowledgeField => Boolean(item));
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AIBaseHeader />
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 p-7 sm:p-10">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Field hub · Educational resources</p>
          <h1 className="relative mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">{field.title}</h1>
          <p className="relative mt-5 max-w-3xl text-base leading-7 text-slate-300">{field.summary} Begin with a foundation topic, then move through applications, methods, limitations, and open questions at your own depth.</p>
          <div className="relative mt-6 flex flex-wrap gap-2">{field.disciplines.map((item) => <span key={item} className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-200">{item}</span>)}</div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><Compass className="h-4 w-4 text-cyan-300" /> Recommended pathway</div><p className="mt-2 text-sm leading-6 text-slate-400">Follow a simple progression: establish vocabulary, connect it to evidence and examples, then develop a researchable question. Each resource lets you change depth without leaving the topic.</p><ol className="mt-5 space-y-3">{resources.map((resource, index) => <li key={resource.id} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-200">{index + 1}</span><div><p className="text-sm font-semibold text-slate-200">{resource.topic}</p><p className="text-xs text-slate-500">{resource.type} · {resource.readingMinutes} min</p></div></li>)}</ol></div>
          <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><SearchCheck className="h-4 w-4 text-emerald-300" /> Research integrity</div><p className="mt-3 text-sm leading-6 text-slate-400">Resources identify their status and do not invent scholarly evidence. Verify external sources before citing them in academic work.</p><span className="mt-5 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200">Source verification required</span></aside>
        </section>

        <section><div className="flex items-end justify-between gap-4 border-b border-slate-800 pb-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Resources</p><h2 className="mt-2 text-2xl font-bold text-white">Start exploring {field.title}</h2></div><span className="text-sm text-slate-500">{resources.length} currently available</span></div><div className="mt-6 grid gap-5 md:grid-cols-3">{resources.map((resource) => <Link key={resource.id} href={`/ai-base/${field.slug}/${resource.slug}`} className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-cyan-400/50"><BookOpen className="h-5 w-5 text-cyan-300" /><div className="mt-5 flex gap-2"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{resource.type}</span><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{resource.difficulty}</span></div><h3 className="mt-4 text-lg font-bold text-white group-hover:text-cyan-200">{resource.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{resource.description}</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-cyan-300">Read resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></Link>)}</div></section>

        {related.length > 0 && <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6"><div className="flex items-center gap-2 text-sm font-bold text-white"><Layers3 className="h-4 w-4 text-violet-300" /> Connected fields</div><div className="mt-4 flex flex-wrap gap-3">{related.map((item) => <Link key={item.slug} href={`/ai-base/${item.slug}`} className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm font-medium text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200">{item.title}</Link>)}</div></section>}
      </main>
    </div>
  );
}
