"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import DOMPurify from "dompurify";
import { generateAssistantOpeningExperience, type AssistantOpeningExperience } from "@archmind/shared";
import {
  Bot,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Camera,
  Download,
  FileDown,
  FileUp,
  Menu,
  Mic,
  Moon,
  MoreHorizontal,
  MoreVertical,
  PanelLeftClose,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCcw,
  Search,
  Send,
  SlidersHorizontal,
  Square,
  Sun,
  Trash2,
  X
} from "lucide-react";
import { getPlatformBaseUrl } from "@/lib/platform";
import { readSessionCredential } from "@/lib/session-keys";
import { DEFAULT_ENGINE_VALUE } from "@/lib/engine-options";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { AssistantAvatar } from "@/components/ui/assistant-avatar";
import { IconButton } from "@/components/ui/icon-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DownloadCompanionModal } from "@/components/download-companion-modal";


type Role = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  error?: boolean;
  sourceNames?: string[];
  attachments?: { name: string; type: string; size: number; url?: string }[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  conversationId?: string;
  createdAt: number;
  updatedAt: number;
}

interface ServerMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface ServerConversation {
  id: string;
  title?: string;
  messageCount: number;
  createdAt: string;
  messages: ServerMessage[];
}

interface AssistantMeta {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  systemPrompt?: string;
  starterPrompts?: string[];
  openingExperience?: AssistantOpeningExperience;
}

interface DesktopBridge {
  platform: string;
  status: () => Promise<{
    assistantId: string;
    assistantName: string;
    assistantIcon?: string;
    assistantColor?: string;
    mode: "full" | "compact" | "bubble" | "tray";
    revoked: boolean;
    folders: string[];
  }>;
  chat: (input: { message: string; conversationId?: string }) => Promise<{
    conversationId?: string;
    answer?: string;
    sources?: Array<{ sourceName?: string; filename?: string }>;
  }>;
  selectFolder: () => Promise<unknown>;
  undoLast: () => Promise<unknown>;
  setMode: (mode: "full" | "compact" | "bubble" | "tray") => Promise<unknown>;
}

declare global {
  interface Window {
    archmindDesktop?: DesktopBridge;
  }
}

function getDesktopBridge() {
  return typeof window !== "undefined" ? window.archmindDesktop : undefined;
}

const STORAGE_PREFIX = "archmind.ai.sessions.v2";
const ACTIVE_PREFIX = "archmind.ai.activeSession.v2";
const THEME_KEY = "archmind.ai.theme.v1";
const HIDDEN_PREFIX = "archmind.ai.hidden.v1";
const PINNED_PREFIX = "archmind.ai.pinned.v1";

const EXAMPLE_PROMPTS = [
  {
    title: "Explain a concept",
    prompt: "Explain vector databases to me like I am a smart beginner."
  },
  {
    title: "Write code",
    prompt: "Write a TypeScript function that groups messages by date."
  },
  {
    title: "Plan a product",
    prompt: "Create a launch plan for an AI assistant SaaS product."
  },
  {
    title: "Summarize",
    prompt: "Summarize the difference between RAG and fine-tuning in a table."
  }
];

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSession(): ChatSession {
  const now = Date.now();
  return {
    id: makeId(),
    title: "New chat",
    messages: [],
    model: DEFAULT_ENGINE_VALUE,
    createdAt: now,
    updatedAt: now
  };
}

function createMessage(role: Role, content: string, attachments?: { name: string; type: string; size: number; url?: string }[], error = false): ChatMessage {
  return {
    id: makeId(),
    role,
    content,
    error,
    attachments,
    createdAt: Date.now()
  };
}

function inferTitle(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 42 ? `${clean.slice(0, 42)}...` : clean || "New chat";
}

function parseSseEvents(buffer: string) {
  const events = buffer.split("\n\n");
  return {
    complete: events.slice(0, -1),
    rest: events.at(-1) ?? ""
  };
}

function assistantNamespace(assistantId?: string) {
  return assistantId ? `assistant.${assistantId}` : "general";
}

function sessionsKey(assistantId?: string) {
  return `${STORAGE_PREFIX}.${assistantNamespace(assistantId)}`;
}

function activeKey(assistantId?: string) {
  return `${ACTIVE_PREFIX}.${assistantNamespace(assistantId)}`;
}

function hiddenKey(assistantId?: string) {
  return `${HIDDEN_PREFIX}.${assistantNamespace(assistantId)}`;
}

function pinnedKey(assistantId?: string) {
  return `${PINNED_PREFIX}.${assistantNamespace(assistantId)}`;
}

function readHiddenConversationIds(assistantId?: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(hiddenKey(assistantId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function hideConversationId(assistantId: string | undefined, conversationId: string) {
  if (typeof window === "undefined" || !conversationId) return;
  const hidden = readHiddenConversationIds(assistantId);
  hidden.add(conversationId);
  window.localStorage.setItem(hiddenKey(assistantId), JSON.stringify([...hidden]));
}

function readStoredSessions(assistantId?: string): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(sessionsKey(assistantId));
    const parsed = raw ? (JSON.parse(raw) as ChatSession[]) : [];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [createSession()];
  } catch {
    return [createSession()];
  }
}

function serverConversationToSession(conversation: ServerConversation): ChatSession {
  const createdAt = Date.parse(conversation.createdAt) || Date.now();
  const messages = conversation.messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as Role,
      content: message.content,
      createdAt: Date.parse(message.createdAt) || createdAt
    }));

  return {
    id: conversation.id,
    title: conversation.title || messages.find((message) => message.role === "user")?.content.slice(0, 42) || "New chat",
    messages,
    model: DEFAULT_ENGINE_VALUE,
    conversationId: conversation.id,
    createdAt,
    updatedAt: messages.at(-1)?.createdAt ?? createdAt
  };
}

