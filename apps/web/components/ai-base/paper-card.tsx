import { ExternalLink, FileText } from "lucide-react";
import type { ResearchPaper } from "@/lib/ai-base-library";

export function PaperCard({ paper }: { paper: ResearchPaper }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-cyan-500/50 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300"><FileText className="h-3 w-3" /> {paper.venue}</span>
        <span className="text-xs text-slate-500">{paper.year}</span>
      </div>
      <h3 className="mt-4 text-base font-bold leading-snug text-slate-100">{paper.title}</h3>
      <p className="mt-2 text-xs font-medium text-slate-500">{paper.authors}</p>
      <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">{paper.summary}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{paper.tags.map((tag) => <span key={tag} className="rounded bg-slate-950 px-2 py-1 text-[10px] text-slate-400">#{tag}</span>)}</div>
      <a href={paper.url} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200 hover:underline">Read paper / source <ExternalLink className="h-3.5 w-3.5" /></a>
    </article>
  );
}
