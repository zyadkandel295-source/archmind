"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, HardDriveDownload, Loader2, MonitorDown, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { ApiRequestError, requestData, requestFile } from "@/lib/data-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";

interface Assistant { id: string; name: string; isPublic: boolean; }
type BuildStatus = "idle" | "validating" | "queued" | "building" | "packaging" | "validating_artifact" | "ready" | "downloading" | "failed" | "expired" | "cancelled";
type DesktopBuild = {
  id: string; assistantId: string; platform: "win32" | "darwin" | "linux"; architecture: "x64" | "arm64";
  status: BuildStatus; productName: string; runtimeVersion: string; assistantVersion: number;
  artifactSize?: number; artifactSha256?: string; error?: string; expiresAt: string;
};
type Device = { id: string; assistantId: string; deviceName: string; revokedAt?: string; lastSeenAt: string; };
const activeStatuses: BuildStatus[] = ["validating", "queued", "building", "packaging", "validating_artifact", "downloading"];
const statusLabel: Record<BuildStatus, string> = {
  idle: "Waiting to start", validating: "Validating", queued: "Queued", building: "Building", packaging: "Packaging",
  validating_artifact: "Verifying installer", ready: "Ready to download", downloading: "Downloading", failed: "Build failed", expired: "Expired", cancelled: "Cancelled"
};

function formatSize(bytes?: number) {
  if (!bytes) return "Available after verification";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function installErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status >= 500) {
    return `The installer service could not finish this yet. Try Rebuild Installer, or wait a moment and click Install Assistant again.${error.correlationId ? ` Reference: ${error.correlationId}.` : ""}`;
  }
  if (error instanceof ApiRequestError && error.correlationId) return `${error.message} Reference: ${error.correlationId}.`;
  return error instanceof Error ? error.message : "The installation request could not be completed.";
}

