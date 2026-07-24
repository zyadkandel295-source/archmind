import { AdvancedDashboard } from "@/components/dashboard/dashboard-layout";
import { DashboardGuard } from "@/components/dashboard-guard";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function DashboardPage() {
  return (
    <main className="w-full min-h-screen">
      <DashboardGuard>
        <ErrorBoundary name="Dashboard">
          <AdvancedDashboard />
        </ErrorBoundary>
      </DashboardGuard>
    </main>
  );
}
