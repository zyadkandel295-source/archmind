"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Filter, Search, Sparkles } from "lucide-react";
import { getAllKnowledgeResources, KNOWLEDGE_FIELDS, type KnowledgeDepth } from "@/lib/knowledge-catalog";
import { KnowledgeBookLibrary } from "./knowledge-book-library";

export function KnowledgeExplorer() {
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All fields");
  const [depth, setDepth] = useState<KnowledgeDepth | "All depths">("All depths");
  const [resourceType, setResourceType] = useState("All resource types");
  const disciplines = useMemo(() => ["All fields", ...KNOWLEDGE_FIELDS.map((field) => field.title)], []);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return KNOWLEDGE_FIELDS.filter((field) => {
      const haystack = [field.title, field.summary, ...field.disciplines, ...field.topics].join(" ").toLowerCase();
      return (discipline === "All fields" || field.title === discipline) && (!term || haystack.includes(term));
    });
  }, [discipline, query]);
  const resources = useMemo(() => getAllKnowledgeResources(), []);
  const matchingResources = useMemo(() => {
    const term = query.trim().toLowerCase();
    return resources
      .filter((resource) => {
        const haystack = [resource.title, resource.field.title, resource.discipline, resource.topic, ...resource.tags].join(" ").toLowerCase();
        return (discipline === "All fields" || resource.field.title === discipline) &&
          (depth === "All depths" || resource.difficulty === depth) &&
          (resourceType === "All resource types" || resource.type === resourceType) &&
          (!term || haystack.includes(term));
      })
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(term)) - Number(a.title.toLowerCase().startsWith(term)) || a.title.localeCompare(b.title));
  }, [depth, discipline, query, resourceType, resources]);
  const filteringResources = Boolean(query.trim()) || depth !== "All depths" || resourceType !== "All resource types";

  return (
    <section className="space-y-6" aria-labelledby="explore-fields-title">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Multidisciplinary library</p>
          <h2 id="explore-fields-title" className="mt-2 text-2xl font-bold text-white">Explore fields of knowledge</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Browse structured field hubs, learning paths, research questions, and connected concepts. Resource counts reflect the currently available catalog, not popularity.</p>
        </div>
        <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">{KNOWLEDGE_FIELDS.length} field hubs</span>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-[1fr_auto_auto_auto]">
        <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-slate-300 focus-within:border-cyan-400">
          <Search className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mathematics, biology, economics, research…" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" aria-label="Search the knowledge library" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-300">
          <Filter className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value)} className="bg-transparent py-3 outline-none">
            {disciplines.map((item) => <option key={item} value={item} className="bg-slate-950">{item}</option>)}
          </select>
        </label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-300"><select value={depth} onChange={(event) => setDepth(event.target.value as KnowledgeDepth | "All depths")} className="bg-transparent py-3 outline-none" aria-label="Filter resources by depth">{["All depths", "Foundation", "Intermediate", "Advanced", "Research"].map((item) => <option key={item} value={item} className="bg-slate-950">{item}</option>)}</select></label>
        <label className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-300"><select value={resourceType} onChange={(event) => setResourceType(event.target.value)} className="bg-transparent py-3 outline-none" aria-label="Filter resources by type">{["All resource types", "Concept explanation", "Study guide", "Research overview"].map((item) => <option key={item} value={item} className="bg-slate-950">{item}</option>)}</select></label>
      </div>

      {filteringResources ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{matchingResources.map((resource) => <Link key={resource.id} href={`/ai-base/${resource.field.slug}/${resource.slug}`} className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/50"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-200">{resource.type}</span><span className="text-xs text-slate-500">{resource.readingMinutes} min</span></div><p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{resource.field.title}</p><h3 className="mt-2 text-lg font-bold text-white group-hover:text-cyan-200">{resource.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{resource.description}</p><div className="mt-5 flex items-center gap-2 text-sm font-semibold text-cyan-300">Open resource <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div></Link>)}</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((field) => (
          <Link key={field.slug} href={`/ai-base/${field.slug}`} className="group rounded-2xl border border-slate-800 bg-slate-900/70 p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/50 hover:bg-slate-900">
            <div className="flex items-start justify-between gap-4"><span className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-400/20 bg-cyan-400/10"><BookOpen className="h-5 w-5 text-cyan-300" /></span><span className="text-xs text-slate-500">{field.topics.length} starter resources</span></div>
            <h3 className="mt-5 text-lg font-bold text-white group-hover:text-cyan-200">{field.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{field.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">{field.disciplines.slice(0, 3).map((item) => <span key={item} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{item}</span>)}</div>
            <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-cyan-300">Open field hub <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
          </Link>
        ))}
      </div>}
      {(filteringResources ? matchingResources : visible).length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400"><Sparkles className="mx-auto mb-3 h-5 w-5 text-cyan-300" />No resource matches that search yet. Try a broader topic or clear a filter.</div>}
      <KnowledgeBookLibrary />
    </section>
  );
}
