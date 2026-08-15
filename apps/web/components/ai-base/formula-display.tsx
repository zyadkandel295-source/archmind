export function FormulaDisplay({ expression }: { expression: string }) {
  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-950/80 px-4 py-5 text-center shadow-inner shadow-cyan-950/20" aria-label={`Formula: ${expression}`}>
      <span className="text-xl sm:text-2xl tracking-wide text-cyan-200 font-serif whitespace-pre-wrap">{expression}</span>
    </div>
  );
}
