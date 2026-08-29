"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, RefreshCcw, Trash2, XCircle } from "lucide-react";
import { getPlatformBaseUrl } from "@/lib/platform";
import { requestData } from "@/lib/data-client";
import { readSessionCredential } from "@/lib/session-keys";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

type KnowledgeStatus = "uploading" | "processing" | "ready" | "failed";

interface KnowledgeFile {
  id: string;
  filename: string;
  status: KnowledgeStatus;
  sizeBytes: number;
  uploadedAt: string;
  updatedAt?: string;
  chunks: number;
  textLength: number;
  errorMessage?: string;
}

const ACCEPTED_TYPES = ".txt,.md,.pdf,.docx,.csv,.json";
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(status: KnowledgeStatus) {
  if (status === "ready") return "green";
  if (status === "failed") return "warning";
  return "neutral";
}

function isSupported(file: File) {
  return Boolean(file);
}

function uploadKnowledgeFile(
  assistantId: string,
  file: File,
  onProgress: (progress: number) => void
): Promise<{ fileId: string; filename: string; status: KnowledgeStatus }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", `${getPlatformBaseUrl()}/api/assistants/${assistantId}/knowledge/upload`);
    const credential = readSessionCredential();
    if (credential) request.setRequestHeader("Authorization", `Bearer ${credential}`);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      let payload: any = {};
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : {};
      } catch {
        payload = {};
      }
      if (request.status >= 200 && request.status < 300) {
        resolve({
          fileId: payload.fileId || `file-${Date.now()}`,
          filename: payload.filename || file.name,
          status: payload.status || "ready"
        });
        return;
      }
      reject(new Error(payload?.error?.message ?? "Upload failed. Please try again."));
    };
    request.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    request.send(form);
  });
}

