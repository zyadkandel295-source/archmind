"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, BarChart3, Bot, Database, Loader2, MessageSquare } from "lucide-react";
import { requestData } from "@/lib/data-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { formatNumber } from "@/lib/utils";

interface WorkspaceOverview {
  assistants: number;
  sources: number;
  conversations: number;
  messages: number;
  tokens: number;
}

export function AdminClient() {
  const [overview, setOverview] = useState<WorkspaceOverview>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestData<{ overview: WorkspaceOverview }>("/api/admin/overview")
      .then((response) => setOverview(response.overview))
      .catch((error) => {
        toast({
          type: "error",
          title: "Overview unavailable",
          message: error instanceof Error ? error.message : "Could not load workspace overview."
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = [
    { label: "Assistants", value: overview?.assistants ?? 0, icon: Bot },
    { label: "Sources", value: overview?.sources ?? 0, icon: Database },
    { label: "Conversations", value: overview?.conversations ?? 0, icon: MessageSquare },
    { label: "Messages", value: overview?.messages ?? 0, icon: Activity },
    { label: "Usage units", value: overview?.tokens ?? 0, icon: BarChart3 }
  ];

  return (
    <Stagger className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric) => (
        <StaggerItem key={metric.label}>
          <Card className="h-full">
            <CardHeader>
              {loading ? <Skeleton className="h-6 w-6 rounded-lg" /> : <metric.icon className="h-6 w-6 text-brand-600" />}
              <h2 className="mt-3 text-xl font-bold">{metric.label}</h2>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-black">
                  {formatNumber(metric.value)}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </StaggerItem>
      ))}
      {loading ? (
        <div className="col-span-full flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : null}
    </Stagger>
  );
}
