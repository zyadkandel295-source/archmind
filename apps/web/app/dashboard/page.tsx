import { DashboardClient } from "@/components/dashboard-client";
import { DashboardGuard } from "@/components/dashboard-guard";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <DashboardGuard>
        <ErrorBoundary name="Dashboard">
          <DashboardClient />
        </ErrorBoundary>
      </DashboardGuard>
    </main>
  );
}
