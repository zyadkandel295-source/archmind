"use client";
import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { fileFetch, type GeneratedFileView } from "@/lib/generated-files";

export function GeneratedFileCard({ id }: { id: string }) {
  const [file, setFile] = useState<GeneratedFileView>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState<string>();
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const data = await (await fileFetch(`/files/${id}/status`)).json();
        if (!active) return;
        setFile(data.file);
        setError("");
        if (!["completed", "failed"].includes(data.file.status))
          timer = setTimeout(poll, 2500);
      } catch (e) {
        if (active) {
          setError(
            e instanceof Error ? e.message : "Could not load file status.",
          );
          timer = setTimeout(poll, 10000);
        }
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);
  async function download(open = false) {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const blob = await (
        await fileFetch(`/files/${id}/download${open ? "?inline=true" : ""}`)
      ).blob();
      const url = URL.createObjectURL(blob);
      if (open) {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        anchor.click();
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.filename;
        anchor.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }
  async function retry() {
    setBusy(true);
    setError("");
    try {
      const result = await (
        await fileFetch(`/files/${id}/regenerate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: "Retry generation",
            requestId: crypto.randomUUID(),
          }),
        })
      ).json();
      setVersion(result.file.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="mt-3 rounded-xl border border-violet-400/30 bg-violet-400/5 p-4"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <FileText className="mt-1 h-5 w-5 shrink-0 text-violet-300" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-violet-100">
            {file?.filename ?? "Loading file"}
          </p>
          {file?.status === "completed" ? (
            <p className="text-xs text-violet-200/80">
              {
                { pdf: "PDF", docx: "Word Document", pptx: "PowerPoint" }[
                  file.format
                ]
              }{" "}
              · {file.countIsEstimate ? "~" : ""}
              {file.count} {file.format === "pptx" ? "slides" : "pages"} ·{" "}
              {Math.ceil(file.size / 1024)} KB
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-violet-200/80">
              {file?.status !== "failed" && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {file?.stage ?? "Loading status"}
            </p>
          )}
          {file?.status === "completed" && (
            <div className="mt-3 flex gap-3">
              {file.format === "pdf" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void download(true)}
                  className="flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void download()}
                className="flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {busy ? "Loading…" : "Download"}
              </button>
            </div>
          )}
          {file?.error && (
            <p className="mt-2 text-xs text-red-200">{file.error}</p>
          )}
          {file?.status === "failed" && !version && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void retry()}
              className="mt-2 flex items-center gap-1 text-xs font-semibold disabled:opacity-50"
            >
              <RefreshCcw className="h-3 w-3" />
              Retry generation
            </button>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-200">
              {error}
            </p>
          )}
        </div>
      </div>
      {version && <GeneratedFileCard id={version} />}
    </div>
  );
}
