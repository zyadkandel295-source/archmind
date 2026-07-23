"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Database,
  FileText,
  HelpCircle,
  Mail,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  User,
  Webhook,
  Check,
  ChevronDown,
  ChevronUp,
  XCircle,
  Loader2
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { easeOutExpo } from "@/lib/motion";
import { requestData } from "@/lib/data-client";
import { getPlatformBaseUrl } from "@/lib/platform";
import { readSessionCredential } from "@/lib/session-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

interface Connection {
  name: string;
  key: string;
  status: "connected" | "disconnected";
  type: string;
  tokenSource?: "user" | "environment" | "none";
  workspaceName?: string;
  connectedAt?: string;
}

interface BridgeLog {
  id: string;
  timestamp: string;
  request: string;
  intent: string;
  extractedData: Record<string, any>;
  toolsPlanned: string[];
  toolsExecuted: Array<{
    name: string;
    params: Record<string, any>;
    success: boolean;
    response: any;
    timestamp: string;
    durationMs: number;
    retryCount: number;
  }>;
  status: "success" | "failed" | "pending_approval";
  errorMessage?: string;
  executionTimeMs: number;
}

interface BridgeApproval {
  id: string;
  logId: string;
  actionType: string;
  actionDescription: string;
  toolName: string;
  toolParams: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface WorkflowStep {
  text: string;
  intents: string[];
}

interface WorkflowPlan {
  steps: WorkflowStep[];
  entities: string[];
}

const serviceTemplates = {
  gmail: {
    from: "partner@growth.com",
    subject: "Urgent: Book sales intro",
    body: "Hey there, we want to book a call with your sales team for tomorrow at 2:00 PM. Please send confirmation to partner@growth.com. Cheers, John."
  },
  notion: {
    title: "Client Kickoff Meeting Notes",
    properties: {
      client: "Global Tech Inc",
      priority: "High"
    }
  },
  google_calendar: {
    title: "Project Review Meeting",
    status: "cancelled"
  },
  crm: {
    name: "Venture Corp Ltd",
    stage: "Contract Signed",
    value: "$12,500"
  }
};

const PIPELINE_STAGES = [
  { id: "parse", label: "Parsing request" },
  { id: "build", label: "Building workflow steps" },
  { id: "validate", label: "Validating actions" },
  { id: "send", label: "Sending to automation bridge" },
  { id: "complete", label: "Completed successfully" }
] as const;

/* ── Client-side NLP helpers (no backend changes) ── */

function parseSteps(text: string): string[] {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return lines.map((l) =>
      l.replace(/^(?:\d+[.)\-]\s*|[-•*]\s*)/, "").trim()
    ).filter(Boolean);
  }
  const parts = text.split(/(?:,\s*and\s+|,\s*then\s+|\s+and\s+then\s+|;\s*|\.\s+)/).map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [text.trim()];
}

function detectIntents(text: string): string[] {
  const lower = text.toLowerCase();
  const intents: string[] = [];
  if (/\b(calendar|meeting|schedule|book|event|appointment)\b/.test(lower)) intents.push("calendar");
  if (/\b(email|mail|send.*to|invite)\b/.test(lower)) intents.push("email");
  if (/\b(sheet|spreadsheet|log.*to|write.*to)\b/.test(lower)) intents.push("sheets");
  if (/\b(cancel|delete|remove)\b/.test(lower)) intents.push("cancel");
  if (/\b(crm|deal|lead|pipeline)\b/.test(lower)) intents.push("crm");
  if (/\b(telegram|tg|bot|message.*telegram|send.*telegram)\b/.test(lower)) intents.push("telegram");
  return intents;
}

