"use client";

import { useEffect, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { requestData } from "@/lib/data-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Assistant {
  id: string;
  name: string;
  isPublic: boolean;
}

export function DeployClient({ assistantId }: { assistantId: string }) {
  const [assistant, setAssistant] = useState<Assistant>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    requestData<{ assistant: Assistant }>(`/api/assistants/${assistantId}`)
      .then((response) => {
        if (!cancelled) setAssistant(response.assistant);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assistantId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-4">
        <Skeleton className="h-12 w-3/4 rounded-xl bg-slate-800/50" />
        <Skeleton className="h-64 w-full rounded-2xl bg-slate-800/30" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6 text-slate-100 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" /> AGENTIA System Control
          </span>
          <h1 className="mt-2 text-3xl font-black text-white">
            Deploy {assistant?.name ?? "Agent"}
          </h1>
        </div>
      </div>

      <Card className="border border-cyan-500/30 bg-slate-900/60 shadow-2xl backdrop-blur-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">App & Floating Control Bubble</h2>
              <p className="text-xs text-slate-400">Direct Computer Operation & System Automation</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-indigo-500/15 p-6 text-slate-100">
            <div className="flex items-center gap-2 text-base font-black text-cyan-300">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span>Coming Soon: You Will Control Your Computer & System!</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Coming soon you will control desktop applications, system operations, browser automation, and computer tasks directly through AGENTIA AI App & Floating Control Bubble.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Web Agent Workspace</h4>
              <p className="mt-1 text-xs text-slate-400">Deployed and active instantly in your browser workspace.</p>
              <span className="mt-3 inline-block rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">Active Live</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Floating Control Bubble</h4>
              <p className="mt-1 text-xs text-slate-400">System automation, desktop control & background tasks.</p>
              <span className="mt-3 inline-block rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">Coming Soon</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
