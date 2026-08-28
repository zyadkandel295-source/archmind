"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, HardDriveDownload, Loader2, LockKeyhole, MonitorCog, PackageCheck, ShieldCheck } from "lucide-react";
import { requestData, requestFile } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type Assistant = { id: string; name: string; description?: string };
type Build = { id: string; status: string; productName: string; platform: string; architecture: string; artifactSha256?: string; error?: string; createdAt: string };
type ExportResponse = { package: { id: string }; version: { version: number } };

const inProgress = (status: string) => ["validating", "queued", "building", "packaging", "validating_artifact"].includes(status);
const label = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const appIdentifier = (name: string) => `com.agentia.${name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40) || "assistant"}`;

export function AppExportClient({ assistantId }: { assistantId: string }) {
  const [assistant, setAssistant] = useState<Assistant>();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [publisher, setPublisher] = useState("Agentia Creator");
  const [authMode, setAuthMode] = useState<"agentia_account" | "private" | "public">("agentia_account");
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [downloading, setDownloading] = useState<string>();

  const refresh = useCallback(async () => {
    const result = await requestData<{ builds: Build[] }>(`/api/platform/desktop/builds?assistantId=${encodeURIComponent(assistantId)}`);
    setBuilds(result.builds);
  }, [assistantId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([requestData<{ assistant: Assistant }>(`/api/assistants/${assistantId}`), refresh()])
      .then(([result]) => { if (!cancelled) { setAssistant(result.assistant); setName(result.assistant.name); setId(appIdentifier(result.assistant.name)); } })
      .catch((reason) => !cancelled && setError(reason instanceof Error ? reason.message : "Unable to load export details."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [assistantId, refresh]);

  useEffect(() => {
    if (!builds.some((build) => inProgress(build.status))) return;
    const interval = window.setInterval(() => { void refresh().catch(() => undefined); }, 3_000);
    return () => window.clearInterval(interval);
  }, [builds, refresh]);

  async function buildApp() {
    setSubmitting(true); setError(undefined); setMessage(undefined);
    try {
      const exported = await requestData<ExportResponse>(`/api/platform/assistants/${assistantId}/exports`, {
        method: "POST",
        body: JSON.stringify({ application: { id, name, description: assistant?.description ?? "", version, publisher, authenticationMode: authMode, platform: "windows", architecture: "x64" }, inferenceMode: "cloud", requestedPermissions: ["network", "notifications"], requiredPermissions: [], syncEnabled, releaseNotes: `Exported ${name} ${version}` })
      });
      const built = await requestData<{ reused: boolean }>("/api/platform/desktop/builds", {
        method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ assistantId, packageId: exported.package.id, platform: "win32", architecture: "x64" })
      });
      setMessage(built.reused ? "An identical verified build is ready." : `Build v${exported.version.version} queued. It will continue in the background.`);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The build could not be started."); }
    finally { setSubmitting(false); }
  }

  async function download(buildId: string) {
    setDownloading(buildId); setError(undefined);
    try {
      const authorization = await requestData<{ downloadToken: string }>(`/api/platform/desktop/builds/${buildId}/download-authorization`, { method: "POST" });
      const file = await requestFile(`/api/platform/desktop/builds/${buildId}/download?token=${encodeURIComponent(authorization.downloadToken)}`);
      const url = URL.createObjectURL(file.blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename ?? "Agentia-App-Setup.exe"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The download could not be authorized."); }
    finally { setDownloading(undefined); }
  }

  if (loading) return <div className="mx-auto max-w-6xl space-y-4 p-6"><Skeleton className="h-12 w-2/5 rounded-xl bg-slate-800/50" /><Skeleton className="h-80 w-full rounded-2xl bg-slate-800/30" /></div>;

  return <main className="mx-auto max-w-6xl space-y-6 p-6 text-slate-100">
    <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Agentia App Export</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Build {assistant?.name ?? "assistant"} as an app</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Creates a signed immutable manifest and a real Windows installer. Provider keys and Supabase service credentials never enter the package.</p></div><div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"><ShieldCheck className="mr-2 inline h-4 w-4" /> Isolated build pipeline</div></section>
    {error && <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</div>}
    {message && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">{message}</div>}
    <div className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><MonitorCog className="h-5 w-5 text-cyan-300" /> App configuration</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm text-slate-300">Application name<Input value={name} onChange={(event) => { setName(event.target.value); setId(appIdentifier(event.target.value)); }} className="border-slate-700 bg-slate-900 text-white" /></label><label className="space-y-1.5 text-sm text-slate-300">Semantic version<Input value={version} onChange={(event) => setVersion(event.target.value)} className="border-slate-700 bg-slate-900 text-white" /></label><label className="space-y-1.5 text-sm text-slate-300 sm:col-span-2">Package identifier<Input value={id} onChange={(event) => setId(event.target.value)} placeholder="com.yourcompany.app" className="border-slate-700 bg-slate-900 font-mono text-sm text-white" /></label><label className="space-y-1.5 text-sm text-slate-300">Publisher<Input value={publisher} onChange={(event) => setPublisher(event.target.value)} className="border-slate-700 bg-slate-900 text-white" /></label><label className="space-y-1.5 text-sm text-slate-300">Access model<Select value={authMode} onChange={(event) => setAuthMode(event.target.value as typeof authMode)} className="border-slate-700 bg-slate-900 text-white"><option value="agentia_account">Agentia account</option><option value="private">Creator only</option><option value="public">Public distribution</option></Select></label></div><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-sm"><input type="checkbox" checked={syncEnabled} onChange={(event) => setSyncEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-500" /><span><b className="text-slate-100">Enable secure cloud sync</b><span className="mt-1 block text-xs text-slate-400">The runtime keeps its encrypted local profile separate from synchronization and preserves conflicts for review.</span></span></label><button type="button" disabled={submitting || !name.trim() || !id.trim()} onClick={() => void buildApp()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <HardDriveDownload className="h-5 w-5" />}{submitting ? "Creating signed export…" : "Export as Windows app"}</button></CardContent></Card>
      <div className="space-y-4"><Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="text-lg">Runtime targets</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2"><span>Windows x64 installer</span><span className="text-xs font-semibold text-cyan-200">Available</span></div><div className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-slate-500"><span>macOS, Linux, Web/PWA</span><span className="text-xs">Trusted workers required</span></div></CardContent></Card><Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><LockKeyhole className="h-5 w-5 text-cyan-300" /> Export security</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-relaxed text-slate-400"><p>Manifest fields are strict, canonicalized, checksummed, and signed server-side.</p><p>Credentials, service-role keys, local paths, and conversational content are rejected.</p><p>Sensitive local capabilities remain permission-gated at runtime.</p></CardContent></Card></div>
    </div>
    <Card className="border-slate-800 bg-slate-950/70"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><PackageCheck className="h-5 w-5 text-cyan-300" /> Build history</CardTitle></CardHeader><CardContent>{builds.length === 0 ? <p className="py-6 text-sm text-slate-500">No application builds yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500"><tr><th className="pb-3">Application</th><th className="pb-3">Target</th><th className="pb-3">Status</th><th className="pb-3">Integrity</th><th className="pb-3 text-right">Action</th></tr></thead><tbody>{builds.map((build) => <tr key={build.id} className="border-b border-slate-900"><td className="py-4 font-medium text-slate-200">{build.productName}<span className="mt-1 block text-xs font-normal text-slate-500">{new Date(build.createdAt).toLocaleString()}</span></td><td className="py-4 text-slate-400">{build.platform} / {build.architecture}</td><td className="py-4"><span className={build.status === "ready" ? "text-emerald-300" : build.status === "failed" ? "text-rose-300" : "text-amber-200"}>{inProgress(build.status) && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}{label(build.status)}</span>{build.error && <span className="mt-1 block max-w-xs text-xs text-rose-300">{build.error}</span>}</td><td className="py-4 font-mono text-xs text-slate-500">{build.artifactSha256 ? `${build.artifactSha256.slice(0, 16)}…` : "Pending"}</td><td className="py-4 text-right">{build.status === "ready" ? <button type="button" disabled={downloading === build.id} onClick={() => void download(build.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50">{downloading === build.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download</button> : <span className="text-xs text-slate-600">—</span>}</td></tr>)}</tbody></table></div>}</CardContent></Card>
  </main>;
}