function extractEntities(text: string): string[] {
  const entities: string[] = [];
  const emails = text.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
  if (emails) entities.push(...emails.map((e) => `📧 ${e}`));
  const times = text.match(/\b(?:tomorrow|today|tonight|next\s+\w+|at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?|\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/gi);
  if (times) entities.push(...times.map((t) => `📅 ${t}`));
  const channels = text.match(/#[\w-]+/g);
  if (channels) entities.push(...channels.map((c) => `💬 ${c}`));
  const names = text.match(/\bwith\s+([A-Z][a-z]+)\b/g);
  if (names) entities.push(...names.map((n) => `👤 ${n.replace(/^with\s+/i, "")}`));
  return [...new Set(entities)];
}

const corrections: Record<string, string> = {
  // Spelling / Typos
  "schdule": "schedule",
  "shdule": "schedule",
  "shedule": "schedule",
  "schedle": "schedule",
  "schduale": "schedule",
  "scedule": "schedule",
  "calender": "calendar",
  "calendr": "calendar",
  "calandare": "calendar",
  "metting": "meeting",
  "meeteing": "meeting",
  "meetting": "meeting",
  "emial": "email",
  "imail": "email",
  "gamil": "email",
  "notifcation": "notification",
  "notifyy": "notification",
  "sheetts": "Google Sheets",
  "shets": "Google Sheets",
  "seets": "Google Sheets",
  "appoinment": "appointment",
  "apointment": "appointment",
  "tomorroww": "tomorrow",
  "tommorow": "tomorrow",
  "tommorrow": "tomorrow",
  "mesage": "message",
  "messg": "message",
  "infomation": "information",
  "confirmm": "confirmation",
  "documentt": "document",
  "requestt": "request",
  "dtelied": "detailed",
  "dtaled": "detailed",
  "arrnage": "arrange",
  "paragrh": "paragraph",
  "stepsss": "steps",
  "expan": "expand",
  "fpr": "for",
  "bu": "by",
  
  // Shorthand / Abbreviations
  "mtg": "meeting",
  "tmrw": "tomorrow",
  "msg": "message",
  "msgs": "messages",
  "info": "information",
  "conf": "confirmation",
  "doc": "document",
    "req": "request",
  "appt": "appointment",
  "cal": "calendar",
  "notif": "notification",
  "notifs": "notifications",
  "ch": "channel",
  "chan": "channel",
  "sync": "synchronize",
  "cust": "customer",
  "biz": "business",
  "dev": "developer",
  "config": "configuration",
  "impl": "implementation",
  "tg": "Telegram",
  "tele": "Telegram"
};

function cleanAndCorrectText(input: string): string {
  return input.replace(/\b([a-zA-Z]+)\b/g, (match) => {
    const lower = match.toLowerCase();
    const replacement = corrections[lower];
    if (replacement !== undefined) {
      if (match === match.toUpperCase() && match.length > 1) {
        return replacement.toUpperCase();
      }
      const firstChar = match[0];
      if (firstChar !== undefined && firstChar === firstChar.toUpperCase()) {
        return replacement.charAt(0).toUpperCase() + replacement.slice(1);
      }
      return replacement;
    }
    return match;
  });
}

function expandStep(step: string): string {
  let clean = cleanAndCorrectText(step).trim();
  // Strip common prompt preamble and transition words
  clean = clean.replace(/^(?:then|finally|first|next|secondly|also|and|lastly|firstly|after\s+that|afterwards|meanwhile|i\s+want\s+u\s+to|i\s+want\s+you\s+to|please)\s+/i, "");
  const firstChar = clean[0];
  if (firstChar !== undefined) {
    clean = firstChar.toUpperCase() + clean.slice(1);
  }
  
  const lower = clean.toLowerCase();
  
  // Extract entities specifically from this step
  const emails = clean.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g);
  const times = clean.match(/\b(?:tomorrow|today|tonight|next\s+\w+)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?|\bat\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\b|\b\d{1,2}\s*(?:AM|PM|am|pm)\b/gi);
  const channels = clean.match(/#[\w-]+/g);
  const names = clean.match(/\b(?:with|to|for)\s+([A-Z][a-z]+)\b/g)?.map(n => n.replace(/^(?:with|to|for)\s+/i, "")) || [];
  
  const emailStr = emails && emails[0] ? emails[0] : "";
  const timeStr = times && times[0] ? times[0] : "";
  const channelStr = channels && channels[0] ? channels[0] : "";
  const nameStr = names[0] || "";

  // 1. Calendar/Meeting intent
  if (/\b(calendar|meeting|schedule|book|event|appointment)\b/.test(lower)) {
    const isCancel = /\b(cancel|delete|remove)\b/.test(lower);
    if (isCancel) {
      let base = "Cancel the scheduled event";
      if (nameStr) base += ` with ${nameStr}`;
      if (timeStr) base += ` at ${timeStr}`;
      base += ", and update the status in Google Calendar to release the booked slot.";
      return base;
    } else {
      let base = "Schedule a new calendar meeting";
      if (nameStr) base += ` with ${nameStr}`;
      if (timeStr) base += ` for ${timeStr}`;
      base += " to review project specifications, and distribute Google Calendar invitations to all participants.";
      return base;
    }
  }

  // 2. Email/Mail intent
  if (/\b(email|mail|send.*email|send.*invite)\b/.test(lower)) {
    let base = "Draft and transmit a professional email notification";
    if (emailStr) {
      base += ` directly to ${emailStr}`;
    } else if (nameStr) {
      base += ` to ${nameStr}`;
    }
    if (timeStr) base += ` regarding the timeline scheduled for ${timeStr}`;
    base += " to provide relevant context and confirm follow-up details.";
    return base;
  }
  
  // 3. Telegram / Bot
  if (/\b(telegram|tg|bot)\b/.test(lower)) {
    let base = "Dispatch a secure notification message via Telegram Bot";
    if (nameStr) {
      base += ` to user ${nameStr}`;
    } else {
      base += " to the active Telegram chat";
    }
    base += " to provide instant progress updates and status alerts.";
    return base;
  }

  // 5. Sheets / Log
  if (/\b(sheet|spreadsheet|log.*to|write.*to)\b/.test(lower)) {
    let base = "Record the completed transaction details by appending a row to the Google Sheets tracker";
    if (nameStr) base += ` for client ${nameStr}`;
    base += " to maintain administrative records and ensure continuous data synchronization.";
    return base;
  }
  
  // Generic / Fallback
  if (!/[.!?]$/.test(clean)) clean += ".";
  
  // For short phrases, add logical verb expansion
  const words = clean.split(/\s+/);
  if (words.length <= 4) {
    if (/^Create\b/i.test(clean)) {
      return clean.replace(/^Create\b/i, "Initialize and create") + " to establish required workflow records.";
    }
    if (/^Send\b/i.test(clean)) {
      return clean.replace(/^Send\b/i, "Dispatch and send") + " to the appropriate recipient.";
    }
    if (/^Update\b/i.test(clean)) {
      return clean.replace(/^Update\b/i, "Modify and update") + " with the latest available data.";
    }
  }
  
  return clean;
}

function improvePrompt(text: string): string {
  const correctedText = cleanAndCorrectText(text);
  const steps = parseSteps(correctedText);
  return steps
    .map((s, i) => {
      const expanded = expandStep(s);
      return `${i + 1}. ${expanded}`;
    })
    .join("\n");
}

function formatToolName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Send /, "📨 ")
    .replace(/^Create /, "✨ ")
    .replace(/^Update /, "📝 ")
    .replace(/^Cancel /, "❌ ");
}

function getSuggestionIcon(query: string): React.ReactNode {
  const lower = query.toLowerCase();
  if (lower.includes("calendar") || lower.includes("meeting") || lower.includes("book") || lower.includes("cancel")) return <Calendar className="h-3 w-3" />;
  if (lower.includes("email") || lower.includes("mail")) return <Mail className="h-3 w-3" />;
  if (lower.includes("sheet") || lower.includes("log")) return <Database className="h-3 w-3" />;
  return <Play className="h-3 w-3" />;
}