export function SourceUploader({ assistantId }: { assistantId: string }) {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshFiles = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await requestData<{ files: KnowledgeFile[] }>(`/api/assistants/${assistantId}/knowledge`);
      setFiles(response.files ?? []);
    } catch (error) {
      toast({
        type: "error",
        title: "Could not load knowledge",
        message: error instanceof Error ? error.message : "Try refreshing the page."
      });
    } finally {
      setLoadingList(false);
    }
  }, [assistantId]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  async function pollStatus(fileId: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await requestData<{
        fileId: string;
        status: KnowledgeStatus;
        chunks: number;
        textLength: number;
        errorMessage?: string;
      }>(`/api/assistants/${assistantId}/knowledge/${fileId}/status`);
      await refreshFiles();
      if (status.status === "ready" || status.status === "failed") return status;
      await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
    await refreshFiles();
    return undefined;
  }

  async function addFile(file: File) {
    if (uploading) return;
    if (!isSupported(file)) {
      toast({ type: "error", title: "Unsupported file", message: "Upload .txt, .md, .pdf, .docx, .csv, or .json." });
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast({ type: "error", title: "File too large", message: "Knowledge files must be 15 MB or smaller." });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadKnowledgeFile(assistantId, file, setUploadProgress);
      setFiles((current) => [
        {
          id: uploaded.fileId,
          filename: uploaded.filename,
          status: uploaded.status,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          chunks: 0,
          textLength: 0
        },
        ...current
      ]);
      toast({ type: "info", title: "Processing file", message: "The backend received the file and is extracting text." });
      const finalStatus = await pollStatus(uploaded.fileId);
      if (finalStatus?.status === "ready") {
        toast({ type: "success", title: "Knowledge ready", message: `${uploaded.filename} is indexed and available in chat.` });
      } else if (finalStatus?.status === "failed") {
        toast({ type: "error", title: "Parsing failed", message: finalStatus.errorMessage ?? "The file could not be read." });
      }
    } catch (error) {
      toast({
        type: "error",
        title: "Upload failed",
        message: error instanceof Error ? error.message : "The backend did not accept this file."
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void addFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void addFile(file);
  }

  async function deleteFile(file: KnowledgeFile) {
    try {
      await requestData(`/api/assistants/${assistantId}/knowledge/${file.id}`, { method: "DELETE" });
      setFiles((current) => current.filter((item) => item.id !== file.id));
      toast({ type: "success", title: "Knowledge deleted", message: `${file.filename} was removed from retrieval.` });
    } catch (error) {
      toast({
        type: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "Could not delete this file."
      });
    }
  }

  async function retryFile(file: KnowledgeFile) {
    try {
      const result = await requestData<{ status: KnowledgeStatus; errorMessage?: string }>(`/api/assistants/${assistantId}/knowledge/${file.id}/retry`, { method: "POST" });
      await refreshFiles();
      toast({
        type: result.status === "ready" ? "success" : "error",
        title: result.status === "ready" ? "Knowledge ready" : "Processing failed",
        message: result.status === "ready" ? `${file.filename} was re-indexed and is available in chat.` : result.errorMessage ?? "The file could not be processed."
      });
    } catch (error) {
      toast({ type: "error", title: "Retry failed", message: error instanceof Error ? error.message : "Could not retry this file." });
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileUp className="h-5 w-5 text-[#A96342]" />
              <h2 className="text-lg font-bold">Knowledge files</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#74695E]">
              <span>{ACCEPTED_TYPES.replaceAll(",", ", ")}</span>
              <span>Max {formatSize(MAX_SIZE_BYTES)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`rounded-xl border border-dashed p-6 text-center transition ${
              dragActive ? "border-[#D9892B] bg-[#F6E4C9]" : "border-[#D7C5AF] bg-[#FAF5ED]"
            }`}
          >
            <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={onFileSelected} />
            <FileUp className="mx-auto h-8 w-8 text-[#A96342]" />
            <p className="mt-3 text-sm font-semibold text-[#29231E]">Drop a file here or choose one from your device.</p>
            <p className="mt-1 text-sm text-[#74695E]">Ready is shown only after parsing and indexing complete.</p>
            <Button
              type="button"
              className="mt-4 border-[#D7C5AF] bg-[#FFF9F1] text-[#29231E] shadow-sm hover:border-[#CDB99F] hover:bg-white disabled:border-[#D7C5AF] disabled:bg-[#FFF9F1] disabled:text-[#29231E]"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
              {uploading ? "Uploading" : "Choose file"}
            </Button>
            {uploading ? (
              <div className="mx-auto mt-4 max-w-md">
                <div className="h-2 overflow-hidden rounded-full bg-[#E8DDCE]">
                  <div className="h-full bg-[#D9892B] transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
                <div className="mt-2 text-xs font-semibold text-[#855719]">{uploadProgress}% uploaded</div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">File status</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="border-[#D7C5AF] bg-[#FFF9F1] text-[#29231E] hover:border-[#CDB99F] hover:bg-white hover:text-[#29231E] disabled:border-[#D7C5AF] disabled:bg-[#FFF9F1] disabled:text-[#29231E]"
              disabled={loadingList}
              onClick={() => void refreshFiles()}
            >
              {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingList ? (
            <p className="text-sm text-[#74695E]">Loading knowledge files...</p>
          ) : files.length === 0 ? (
            <p className="text-sm leading-6 text-[#74695E]">No knowledge files yet. Upload a supported file to make it available during chat.</p>
          ) : (
            files.map((file) => (
              <div key={file.id} className="flex flex-col justify-between gap-3 rounded-[10px] border border-[#E3D4C2] bg-[#FAF5ED] p-4 text-[#29231E] transition hover:border-[#D7B77F] md:flex-row md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {file.status === "ready" ? <CheckCircle2 className="h-4 w-4 text-[#58785F]" /> : null}
                    {file.status === "failed" ? <XCircle className="h-4 w-4 text-[#A54F41]" /> : null}
                    {file.status === "processing" || file.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin text-[#A16B27]" /> : null}
                    <h3 className="truncate font-bold">{file.filename}</h3>
                    <Badge tone={statusTone(file.status)}>{file.status}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-[#74695E]">
                    {formatSize(file.sizeBytes)} · {file.chunks} chunks · {file.textLength} characters
                  </p>
                  {file.errorMessage ? <p className="mt-2 text-sm text-[#934237]">{file.errorMessage}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  {file.status === "failed" ? <Button type="button" variant="ghost" size="sm" onClick={() => void retryFile(file)}><RefreshCcw className="h-4 w-4" />Retry</Button> : null}
                  <Button type="button" variant="ghost" size="sm" onClick={() => void deleteFile(file)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
