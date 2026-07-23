"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, DatabaseZap, Eye, LogIn, MousePointerClick, UserPlus } from "lucide-react";
import { ActivityEvent, getCloudActivityStatus, listActivityEvents } from "@/lib/activity";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function iconFor(type: string) {
  if (type === "auth_login") return LogIn;
  if (type === "auth_register") return UserPlus;
  if (type === "page_view") return Eye;
  return MousePointerClick;
}

export function ActivityDashboard() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const cloudSync = getCloudActivityStatus();

  useEffect(() => {
    const load = () => setEvents(listActivityEvents());
    load();
    const interval = window.setInterval(load, 2500);
    return () => window.clearInterval(interval);
  }, []);

  const metrics = useMemo(() => {
    const uniquePaths = new Set(events.map((event) => event.path)).size;
    const signups = events.filter((event) => event.type === "auth_register").length;
    const logins = events.filter((event) => event.type === "auth_login").length;
    return [
      { label: "Tracked events", value: events.length, icon: Activity },
      { label: "Visited pages", value: uniquePaths, icon: Eye },
      { label: "Logins", value: logins, icon: LogIn },
      { label: "Signups", value: signups, icon: UserPlus }
    ];
  }, [events]);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent>
              <metric.icon className="h-5 w-5 text-brand-600" />
              <div className="mt-4 text-3xl font-black">{metric.value.toLocaleString()}</div>
              <p className="mt-1 text-sm font-medium text-[#C4B5FD]">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-bold">Live Website Activity</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <p className="text-sm leading-6 text-[#C4B5FD]">No activity yet. Browse the app or create an account to populate this stream.</p>
            ) : (
              events.slice(0, 24).map((event) => {
                const Icon = iconFor(event.type);
                return (
                  <div key={event.id} className="flex items-start gap-3 rounded-lg border border-[#2A2555] bg-[#12102A] p-4 text-[#F0EAFF]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-400/40 bg-[#1E1145] text-[#DDD6FE]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{event.type.replace(/_/g, " ")}</span>
                        <Badge tone="slate">{event.path}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-[#C4B5FD]">
                        {new Date(event.createdAt).toLocaleString()} {event.email ? `- ${event.email}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="ink-panel border-b border-[#2A2555] p-5 text-white">
            <DatabaseZap className="h-6 w-6 text-[#C4B5FD]" />
            <h2 className="mt-4 text-xl font-black">Cloud sync</h2>
            <p className="mt-2 text-sm leading-6 text-[#C4B5FD]">
              Events are stored locally for the dashboard and can sync to your cloud activity store when configured.
            </p>
          </div>
          <CardContent className="space-y-3 text-sm leading-6">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Status</span>
              <Badge tone={cloudSync.enabled ? "green" : "amber"}>{cloudSync.enabled ? "Connected" : "Local only"}</Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">Workspace</span>
              <span className="truncate text-[#C4B5FD]">{cloudSync.enabled ? "Synced" : "Local only"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