export function AIChatWorkspace({ assistantId, embedded = false }: { assistantId?: string; embedded?: boolean }) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>(() => readStoredSessions(assistantId));
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(activeKey(assistantId)) ?? "";
  });
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(!embedded);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopConnected, setDesktopConnected] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => readPinnedSessionIds(assistantId));
  const [copiedId, setCopiedId] = useState<string>();
  const [temperature, setTemperature] = useState(0.7);
  const [apiReady, setApiReady] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (window.localStorage.getItem(THEME_KEY) as "dark" | "light" | null) ?? "dark";
  });
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [voiceStatus, setVoiceStatus] = useState<string>();
  const [assistantMeta, setAssistantMeta] = useState<AssistantMeta>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeIdRef = useRef(activeId);
  const endRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewsRef = useRef<{ file: File; url: string }[]>([]);

  const activeSession = useMemo(() => {
    const current = sessions.find((session) => session.id === activeId);
    return current ?? sessions[0] ?? createSession();
  }, [activeId, sessions]);

  const visibleSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query ? sessions.filter((session) => session.title.toLowerCase().includes(query)) : sessions;
    return [...filtered].sort((a, b) => {
      const aPinned = pinnedIds.has(a.id);
      const bPinned = pinnedIds.has(b.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [pinnedIds, searchQuery, sessions]);

  const activePinned = pinnedIds.has(activeSession.id);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeId)) {
      setActiveId(sessions[0]?.id ?? "");
    }
  }, [activeId, sessions]);

  useEffect(() => {
    setSessions(readStoredSessions(assistantId));
    setActiveId(window.localStorage.getItem(activeKey(assistantId)) ?? "");
    setPinnedIds(readPinnedSessionIds(assistantId));
  }, [assistantId]);

  useEffect(() => {
    window.localStorage.setItem(sessionsKey(assistantId), JSON.stringify(sessions));
  }, [assistantId, sessions]);

  useEffect(() => {
    if (activeSession.id) {
      window.localStorage.setItem(activeKey(assistantId), activeSession.id);
    }
  }, [activeSession.id, assistantId]);

  useEffect(() => {
    if (embedded) setSidebarOpen(false);
  }, [embedded]);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    setDesktopConnected(true);
    setApiReady(true);
    setSidebarOpen(false);
    bridge.status()
      .then((status) => {
        setAssistantMeta((current) => ({
          ...current,
          name: current?.name ?? status.assistantName,
          icon: current?.icon ?? status.assistantIcon,
          color: current?.color ?? status.assistantColor
        }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(pinnedKey(assistantId), JSON.stringify([...pinnedIds]));
  }, [assistantId, pinnedIds]);

  useEffect(() => {
    fetch(`${getPlatformBaseUrl()}/api/health`)
      .then((response) => response.json())
      .then((health: { dependencies?: { llm?: boolean } }) => setApiReady(Boolean(health.dependencies?.llm)))
      .catch(() => setApiReady(null));
  }, []);

  useEffect(() => {
    if (!assistantId) return;
    setHistoryLoading(true);
    const credential = readSessionCredential();
    const headers = new Headers();
    if (credential) headers.set("Authorization", `Bearer ${credential}`);

    fetch(`${getPlatformBaseUrl()}/api/assistants/${assistantId}`, { headers, cache: "no-store" })
      .then((response) =>
        response.ok
          ? response.json()
          : fetch(`${getPlatformBaseUrl()}/api/public/${assistantId}`, { headers, cache: "no-store" }).then((fallback) =>
            fallback.ok ? fallback.json() : undefined
          )
      )
      .then((data: { assistant?: AssistantMeta; openingExperience?: AssistantOpeningExperience } | undefined) => {
        if (data?.assistant) {
          setAssistantMeta({
            ...data.assistant,
            openingExperience:
              data.openingExperience ??
              generateAssistantOpeningExperience({
                name: data.assistant.name,
                description: data.assistant.description,
                instructions: data.assistant.systemPrompt,
                starterPrompts: data.assistant.starterPrompts
              })
          });
        }
      })
      .catch(() => undefined);
  }, [assistantId]);

  useEffect(() => {
    if (!assistantId) return;
    const credential = readSessionCredential();
    const headers = new Headers();
    if (credential) headers.set("Authorization", `Bearer ${credential}`);

    fetch(`${getPlatformBaseUrl()}/api/assistants/${assistantId}/conversations`, { headers, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((data: { conversations?: ServerConversation[] } | undefined) => {
        if (!data?.conversations) return;
        const hidden = readHiddenConversationIds(assistantId);
        const serverSessions = data.conversations
          .filter((conversation) => !hidden.has(conversation.id))
          .map(serverConversationToSession);
        setSessions((current) => {
          const localDrafts = current.filter((session) => !session.conversationId);
          const serverIds = new Set(serverSessions.map((session) => session.id));
          const retainedLocal = localDrafts.filter((session) => !serverIds.has(session.id));
          const next = [...serverSessions, ...retainedLocal];
          return next.length > 0 ? next.sort((a, b) => b.updatedAt - a.updatedAt) : [createSession()];
        });
        if (data.conversations.length > 0 && !data.conversations.some((conversation) => conversation.id === activeIdRef.current)) {
          setActiveId(data.conversations[0]!.id);
        }
      })
      .catch(() => {
        toast({ type: "error", title: "Chat history failed to load", message: "Your local draft is still available." });
      })
      .finally(() => setHistoryLoading(false));
  }, [assistantId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeSession.messages, isGenerating]);

  function updateSession(sessionId: string, updater: (session: ChatSession) => ChatSession) {
    setSessions((current) =>
      current.map((session) => (session.id === sessionId ? updater(session) : session)).sort((a, b) => b.updatedAt - a.updatedAt)
    );
  }

  function addNewChat() {
    const session = createSession();
    setSessions((current) => [session, ...current]);
    setActiveId(session.id);
    setInput("");
    setSidebarOpen(false);
  }

  function deleteChat(sessionId: string) {
    const target = sessions.find((session) => session.id === sessionId);
    if (target?.conversationId) {
      hideConversationId(assistantId, target.conversationId);
    }
    setPinnedIds((current) => {
      const next = new Set(current);
      next.delete(sessionId);
      return next;
    });
    setSessions((current) => {
      const next = current.filter((session) => session.id !== sessionId);
      if (activeId === sessionId) {
        setActiveId(next[0]?.id ?? "");
      }
      return next.length > 0 ? next : [createSession()];
    });
    toast({ type: "success", title: "Chat removed", message: "This conversation was removed from your sidebar.", duration: 2200 });
  }

  function renameChat(sessionId: string) {
    const current = sessions.find((session) => session.id === sessionId);
    const title = window.prompt("Rename chat", current?.title ?? "New chat");
    if (!title?.trim()) return;
    updateSession(sessionId, (session) => ({ ...session, title: title.trim(), updatedAt: Date.now() }));
  }

  function clearActiveChat() {
    stopGenerating();
    addNewChat();
    toast({ type: "info", title: "Fresh chat started", message: "Your previous conversation is still available in the sidebar.", duration: 2400 });
  }

  function focusChatSearch() {
    setSidebarOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 80);
  }

  function togglePinActiveChat() {
    if (!activeSession.id) return;
    setPinnedIds((current) => {
      const next = new Set(current);
      const pinned = !next.has(activeSession.id);
      if (pinned) {
        next.add(activeSession.id);
      } else {
        next.delete(activeSession.id);
      }
      toast({
        type: "success",
        title: pinned ? "Chat pinned" : "Chat unpinned",
        message: pinned ? "This chat now stays at the top of your sidebar." : "This chat returned to normal sorting.",
        duration: 1800
      });
      return next;
    });
  }

  async function exportActiveChat() {
    const lines = [
      `# ${activeSession.title}`,
      "",
      ...activeSession.messages.map((message) => `## ${message.role === "user" ? "You" : "Assistant"}\n\n${message.content || "_No content yet._"}`)
    ];
    const blob = new Blob([lines.join("\n\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSession.title.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "archmind-chat"}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast({ type: "success", title: "Chat exported", message: "The active chat was saved as a Markdown file.", duration: 2200 });
  }

  function copyActiveChatLink() {
    const url = `${window.location.origin}${window.location.pathname}`;
    void navigator.clipboard.writeText(url);
    toast({ type: "success", title: "Link copied", message: "The current assistant page link was copied.", duration: 1800 });
  }

  function stopGenerating() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
  }

  async function copyAnswer(message: ChatMessage) {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(message.id);
    toast({ type: "success", title: "Copied", message: "Assistant response copied to clipboard.", duration: 1800 });
    window.setTimeout(() => setCopiedId(undefined), 1500);
  }

  async function approveDesktopFolder() {
    try {
      await getDesktopBridge()?.selectFolder();
      toast({ type: "success", title: "Folder approved", message: "The desktop bubble can watch that folder now.", duration: 2200 });
    } catch (error) {
      toast({ type: "error", title: "Folder approval failed", message: error instanceof Error ? error.message : "Try again from the desktop bubble." });
    }
  }

  async function undoDesktopAction() {
    try {
      await getDesktopBridge()?.undoLast();
      toast({ type: "success", title: "Undo requested", message: "The last supported desktop action was undone.", duration: 2200 });
    } catch (error) {
      toast({ type: "error", title: "Undo failed", message: error instanceof Error ? error.message : "No safe undo was available." });
    }
  }

  async function callAi(messages: ChatMessage[], assistantMessageId: string, sessionId = activeSession.id, files?: File[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);

    try {
      const credential = readSessionCredential();
      const hasFiles = files && files.length > 0;
      const headers = new Headers();
      if (!hasFiles) headers.set("Content-Type", "application/json");
      if (credential) headers.set("Authorization", `Bearer ${credential}`);
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
      const desktopBridge = assistantId ? getDesktopBridge() : undefined;
      if (desktopBridge && !hasFiles) {
        const result = await desktopBridge.chat({
          message: lastUserMessage?.content ?? "",
          conversationId: activeSession.conversationId
        });
        const sourceNames = result.sources
          ? [...new Set(result.sources.map((source) => source.filename ?? source.sourceName).filter(Boolean) as string[])]
          : [];
        updateSession(sessionId, (session) => ({
          ...session,
          conversationId: result.conversationId ?? session.conversationId,
          messages: session.messages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: result.answer ?? "Done.", sourceNames }
              : message
          ),
          updatedAt: Date.now()
        }));
        return;
      }
      const endpoint = assistantId ? `/api/assistants/${assistantId}/chat` : "/api/chat";
      const payload = assistantId
        ? {
          message: lastUserMessage?.content ?? "",
          attachments: lastUserMessage?.attachments ?? [],
          conversationId: activeSession.conversationId,
          sessionId: activeSession.id,
          responseLength: "balanced",
          language: "English"
        }
        : {
          model: activeSession.model,
          temperature,
          messages: messages
            .filter((message) => message.content.trim())
            .slice(-24)
            .map((message) => ({
              role: message.role,
              content: message.content,
              attachments: message.attachments ?? []
            }))
        };

      let body: BodyInit;
      if (hasFiles) {
        const form = new FormData();
        form.append("payload", JSON.stringify(payload));
        files!.forEach((file) => form.append("files", file));
        body = form;
      } else {
        body = JSON.stringify(payload);
      }

      const response = await fetch(`${getPlatformBaseUrl()}${endpoint}`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body
      });

      if (!response.ok || !response.body) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        const rawMessage = errorPayload?.error?.message ?? "The assistant could not respond. Please try again.";
        console.error("[Chat Stream Error] Raw:", rawMessage);

        let friendlyMessage = rawMessage;
        const lower = rawMessage.toLowerCase();
        if (
          lower.includes("token") ||
          lower.includes("auth") ||
          lower.includes("unauthenticated")
        ) {
          friendlyMessage = "Connection could not be completed.";
        } else if (
          lower.includes("database") ||
          lower.includes("sql") ||
          lower.includes("postgres")
        ) {
          friendlyMessage = "We couldn't process your request.";
        }

        throw new Error(friendlyMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseEvents(buffer);
        buffer = parsed.rest;

        for (const eventBlock of parsed.complete) {
          const eventName = eventBlock
            .split("\n")
            .find((line) => line.startsWith("event:"))
            ?.replace("event:", "")
            .trim();
          const dataLine = eventBlock
            .split("\n")
            .find((line) => line.startsWith("data:"))
            ?.replace("data:", "")
            .trim();

          if (!dataLine) continue;

          if (eventName === "meta" || eventName === "done") {
            const data = JSON.parse(dataLine) as {
              conversationId?: string;
              sources?: Array<{ sourceName?: string; filename?: string }>;
            };
            const sourceNames = data.sources
              ? [...new Set(data.sources.map((source) => source.filename ?? source.sourceName).filter(Boolean) as string[])]
              : [];
            if (data.conversationId) {
              updateSession(sessionId, (session) => ({
                ...session,
                conversationId: data.conversationId,
                messages:
                  eventName === "meta" && sourceNames.length > 0
                    ? session.messages.map((message) =>
                      message.id === assistantMessageId ? { ...message, sourceNames } : message
                    )
                    : session.messages,
                updatedAt: Date.now()
              }));
            }
          }

          if (eventName === "token") {
            const data = JSON.parse(dataLine) as { token?: string };
            if (!data.token) continue;

            updateSession(sessionId, (session) => ({
              ...session,
              messages: session.messages.map((message) =>
                message.id === assistantMessageId ? { ...message, content: `${message.content}${data.token}` } : message
              ),
              updatedAt: Date.now()
            }));
          }

          if (eventName === "error") {
            const data = JSON.parse(dataLine) as { message?: string };
            updateSession(sessionId, (session) => ({
              ...session,
              messages: session.messages.map((message) =>
                message.id === assistantMessageId
                  ? {
                    ...message,
                    content: `**AI stream error**\n\n${data.message ?? "The AI stream stopped unexpectedly."}`,
                    error: true
                  }
                  : message
              ),
              updatedAt: Date.now()
            }));
          }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        updateSession(sessionId, (session) => ({
          ...session,
          messages: session.messages.map((message) =>
            message.id === assistantMessageId && !message.content
              ? { ...message, content: "Generation stopped.", error: true }
              : message
          ),
          updatedAt: Date.now()
        }));
        toast({ type: "info", title: "Generation stopped", message: "You can regenerate or send a new message.", duration: 2400 });
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Something went wrong while generating the answer. Please try again.";
        updateSession(sessionId, (session) => ({
          ...session,
          messages: session.messages.map((item) =>
            item.id === assistantMessageId
              ? {
                ...item,
                content: `**Connection issue**\n\n${message}\n\nPlease wait a moment and try again.`,
                error: true
              }
              : item
          ),
          updatedAt: Date.now()
        }));
        toast({ type: "error", title: "Connection issue", message });
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsGenerating(false);
      textareaRef.current?.focus();
    }
  }

  async function sendMessage(content = input) {
    const clean = content.trim();
    if (!clean || isGenerating) return;
    const attachmentsMeta = attachedFiles.map((f) => ({ name: f.name, type: f.type, size: f.size, url: URL.createObjectURL(f) }));
    const userMessage = createMessage("user", clean, attachmentsMeta.length ? attachmentsMeta : undefined);
    const assistantMessage = createMessage("assistant", "");
    const messages = [...activeSession.messages, userMessage, assistantMessage];

    updateSession(activeSession.id, (session) => ({
      ...session,
      title: session.messages.length === 0 ? inferTitle(clean) : session.title,
      messages,
      updatedAt: Date.now()
    }));

    setInput("");
    // keep a reference to files being sent
    const filesToSend = attachedFiles.slice();
    setAttachedFiles([]);
    await callAi(messages.filter((message) => message.id !== assistantMessage.id), assistantMessage.id, undefined, filesToSend);
  }

  async function regenerateLastAnswer() {
    if (isGenerating) return;
    const lastUserIndex = [...activeSession.messages].reverse().findIndex((message) => message.role === "user");
    if (lastUserIndex === -1) return;

    const userIndex = activeSession.messages.length - 1 - lastUserIndex;
    const baseMessages = activeSession.messages.slice(0, userIndex + 1);
    const assistantMessage = createMessage("assistant", "");
    const nextMessages = [...baseMessages, assistantMessage];

    updateSession(activeSession.id, (session) => ({
      ...session,
      messages: nextMessages,
      updatedAt: Date.now()
    }));
    await callAi(baseMessages, assistantMessage.id);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (assistantId) {
      router.push(`/assistants/${assistantId}/sources`);
      toast({ type: "info", title: "Upload on Sources", message: "Add files to your assistant knowledge base from the Sources page.", duration: 2800 });
      return;
    }

    const newFiles = Array.from(files);
    setAttachedFiles((current) => [...current, ...newFiles]);
    toast({ type: "info", title: "Draft attachment", message: "Files attached to this draft. The assistant will receive them for analysis when you send the message.", duration: 2800 });
  }

  function startVoiceInput() {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceStatus("Voice input is not supported in this browser.");
      toast({ type: "error", title: "Voice unavailable", message: "This browser does not support speech recognition." });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInput((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onerror = () => setVoiceStatus("Voice input could not start.");
    recognition.onend = () => window.setTimeout(() => setVoiceStatus(undefined), 1600);
    setVoiceStatus("Listening...");
    recognition.start();
  }

  function removeFile(index: number) {
    setAttachedFiles((current) => current.filter((_, i) => i !== index));
  }

  function selectRecommendedMessage(prompt: string) {
    setInput(prompt);
    window.setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const hasMessages = activeSession.messages.length > 0;
  const assistantName = assistantMeta?.name ?? "ArchMind Assistant";
  const openingExperience =
    assistantMeta?.openingExperience ??
    generateAssistantOpeningExperience({
      name: assistantName,
      description: assistantMeta?.description,
      instructions: assistantMeta?.systemPrompt,
      starterPrompts: assistantMeta?.starterPrompts
    });

  return (
    <main
      className={cn(
        theme === "dark" ? "dark" : "",
        "min-h-dvh overflow-hidden bg-slate-950 text-slate-50 transition-colors"
      )}
    >
      <div className="flex h-dvh min-w-0">
        <AnimatePresence initial={false}>
          {sidebarOpen ? (
            <motion.aside
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed inset-y-0 left-0 z-40 flex w-[min(92vw,clamp(17rem,24vw,20rem))] max-w-full flex-col border-r border-[#2A2555] bg-[#0C0B18] p-[clamp(0.75rem,2vw,1rem)] text-[#F0EAFF] shadow-2xl lg:static lg:shadow-none"
            >
              <div className="flex items-center justify-between px-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#3D3578] bg-[#F0EAFF]" aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/archmind-logo.png" alt="" className="h-full w-full object-cover" />
                  </span>
                  <div>
                    <div className="text-[clamp(0.9rem,1.8vw,1rem)] font-black">ArchMind</div>
                    <div className="text-[clamp(0.72rem,1.5vw,0.78rem)] text-[#C4B5FD]">AI Workspace</div>
                  </div>
                </div>
                <IconButton
                  onClick={() => setSidebarOpen(false)}
                  className="min-h-[2.25rem]"
                  aria-label="Close sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </IconButton>
              </div>

              <button
                onClick={addNewChat}
                disabled={historyLoading}
                className="mt-3 flex min-h-[2.75rem] items-center justify-center gap-2 rounded-[clamp(0.65rem,1.6vw,0.85rem)] border border-violet-400/60 bg-violet-600 px-[clamp(0.9rem,2vw,1rem)] text-[clamp(0.82rem,1.7vw,0.9rem)] font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-[#2A2555] disabled:bg-[#0E0C1E] disabled:text-[#8B7EC8]"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#2A2555] bg-[#12102A] px-3 py-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-violet-500/20">
                <Search className="h-4 w-4 shrink-0 text-[#C4B5FD]" />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search chats"
                  className="w-full bg-transparent text-[clamp(0.82rem,1.7vw,0.9rem)] text-white outline-none placeholder:text-[#8B7EC8]"
                  aria-label="Search chats"
                />
              </div>

              <div className="dark-scrollbar mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
                {historyLoading ? <ConversationSkeleton /> : null}
                <AnimatePresence initial={false}>
                  {!historyLoading && searchQuery.trim() && visibleSessions.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[#3D3578] bg-[#12102A] p-4 text-center text-xs text-[#C4B5FD]">No chats match your search.</p>
                  ) : null}
                  {!historyLoading &&
                    visibleSessions.map((session) => (
                      <motion.div
                        key={session.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        whileHover={{ x: 3 }}
                        className={cn(
                          "group rounded-[clamp(0.65rem,1.6vw,0.85rem)] border p-[clamp(0.75rem,2vw,0.9rem)] transition",
                          session.id === activeSession.id
                            ? "border-violet-400/70 bg-[#1E1145] text-white"
                            : "border-transparent text-[#C4B5FD] hover:border-[#3D3578] hover:bg-[#1A1640] hover:text-white"
                        )}
                      >
                        <button
                          onClick={() => {
                            setActiveId(session.id);
                            setSidebarOpen(false);
                          }}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            {pinnedIds.has(session.id) ? <Pin className="h-3.5 w-3.5 shrink-0 text-[#C4B5FD]" /> : null}
                            <div className="line-clamp-1 text-[clamp(0.82rem,1.7vw,0.9rem)] font-bold">{session.title}</div>
                          </div>
                          <div className="mt-1 text-[clamp(0.72rem,1.5vw,0.78rem)] text-[#C4B5FD]">
                            {session.messages.length} messages
                          </div>
                        </button>
                        <div className="mt-2 flex items-center gap-1 opacity-100 transition lg:opacity-0 lg:group-hover:opacity-100">
                          <button
                            onClick={() => renameChat(session.id)}
                            className="rounded-lg p-1.5 text-[#C4B5FD] transition hover:bg-white/10 hover:text-white active:scale-95"
                            aria-label="Rename chat"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteChat(session.id)}
                            className="rounded-lg p-1.5 text-[#C4B5FD] transition hover:bg-rose-500/10 hover:text-rose-200 active:scale-95"
                            aria-label="Delete chat"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </div>

              <div className="mt-4 rounded-[clamp(0.75rem,1.8vw,0.95rem)] border border-[#2A2555] bg-[#12102A] p-[clamp(0.75rem,2vw,0.9rem)] text-[#F0EAFF]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[clamp(0.82rem,1.7vw,0.9rem)] font-bold">AI connection</div>
                    <div className="text-[clamp(0.72rem,1.5vw,0.78rem)] text-[#C4B5FD]">
                      {apiReady === null ? "Checking connection" : apiReady ? "Connected" : "Unavailable"}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shadow-lg",
                      apiReady === null
                        ? "bg-amber-400 shadow-amber-400/50"
                        : apiReady
                          ? "bg-emerald-400 shadow-emerald-400/50"
                          : "bg-red-400 shadow-red-400/50"
                    )}
                  />
                </div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>

        {sidebarOpen ? <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar overlay" /> : null}

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-[clamp(4.75rem,10vw,5.75rem)] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#2A2555] bg-[#0C0B18] px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.8rem,2vw,1rem)]">
            <div className="flex min-w-0 items-center gap-3">
              {!sidebarOpen ? (
                <IconButton
                  onClick={() => setSidebarOpen(true)}
                  className="min-h-[2.6rem]"
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </IconButton>
              ) : null}
              <AssistantAvatar name={assistantName} icon={assistantMeta?.icon} size="md" />
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex min-w-0 items-center gap-1 text-left text-[clamp(0.98rem,2.2vw,1.2rem)] font-black text-white transition hover:text-[#DDD6FE]"
                  aria-label="Open assistant settings"
                >
                  <span className="truncate">{assistantName}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#C4B5FD]" />
                </button>
                <StatusBadge className="mt-1 max-w-full" pulse>
                  <span className="truncate">Online - Ready to assist</span>
                </StatusBadge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {desktopConnected ? (
                <>
                  <IconButton
                    onClick={() => void approveDesktopFolder()}
                    aria-label="Approve desktop folder"
                    title="Approve folder"
                    className="min-h-[2.6rem]"
                  >
                    <FileUp className="h-5 w-5" />
                  </IconButton>
                  <IconButton
                    onClick={() => void undoDesktopAction()}
                    aria-label="Undo last desktop action"
                    title="Undo last desktop action"
                    className="min-h-[2.6rem]"
                  >
                    <RefreshCcw className="h-5 w-5" />
                  </IconButton>
                </>
              ) : null}

              {!desktopConnected ? (
                <button
                  type="button"
                  onClick={() => setDownloadOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-black text-white shadow-md shadow-violet-600/25 transition hover:from-violet-500 hover:to-indigo-500 active:scale-95"
                  title="Download Windows App & Floating Bubble"
                >
                  <Download className="h-4 w-4 text-amber-300" />
                  <span className="hidden sm:inline">Export App & Bubble</span>
                  <span className="sm:hidden">App</span>
                </button>
              ) : null}

              <IconButton
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                className="min-h-[2.6rem]"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </IconButton>
              <IconButton
                onClick={() => setSettingsOpen(true)}
                className="min-h-[2.6rem]"
                aria-label="Open settings"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </IconButton>
              <IconButton onClick={focusChatSearch} className="hidden min-h-[2.6rem] sm:grid" aria-label="Search chats">
                <Search className="h-5 w-5" />
              </IconButton>
              <IconButton
                onClick={togglePinActiveChat}
                className={cn("hidden min-h-[2.6rem] md:grid", activePinned && "border-violet-400/70 bg-[#1E1145] text-[#DDD6FE]")}
                aria-label={activePinned ? "Unpin conversation" : "Pin conversation"}
                title={activePinned ? "Unpin conversation" : "Pin conversation"}
              >
                {activePinned ? <PinOff className="h-5 w-5" /> : <Pin className="h-5 w-5" />}
              </IconButton>
              <div className="relative">
                <IconButton
                  onClick={() => setMoreOpen((open) => !open)}
                  className={cn("min-h-[2.6rem]", moreOpen && "border-violet-400/70 bg-[#1E1145] text-[#DDD6FE]")}
                  aria-label="More actions"
                  aria-expanded={moreOpen}
                >
                  <MoreVertical className="h-5 w-5" />
                </IconButton>
                <AnimatePresence>
                  {moreOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-lg border border-[#3D3578] bg-[#12102A] p-1.5 text-sm text-[#F0EAFF] shadow-2xl shadow-black/50"
                    >
                      {[
                        { label: "Search chats", icon: Search, action: focusChatSearch },
                        { label: activePinned ? "Unpin chat" : "Pin chat", icon: activePinned ? PinOff : Pin, action: togglePinActiveChat },
                        { label: "Rename chat", icon: Pencil, action: () => renameChat(activeSession.id) },
                        { label: "Export chat", icon: FileDown, action: () => void exportActiveChat() },
                        { label: "Copy page link", icon: Copy, action: copyActiveChatLink },
                        { label: "New chat", icon: Plus, action: addNewChat },
                        { label: "Clear current", icon: Trash2, action: clearActiveChat, danger: true }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            item.action();
                            setMoreOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-semibold transition hover:bg-white/10 hover:text-white",
                            item.danger ? "text-rose-200 hover:bg-rose-500/12" : "text-slate-200"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <div className="dark-scrollbar neural-grid flex-1 overflow-y-auto bg-slate-950/[0.35]">
            <div className="mx-auto flex min-h-full w-full max-w-[min(100%,72rem)] flex-col px-[clamp(1rem,3vw,2rem)] py-[clamp(1.25rem,3vw,2rem)]">
              {historyLoading ? (
                <ChatHistorySkeleton />
              ) : !hasMessages ? (
                <WelcomeScreen
                  assistantName={assistantName}
                  assistantIcon={assistantMeta?.icon}
                  openingExperience={openingExperience}
                  onPromptSelect={selectRecommendedMessage}
                />
              ) : (
                <div className="space-y-6 pb-28">
                  <AnimatePresence initial={false}>
                    {activeSession.messages.map((message) => (
                      <ChatBubble
                        key={message.id}
                        message={message}
                        copied={copiedId === message.id}
                        onCopy={() => void copyAnswer(message)}
                        onRegenerate={() => void regenerateLastAnswer()}
                      />
                    ))}
                  </AnimatePresence>
                  {isGenerating ? <TypingIndicator /> : null}
                  <div ref={endRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#2A2555] bg-[#0C0B18] px-[clamp(1rem,3vw,1.5rem)] py-[clamp(0.85rem,2.4vw,1rem)]">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[min(100%,72rem)]">
              {attachedFiles.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {previewsRef.current.map(({ file, url }, idx) => (
                    <div
                      key={`${file.name}-${file.size}-${idx}`}
                      className="inline-flex max-w-full items-center gap-3 rounded-xl border border-white/[0.12] bg-white/[0.08] px-3 py-2 text-xs font-semibold text-[#F0EAFF]"
                    >
                      {file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={file.name} className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <FileUp className="h-5 w-5" />
                      )}
                      <div className="max-w-xs">
                        <div className="truncate text-sm font-bold">{file.name}</div>
                        <div className="text-xs text-[#C4B5FD]">{file.type || "file"} · {Math.round(file.size / 1024)} KB</div>
                      </div>
                      <button type="button" onClick={() => removeFile(idx)} className="rounded p-1 text-[#C4B5FD] hover:bg-white/10 hover:text-white" aria-label="Remove attachment">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {voiceStatus ? <div className="mb-2 text-xs font-semibold text-[#DDD6FE]">{voiceStatus}</div> : null}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                className="rounded-[clamp(0.85rem,2vw,1.1rem)] border border-[#3D3578] bg-[#12102A] p-[clamp(0.55rem,1.6vw,0.75rem)] shadow-lg shadow-black/25 transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-violet-500/15"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder={`Message ${assistantName}...`}
                  className="dark-scrollbar max-h-[32dvh] min-h-[clamp(3rem,8vw,4rem)] w-full resize-none bg-transparent px-[clamp(0.75rem,2vw,1rem)] py-[clamp(0.7rem,2vw,0.9rem)] text-[clamp(0.9rem,2vw,1rem)] leading-6 text-[#F0EAFF] outline-none placeholder:text-[#8B7EC8]"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2A2555] px-1 pt-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <label className="inline-grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-[#C4B5FD] transition hover:bg-white/10 hover:text-white" aria-label="Attach file">
                      <Paperclip className="h-5 w-5" />
                      <input type="file" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
                    </label>
                    <button
                      type="button"
                      onClick={() => toast({ type: "info", title: "Code mode", message: "Paste code into the message box and send it with context." })}
                      className="inline-grid size-10 shrink-0 place-items-center rounded-xl text-[#C4B5FD] transition hover:bg-white/10 hover:text-white"
                      aria-label="Code input"
                    >
                      <Code2 className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast({ type: "info", title: "Screenshot capture", message: "Attach an image file to share a screenshot with the assistant." })}
                      className="inline-grid size-10 shrink-0 place-items-center rounded-xl text-[#C4B5FD] transition hover:bg-white/10 hover:text-white"
                      aria-label="Attach screenshot"
                    >
                      <Camera className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={clearActiveChat}
                      className="inline-grid size-10 shrink-0 place-items-center rounded-xl text-[#C4B5FD] transition hover:bg-white/10 hover:text-white"
                      aria-label="Clear chat"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={startVoiceInput}
                      className="inline-grid size-10 shrink-0 place-items-center rounded-xl text-[#C4B5FD] transition hover:bg-white/10 hover:text-white"
                      aria-label="Voice input"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                    {isGenerating ? (
                      <button
                        type="button"
                        onClick={stopGenerating}
                        className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-xl bg-red-500 px-[clamp(0.8rem,2vw,1rem)] text-sm font-bold text-white transition hover:bg-red-600"
                      >
                        <Square className="h-4 w-4 fill-current" />
                        Stop
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!input.trim()}
                        className="inline-flex min-h-[2.5rem] items-center gap-2 rounded-lg border border-violet-400/60 bg-violet-600 px-[clamp(0.9rem,2.2vw,1.1rem)] text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:border-[#2A2555] disabled:bg-[#0E0C1E] disabled:text-[#8B7EC8]"
                      >
                        <Send className="h-4 w-4" />
                        Send
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-2 text-center text-[clamp(0.72rem,1.5vw,0.8rem)] text-[#C4B5FD]">
                Messages stream securely with full conversation context.
              </p>
            </form>
          </div>
        </section>
      </div>

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        temperature={temperature}
        onClose={() => setSettingsOpen(false)}
        onThemeChange={setTheme}
        onTemperatureChange={setTemperature}
      />
      {!desktopConnected ? (
        <DownloadCompanionModal
          assistantId={assistantId}
          assistantName={assistantName}
          assistantColor={assistantMeta?.color}
          assistantIcon={assistantMeta?.icon}
          open={downloadOpen}
          onClose={() => setDownloadOpen(false)}
        />
      ) : null}
    </main>
  );
}

function readPinnedSessionIds(assistantId?: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const raw = window.localStorage.getItem(pinnedKey(assistantId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function WelcomeScreen({
  assistantName,
  assistantIcon,
  openingExperience,
  onPromptSelect
}: {
  assistantName: string;
  assistantIcon?: string;
  openingExperience: AssistantOpeningExperience;
  onPromptSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 items-center">
      <div className="w-full py-[clamp(2rem,6vw,3.5rem)]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="mx-auto mb-[clamp(1.5rem,4vw,2.25rem)] flex max-w-[min(100%,42rem)] gap-[clamp(0.75rem,2vw,1rem)]"
        >
          <AssistantAvatar name={assistantName} icon={assistantIcon} size="md" />
          <div className="rounded-[clamp(0.85rem,2vw,1.1rem)] border border-[#2A2555] bg-[#1A1640] px-[clamp(1rem,2.5vw,1.25rem)] py-[clamp(0.9rem,2.2vw,1rem)] text-[clamp(0.88rem,1.8vw,0.95rem)] leading-7 text-[#F0EAFF] shadow-sm shadow-black/20">
            {openingExperience.greeting}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-[min(100%,48rem)] text-center"
        >
          <span className="mx-auto grid size-[clamp(3.5rem,9vw,4.75rem)] place-items-center overflow-hidden rounded-[clamp(0.85rem,2vw,1.1rem)] border border-[#3D3578] bg-[#F0EAFF] shadow-lg shadow-black/25" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/archmind-logo.png" alt="" className="h-full w-full object-cover" />
          </span>
          <h1 className="mt-6 text-[clamp(2rem,6vw,3.25rem)] font-black leading-tight tracking-normal text-white">How can I help today?</h1>
          <p className="mx-auto mt-4 max-w-[min(100%,42rem)] text-[clamp(0.95rem,2vw,1rem)] leading-7 text-[#C4B5FD]">
            Try a recommended message, then edit it before sending.
          </p>
        </motion.div>

        <div className="mt-[clamp(1.5rem,4vw,2.5rem)] grid gap-3 sm:grid-cols-2">
          {openingExperience.recommendedMessages.map((prompt, index) => (
            <motion.button
              key={prompt}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              onClick={() => onPromptSelect(prompt)}
              className="group rounded-[clamp(0.85rem,2vw,1.1rem)] border border-[#2A2555] bg-[#12102A] p-[clamp(1rem,2.5vw,1.25rem)] text-left text-[#F0EAFF] shadow-sm transition hover:border-blue-500 hover:bg-[#1A1640]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-white">{prompt}</h2>
                </div>
                <MoreHorizontal className="h-5 w-5 text-[#8B7EC8] transition group-hover:text-[#C4B5FD]" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  copied,
  onCopy,
  onRegenerate
}: {
  message: ChatMessage;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  const isAssistant = message.role === "assistant";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -1 }}
      className={cn("flex gap-[clamp(0.75rem,2vw,1rem)]", isAssistant ? "items-start" : "justify-end")}
    >
      {isAssistant ? (
        <div className="mt-1 grid size-[2.35rem] shrink-0 place-items-center rounded-lg border border-violet-400/60 bg-violet-600 text-white shadow-sm">
          <Bot className="h-5 w-5" />
        </div>
      ) : null}

      <div className={cn("max-w-[min(42rem,92%)]", isAssistant ? "mr-auto" : "ml-auto")}>
        <div
          className={cn(
            "rounded-[clamp(0.85rem,2vw,1.1rem)] px-[clamp(1rem,2.5vw,1.25rem)] py-[clamp(0.9rem,2.2vw,1rem)] text-[clamp(0.88rem,1.8vw,0.95rem)] leading-7 shadow-sm transition",
            isAssistant
              ? "border border-[#2A2555] bg-[#1A1640] text-[#F0EAFF] shadow-black/20"
              : "border border-violet-400/70 bg-violet-600 text-white"
          )}
        >
          {isAssistant ? (
            message.content ? (
              <div className={cn("markdown-body", message.error && "text-red-200")}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    a: ({ node, href, children, ...props }) => {
                      if (!href?.startsWith("http://") && !href?.startsWith("https://") && !href?.startsWith("/")) {
                        return <span>{children}</span>;
                      }
                      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
                    }
                  }}
                >
                  {typeof window !== "undefined"
                    ? DOMPurify.sanitize(message.content, {
                      ALLOWED_TAGS: ["b", "i", "em", "strong", "p", "br", "a", "code", "pre", "h1", "h2", "h3", "ul", "ol", "li", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "span", "div"],
                      ALLOWED_ATTR: ["href", "title", "target", "rel"],
                    })
                    : message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <TypingIndicator compact />
            )
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
          {message.attachments && message.attachments.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-3">
              {message.attachments.map((att, i) => (
                <div key={`${att.name}-${i}`} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[#3D3578] bg-[#12102A] px-2 py-1 text-xs text-[#F0EAFF]">
                  {att.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.url} alt={att.name} className="h-12 w-12 rounded object-cover" />
                  ) : (
                    <div className="grid size-8 shrink-0 place-items-center rounded bg-white/10 text-xs">{att.name.split('.').pop()}</div>
                  )}
                  <div className="max-w-xs">
                    <div className="font-semibold truncate">{att.name}</div>
                    <div className="text-xs text-[#C4B5FD]">{att.type || 'file'} · {Math.round((att.size || 0) / 1024)} KB</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {isAssistant && message.content ? (
          <div className="mt-2 flex flex-wrap items-center gap-1 text-[#C4B5FD]">
            {message.sourceNames && message.sourceNames.length > 0 ? (
              <span className="rounded-lg border border-violet-400/40 bg-[#1E1145] px-2 py-1 text-xs font-semibold text-[#DDD6FE]">
                Used knowledge: {message.sourceNames.join(", ")}
              </span>
            ) : null}
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-white/10 hover:text-white"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={onRegenerate}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-white/10 hover:text-white"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function TypingIndicator({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("text-sm text-[#C4B5FD]", compact ? "py-0" : "py-2")}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">Thinking</span>
        <span className="flex gap-1">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
              transition={{ repeat: Infinity, duration: 1, delay: dot * 0.15 }}
              className="h-1.5 w-1.5 rounded-full bg-blue-400"
            />
          ))}
        </span>
      </div>
      {!compact ? (
        <div className="mt-3 space-y-2">
          <div className="typing-line h-2.5 w-[min(16rem,72vw)] rounded-full" />
          <div className="typing-line h-2.5 w-[min(11rem,54vw)] rounded-full" />
        </div>
      ) : null}
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[#2A2555] bg-[#12102A] p-3">
          <Skeleton className="h-4 w-40 bg-[#231E52]" />
          <Skeleton className="mt-3 h-3 w-20 bg-[#231E52]" />
        </div>
      ))}
    </div>
  );
}

function ChatHistorySkeleton() {
  return (
    <div className="space-y-6 pb-28 pt-4">
      <div className="flex gap-4">
        <Skeleton className="size-[2.35rem] shrink-0 rounded-xl" />
        <div className="w-full max-w-[min(42rem,92%)] rounded-xl border border-[#2A2555] bg-[#1A1640] p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-3 h-4 w-11/12" />
          <Skeleton className="mt-3 h-4 w-1/2" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-full max-w-[min(28rem,88%)] rounded-xl border border-violet-400/70 bg-violet-600 p-5">
          <Skeleton className="h-4 w-3/4 bg-white/20" />
          <Skeleton className="mt-3 h-4 w-1/2 bg-white/20" />
        </div>
      </div>
    </div>
  );
}

function SettingsModal({
  open,
  theme,
  temperature,
  onClose,
  onThemeChange,
  onTemperatureChange
}: {
  open: boolean;
  theme: "dark" | "light";
  temperature: number;
  onClose: () => void;
  onThemeChange: (theme: "dark" | "light") => void;
  onTemperatureChange: (temperature: number) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 px-[clamp(1rem,4vw,2rem)] py-[clamp(1.5rem,5vw,3rem)]"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            className="w-full max-w-[min(92vw,34rem)] rounded-[clamp(0.9rem,2.2vw,1.2rem)] border border-[#3D3578] bg-[#12102A] p-[clamp(1.2rem,4vw,1.6rem)] text-[#F0EAFF] shadow-2xl shadow-black/60"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[clamp(1.15rem,2.8vw,1.35rem)] font-black">Settings</h2>
                <p className="mt-1 text-sm text-[#C4B5FD]">Tune the assistant experience.</p>
              </div>
              <button onClick={onClose} className="rounded-lg border border-[#2A2555] bg-[#1A1640] p-2 text-[#C4B5FD] transition hover:bg-[#231E52] hover:text-white" aria-label="Close settings">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold">Creativity</label>
                  <span className="text-sm text-[#C4B5FD]">{temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.4"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => onTemperatureChange(Number(event.target.value))}
                  className="mt-3 w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="text-sm font-bold">Theme</label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["dark", "light"] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => onThemeChange(option)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold capitalize transition",
                        theme === option
                          ? "border-violet-400/70 bg-[#1E1145] text-[#DDD6FE]"
                          : "border-[#2A2555] bg-[#1A1640] text-[#C4B5FD] hover:bg-[#231E52] hover:text-white"
                      )}
                    >
                      {option === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-[#2A2555] bg-[#1A1640] p-4 text-sm leading-6 text-[#C4B5FD]">
                Sensitive credentials stay protected. Your browser only receives presentation-ready responses.
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

interface SpeechRecognitionResultLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