export function AutomationClient({ assistantId }: { assistantId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [logs, setLogs] = useState<BridgeLog[]>([]);
  const [approvals, setApprovals] = useState<BridgeApproval[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab view state
  const [activeTab, setActiveTab] = useState<"simulator" | "history" | "connectors" | "webhooks">("simulator");

  // Toggle connection status client-side
  const toggleConnection = (key: string) => {
    if (key === "notion") return; // Notion uses OAuth flow, not simple toggle
    setConnections((prev) =>
      prev.map((c) => (c.key === key ? { ...c, status: c.status === "connected" ? "disconnected" : "connected" } : c))
    );
    const conn = connections.find((c) => c.key === key);
    const isNowConnected = conn ? conn.status !== "connected" : false;
    toast({
      type: "info",
      title: `${conn?.name || key} Status Updated`,
      message: `${conn?.name || key} has been manually set to ${isNowConnected ? "Connected" : "Disconnected"}.`
    });
  };

  const handleConnectNotion = async () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("notion_connect_referrer", window.location.pathname);
      try {
        const data = await requestData<{ authUrl: string }>("/api/auth/notion/authorize", { method: "POST" });
        if (data?.authUrl) {
          window.location.href = data.authUrl;
        }
      } catch {
        toast({ type: "error", title: "Notion Connection Error", message: "Failed to initiate Notion OAuth connection." });
      }
    }
  };

  const handleDisconnectNotion = async () => {
    try {
      await requestData("/api/auth/notion/disconnect", { method: "DELETE" });
      toast({
        type: "success",
        title: "Notion Disconnected",
        message: "Successfully disconnected your Notion account."
      });
      loadDashboard();
    } catch (error: any) {
      toast({
        type: "error",
        title: "Disconnection Failed",
        message: error?.message || "Could not disconnect Notion."
      });
    }
  };

  const [consoleQuery, setConsoleQuery] = useState("");
  const [consoleRunning, setConsoleRunning] = useState(false);
  const [currentResult, setCurrentResult] = useState<any>(null);

  // Redesigned UI state
  const [showFormatHelp, setShowFormatHelp] = useState(false);
  const [showRawLog, setShowRawLog] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [currentPipelineStage, setCurrentPipelineStage] = useState(0);
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowPlan | null>(null);
  const [proposedDefinition, setProposedDefinition] = useState<any>(null);
  const pipelineStages = PIPELINE_STAGES;

  // Auto-detect steps as user types
  const detectedSteps = useMemo(() => {
    if (!consoleQuery.trim()) return [];
    return parseSteps(consoleQuery);
  }, [consoleQuery]);

  // Webhook trigger state
  const [webhookService, setWebhookService] = useState<keyof typeof serviceTemplates>("gmail");
  const [webhookPayload, setWebhookPayload] = useState(JSON.stringify(serviceTemplates.gmail, null, 2));
  const [webhookRunning, setWebhookRunning] = useState(false);

  // Expanded Logs State
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, logsRes, notionStatusRes] = await Promise.all([
        requestData<{ connections: Connection[] }>(`/api/assistants/${assistantId}/execution-bridge/status`),
        requestData<{ logs: BridgeLog[]; approvals: BridgeApproval[] }>(`/api/assistants/${assistantId}/execution-bridge/logs`),
        requestData<{ connected: boolean; workspaceName?: string; connectedAt?: string }>("/api/auth/notion/status").catch(() => ({ connected: false, workspaceName: undefined, connectedAt: undefined }))
      ]);

      const updatedConnections = statusRes.connections.map((c) => {
        if (c.key === "notion") {
          return {
            ...c,
            status: notionStatusRes.connected ? ("connected" as const) : ("disconnected" as const),
            workspaceName: notionStatusRes.workspaceName,
            connectedAt: notionStatusRes.connectedAt
          };
        }
        return c;
      });

      setConnections(updatedConnections);
      setLogs(logsRes.logs);
      setApprovals(logsRes.approvals.filter((a) => a.status === "pending"));
    } catch (error: any) {
      toast({
        type: "error",
        title: "Could not load automation data",
        message: error?.message || "Please reload the page."
      });
    } finally {
      setLoading(false);
    }
  }, [assistantId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  /* ── Improve Prompt handler ── */
  async function handleImprovePrompt() {
    if (!consoleQuery.trim() || isImproving) return;
    setIsImproving(true);
    await new Promise((r) => setTimeout(r, 600));
    const improved = improvePrompt(consoleQuery);
    setConsoleQuery(improved);
    setIsImproving(false);
    toast({
      type: "success",
      title: "Prompt Improved",
      message: "Your input has been restructured for clarity."
    });
  }

  /* ── Execute with Pipeline Animation ── */
  async function handleExecuteWithPipeline() {
    if (!consoleQuery.trim() || consoleRunning || pipelineActive) return;

    setPipelineActive(true);
    setCurrentResult(null);
    setShowRawLog(false);
    setCurrentPipelineStage(0);

    // The backend interprets the request into a proposal. Interpretation never executes tools.
    setConsoleRunning(true);
    try {
      setCurrentPipelineStage(1);
      const response = await requestData<{ definition: any; questions: string[]; validation: { valid: boolean; activationReady: boolean; errors: string[]; warnings: string[] } }>(
        "/api/platform/workflows/propose",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: consoleQuery })
        }
      );
      setWorkflowPlan({
        steps: response.definition.actions.map((action: any) => ({ text: action.name, intents: [action.riskLevel.replaceAll("_", " ")] })),
        entities: response.questions
      });
      setProposedDefinition(response.definition);
      setCurrentPipelineStage(3);
      await new Promise((r) => setTimeout(r, 250));
      setCurrentPipelineStage(4);
      setCurrentResult({
        status: "proposal",
        responseMessage: response.questions.length
          ? `Before activation: ${response.questions.join(" ")}`
          : "Review the interpreted steps, then save this workflow as a draft.",
        executionTimeMs: 0,
        validation: response.validation
      });
      toast({
        type: "success",
        title: "Workflow proposal ready",
        message: "Nothing has run. Review the steps and permissions before saving."
      });
    } catch (error: any) {
      toast({
        type: "error",
        title: "Could not build the workflow",
        message: error?.message || "Please check the description and try again."
      });
    } finally {
      setConsoleRunning(false);
      setPipelineActive(false);
    }
  }

  async function handleSaveDraft() {
    if (!proposedDefinition) return;
    try {
      await requestData(`/api/platform/assistants/${assistantId}/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: consoleQuery.trim().slice(0, 80), purpose: consoleQuery.trim(), definition: proposedDefinition })
      });
      toast({ type: "success", title: "Draft saved", message: "The workflow is saved and will not run until you finish setup and activate it." });
      setCurrentResult((value: any) => ({ ...value, status: "draft_saved", responseMessage: "Draft saved. Complete the requested folders, schedules, and connections before activation." }));
    } catch (error: any) {
      toast({ type: "error", title: "Could not save draft", message: error?.message || "Please try again." });
    }
  }

  const suggestionQueries = [
    "Book a sales call with Alice (alice@corp.com) tomorrow at 10 AM and log it to Sheets",
    "Send a Telegram update to chat about new client Bob (bob@gmail.com)",
    "Simulate failure to write sheets and log leads to check retry behavior",
    "Cancel the project briefing meeting at 3 PM and send confirmation email (Requires confirmation)"
  ];

  async function handleWebhookRun() {
    if (webhookRunning) return;
    setWebhookRunning(true);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(webhookPayload);
      } catch {
        throw new Error("Invalid JSON in Webhook Payload.");
      }

      const response = await requestData<{ result: any }>(
        `/api/assistants/${assistantId}/execution-bridge/webhooks/${webhookService}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsedPayload)
        }
      );
      setCurrentResult(response.result);
      toast({
        type: "success",
        title: "Webhook Posted",
        message: `Successfully posted event from ${webhookService}.`
      });
      // Reload logs
      const logsRes = await requestData<{ logs: BridgeLog[]; approvals: BridgeApproval[] }>(
        `/api/assistants/${assistantId}/execution-bridge/logs`
      );
      setLogs(logsRes.logs);
      setApprovals(logsRes.approvals.filter((a) => a.status === "pending"));
    } catch (error: any) {
      toast({
        type: "error",
        title: "Webhook Post Failed",
        message: error?.message || "Failed to trigger webhook parser."
      });
    } finally {
      setWebhookRunning(false);
    }
  }

  async function handleApproval(approvalId: string, decision: "approved" | "rejected") {
    try {
      const response = await requestData<{ result: any }>(
        `/api/assistants/${assistantId}/execution-bridge/approvals/${approvalId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision })
        }
      );
      toast({
        type: decision === "approved" ? "success" : "info",
        title: decision === "approved" ? "Action Confirmed" : "Action Rejected",
        message: response.result.responseMessage
      });
      loadDashboard();
      if (currentResult?.logId === response.result.logId) {
        setCurrentResult(response.result);
      }
    } catch (error: any) {
      toast({
        type: "error",
        title: "Decision Failed",
        message: error?.message || "Failed to submit approval choice."
      });
    }
  }

  const getServiceIcon = (key: string) => {
    switch (key) {
      case "gmail":
        return <Mail className="h-4 w-4" />;
      case "google_calendar":
        return <Calendar className="h-4 w-4" />;
      case "google_sheets":
        return <Database className="h-4 w-4" />;
      case "notion":
        return <FileText className="h-4 w-4" />;
      case "telegram":
        return <Webhook className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const selectWebhookTemplate = (service: keyof typeof serviceTemplates) => {
    setWebhookService(service);
    setWebhookPayload(JSON.stringify(serviceTemplates[service], null, 2));
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="online">Autonomous Layer</Badge>
            <Badge tone="new">Execution Bridge</Badge>
            <Badge tone="neutral">No Login Flows</Badge>
          </div>
          <h1 className="mt-4 text-3xl font-black md:text-5xl">Action Gateway</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
            Securely run workflows, monitor webhooks, test agent decision pipelines, and verify execution logs in real time.
          </p>
        </div>
        <Button variant="secondary" size="lg" onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync dashboard
        </Button>
      </div>

      <div className={approvals.length > 0 ? "grid gap-6 lg:grid-cols-[2.5fr_1fr]" : "max-w-4xl mx-auto"}>
        <div className="space-y-6">
          {/* ═══════════════════════════════════════════════════════ */}
          {/* Main Interactive Tab Container                         */}
          {/* ═══════════════════════════════════════════════════════ */}
          <Card className="overflow-hidden border-border-soft shadow-modal bg-bg-panel rounded-2xl">
            {/* Header with Navigation Tabs */}
            <div className="flex flex-wrap border-b border-border-soft bg-bg-card/50 px-4">
              {(["simulator", "history", "connectors"] as const).map((tab) => {
                const isActive = activeTab === tab;
                let label = "Simulator";
                let icon = <Activity className="h-4 w-4" />;
                if (tab === "history") {
                  label = "History & Logs";
                  icon = <FileText className="h-4 w-4" />;
                } else if (tab === "connectors") {
                  label = "API Connectors";
                  icon = <Webhook className="h-4 w-4" />;
                }

                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative flex items-center gap-2 px-4 py-3.5 text-xs font-bold uppercase tracking-wider transition outline-none ${
                      isActive ? "text-[#DDD6FE] font-extrabold" : "text-text-soft hover:text-text-main"
                    }`}
                  >
                    {icon}
                    {label}
                    {tab === "history" && logs.length > 0 && (
                      <span className="ml-1.5 bg-slate-200 text-text-main text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                        {logs.length}
                      </span>
                    )}
                    {tab === "connectors" && (
                      <span className="ml-1.5 bg-[#1E1145] text-[#DDD6FE] border border-violet-400/35 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                        {connections.filter(c => c.status === "connected").length}/{connections.length}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="active-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <CardContent className="pt-6">
              {/* ── TAB 1: SIMULATOR ── */}
              {activeTab === "simulator" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-main">Execution Simulator</h3>
                    <p className="text-xs text-text-soft mt-0.5">Submit natural language commands to test the automation bridge pipeline.</p>
                  </div>
                  
                  {/* Smart Prompt Editor */}
                  <div className="relative">
                    <textarea
                      id="smart-prompt-editor"
                      placeholder="Write your workflow step by step or describe your automation…"
                      value={consoleQuery}
                      onChange={(e) => setConsoleQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          handleExecuteWithPipeline();
                        }
                      }}
                      className="smart-textarea w-full rounded-xl border border-border-soft bg-bg-panel px-4 py-3 text-sm leading-relaxed outline-none focus:border-brand-500 transition-all duration-200 font-[inherit]"
                      disabled={consoleRunning || pipelineActive}
                      rows={5}
                    />
                    <div className="flex items-center justify-between mt-1.5 px-1">
                      <span className="text-[10px] text-text-soft">
                        {consoleQuery.length > 0 && `${consoleQuery.length} chars`}
                        {detectedSteps.length > 1 && (
                          <span className="ml-2 text-[#C4B5FD] font-semibold">
                            {detectedSteps.length} steps detected
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-text-soft">
                        Ctrl+Enter to execute
                      </span>
                    </div>
                  </div>

                  {/* Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowFormatHelp(!showFormatHelp)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-bg-panel px-3 py-2 text-xs font-semibold text-text-muted hover:bg-bg-card hover:border-slate-300 transition"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Format Help
                      {showFormatHelp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    <button
                      onClick={handleImprovePrompt}
                      disabled={!consoleQuery.trim() || isImproving || consoleRunning}
                      className="improve-btn-shimmer inline-flex items-center gap-1.5 rounded-lg border border-violet-400/45 bg-[#1E1145] px-3 py-2 text-xs font-semibold text-[#DDD6FE] hover:border-violet-300 hover:bg-[#17345f] transition disabled:pointer-events-none disabled:border-[#2A2555] disabled:bg-[#0E0C1E] disabled:text-[#8B7EC8]"
                    >
                      {isImproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {isImproving ? "Improving…" : "Improve Prompt"}
                    </button>

                    <div className="flex-1" />

                    <Button
                      size="lg"
                      onClick={handleExecuteWithPipeline}
                      disabled={consoleRunning || pipelineActive || !consoleQuery.trim()}
                    >
                      {consoleRunning || pipelineActive
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Play className="h-4 w-4" />
                      }
                      Execute
                    </Button>
                  </div>

                  {/* Format Help Panel */}
                  <AnimatePresence>
                    {showFormatHelp && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: easeOutExpo }}
                        className="overflow-hidden"
                      >
                        <div className="mt-1 rounded-xl border border-[#2A2555] bg-[#12102A] p-4">
                          <div className="text-xs font-bold text-[#DDD6FE] uppercase tracking-wider mb-2.5">
                            Prompt Structure Examples
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-bg-panel border border-border-soft p-3">
                              <div className="text-[10px] font-bold text-text-soft uppercase tracking-wider mb-1.5">Numbered Steps</div>
                              <pre className="text-xs text-text-muted whitespace-pre-wrap leading-relaxed">{`1. Schedule a meeting with Alice for tomorrow at 2 PM\n2. Send email invite to alice@corp.com\n3. Add a log entry to Google Sheets`}</pre>
                            </div>
                            <div className="rounded-lg bg-bg-panel border border-border-soft p-3">
                              <div className="text-[10px] font-bold text-text-soft uppercase tracking-wider mb-1.5">Bullet Points</div>
                              <pre className="text-xs text-text-muted whitespace-pre-wrap leading-relaxed">{`- Send a Telegram notification message to Bob\n- Update the Google Sheet with new client data\n- Send confirmation email to bob@corp.com`}</pre>
                            </div>
                            <div className="rounded-lg bg-bg-panel border border-border-soft p-3 md:col-span-2">
                              <div className="text-[10px] font-bold text-text-soft uppercase tracking-wider mb-1.5">Natural Language (auto-detected)</div>
                              <pre className="text-xs text-text-muted whitespace-pre-wrap leading-relaxed">{`Book a sales call with Alice tomorrow at 10 AM, send her a calendar invite,\nsend a Telegram message to Bob, and update Google Sheets to record the booking.`}</pre>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Detected Steps Preview */}
                  <AnimatePresence>
                    {detectedSteps.length > 1 && !pipelineActive && !currentResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.3, ease: easeOutExpo }}
                        className="rounded-xl border border-border-soft bg-bg-card/60 p-3"
                      >
                        <div className="text-[10px] font-bold text-text-soft uppercase tracking-wider mb-2">
                          Detected Workflow Steps
                        </div>
                        <div className="space-y-1.5">
                          {detectedSteps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-text-main">
                              <span className="flex-shrink-0 w-5 h-5 rounded-md bg-[#1E1145] text-[#DDD6FE] font-bold text-[10px] flex items-center justify-center border border-violet-400/40">
                                {i + 1}
                              </span>
                              <span className="leading-relaxed pt-0.5">{step}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Execution Pipeline Flow Animation */}
                  <AnimatePresence>
                    {pipelineActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.35, ease: easeOutExpo }}
                        className="rounded-2xl border border-border-soft bg-slate-900 text-[#F0EAFF] overflow-hidden shadow-inner"
                      >
                        <div className="bg-slate-800 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-text-soft border-b border-slate-700">
                          <span className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-60" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" />
                            </span>
                            EXECUTION PIPELINE
                          </span>
                          <Badge tone="new">processing</Badge>
                        </div>
                        <div className="p-4 space-y-3">
                          {pipelineStages.map((stage, idx) => (
                            <motion.div
                              key={stage.id}
                              initial={{ opacity: 0, x: -12 }}
                              animate={
                                idx <= currentPipelineStage
                                  ? { opacity: 1, x: 0 }
                                  : { opacity: 0.3, x: 0 }
                              }
                              transition={{ delay: idx * 0.08, duration: 0.35, ease: easeOutExpo }}
                              className="flex items-center gap-3"
                            >
                              <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-300 ${
                                idx < currentPipelineStage
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : idx === currentPipelineStage
                                    ? "bg-[#1E1145] text-[#DDD6FE]"
                                    : "bg-slate-800 text-text-muted"
                              }`}>
                                {idx < currentPipelineStage ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : idx === currentPipelineStage ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                              </div>
                              <span className={`text-xs font-medium transition-colors duration-300 ${
                                idx < currentPipelineStage
                                  ? "text-emerald-400"
                                  : idx === currentPipelineStage
                                    ? "text-white"
                                    : "text-text-muted"
                              }`}>
                                {stage.label}
                              </span>
                              {idx < currentPipelineStage && (
                                <span className="text-[10px] text-emerald-600 ml-auto font-mono">✔ done</span>
                              )}
                              {idx === currentPipelineStage && (
                                <span className="text-[10px] text-[#C4B5FD] ml-auto animate-pulse font-mono">running…</span>
                              )}
                            </motion.div>
                          ))}
                        </div>

                        {workflowPlan && currentPipelineStage >= 1 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ delay: 0.2, duration: 0.35 }}
                            className="border-t border-slate-700 px-4 py-3 bg-slate-950/20"
                          >
                            <div className="text-[10px] font-bold text-[#C4B5FD] uppercase tracking-wider mb-2">
                              Workflow Plan
                            </div>
                            <div className="space-y-1">
                              {workflowPlan.steps.map((step, i) => (
                                <div key={i} className="flex items-start gap-2 text-xs">
                                  <span className="text-text-soft font-mono flex-shrink-0">
                                    {String(i + 1).padStart(2, "0")}.
                                  </span>
                                  <span className="text-text-muted">{step.text}</span>
                                  {step.intents.length > 0 && (
                                    <span className="text-[9px] text-[#DDD6FE] bg-[#1E1145] border border-violet-400/30 px-1.5 py-0.5 rounded font-mono ml-auto flex-shrink-0">
                                      {step.intents.join(", ")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                            {workflowPlan.entities.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1">
                                {workflowPlan.entities.map((ent, i) => (
                                  <span key={i} className="text-[9px] bg-slate-800 text-emerald-400 border border-slate-700 rounded px-1.5 py-0.5 font-mono">
                                    {ent}
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Success / Result Feedback */}
                  <AnimatePresence>
                    {currentResult && !pipelineActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.45, ease: easeOutExpo }}
                        className="space-y-4"
                      >
                        <div className={`rounded-xl overflow-hidden border shadow-sm ${
                          currentResult.status === "success"
                            ? "border-emerald-400/35 bg-[#0C1F17]"
                            : currentResult.status === "failed"
                              ? "border-red-400/40 bg-[#2D1115]"
                              : "border-amber-400/40 bg-[#2F230E]"
                        }`}>
                          <div className="px-5 py-4 flex items-center gap-3">
                            {currentResult.status === "success" ? (
                              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-modal shadow-emerald-500/25 pipeline-step-glow">
                                <CheckCircle className="h-5 w-5" />
                              </div>
                            ) : currentResult.status === "failed" ? (
                              <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-modal shadow-rose-500/25">
                                <XCircle className="h-5 w-5" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-modal shadow-amber-500/25 animate-pulse">
                                <ShieldAlert className="h-5 w-5" />
                              </div>
                            )}
                            <div>
                              <h3 className={`font-bold text-base ${
                                currentResult.status === "success"
                                  ? "text-emerald-100"
                                  : currentResult.status === "failed"
                                    ? "text-red-100"
                                    : "text-amber-100"
                              }`}>
                                {currentResult.status === "proposal"
                                  ? "Review this workflow proposal"
                                  : currentResult.status === "draft_saved"
                                    ? "Workflow draft saved"
                                  : currentResult.status === "success"
                                  ? "Workflow executed successfully"
                                  : currentResult.status === "failed"
                                    ? "Workflow execution failed"
                                    : "Action requires approval"
                                }
                              </h3>
                              <p className="text-xs text-text-muted mt-0.5">
                                {currentResult.responseMessage}
                              </p>
                            </div>
                            <Badge
                              tone={
                                currentResult.status === "success" ? "online"
                                : currentResult.status === "failed" ? "warning"
                                : "amber"
                              }
                              className="ml-auto"
                            >
                              {currentResult.executionTimeMs}ms
                            </Badge>
                          </div>

                          {currentResult.status === "pending_approval" && (
                            <div className="border-t border-amber-400/35 px-5 py-3 flex items-start gap-2.5 bg-[#3A2A10]">
                              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="text-xs font-bold text-amber-100 uppercase tracking-wider">Human Safety Gate Triggered</div>
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                      const pendingApp = approvals.find((a) => a.logId === currentResult.logId);
                                      if (pendingApp) handleApproval(pendingApp.id, "approved");
                                    }}
                                  >
                                    Approve Action
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      const pendingApp = approvals.find((a) => a.logId === currentResult.logId);
                                      if (pendingApp) handleApproval(pendingApp.id, "rejected");
                                    }}
                                  >
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                          {currentResult.status === "proposal" && (
                            <div className="border-t border-amber-400/35 px-5 py-3 flex items-center justify-between gap-3 bg-[#3A2A10]">
                              <p className="text-xs text-amber-100">Saving creates a draft only. No files, accounts, or external services are changed.</p>
                              <Button size="sm" variant="primary" onClick={handleSaveDraft}>Save draft</Button>
                            </div>
                          )}
                        </div>

                        {currentResult.status === "success" && currentResult.toolsExecuted && currentResult.toolsExecuted.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.4, ease: easeOutExpo }}
                            className="success-accent rounded-xl border border-emerald-400/35 p-4"
                          >
                            <div className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mb-3">
                              Execution Summary
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {currentResult.toolsExecuted.map((exe: any, i: number) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: 0.1 + i * 0.08 }}
                                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-xs font-medium ${
                                    exe.success
                                      ? "border-emerald-400/35 bg-bg-panel text-emerald-200"
                                      : "border-red-400/35 bg-bg-panel text-red-200"
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                                    exe.success ? "bg-[#0C1F17] text-emerald-200 border border-emerald-400/35" : "bg-[#2D1115] text-red-200 border border-red-400/35"
                                  }`}>
                                    {exe.success ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{formatToolName(exe.name)}</div>
                                    <div className="text-[10px] text-text-soft mt-0.5">{exe.durationMs}ms</div>
                                  </div>
                                  {exe.success && (
                                    <span className="text-emerald-500 text-[10px] font-bold flex-shrink-0">✔</span>
                                  )}
                                </motion.div>
                              ))}
                            </div>

                            {currentResult.extractedData && Object.keys(currentResult.extractedData).length > 0 && (
                              <div className="mt-3 pt-3 border-t border-emerald-400/35">
                                <div className="text-[10px] font-bold text-text-soft uppercase tracking-wider mb-1.5">Details</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(currentResult.extractedData).map(([key, val]) => (
                                    <span key={key} className="text-[10px] bg-bg-panel border border-border-soft text-text-muted rounded-md px-2 py-1 font-medium">
                                      {key}: {typeof val === "string" ? val : JSON.stringify(val)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Raw pipeline log toggle */}
                        <div className="rounded-xl border border-border-soft overflow-hidden">
                          <button
                            onClick={() => setShowRawLog(!showRawLog)}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-text-soft hover:bg-bg-card transition"
                          >
                            <span className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5" />
                              Raw Pipeline Log
                            </span>
                            {showRawLog ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                          <AnimatePresence>
                            {showRawLog && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="bg-slate-900 text-[#F0EAFF] p-4 font-mono text-xs space-y-3 max-h-[320px] overflow-y-auto border-t border-border-soft">
                                  <div>
                                    <span className="text-[#C4B5FD] font-bold">[INTENT]:</span>{" "}
                                    <span className="text-white">{currentResult.intent}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#C4B5FD] font-bold">[EXTRACTED DATA]:</span>
                                    <pre className="text-emerald-400 mt-1 pl-4">{JSON.stringify(currentResult.extractedData, null, 2)}</pre>
                                  </div>
                                  <div>
                                    <span className="text-[#C4B5FD] font-bold">[TOOLS PLANNED]:</span>
                                    <div className="mt-1 pl-4 space-y-0.5">
                                      {currentResult.toolsPlanned.length === 0 ? (
                                        <span className="text-text-soft">No actions planned</span>
                                      ) : (
                                        currentResult.toolsPlanned.map((t: string, i: number) => (
                                          <div key={i} className="text-text-muted">
                                            {i + 1}. <span className="text-white font-semibold">{t}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  </div>
                                  {currentResult.toolsExecuted && currentResult.toolsExecuted.length > 0 && (
                                    <div>
                                      <span className="text-[#C4B5FD] font-bold">[EXECUTION LOG]:</span>
                                      <div className="mt-1 pl-4 space-y-2">
                                        {currentResult.toolsExecuted.map((exe: any, i: number) => (
                                          <div key={i} className="border-l-2 border-slate-700 pl-3">
                                            <div className="flex items-center justify-between">
                                              <span className={exe.success ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                                {exe.success ? "✓" : "✗"} {exe.name}
                                              </span>
                                              <span className="text-[10px] text-text-soft">
                                                {exe.durationMs}ms | Retries: {exe.retryCount}
                                              </span>
                                            </div>
                                            <div className="text-[11px] text-text-soft mt-0.5">Params: {JSON.stringify(exe.params)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Suggestion Chips */}
                  {!pipelineActive && !currentResult && (
                    <div>
                      <p className="text-xs font-semibold text-text-soft uppercase tracking-wider">Try an example:</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {suggestionQueries.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => setConsoleQuery(q)}
                            className="group inline-flex items-center gap-1.5 rounded-lg bg-[#12102A] border border-[#2A2555] px-2.5 py-1.5 text-xs font-medium text-[#C4B5FD] hover:border-violet-400/50 hover:bg-[#231E52] hover:text-white transition-all duration-200"
                          >
                            <span className="text-text-soft group-hover:text-brand-500 transition-colors">
                              {getSuggestionIcon(q)}
                            </span>
                            {q.length > 52 ? `${q.substring(0, 52)}…` : q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: AUDIT HISTORY ── */}
              {activeTab === "history" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-text-main">Execution History & Audit Trail</h3>
                      <p className="text-xs text-text-soft mt-0.5">Chronological record of all actions, validations, plans, and API logs.</p>
                    </div>
                    <Badge tone="neutral">{logs.length} entries</Badge>
                  </div>

                  {logs.length === 0 ? (
                    <div className="p-12 text-center text-text-soft text-sm border border-dashed rounded-2xl bg-bg-card/40">
                      <FileText className="h-8 w-8 mx-auto text-text-muted mb-2" />
                      No execution logs recorded yet. Run a query in the simulator to begin.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2A2555] border border-[#2A2555] rounded-xl overflow-hidden bg-[#12102A] shadow-sm">
                      {logs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <div key={log.id} className="transition hover:bg-bg-card/50">
                            <div
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="flex flex-col gap-3 md:flex-row md:items-center justify-between p-4 cursor-pointer"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className={`grid h-8 w-8 place-items-center rounded-lg ${log.status === "success"
                                      ? "bg-[#0C1F17] text-emerald-200 border border-emerald-400/35"
                                      : log.status === "failed"
                                        ? "bg-[#2D1115] text-red-200 border border-red-400/35"
                                        : "bg-[#2F230E] text-amber-200 border border-amber-400/35"
                                    }`}
                                >
                                  {log.status === "success" ? (
                                    <Check className="h-4 w-4" />
                                  ) : log.status === "failed" ? (
                                    <XCircle className="h-4 w-4" />
                                  ) : (
                                    <ShieldAlert className="h-4 w-4 animate-pulse" />
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-text-main text-sm leading-snug">{log.request}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge tone="new">{log.intent}</Badge>
                                    <span className="text-xs text-text-soft">
                                      {new Date(log.timestamp).toLocaleTimeString()} · {log.executionTimeMs}ms
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-end md:self-center">
                                <span className="text-xs font-semibold text-text-soft">
                                  {log.toolsExecuted.length} tools executed
                                </span>
                                {isExpanded ? <ChevronUp className="h-4 w-4 text-text-soft" /> : <ChevronDown className="h-4 w-4 text-text-soft" />}
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="bg-bg-card p-4 border-t border-border-soft font-mono text-xs text-text-main space-y-4">
                                <div>
                                  <div className="text-xs font-bold text-text-soft uppercase tracking-wider">EXTRACTED ENTITIES</div>
                                  <pre className="mt-1 bg-bg-panel p-2.5 rounded border border-border-soft text-emerald-600 overflow-x-auto">{JSON.stringify(log.extractedData, null, 2)}</pre>
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-text-soft uppercase tracking-wider">TOOL LOGS</div>
                                  <div className="mt-2 space-y-2">
                                    {log.toolsExecuted.length === 0 ? (
                                      <div className="text-text-soft italic">No tool calls performed.</div>
                                    ) : (
                                      log.toolsExecuted.map((exe, i) => (
                                        <div key={i} className="bg-bg-panel p-2.5 rounded border border-border-soft">
                                          <div className="flex items-center justify-between">
                                            <span className={exe.success ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                                              {exe.success ? "✓" : "✗"} {exe.name}
                                            </span>
                                            <span className="text-[10px] text-text-soft">
                                              {exe.durationMs}ms | Retries: {exe.retryCount}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-text-soft mt-1">Params: {JSON.stringify(exe.params)}</div>
                                          {exe.response && (
                                            <pre className="text-[10px] text-text-soft mt-1.5 overflow-x-auto bg-bg-card p-1.5 rounded">
                                              Response: {JSON.stringify(exe.response, null, 2)}
                                            </pre>
                                          )}
                                          {!exe.success && exe.response?.error && (
                                            <div className="text-[10px] text-red-100 bg-[#2D1115] border border-red-400/35 p-1.5 rounded mt-1.5">
                                              Error: {typeof exe.response.error === 'string' ? exe.response.error : JSON.stringify(exe.response.error)}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                                {log.errorMessage && (
                                  <div className="rounded-lg bg-[#2D1115] border border-red-400/35 text-red-100 p-3 flex gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <div>
                                      <div className="font-bold">Pipeline Error:</div>
                                      <div className="mt-0.5">{log.errorMessage}</div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: API CONNECTORS ── */}
              {activeTab === "connectors" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-main">API Connectors</h3>
                    <p className="text-xs text-text-soft mt-0.5">Simulate enabling and disabling connected integrations by clicking on them.</p>
</div>

                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {connections.map((c) => {
                        const isConnected = c.status === "connected";
                        return (
                          <div
                            key={c.key}
                            onClick={() => c.key === "notion" ? null : toggleConnection(c.key)}
                            className={`flex flex-col p-3.5 rounded-xl border select-none transition-all duration-200 ${
                              isConnected
                                ? "bg-[#1E1145] border-violet-400/35"
                                : "bg-bg-card/50 border-border-soft"
                            } ${c.key !== "notion" ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition ${
                                  isConnected ? "bg-[#1E1145] text-[#DDD6FE] border border-violet-400/35" : "bg-bg-hover text-text-soft border border-border-soft"
                                }`}>
                                  {getServiceIcon(c.key)}
                                </div>
                                <div>
                                  <div className="font-bold text-text-main text-xs leading-none">{c.name}</div>
                                  <span className="text-[10px] text-text-soft block mt-1">{c.type}</span>
                                </div>
                              </div>
                              {c.key !== "notion" ? (
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-4 rounded-full flex items-center p-0.5 transition-colors duration-200 ${
                                    isConnected ? "bg-emerald-500 justify-end" : "bg-[#3D3578] justify-start"
                                  }`}>
                                    <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                                  </div>
                                </div>
                              ) : (
                                <Badge tone={isConnected ? "online" : "neutral"}>
                                  {isConnected ? "Connected" : "Disconnected"}
                                </Badge>
                              )}
                            </div>

                            {c.key === "notion" && (
                              isConnected ? (
                                <div className="mt-3 pt-3 border-t border-border-soft flex flex-col gap-2 text-[10px] text-text-soft">
                                  <div className="flex justify-between">
                                    <span>Workspace:</span>
                                    <span className="font-semibold text-text-main">
                                      {(c as any).workspaceName || "Connected"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="text-[9px] text-text-soft">
                                      {c.connectedAt ? `Connected on ${new Date(c.connectedAt).toLocaleDateString()}` : ""}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-6 text-[9px] px-2 py-0 text-red-100 hover:text-white hover:bg-[#2D1115] border border-red-400/35 hover:border-red-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDisconnectNotion();
                                      }}
                                    >
                                      Disconnect
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-3 pt-3 border-t border-border-soft flex justify-end">
                                  <Button
                                    size="sm"
                                    className="h-6 text-[9px] px-2.5 py-0 bg-brand-600 hover:bg-brand-700 text-white font-semibold"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConnectNotion();
                                    }}
                                  >
                                    Connect Notion
                                  </Button>
                                </div>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Sidebar for Safety Gate Approvals */}
        {approvals.length > 0 && (
          <div className="space-y-6">
            <Card className="border-border-soft shadow-md bg-bg-panel">
              <CardHeader className="bg-[#2F230E] border-b border-amber-400/35 flex flex-row items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-text-main uppercase tracking-wider">Safety Gate</h2>
                  <p className="text-[10px] text-text-soft mt-0.5">High-risk actions pending approval.</p>
                </div>
                <ShieldAlert className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {approvals.map((app) => (
                    <div key={app.id} className="rounded-xl border border-amber-400/35 bg-[#2F230E] p-3 space-y-3">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[10px] font-bold text-amber-100 uppercase tracking-wider font-mono">{app.toolName}</div>
                          <p className="text-xs text-text-main mt-1 font-semibold leading-relaxed">{app.actionDescription}</p>
                          <span className="text-[9px] text-text-soft block mt-1">
                            Triggered: {new Date(app.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => handleApproval(app.id, "approved")}>
                          Confirm Approve
                        </Button>
                        <Button size="sm" variant="secondary" className="bg-bg-panel" onClick={() => handleApproval(app.id, "rejected")}>
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
