"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionStore } from "@/lib/session-store";

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authStatus = useSessionStore((state) => state.authStatus);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const returnTo = pathname && pathname !== "/auth/login" ? pathname : "/dashboard";
      router.replace(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authStatus, pathname, router]);

  if (authStatus !== "authenticated") {
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
