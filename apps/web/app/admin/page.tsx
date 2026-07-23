"use client";

import { AdminClient } from "@/components/admin-client";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Reveal className="mb-8">
        <Badge tone="warning">Admin only</Badge>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">Workspace overview</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#C4B5FD]">Live usage metrics for your assistants and conversations.</p>
      </Reveal>
      <AdminClient />
    </main>
  );
}
