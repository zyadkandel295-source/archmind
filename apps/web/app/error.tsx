"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error details only to the browser console for developers
    console.error("[Global UI Crash Exception]", error);
  }, [error]);

  return (
    <div className="arch-shell neural-grid min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden border border-red-400/45 bg-[#151B24] shadow-2xl shadow-black/50">
        <div className="border-b border-[#2A3545] bg-[#35171b] p-6 flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-xl border border-red-300/45 bg-red-600 text-white flex items-center justify-center mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-300 max-w-xs leading-5">
            We couldn&apos;t process your request. Please try again. If the issue persists, contact workspace support.
          </p>
        </div>
        <CardContent className="p-6 flex flex-col gap-3">
          <Button onClick={() => reset()} className="w-full h-12">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/dashboard";
              }
            }}
            className="w-full h-12"
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
