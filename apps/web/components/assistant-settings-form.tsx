"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { requestData } from "@/lib/data-client";
import { DEFAULT_ENGINE_VALUE, ENGINE_OPTIONS } from "@/lib/engine-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { AssistantIconPicker } from "@/components/ui/assistant-icon-picker";
import { getAssistantIcon } from "@/lib/assistant-icons";

interface Assistant {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  tone: "professional" | "casual" | "teacher" | "custom";
  isPublic: boolean;
  model: string;
  temperature: number;
  icon?: string;
  color?: string;
  starterPrompts?: string[];
}

const fallbackAssistant: Assistant = {
  id: "",
  name: "Assistant",
  description: "",
  systemPrompt: "You are ArchMind, a professional AI assistant. Follow the user's instructions strictly and answer clearly.",
  tone: "professional",
  isPublic: false,
  model: DEFAULT_ENGINE_VALUE,
  temperature: 0.7,
  icon: "Bot",
  color: "#8B5CF6",
  starterPrompts: []
};

export function AssistantSettingsForm({ assistantId }: { assistantId: string }) {
  const router = useRouter();
  const [assistant, setAssistant] = useState<Assistant>({ ...fallbackAssistant, id: assistantId });
  const [starterPrompts, setStarterPrompts] = useState("");
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    requestData<{ assistant: Assistant }>(`/api/assistants/${assistantId}`)
      .then((response) => {
        if (mounted) {
          setAssistant(response.assistant);
          setStarterPrompts((response.assistant.starterPrompts ?? []).join("\n"));
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Could not load assistant settings.";
        if (mounted) {
          const isAuthError =
            message === "UNAUTHENTICATED" ||
            message.includes("Missing bearer token") ||
            message.includes("Invalid or expired access token") ||
            message.includes("Unauthenticated");

          if (!isAuthError) {
            setStatus(message);
          }
          toast({ type: "error", title: "Settings failed to load", message });
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [assistantId]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(undefined);
    try {
      const response = await requestData<{ assistant: Assistant }>(`/api/assistants/${assistantId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: assistant.name,
          description: assistant.description,
          systemPrompt: assistant.systemPrompt,
          tone: assistant.tone,
          isPublic: assistant.isPublic,
          visibility: assistant.isPublic ? "public" : "private",
          model: assistant.model,
          temperature: assistant.temperature,
          icon: assistant.icon,
          color: assistant.color,
          starterPrompts: starterPrompts.split("\n").map((prompt) => prompt.trim()).filter(Boolean)
        })
      });
      setAssistant(response.assistant);
      setStarterPrompts((response.assistant.starterPrompts ?? []).join("\n"));
      setStatus("Settings saved.");
      toast({ type: "success", title: "Settings saved", message: `${response.assistant.name} is up to date.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Settings could not be saved.";
      setStatus(message);
      toast({ type: "error", title: "Save failed", message });
    } finally {
      setSaving(false);
    }
  }

  async function clearConversations() {
    setClearing(true);
    setStatus(undefined);
    try {
      await requestData(`/api/assistants/${assistantId}/conversations/clear`, { method: "POST" });
      setStatus("Conversations cleared.");
      toast({ type: "success", title: "Conversations cleared", message: "Only this assistant's conversations were cleared." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Conversations could not be cleared.";
      setStatus(message);
      toast({ type: "error", title: "Clear failed", message });
    } finally {
      setClearing(false);
    }
  }

  async function deleteAssistant() {
    if (!window.confirm("Are you sure you want to delete this assistant?")) return;
    setDeleting(true);
    try {
      await requestData(`/api/assistants/${assistantId}`, { method: "DELETE" });
      toast({ type: "success", title: "Assistant deleted", message: "Returning to the dashboard." });
      router.push("/dashboard");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Assistant could not be deleted.";
      setStatus(message);
      toast({ type: "error", title: "Delete failed", message });
      setDeleting(false);
    }
  }

  if (loading) return <SettingsSkeleton />;
  const HeaderIcon = getAssistantIcon(assistant.icon).Icon;

  return (
    <motion.form initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} onSubmit={save}>
      <div className="mb-8 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="secondary" disabled={clearing || saving || deleting} onClick={clearConversations}>
          {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {clearing ? "Clearing" : "Clear conversations"}
        </Button>
        <Button type="button" variant="ghost" disabled={clearing || saving || deleting} onClick={deleteAssistant}>
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {deleting ? "Deleting" : "Delete"}
        </Button>
        <Button type="submit" disabled={saving || clearing || deleting}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving" : "Save changes"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-xl border bg-[#1A1640] text-white shadow-sm"
                style={{ borderColor: assistant.color || "#8B5CF6" }}
              >
                <HeaderIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Behavior & Style</h2>
                <p className="mt-1 text-sm text-[#C4B5FD]">Tune identity, instructions, response engine, and sharing.</p>
              </div>
            </div>
            <SlidersHorizontal className="h-5 w-5 text-[#C4B5FD]" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold">Assistant name</label>
            <Input value={assistant.name} onChange={(event) => setAssistant((current) => ({ ...current, name: event.target.value }))} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Response Engine</label>
            <Select
              value={assistant.model}
              onChange={(event) => setAssistant((current) => ({ ...current, model: event.target.value }))}
            >
              {ENGINE_OPTIONS.map((option) => (
                <option key={option.tier} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Temperature</label>
            <Input
              value={assistant.temperature}
              onChange={(event) => setAssistant((current) => ({ ...current, temperature: Number(event.target.value) }))}
              type="number"
              min="0"
              max="2"
              step="0.1"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Tone</label>
            <Select
              value={assistant.tone}
              onChange={(event) => setAssistant((current) => ({ ...current, tone: event.target.value as Assistant["tone"] }))}
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="teacher">Teacher</option>
              <option value="custom">Custom</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">Description</label>
            <Textarea
              value={assistant.description ?? ""}
              onChange={(event) => setAssistant((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">Instructions / system prompt</label>
            <Textarea
              className="min-h-44"
              value={assistant.systemPrompt}
              onChange={(event) => setAssistant((current) => ({ ...current, systemPrompt: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">Icon</label>
            <AssistantIconPicker
              value={assistant.icon ?? "Bot"}
              onChange={(nextIcon) => setAssistant((current) => ({ ...current, icon: nextIcon }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Color</label>
            <Input value={assistant.color ?? "#8B5CF6"} onChange={(event) => setAssistant((current) => ({ ...current, color: event.target.value }))} type="color" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold">Starter prompts</label>
            <Textarea className="min-h-28" value={starterPrompts} onChange={(event) => setStarterPrompts(event.target.value)} />
          </div>
          <label className="flex items-center gap-3 rounded-xl border border-[#2A2555] bg-[#12102A] p-4 text-sm font-semibold text-[#F0EAFF] shadow-sm">
            <input
              checked={assistant.isPublic}
              onChange={(event) => setAssistant((current) => ({ ...current, isPublic: event.target.checked }))}
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
            />
            Public assistant with shareable slug
          </label>
          {status ? <p className="rounded-lg border border-violet-400/50 bg-[#1E1145] px-4 py-3 text-sm font-semibold text-[#DDD6FE] md:col-span-2">{status}</p> : null}
        </CardContent>
      </Card>
    </motion.form>
  );
}

function SettingsSkeleton() {
  return (
    <div>
      <div className="mb-8 flex justify-end gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div>
              <Skeleton className="h-6 w-52" />
              <Skeleton className="mt-2 h-4 w-72" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className={index === 4 || index === 5 || index === 6 ? "md:col-span-2" : ""}>
              <Skeleton className="mb-2 h-4 w-32" />
              <Skeleton className={index === 5 ? "h-44 w-full" : index === 6 ? "h-28 w-full" : "h-11 w-full"} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
