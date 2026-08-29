"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, ExternalLink, Search } from "lucide-react";

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
  const [books, setBooks] = useState<KnowledgeBook[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/knowledge/ai-base-documents.json")
      .then((response) => response.ok ? response.json() as Promise<KnowledgeBook[]> : [])
      .then((data) => setBooks(Array.isArray(data) ? data : []))
      .catch(() => setBooks([]));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return books.filter((book) => (!fieldSlug || book.categorySlug === fieldSlug) && (!term || `${book.title} ${book.category} ${book.description}`.toLowerCase().includes(term)));
  }, [books, fieldSlug, query]);

  return (
    <section className="space-y-5" aria-labelledby={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">AGENTIA Knowledge Base</p>
          <h2 id={fieldSlug ? "knowledge-books-title" : "knowledge-library-title"} className="mt-2 text-2xl font-bold text-white">{fieldSlug ? "Five library books" : "Educational PDF library"}</h2>
          <p className="mt-2 text-sm text-slate-400">Every book is 20 pages, watermarked, readable online, downloadable, and indexed for grounded chat answers.</p>
        </div>
        {!fieldSlug ? <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300"><Search className="h-4 w-4 text-cyan-300" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search PDF books" className="w-52 bg-transparent outline-none placeholder:text-slate-500" /></label> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((book) => <article key={book.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"><BookOpen className="h-5 w-5 text-cyan-300" /><p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{book.category}</p><h3 className="mt-2 text-lg font-bold text-white">{book.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{book.description}</p><p className="mt-4 text-xs text-slate-500">{book.pageCount} pages · {book.status} · v{book.version}</p><div className="mt-5 flex flex-wrap gap-2"><a href={book.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"><ExternalLink className="h-3.5 w-3.5" /> Open</a><a href={book.url} download className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"><Download className="h-3.5 w-3.5" /> Download</a></div></article>)}
      </div>
      {books.length > 0 && visible.length === 0 ? <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">No PDF knowledge books match that search.</p> : null}
    </section>
  );
}