export function DeployClient({ assistantId }: { assistantId: string }) {
  const [assistant, setAssistant] = useState<Assistant>();
  const [loading, setLoading] = useState(true);
  const [builds, setBuilds] = useState<DesktopBuild[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [downloadTokens, setDownloadTokens] = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [autoDownloadBuildId, setAutoDownloadBuildId] = useState<string>();
  const [architecture, setArchitecture] = useState<"x64" | "arm64">("x64");
  const [installError, setInstallError] = useState<string>();
  const [installStatus, setInstallStatus] = useState<string>("Ready");
  const stateRequestInFlight = useRef(false);
  const installRequestInFlight = useRef(false);
  const currentIdempotencyKey = useRef<string>();
  const autoDownloadedBuilds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    requestData<{ assistant: Assistant }>(`/api/assistants/${assistantId}`)
      .then((response) => { if (!cancelled) setAssistant(response.assistant); })
      .catch((error) => { if (!cancelled) setInstallError(installErrorMessage(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [assistantId]);

  const loadInstallState = useCallback(async () => {
    if (stateRequestInFlight.current) return;
    stateRequestInFlight.current = true;
    try {
      const [buildResponse, deviceResponse] = await Promise.all([
        requestData<{ builds: DesktopBuild[] }>(`/api/platform/desktop/builds?assistantId=${assistantId}`),
        requestData<{ devices: Device[] }>("/api/platform/devices")
      ]);
      setBuilds(buildResponse.builds);
      setDevices(deviceResponse.devices.filter((device) => device.assistantId === assistantId));
      setInstallError(undefined);
    } finally {
      stateRequestInFlight.current = false;
    }
  }, [assistantId]);

  useEffect(() => { void loadInstallState().catch((error) => setInstallError(installErrorMessage(error))); }, [loadInstallState]);

  const latestBuild = builds[0];
  const activeBuildId = latestBuild?.id;
  const activeBuildStatus = latestBuild?.status;
  useEffect(() => {
    if (!activeBuildId || !activeBuildStatus || !activeStatuses.includes(activeBuildStatus)) return;
    let cancelled = false;
    let timer: number | undefined;
    let retryCount = 0;
    const poll = async () => {
      try {
        await loadInstallState();
        retryCount = 0;
        if (!cancelled) timer = window.setTimeout(poll, 3000);
      } catch (error) {
        const retryable = error instanceof ApiRequestError && error.retryable;
        const message = installErrorMessage(error);
        if (!retryable || retryCount >= 3 || cancelled) {
          setInstallError(message);
          toast({ type: "error", title: "Installer status unavailable", message, dedupeKey: `install-poll-${assistantId}` });
          return;
        }
        retryCount += 1;
        timer = window.setTimeout(poll, Math.min(12000, 1000 * 2 ** retryCount));
      }
    };
    timer = window.setTimeout(poll, 3000);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [assistantId, activeBuildId, activeBuildStatus, loadInstallState]);

  async function startInstall(force = false) {
    if (installRequestInFlight.current) return;
    installRequestInFlight.current = true;
    setInstalling(true);
    setInstallStatus("Requesting assistant-specific Windows installer...");
    setInstallError(undefined);
    const idempotencyKey = force ? crypto.randomUUID() : currentIdempotencyKey.current ?? crypto.randomUUID();
    currentIdempotencyKey.current = idempotencyKey;
    try {
      const response = await requestData<{ build: DesktopBuild; downloadToken?: string; reused: boolean; queue?: unknown }>("/api/platform/desktop/builds", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ assistantId, platform: "win32", architecture, force })
      });
      setBuilds((current) => [response.build, ...current.filter((build) => build.id !== response.build.id)]);
      setAutoDownloadBuildId(response.build.id);
      if (response.downloadToken) setDownloadTokens((current) => ({ ...current, [response.build.id]: response.downloadToken! }));
      setInstallStatus(response.build.status === "ready" ? "Assistant installer is ready. Starting protected download..." : `Assistant-specific installer ${response.build.status}. Waiting for packaging to finish...`);
      toast({
        type: "info",
        title: response.reused ? "Assistant installer reused" : "Assistant installer started",
        message: "ArchMind is preparing a Windows app branded and isolated for this assistant.",
        dedupeKey: `install-start-${response.build.id}`
      });
      if (response.build.status === "ready") await downloadInstaller(response.build);
      else void loadInstallState();
    } catch (error) {
      if (!force && error instanceof ApiRequestError && [401, 403].includes(error.status) && /download.*authorized/i.test(error.message)) {
        currentIdempotencyKey.current = undefined;
        installRequestInFlight.current = false;
        setDownloading(false);
        setInstallStatus("Refreshing the assistant installer authorization...");
        await startInstall(true);
        return;
      }
      const message = installErrorMessage(error);
      setInstallError(message);
      toast({ type: "error", title: "Install request failed", message, dedupeKey: `install-request-${assistantId}` });
    } finally {
      currentIdempotencyKey.current = undefined;
      installRequestInFlight.current = false;
      setInstalling(false);
      setDownloading(false);
    }
  }

  const downloadInstaller = useCallback(async (build: DesktopBuild) => {
    if (downloading) return;
    setDownloading(true);
    try {
      let token = downloadTokens[build.id];
      if (!token) {
        const authorization = await requestData<{ build: DesktopBuild; downloadToken: string }>(`/api/platform/desktop/builds/${build.id}/download-authorization`, { method: "POST" });
        token = authorization.downloadToken;
        setDownloadTokens((current) => ({ ...current, [build.id]: token! }));
      }
      const file = await requestFile(`/api/platform/desktop/builds/${build.id}/download?token=${encodeURIComponent(token)}`);
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename ?? `${build.productName.replace(/[^a-z0-9 -]+/gi, "").trim() || "ArchMind Assistant"} Setup.exe`;
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      toast({ type: "success", title: "Installer downloaded", message: "Open the Windows installer, then keep Launch enabled after setup.", dedupeKey: `installer-download-${build.id}` });
    } catch (error) {
      const message = installErrorMessage(error);
      setInstallError(message);
      toast({ type: "error", title: "Download failed", message, dedupeKey: `installer-download-${build.id}` });
    } finally { setDownloading(false); }
  }, [downloadTokens, downloading]);

  useEffect(() => {
    if (!autoDownloadBuildId || !latestBuild || latestBuild.id !== autoDownloadBuildId || latestBuild.status !== "ready") return;
    if (downloading || autoDownloadedBuilds.current.has(latestBuild.id)) return;
    autoDownloadedBuilds.current.add(latestBuild.id);
    setAutoDownloadBuildId(undefined);
    void downloadInstaller(latestBuild);
  }, [autoDownloadBuildId, downloading, downloadInstaller, latestBuild]);

  async function revokeDevice(deviceId: string) {
    try {
      await requestData(`/api/platform/devices/${deviceId}`, { method: "DELETE" });
      await loadInstallState();
      toast({ type: "success", title: "Device revoked", message: "The desktop app will lose access at its next session check." });
    } catch (error) {
      toast({ type: "error", title: "Could not revoke device", message: installErrorMessage(error), dedupeKey: `revoke-${deviceId}` });
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-7 rounded-2xl border border-[#2A2555] bg-[#0C0B18] p-5 sm:p-7">
        <Badge tone={assistant?.isPublic ? "online" : "warning"}>{assistant?.isPublic ? "Public" : "Private"} assistant</Badge>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">{assistant?.name ?? "Assistant"} desktop app</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C4B5FD]">Use your assistant outside the browser, keep it in the system tray, and allow approved local actions on Windows.</p>
      </section>

      {installError ? <div className="mb-5 rounded-xl border border-amber-300/35 bg-amber-400/[0.1] px-4 py-3 text-sm leading-6 text-amber-50">{installError}</div> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
        <Card>
          <CardHeader><h2 className="text-xl font-bold">Install Assistant</h2></CardHeader>
          <CardContent className="space-y-5">
            {loading ? <Skeleton className="h-28 w-full" /> : <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select value={architecture} onChange={(event) => setArchitecture(event.target.value as "x64" | "arm64")} className="rounded-lg border border-[#3D3578] bg-[#0C0B18] px-3 py-2 text-sm font-semibold text-[#F0EAFF]" aria-label="Windows architecture">
                  <option value="x64">Windows x64</option><option value="arm64">Windows ARM64</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={installing || downloading} onClick={() => void startInstall(false)}>
                    {installing || downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
                    {downloading ? "Downloading" : installing ? "Preparing" : "Install Assistant"}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-[#2A2555] bg-[#05070B] p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-[#F0EAFF]">Install status</p><p className="mt-1 text-sm text-[#C4B5FD]">{installStatus}</p></div><MonitorDown className="h-5 w-5 shrink-0 text-blue-300" /></div>
                <p className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.08] p-3 text-sm text-emerald-50">ArchMind prepares a Windows installer branded and isolated for this selected assistant, then downloads it through a protected authorization link.</p>
                {latestBuild ? <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[#8B7EC8]">Windows platform</dt><dd className="font-semibold text-[#F0EAFF]">Windows {latestBuild.architecture.toUpperCase()}</dd></div><div><dt className="text-[#8B7EC8]">Version</dt><dd className="font-semibold text-[#F0EAFF]">Assistant v{latestBuild.assistantVersion}</dd></div><div><dt className="text-[#8B7EC8]">Installer size</dt><dd className="font-semibold text-[#F0EAFF]">{formatSize(latestBuild.artifactSize)}</dd></div><div className="min-w-0"><dt className="text-[#8B7EC8]">SHA-256</dt><dd className="break-all font-mono text-xs text-[#F0EAFF]">{latestBuild.artifactSha256 ?? "Available after verification"}</dd></div></dl> : null}
                {latestBuild?.error ? <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-500/[0.1] p-3 text-sm text-rose-100">The installer could not be created yet. Use Rebuild Installer to try again. {latestBuild.error}</p> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button disabled={!latestBuild || latestBuild.status !== "ready" || downloading} onClick={() => latestBuild && void downloadInstaller(latestBuild)}>{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Installer</Button>
                </div>
              </div>
            </>}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card><CardHeader><h2 className="text-xl font-bold">Installed devices</h2></CardHeader><CardContent className="space-y-3">{devices.length ? devices.map((device) => <div key={device.id} className="flex flex-col gap-3 rounded-lg border border-[#2A2555] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#F0EAFF]">{device.deviceName}</p><p className="text-xs text-[#8B7EC8]">{device.revokedAt ? "Revoked" : `Last seen ${new Date(device.lastSeenAt).toLocaleString()}`}</p></div><Button variant="secondary" disabled={Boolean(device.revokedAt)} onClick={() => void revokeDevice(device.id)}>Revoke Device</Button></div>) : <p className="text-sm leading-6 text-[#8B7EC8]">No Windows devices have completed setup for this assistant yet.</p>}</CardContent></Card>
          <Card><CardHeader><h2 className="text-xl font-bold">Windows installation</h2></CardHeader><CardContent className="space-y-3 text-sm leading-6 text-[#C4B5FD]"><ol className="list-decimal space-y-2 pl-5"><li>Download the verified installer.</li><li>Open the downloaded <code>.exe</code> file.</li><li>Complete Windows setup.</li><li>Keep Launch enabled to open your assistant.</li></ol><div className="flex gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/[0.08] p-3 text-emerald-50"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>The installer contains no permanent account password. Local actions require approval, and devices can be revoked at any time.</p></div></CardContent></Card>
        </div>
      </div>
    </main>
  );
}
