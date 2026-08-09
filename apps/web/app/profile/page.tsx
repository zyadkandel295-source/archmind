import { ProfileClient } from "@/components/profile-client";
import { DashboardGuard } from "@/components/dashboard-guard";

export default function ProfilePage() {
  return (
    <DashboardGuard>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <ProfileClient />
      </main>
    </DashboardGuard>
  );
}

