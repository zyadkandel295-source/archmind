"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Download,
  ExternalLink,
  HardDriveDownload,
  HelpCircle,
  Loader2,
  Minimize2,
  Monitor,
  Move,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X
} from "lucide-react";
import { ApiRequestError, requestData, requestFile } from "@/lib/data-client";
import { toast } from "@/components/ui/toast";

interface DownloadCompanionModalProps {
  assistantId?: string;
  assistantName: string;
  assistantColor?: string;
  assistantIcon?: string;
  open: boolean;
  onClose: () => void;
}

type BuildStatus = "idle" | "validating" | "queued" | "building" | "packaging" | "validating_artifact" | "ready" | "downloading" | "failed";

type DesktopBuild = {
  id: string;
  assistantId: string;
  platform: "win32" | "darwin" | "linux";
  architecture: "x64" | "arm64";
  status: BuildStatus;
  productName: string;
  runtimeVersion: string;
  assistantVersion: number;
  artifactSize?: number;
  artifactSha256?: string;
  error?: string;
  expiresAt: string;
};

const activeStatuses: BuildStatus[] = ["validating", "queued", "building", "packaging", "validating_artifact", "downloading"];

const statusStepIndex: Record<BuildStatus, number> = {
  idle: 0,
  validating: 1,
  queued: 1,
  building: 2,
  packaging: 3,
  validating_artifact: 3,
  ready: 4,
  downloading: 4,
  failed: -1
};

const statusDescriptions: Record<BuildStatus, string> = {
  idle: "Ready to prepare assistant installer",
  validating: "Step 1/4: Validating security & account credentials...",
  queued: "Step 1/4: Queued in desktop builder engine...",
  building: "Step 2/4: Assembling isolated assistant app bundle...",
  packaging: "Step 3/4: Packaging fast Windows NSIS installer (~15-30s)...",
  validating_artifact: "Step 4/4: Verifying installer SHA-256 integrity...",
  ready: "Installer Ready! Click Download to get your app.",
  downloading: "Downloading protected installer package...",
  failed: "Installer build failed. Click Rebuild to try again."
};

