"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, CheckCircle2, Download, ExternalLink, Library, Search } from "lucide-react";

type TextbookChapter = {
  chapter_number: number;
  title: string;
  status?: string;
  review_status?: string;
};

type KnowledgeBook = {
  id: string;
  collection: string;
  field_id: string;
  field_name: string;
  title: string;
  filename: string;
  category: string;
  categorySlug: string;
  description: string;
  pageCount: number;
  status: string;
  version: string;
  url: string;
  chapters?: TextbookChapter[];
};

export function KnowledgeBookLibrary({ fieldSlug }: { fieldSlug?: string }) {
  const [textbooks, setTextbooks] = useState<KnowledgeBook[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/knowledge/ai-base-textbooks.json")
      .then((res) => (res.ok ? (res.json() as Promise<KnowledgeBook[]>) : []))
      .then((data) => setTextbooks(Array.isArray(data) ? data : []))
      .catch(() => setTextbooks([]));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return textbooks.filter(
      (book) =>
        (!fieldSlug || book.categorySlug === fieldSlug) &&
        (!term || `${book.title} ${book.category} ${book.description}`.toLowerCase().includes(term))
    );
  }, [textbooks, fieldSlug, query]);

  return (
    <section className="space-y-6" aria-labelledby={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Library className="h-3.5 w-3.5" /> AGENTIA Academic Library
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              {fieldSlug ? "220 Pages · 5 Chapters" : "23 Textbooks · 5,060 Pages"}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-amber-950/30 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              Collection: Applications of AI and Technology
            </span>
          </div>
          <h2 id={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"} className="mt-3 text-2xl font-extrabold text-white sm:text-3xl">
            {fieldSlug ? "Curriculum Textbook (220 Pages)" : "Applications of AI and Technology — Textbook Collection"}
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl leading-relaxed">
            {fieldSlug
              ? "Comprehensive 220-page classical academic textbook tracing how Artificial Intelligence transformed research, discovery, workflows, and professional practice in this discipline through 2026."
              : "Peer-reviewed, research-based academic textbooks (exactly 220 pages each) exploring how Artificial Intelligence transformed research, discovery, workflows, and professional practice across all 23 disciplines through 2026."}
          </p>
        </div>
        {!fieldSlug && (
          <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-slate-300 shadow-inner">
            <Search className="h-4 w-4 text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search across 23 textbooks..."
              className="w-56 bg-transparent outline-none placeholder:text-slate-500"
            />
          </label>
        )}
      </div>

      {/* Grid / Single Book Layout */}
      <div className={`grid gap-6 ${fieldSlug ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {visible.map((book) => (
          <article
            key={book.id}
            className={`group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-500/40 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-cyan-950/30 ${
              fieldSlug ? "p-8 border-cyan-500/30 bg-slate-900/90" : ""
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  {book.category}
                </span>
                <span className="text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 rounded px-2.5 py-1">
                  {book.pageCount} Pages · Digital A4
                </span>
              </div>

              <h3 className={`mt-4 font-bold leading-snug text-white group-hover:text-cyan-200 transition ${
                fieldSlug ? "text-2xl sm:text-3xl" : "text-lg"
              }`}>
                {book.title}
              </h3>

              <p className={`mt-3 leading-relaxed text-slate-300 ${fieldSlug ? "text-base" : "text-sm line-clamp-3"}`}>
                {book.description}
              </p>

              {/* Chapter Table of Contents Outline */}
              {book.chapters && book.chapters.length > 0 && (
                <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-cyan-400" /> Five Core Curriculum Chapters
                  </p>
                  <ol className="space-y-1.5 text-xs text-slate-300">
                    {book.chapters.map((ch) => (
                      <li key={ch.chapter_number} className="flex items-baseline gap-2">
                        <span className="font-semibold text-cyan-400 shrink-0">Ch {ch.chapter_number}:</span>
                        <span className="truncate">{ch.title}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            <div className="mt-6 border-t border-slate-800/80 pt-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Peer-Reviewed Textbook
                </span>
                <span>Version {book.version} · {book.status}</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href={book.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  <ExternalLink className="h-4 w-4" /> Read Online (220 Pages)
                </a>
                <a
                  href={book.url}
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                >
                  <Download className="h-4 w-4" /> Download Full PDF
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      {textbooks.length > 0 && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          No PDF textbooks match that search term.
        </p>
      )}
    </section>
  );
}
