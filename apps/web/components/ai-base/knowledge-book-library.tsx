"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, BookmarkCheck, Download, ExternalLink, Library, Search } from "lucide-react";

type KnowledgeBook = {
  id: string;
  title: string;
  category: string;
  categorySlug: string;
  description: string;
  pageCount: number;
  status: string;
  version: string;
  url: string;
};

export function KnowledgeBookLibrary({ fieldSlug }: { fieldSlug?: string }) {
  const [activeTab, setActiveTab] = useState<"textbooks" | "monographs">("textbooks");
  const [textbooks, setTextbooks] = useState<KnowledgeBook[]>([]);
  const [monographs, setMonographs] = useState<KnowledgeBook[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/knowledge/ai-base-textbooks.json")
      .then((res) => (res.ok ? (res.json() as Promise<KnowledgeBook[]>) : []))
      .then((data) => setTextbooks(Array.isArray(data) ? data : []))
      .catch(() => setTextbooks([]));

    fetch("/knowledge/ai-base-documents.json")
      .then((res) => (res.ok ? (res.json() as Promise<KnowledgeBook[]>) : []))
      .then((data) => setMonographs(Array.isArray(data) ? data : []))
      .catch(() => setMonographs([]));
  }, []);

  const currentList = activeTab === "textbooks" ? textbooks : monographs;

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return currentList.filter(
      (book) =>
        (!fieldSlug || book.categorySlug === fieldSlug) &&
        (!term || `${book.title} ${book.category} ${book.description}`.toLowerCase().includes(term))
    );
  }, [currentList, fieldSlug, query]);

  return (
    <section className="space-y-6" aria-labelledby={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-950/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Library className="h-3 w-3" /> AGENTIA Academic Library
            </span>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              23 Textbooks · 5,060 Pages
            </span>
          </div>
          <h2 id={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"} className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">
            {fieldSlug ? "Curriculum Textbooks & Monographs" : "Applications of AI and Technology Library"}
          </h2>
          <p className="mt-2 text-sm text-slate-400 max-w-3xl">
            Peer-reviewed, research-based academic textbooks (220 pages each) exploring how Artificial Intelligence transformed research, discovery, workflows, and professional practice across all 23 disciplines through 2026.
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

      {/* Collection Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveTab("textbooks")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "textbooks"
              ? "border border-cyan-400/60 bg-cyan-950/80 text-cyan-200 shadow-lg shadow-cyan-950/50"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <BookmarkCheck className="h-4 w-4 text-cyan-400" />
          23 Comprehensive Textbooks (220 Pages Each)
          <span className="ml-1 rounded-full bg-cyan-400/20 px-2 py-0.5 text-xs text-cyan-300">
            {fieldSlug ? visible.length : "23 Books"}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("monographs")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "monographs"
              ? "border border-cyan-400/60 bg-cyan-950/80 text-cyan-200 shadow-lg shadow-cyan-950/50"
              : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
        >
          <BookOpen className="h-4 w-4 text-slate-400" />
          120 Field Monographs (20 Pages Each)
          <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
            {fieldSlug ? (activeTab === "monographs" ? visible.length : "5") : "120"}
          </span>
        </button>
      </div>

      {/* Grid of Books */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((book) => (
          <article
            key={book.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-cyan-500/40 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-cyan-950/30"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  {book.category}
                </span>
                <span className="text-xs font-semibold text-amber-400/90 bg-amber-950/30 border border-amber-500/20 rounded px-2 py-0.5">
                  {book.pageCount} Pages
                </span>
              </div>

              <h3 className="mt-4 text-lg font-bold leading-snug text-white group-hover:text-cyan-200 transition">
                {book.title}
              </h3>

              <p className="mt-2.5 text-sm leading-6 text-slate-400 line-clamp-3">
                {book.description}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-800/80 pt-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-4">
                <span>Format: Digital A4 PDF</span>
                <span>Version {book.version} · {book.status}</span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href={book.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Read Online
                </a>
                <a
                  href={book.url}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>

      {currentList.length > 0 && visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          No PDF textbooks match that search term.
        </p>
      )}
    </section>
  );
}

