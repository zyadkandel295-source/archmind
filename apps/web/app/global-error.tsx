"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Root Layout Crash Exception]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#080B10] p-4 font-sans">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-red-400/45 bg-[#151B24] shadow-2xl shadow-black/50 p-6 text-center text-slate-100">
            <div className="mx-auto h-16 w-16 rounded-xl border border-red-300/45 bg-red-600 text-white flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">System Error</h1>
            <p className="mt-2 text-sm text-slate-300 leading-5">
              A critical layout error has occurred. We couldn&apos;t process your request.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button onClick={() => reset()} className="w-full h-12">
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
