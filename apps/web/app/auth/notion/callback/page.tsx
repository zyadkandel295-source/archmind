"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const error = searchParams.get("error");
  const workspaceName = searchParams.get("workspace");

  const isSuccess = status === "success";
  const isError = Boolean(error);

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        // Redirect to dashboard or previous page
        const lastReferrer = localStorage.getItem("notion_connect_referrer");
        if (lastReferrer) {
          localStorage.removeItem("notion_connect_referrer");
          router.push(lastReferrer);
        } else {
          router.push("/dashboard");
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  const handleRetry = () => {
    const lastReferrer = localStorage.getItem("notion_connect_referrer");
    if (lastReferrer) {
      localStorage.removeItem("notion_connect_referrer");
      router.push(lastReferrer);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <Card className="w-full max-w-md border-border bg-card">
      <CardContent className="pt-6 text-center space-y-6">
        {isSuccess ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center space-y-4"
          >
            <CheckCircle className="h-16 w-16 text-emerald-500 animate-pulse" />
            <h2 className="text-2xl font-bold text-foreground">Connection Successful!</h2>
            <p className="text-muted-foreground text-sm">
              Successfully connected to Notion workspace:{" "}
              <span className="font-semibold text-foreground">{workspaceName || "Your Workspace"}</span>
            </p>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground pt-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecting back...</span>
            </div>
          </motion.div>
        ) : isError ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center space-y-4"
          >
            <XCircle className="h-16 w-16 text-rose-500" />
            <h2 className="text-2xl font-bold text-foreground">Connection Failed</h2>
            <p className="text-muted-foreground text-sm">
              Could not connect to Notion. Reason:{" "}
              <span className="font-semibold text-foreground">
                {error === "access_denied"
                  ? "Access Denied by User"
                  : error === "invalid_state"
                  ? "Security verification failed"
                  : error === "token_exchange_failed"
                  ? "Token exchange failed"
                  : error === "user_not_found"
                  ? "User session expired"
                  : error}
              </span>
            </p>
            <Button onClick={handleRetry} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/95">
              Go Back
            </Button>
          </motion.div>
        ) : (
          <div className="flex flex-col items-center space-y-4 py-8">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
            <h2 className="text-2xl font-bold text-foreground">Verifying connection...</h2>
            <p className="text-muted-foreground text-sm">Completing the Notion OAuth flow.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function NotionCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <Suspense fallback={
        <div className="flex flex-col items-center space-y-4 py-8">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
          <h2 className="text-2xl font-bold text-foreground">Loading...</h2>
        </div>
      }>
        <CallbackContent />
      </Suspense>
    </div>
  );
}