function formatBytes(bytes?: number) {
  if (!bytes) return "Available after build";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DownloadCompanionModal({
  assistantId,
  assistantName,
  assistantColor = "#7C3AED",
  assistantIcon = "Bot",
  open,
  onClose
}: DownloadCompanionModalProps) {
  const [activeTab, setActiveTab] = useState<"download" | "bubble">("download");
  const [installing, setInstalling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
  const [latestBuild, setLatestBuild] = useState<DesktopBuild>();
  const [downloadToken, setDownloadToken] = useState<string>();
  const [errorMessage, setErrorMessage] = useState<string>();
  
  // Interactive Floating Bubble Preview State
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [bubblePos, setBubblePos] = useState({ x: 24, y: 24 });
  const [previewMessages, setPreviewMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: `Hi! I'm ${assistantName} floating bubble. I stay accessible on your desktop anytime!` }
  ]);
  const [previewInput, setPreviewInput] = useState("");

  const pollTimerRef = useRef<number>();
  const installInFlight = useRef(false);

  // Poll build state if active
  const checkBuildStatus = useCallback(async () => {
    if (!assistantId) return;
    try {
      const response = await requestData<{ builds: DesktopBuild[] }>(`/api/platform/desktop/builds?assistantId=${assistantId}`);
      if (response.builds.length > 0) {
        const build = response.builds[0]!;
        setLatestBuild(build);
        setBuildStatus(build.status);
        if (build.error) setErrorMessage(build.error);
        return build;
      }
    } catch {
      // Ignore polling errors
    }
    return undefined;
  }, [assistantId]);

  useEffect(() => {
    if (open && assistantId) {
      void checkBuildStatus();
    }
  }, [open, assistantId, checkBuildStatus]);

  useEffect(() => {
    if (!open || !assistantId || !activeStatuses.includes(buildStatus)) {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      return;
    }
    const poll = async () => {
      const build = await checkBuildStatus();
      if (build && activeStatuses.includes(build.status)) {
        pollTimerRef.current = window.setTimeout(poll, 2500);
      }
    };
    pollTimerRef.current = window.setTimeout(poll, 2500);
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, [open, assistantId, buildStatus, checkBuildStatus]);

  async function startFastBuild(force = false) {
    if (!assistantId || installInFlight.current) return;
    installInFlight.current = true;
    setInstalling(true);
    setErrorMessage(undefined);
    setBuildStatus("validating");

    const idempotencyKey = force ? crypto.randomUUID() : `build-${assistantId}-${Date.now()}`;

    try {
      const response = await requestData<{ build: DesktopBuild; downloadToken?: string; reused: boolean }>("/api/platform/desktop/builds", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ assistantId, platform: "win32", architecture: "x64", force })
      });

      setLatestBuild(response.build);
      setBuildStatus(response.build.status);
      if (response.downloadToken) setDownloadToken(response.downloadToken);

      toast({
        type: "info",
        title: response.reused ? "Installer Ready" : "Packaging Started",
        message: response.reused ? "Reused verified assistant installer build." : "ArchMind is packaging your 30-second Windows installer.",
        dedupeKey: `build-toast-${response.build.id}`
      });

      if (response.build.status === "ready") {
        await handleDownloadInstaller(response.build, response.downloadToken);
      }
    } catch (error) {
      const msg = error instanceof ApiRequestError ? error.message : "Build request failed.";
      setErrorMessage(msg);
      setBuildStatus("failed");
      toast({ type: "error", title: "Installer build failed", message: msg });
    } finally {
      installInFlight.current = false;
      setInstalling(false);
    }
  }

  async function handleDownloadInstaller(build: DesktopBuild, token?: string) {
    if (downloading) return;
    setDownloading(true);
    setBuildStatus("downloading");
    try {
      let activeToken = token ?? downloadToken;
      if (!activeToken) {
        const authRes = await requestData<{ downloadToken: string }>(`/api/platform/desktop/builds/${build.id}/download-authorization`, { method: "POST" });
        activeToken = authRes.downloadToken;
        setDownloadToken(activeToken);
      }
      const file = await requestFile(`/api/platform/desktop/builds/${build.id}/download?token=${encodeURIComponent(activeToken)}`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename ?? `Install ${assistantName.replace(/[^a-z0-9 -]+/gi, "").trim() || "ArchMind Assistant"}.exe`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setBuildStatus("ready");
      toast({
        type: "success",
        title: "Download Started!",
        message: "Open the downloaded .exe installer on Windows to complete setup.",
        duration: 4000
      });
    } catch (error) {
      setBuildStatus("failed");
      const msg = error instanceof ApiRequestError ? error.message : "Download failed.";
      setErrorMessage(msg);
      toast({ type: "error", title: "Download failed", message: msg });
    } finally {
      setDownloading(false);
    }
  }

  function handleSendPreviewMessage() {
    if (!previewInput.trim()) return;
    const userText = previewInput.trim();
    setPreviewMessages((prev) => [
      ...prev,
      { role: "user", text: userText },
      { role: "assistant", text: `[Bubble Preview] Responding to: "${userText}". In the desktop app, this runs via global hotkey (Alt+Space) right over your apps!` }
    ]);
    setPreviewInput("");
  }

  const currentStep = statusStepIndex[buildStatus] ?? 0;
  const isBuilding = activeStatuses.includes(buildStatus);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/80 p-4 sm:p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-companion-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            className="relative w-full max-w-2xl rounded-2xl border border-[#3A3366] bg-[#0E0C1F] p-6 text-white shadow-2xl shadow-violet-950/50"
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-xl border border-slate-700 bg-[#161330] p-2 text-slate-300 transition hover:bg-[#221D47] hover:text-white"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header Badge */}
            <div className="flex items-center gap-3">
              <div
                className="grid h-12 w-12 place-items-center rounded-2xl text-white shadow-md"
                style={{ backgroundColor: assistantColor }}
              >
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-300">
                  <Sparkles className="h-3 w-3 text-amber-400" /> ~30s Desktop Builder
                </span>
                <h2 id="download-companion-title" className="mt-1 text-2xl font-black text-white sm:text-3xl">
                  {assistantName} App & Bubble
                </h2>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="mt-6 flex border-b border-[#252046]">
              <button
                type="button"
                onClick={() => setActiveTab("download")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === "download"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <HardDriveDownload className="h-4 w-4" /> Download Windows App
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bubble")}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === "bubble"
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <Bot className="h-4 w-4" /> Floating Bubble Preview
              </button>
            </div>

            {/* TAB 1: DOWNLOAD SETUP */}
            {activeTab === "download" ? (
              <div className="mt-6 space-y-5">
                <p className="text-sm leading-6 text-slate-300">
                  Build and download a dedicated Windows desktop installer bound to <strong className="text-white">{assistantName}</strong>. Runs as a floating bubble or desktop window with real-time chat synchronization.
                </p>

                {/* Progress Bar & Steps */}
                <div className="rounded-xl border border-[#27214B] bg-[#070611] p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>{statusDescriptions[buildStatus]}</span>
                    <span>{latestBuild?.artifactSize ? formatBytes(latestBuild.artifactSize) : "Fast NSIS"}</span>
                  </div>

                  {/* Visual Step Indicator */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[1, 2, 3, 4].map((step) => {
                      const active = currentStep >= step;
                      const current = currentStep === step && isBuilding;
                      return (
                        <div
                          key={step}
                          className={`h-2 rounded-full transition-all duration-500 ${
                            active
                              ? "bg-violet-500 shadow-sm shadow-violet-500/50"
                              : current
                              ? "bg-violet-400 animate-pulse"
                              : "bg-slate-800"
                          }`}
                        />
                      );
                    })}
                  </div>

                  {errorMessage ? (
                    <p className="mt-2 text-xs font-medium text-rose-400">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="button"
                    disabled={installing || downloading}
                    onClick={() => void startFastBuild(latestBuild?.status === "failed")}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500 disabled:opacity-50"
                  >
                    {installing || downloading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : latestBuild?.status === "ready" ? (
                      <Download className="h-5 w-5" />
                    ) : (
                      <HardDriveDownload className="h-5 w-5" />
                    )}
                    {downloading
                      ? "Downloading Setup..."
                      : installing
                      ? "Building App (~30s)..."
                      : latestBuild?.status === "ready"
                      ? "Download Windows Installer"
                      : "Build & Download (~30s)"}
                  </button>

                  {assistantId ? (
                    <Link
                      href={`/assistants/${assistantId}/deploy`}
                      onClick={onClose}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#161330] px-4 py-3.5 text-sm font-bold text-slate-200 transition hover:bg-[#221D47] hover:text-white"
                    >
                      <Monitor className="h-4 w-4" /> Manage Devices
                    </Link>
                  ) : null}
                </div>

                {/* Security Note */}
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3 text-xs leading-5 text-emerald-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>
                    Zero permanent account passwords stored in binary. Uses single-use bootstrap credential linked directly to your assistant backend.
                  </span>
                </div>
              </div>
            ) : null}

            {/* TAB 2: FLOATING BUBBLE PREVIEW */}
            {activeTab === "bubble" ? (
              <div className="mt-6 space-y-4">
                <p className="text-sm leading-6 text-slate-300">
                  Test how the floating bubble widget works right here on the website! In the desktop app, this bubble floats above all Windows apps and expands on click or via <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-xs text-violet-300 font-mono">Alt+Space</kbd>.
                </p>

                {/* Interactive Simulation Area */}
                <div className="relative min-h-[220px] rounded-xl border border-dashed border-[#3D3578] bg-[#070611] p-4 overflow-hidden">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Move className="h-3.5 w-3.5 text-violet-400" /> Drag or click the bubble icon below:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBubbleOpen(!bubbleOpen)}
                      className="text-violet-400 hover:underline"
                    >
                      {bubbleOpen ? "Minimize Bubble" : "Expand Bubble Chat"}
                    </button>
                  </div>

                  {/* Floating Bubble Icon */}
                  <motion.div
                    drag
                    dragConstraints={{ left: 0, right: 340, top: 0, bottom: 120 }}
                    onClick={() => setBubbleOpen(!bubbleOpen)}
                    className="absolute cursor-pointer z-10 grid h-12 w-12 place-items-center rounded-full text-white shadow-xl shadow-violet-950/80 ring-2 ring-violet-400/50 hover:scale-105 transition-transform"
                    style={{ backgroundColor: assistantColor, top: bubblePos.y, left: bubblePos.x }}
                  >
                    <Bot className="h-6 w-6" />
                  </motion.div>

                  {/* Expanded Mini Chat Overlay */}
                  <AnimatePresence>
                    {bubbleOpen ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute right-4 bottom-4 w-72 rounded-xl border border-[#3A3366] bg-[#120F2A] shadow-2xl p-3 z-20 space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-[#27214B] pb-2">
                          <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5" /> {assistantName} (Bubble)
                          </span>
                          <button
                            type="button"
                            onClick={() => setBubbleOpen(false)}
                            className="text-slate-400 hover:text-white"
                          >
                            <Minimize2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-2 text-xs">
                          {previewMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`p-2 rounded-lg ${
                                msg.role === "user"
                                  ? "bg-violet-600 text-white ml-6 text-right"
                                  : "bg-[#1A1640] border border-[#2D275A] text-slate-200 mr-4"
                              }`}
                            >
                              {msg.text}
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={previewInput}
                            onChange={(e) => setPreviewInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendPreviewMessage()}
                            placeholder="Type preview message..."
                            className="flex-1 rounded-lg border border-[#3D3578] bg-[#080715] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
                          />
                          <button
                            type="button"
                            onClick={handleSendPreviewMessage}
                            className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-white hover:bg-violet-500"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("download")}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-lg hover:bg-violet-500"
                  >
                    <HardDriveDownload className="h-4 w-4" /> Download Windows Desktop App (~30s)
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
