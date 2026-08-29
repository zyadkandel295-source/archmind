"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bot,
  Copy,
  Database,
  Loader2,
  MessageSquare,
  Plus,
  Radio,
  Cpu,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud
} from "lucide-react";
import { requestData } from "@/lib/data-client";
import { engineLabel } from "@/lib/engine-options";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { getAssistantIcon } from "@/lib/assistant-icons";
import { AIBrainVisualization } from "./dashboard/ai-brain-viz";

interface Assistant {
  id: string;
  name: string;
  description?: string;
  model: string;
  tone: string;
  isPublic?: boolean;
  color?: string;
  icon?: string;
  sourceCount?: number;
  messageCount?: number;
  tokenUsage?: number;
}

interface Overview {
  assistants: number;
  messages: number;
  sources: number;
  tokens: number;
}

type WorkingAction = "duplicate" | "clear" | "delete";

const metricPanels = ["bg-[#151B24]", "bg-[#151B24]", "bg-[#151B24]", "bg-[#151B24]"];

export function DashboardClient() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [overview, setOverview] = useState<Overview>({
    assistants: 0,
    messages: 0,
    sources: 0,
    tokens: 0
  });
  const [notice, setNotice] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<{ id: string; action: WorkingAction }>();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([
      requestData<{ assistants: Assistant[] }>("/api/assistants"),
      requestData<{ overview: Overview }>("/api/analytics/overview")
    ])
      .then(([assistantResponse, analyticsResponse]) => {
        const list = Array.isArray(assistantResponse?.assistants)
          ? assistantResponse.assistants
          : Array.isArray((assistantResponse as any)?.data)
          ? (assistantResponse as any).data
          : [];

        let localFallback: Assistant[] = [];
        try {
          const raw = window.localStorage.getItem("agentia_assistants") || window.localStorage.getItem("archmind_assistants");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localFallback = parsed.map((a: any) => ({
                id: a.id,
                name: a.name || "Assistant",
                description: a.description || "",
                model: a.model_name || a.model || "llama-3.1-8b-instant",
                tone: a.tone || "professional",
                isPublic: Boolean(a.is_public || a.isPublic),
                color: a.color || "indigo",
                icon: a.icon || "bot"
              }));
            }
          }
        } catch {
          // ignore
        }

        const finalAssistants = list.length > 0 ? list : localFallback;
        setAssistants(finalAssistants);
        setOverview(analyticsResponse?.overview || { assistants: finalAssistants.length, messages: 0, sources: 0, tokens: 0 });
        setNotice(undefined);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load dashboard data.";
        if (mounted) {
          let localFallback: Assistant[] = [];
          try {
            const raw = window.localStorage.getItem("agentia_assistants") || window.localStorage.getItem("archmind_assistants");
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                localFallback = parsed.map((a: any) => ({
                  id: a.id,
                  name: a.name || "Assistant",
                  description: a.description || "",
                  model: a.model_name || a.model || "llama-3.1-8b-instant",
                  tone: a.tone || "professional",
                  isPublic: Boolean(a.is_public || a.isPublic),
                  color: a.color || "indigo",
                  icon: a.icon || "bot"
                }));
              }
            }
          } catch {}
          setAssistants(localFallback);
          setOverview({ assistants: localFallback.length, messages: 0, sources: 0, tokens: 0 });
          const isAuthError =
            message === "UNAUTHENTICATED" ||
            message.includes("Missing bearer token") ||
            message.includes("Invalid or expired access token") ||
            message.includes("Unauthenticated");

          if (!isAuthError) {
            setNotice(message);
          }
          toast({ type: "error", title: "Dashboard failed to load", message });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(
    () => [
      { label: "Agents", value: overview.assistants, icon: Bot },
      { label: "Commands", value: overview.messages, icon: MessageSquare },
      { label: "Sources", value: overview.sources, icon: Database },
      { label: "System Operations", value: overview.tokens, icon: Activity }
    ],
    [overview]
  );

  async function duplicateAssistant(id: string) {
    setWorking({ id, action: "duplicate" });
    try {
      const response = await requestData<{ assistant: Assistant }>(`/api/assistants/${id}/duplicate`, { method: "POST" });
      setAssistants((current) => [response.assistant, ...current]);
      setOverview((current) => ({ ...current, assistants: current.assistants + 1 }));
      toast({ type: "success", title: "Agent duplicated", message: `${response.assistant.name} is ready to edit.` });
    } catch (error) {
      toast({
        type: "error",
        title: "Could not duplicate agent",
        message: error instanceof Error ? error.message : "Try again in a moment."
      });
    } finally {
      setWorking(undefined);
    }
  }

  async function clearConversations(id: string) {
    setWorking({ id, action: "clear" });
    try {
      await requestData(`/api/assistants/${id}/conversations/clear`, { method: "POST" });
      setAssistants((current) =>
        current.map((assistant) => (assistant.id === id ? { ...assistant, messageCount: 0 } : assistant))
      );
      toast({ type: "success", title: "Operation history cleared", message: "Only this agent's operation history was cleared." });
    } catch (error) {
      toast({
        type: "error",
        title: "Could not clear operations",
        message: error instanceof Error ? error.message : "Try again in a moment."
      });
    } finally {
      setWorking(undefined);
    }
  }

  async function deleteAssistant(id: string, createdAt?: string) {
    if (createdAt) {
      const createdAtMs = new Date(createdAt).getTime();
      const elapsedMs = Date.now() - createdAtMs;
      const LOCK_PERIOD_MS = 25 * 24 * 60 * 60 * 1000;
      if (elapsedMs < LOCK_PERIOD_MS) {
        const remainingDays = Math.ceil((LOCK_PERIOD_MS - elapsedMs) / (24 * 60 * 60 * 1000));
        toast({
          type: "error",
          title: "Agent Deletion Locked 🔒",
          message: `Agents cannot be deleted for 25 days after creation. (${remainingDays} days remaining)`
        });
        return;
      }
    }
    if (!window.confirm("Are you sure you want to deactivate this agent?")) return;
    setWorking({ id, action: "delete" });
    try {
      await requestData(`/api/assistants/${id}`, { method: "DELETE" });
      setAssistants((current) => current.filter((assistant) => assistant.id !== id));
      setOverview((current) => ({ ...current, assistants: Math.max(0, current.assistants - 1) }));
      toast({ type: "success", title: "Agent deactivated", message: "The agent was deactivated from your fleet." });
    } catch (error) {
      toast({
        type: "error",
        title: "Could not deactivate agent",
        message: error instanceof Error ? error.message : "Try again in a moment."
      });
    } finally {
      setWorking(undefined);
    }
  }

  return (
    <>
      <section className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-cyan-400/15 bg-slate-950/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400 shadow-inner shadow-cyan-950/20">
        <span className="flex items-center gap-2 text-emerald-300"><Radio className="h-3 w-3 animate-pulse" /> System online</span>
        <span className="flex items-center gap-2"><Cpu className="h-3 w-3 text-cyan-300" /> Agent runtime ready</span>
        <span>Knowledge mesh: {overview.sources} indexed nodes</span>
        <span className="text-slate-500">v1.0 · secure operator console</span>
      </section>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col justify-between gap-4 md:flex-row md:items-center"
      >
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Protected workspace</Badge>
            <Badge tone="blue">Secured environment</Badge>
            {notice ? <Badge tone="amber">Notice</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">AGENTIA Command Center</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Manage your AI agents, command operations, review system activity, and deploy automation from one central control room.
          </p>
          {notice ? <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-amber-200">{notice}</p> : null}
        </div>
        <Link href="/assistants/new">
          <Button size="lg">
            <Plus className="h-4 w-4" />
            Deploy Agent
          </Button>
        </Link>
      </motion.div>



      {/* AI Brain Visualization Canvas */}
      <section className="relative mt-8 h-80 w-full overflow-hidden rounded-xl border border-cyan-400/25 bg-slate-950 shadow-2xl shadow-cyan-950/30">
        <AIBrainVisualization />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-cyan-400/15 bg-slate-950/80 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-100/70 backdrop-blur">
          <span>Neural operations map</span><span>Live telemetry · encrypted</span>
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Agent Fleet Overview</h2>
              <p className="mt-1 text-sm text-slate-300">Deploy, configure, and command each agent independently.</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <AssistantListSkeleton /> : null}

            {!loading && (assistants || []).length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-dashed border-[#3A4658] bg-[#151B24] p-8 text-center shadow-soft"
              >
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-[#3A4658] bg-[#1B2330] text-[#F4F7FB]">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-black text-white">No agents deployed yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
                  Deploy your first agent with operational guidelines, automation rules, and system integration.
                </p>
                <Link href="/assistants/new" className="mt-5 inline-flex">
                  <Button>
                    <Plus className="h-4 w-4" />
                    Deploy agent
                  </Button>
                </Link>
              </motion.div>
            ) : null}

            <AnimatePresence initial={false}>
              {!loading &&
                (assistants || []).map((assistant, index) => (
                  <AssistantCard
                    key={assistant.id}
                    assistant={assistant}
                    index={index}
                    workingAction={working?.id === assistant.id ? working.action : undefined}
                    onDuplicate={() => duplicateAssistant(assistant.id)}
                    onClear={() => clearConversations(assistant.id)}
                    onDelete={() => deleteAssistant(assistant.id)}
                  />
                ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#22C55E]/50 bg-[#10291B] text-[#CFFADE]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold">Security</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-300">
            <p>User sessions are encrypted and expire automatically for security.</p>
            <p>All workspace configurations are securely isolated, and sensitive credentials never reach the browser.</p>
            <p>Granular isolation policies protect user workspaces.</p>
            <p>Active rate limiting ensures platform availability.</p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function AssistantListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[#2A3545] bg-[#151B24] p-4">
          <div className="flex gap-3">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="flex-1">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-3 h-4 w-3/4" />
              <Skeleton className="mt-3 h-4 w-44" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssistantCard({
  assistant,
  index,
  workingAction,
  onDuplicate,
  onClear,
  onDelete
}: {
  assistant: Assistant;
  index: number;
  workingAction?: WorkingAction;
  onDuplicate: () => void;
  onClear: () => void;
  onDelete: () => void;
}) {
  const busy = Boolean(workingAction);
  const AssistantIcon = getAssistantIcon(assistant.icon).Icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ y: -3 }}
      className="rounded-xl"
    >
      <div className="relative flex flex-col justify-between gap-4 rounded-xl border border-[#2A3545] bg-[#151B24] p-4 text-[#F4F7FB] shadow-sm transition hover:border-[#3A4658] hover:bg-[#1B2330] md:flex-row md:items-center">
        <div
          className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full opacity-80"
          style={{ backgroundColor: assistant.color || "#3B82F6" }}
        />
        <div className="flex min-w-0 gap-4">
          <div
            className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-[#3A4658] bg-[#1B2330] text-white"
            style={{
              borderColor: assistant.color || "#3B82F6"
            }}
          >
            <AssistantIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-black text-white">{assistant.name}</h3>
              <Badge tone="blue">{engineLabel(assistant.model || (assistant as any).model_name || "jellyfish-bia-1")}</Badge>
              {assistant.tone ? <Badge tone="slate">{assistant.tone}</Badge> : null}
              {assistant.isPublic ? <Badge tone="green">Shared</Badge> : <Badge tone="amber">Restricted</Badge>}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{assistant.description || "No description yet."}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-slate-300">
              <span>{assistant.sourceCount ?? 0} sources</span>
              <span>{assistant.messageCount ?? 0} messages</span>
              <span>{formatNumber(assistant.tokenUsage ?? 0)} units</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link href={`/assistants/${assistant.id}/chat`}>
            <Button variant="secondary" size="sm">
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
          </Link>
          <Link href={`/assistants/${assistant.id}/settings`}>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href={`/assistants/${assistant.id}/sources`}>
            <Button variant="ghost" size="sm">
              <UploadCloud className="h-4 w-4" />
              Sources
            </Button>
          </Link>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDuplicate} aria-busy={workingAction === "duplicate"}>
            {workingAction === "duplicate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            {workingAction === "duplicate" ? "Duplicating" : "Duplicate"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClear} aria-busy={workingAction === "clear"}>
            {workingAction === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {workingAction === "clear" ? "Clearing" : "Clear"}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDelete} aria-busy={workingAction === "delete"}>
            {workingAction === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {workingAction === "delete" ? "Deleting" : "Delete"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
