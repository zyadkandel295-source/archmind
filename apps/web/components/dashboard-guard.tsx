"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { AccountRequired } from "@/components/account-required";
import { Skeleton } from "@/components/ui/skeleton";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { readSessionCredential } from "@/lib/session-keys";
import { useSessionStore } from "@/lib/session-store";

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useSessionStore((state) => state.accessToken);
  const [status, setStatus] = useState<"loading" | "signed-in" | "signed-out">("loading");

  useEffect(() => {
    const cred = readSessionCredential();
    if (cred || accessToken) {
      setStatus("signed-in");
      return;
    }

    if (!isFirebaseConfigured()) {
      setStatus("signed-out");
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setStatus("signed-in");
        return;
      }
      setStatus("signed-out");
    });

    return unsubscribe;
  }, [accessToken]);

  useEffect(() => {
    if (status === "signed-out") {
      const returnTo = pathname && pathname !== "/auth/login" ? pathname : "/dashboard";
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [status, pathname, router]);

  if (status === "loading" || status === "signed-out") {
    return (
      <div className="space-y-6 px-4 py-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
