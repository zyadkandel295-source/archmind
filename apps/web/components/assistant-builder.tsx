"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Eye, Loader2, Palette, Sparkles } from "lucide-react";
import { requestData } from "@/lib/data-client";
import { DEFAULT_ENGINE_VALUE, ENGINE_OPTIONS, engineLabel } from "@/lib/engine-options";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { AssistantIconPicker } from "@/components/ui/assistant-icon-picker";
import { getAssistantIcon } from "@/lib/assistant-icons";

const steps = ["Identity", "Behavior", "Launch"];

export function AssistantBuilder() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("Customer Support Assistant");
  const [description, setDescription] = useState("Answers customer questions from support docs with citations.");
  const [tone, setTone] = useState("professional");
  const [engine, setEngine] = useState(DEFAULT_ENGINE_VALUE);
  const [temperature, setTemperature] = useState(0.7);
  const [isPublic, setIsPublic] = useState(true);
  const [icon, setIcon] = useState("Bot");
  const [color, setColor] = useState("#8B5CF6");
  const [starterPrompts, setStarterPrompts] = useState("How can you help me?\nSummarize this document.\nHelp me write better code.");
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a precise support assistant. Follow these instructions strictly. Use retrieved context first when relevant, cite sources when available, and fall back to general knowledge for normal questions."
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await requestData("/api/assistants", {
        method: "POST",
        body: JSON.stringify({
          name,
          description,
          tone,
          systemPrompt,
          isPublic,
          visibility: isPublic ? "public" : "private",
          model: engine,
          temperature,
          icon,
          color,
          starterPrompts: starterPrompts.split("\n").map((prompt) => prompt.trim()).filter(Boolean)
        })
      });
      toast({ type: "success", title: "Assistant created", message: `${name} is now in your dashboard.` });
      router.push("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create assistant.";
      setError(message);
      toast({ type: "error", title: "Creation failed", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <Badge tone="blue">Step {step} of 3</Badge>
              <h1 className="mt-3 text-2xl font-black text-white">Assistant Builder</h1>
              <p className="mt-2 text-sm leading-6 text-[#C4B5FD]">Create a polished assistant profile with custom instructions and advanced settings.</p>
            </div>
            <div className="flex gap-2">
              {steps.map((item, index) => {
                const active = step === index + 1;
                const complete = step > index + 1;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStep(index + 1)}
                    className={cn(
                      "flex h-10 items-center gap-2 rounded-full border px-3 text-xs font-black transition",
                      active
                        ? "border-violet-400/70 bg-[#1E1145] text-[#DDD6FE] shadow-sm"
                        : complete
                          ? "border-[#22C55E]/50 bg-[#10291B] text-[#CFFADE]"
                          : "border-[#2A2555] bg-[#1A1640] text-[#C4B5FD] hover:bg-[#231E52] hover:text-white"
                    )}
                  >
                    {complete ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    <span className="hidden sm:inline">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-6">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="identity"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Name</label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Tone</label>
                    <Select
                      value={tone}
                      onChange={(event) => setTone(event.target.value)}
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="teacher">Teacher</option>
                      <option value="custom">Custom</option>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold">Description</label>
                    <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold">Icon</label>
                    <AssistantIconPicker value={icon} onChange={setIcon} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Color</label>
                    <Input value={color} onChange={(event) => setColor(event.target.value)} type="color" />
                  </div>
                </motion.div>
              ) : null}

              {step === 2 ? (
                <motion.div
                  key="behavior"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold">Instructions / system prompt</label>
                    <Textarea value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} className="min-h-44" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold">Response Engine</label>
                    <Select value={engine} onChange={(event) => setEngine(event.target.value)}>
                      {ENGINE_OPTIONS.map((option) => (
                        <option key={option.tier} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-sm font-semibold">Temperature</label>
                      <span className="text-sm font-semibold text-[#C4B5FD]">{temperature.toFixed(1)}</span>
                    </div>
                    <input
                      value={temperature}
                      onChange={(event) => setTemperature(Number(event.target.value))}
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                    className="h-11 w-full accent-blue-600"
                    />
                  </div>
                </motion.div>
              ) : null}

              {step === 3 ? (
                <motion.div
                  key="launch"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -18 }}
                  className="grid gap-4 md:grid-cols-3"
                >
                  {["RAG sources", "PWA shortcut", "Safe actions"].map((item) => (
                    <div key={item} className="rounded-xl border border-[#2A2555] bg-[#12102A] p-4 text-[#F0EAFF] shadow-sm transition hover:border-[#3D3578] hover:bg-[#1A1640]">
                      <Check className="mb-3 h-5 w-5 text-emerald-300" />
                      <div className="font-semibold text-white">{item}</div>
                      <p className="mt-2 text-sm leading-6 text-[#C4B5FD]">Ready and configured for your workspace.</p>
                    </div>
                  ))}
                  <div className="md:col-span-3">
                    <label className="mb-2 block text-sm font-semibold">Starter prompts</label>
                    <Textarea value={starterPrompts} onChange={(event) => setStarterPrompts(event.target.value)} className="min-h-28" />
                  </div>
                  <label className="rounded-xl border border-[#2A2555] bg-[#12102A] p-4 text-[#F0EAFF] md:col-span-3">
                    <span className="flex items-center gap-3 text-sm font-semibold">
                      <input
                        checked={isPublic}
                        onChange={(event) => setIsPublic(event.target.checked)}
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                      />
                      Create a public sharing slug
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-[#C4B5FD]">
                      Public assistants are available through /p/:slug and can be embedded with an iframe.
                    </span>
                  </label>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {error ? <p className="rounded-xl border border-red-300/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100">{error}</p> : null}

            <div className="flex justify-between">
              <Button type="button" variant="secondary" disabled={step === 1 || saving} onClick={() => setStep((value) => Math.max(1, value - 1))}>
                Back
              </Button>
              {step < 3 ? (
                <Button type="button" disabled={saving} onClick={() => setStep((value) => Math.min(3, value + 1))}>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {saving ? "Creating assistant" : "Create assistant"}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <motion.aside initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="sticky top-24 overflow-hidden">
          <CardContent>
            <div
              className="grid h-16 w-16 place-items-center rounded-xl border bg-[#1A1640] text-white"
              style={{ borderColor: color }}
            >
              {(() => {
                const Icon = getAssistantIcon(icon).Icon;
                return <Icon className="h-8 w-8" />;
              })()}
            </div>
            <h2 className="mt-5 text-xl font-black text-white">{name || "Assistant name"}</h2>
            <p className="mt-2 text-sm leading-6 text-[#C4B5FD]">{description || "Assistant description preview."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">{engineLabel(engine)}</Badge>
              <Badge tone="slate">{tone}</Badge>
              {isPublic ? <Badge tone="green">Shared</Badge> : <Badge tone="amber">Restricted</Badge>}
            </div>
            <div className="mt-5 rounded-xl border border-[#2A2555] bg-[#12102A] p-4 text-[#F0EAFF]">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Eye className="h-4 w-4 text-[#C4B5FD]" />
                Test chat preview
              </div>
              <p className="mt-2 text-sm leading-6 text-[#C4B5FD]">
                After saving, open Chat from the dashboard to test this assistant with these exact instructions.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#C4B5FD]">
              <Palette className="h-4 w-4" />
              {getAssistantIcon(icon).label} / {color}
            </div>
          </CardContent>
        </Card>
      </motion.aside>
    </motion.div>
  );
}
