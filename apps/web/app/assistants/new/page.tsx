import { Suspense } from "react";
import { AssistantBuilder } from "@/components/assistant-builder";

export default function NewAssistantPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-400">Preparing your assistant workspace…</div>}>
        <AssistantBuilder />
      </Suspense>
    </main>
  );
}
