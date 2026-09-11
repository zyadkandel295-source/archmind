"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, CircleStop, Clock3, Gauge, Play, RefreshCw, Route, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { requestData } from "@/lib/data-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Range = "today" | "7d" | "30d" | "90d" | "all";
type Overview = { kpi: { totalUsers: number; totalVisitors: number; totalSessions: number; pageViews: number; activeNow: number; newUsers: number; returningUsers: number; avgSessionDurationFormatted: string; bounceRate: number; totalEvents: number }; chart: Array<{ label: string; uniqueVisitors: number; pageViews: number; sessions: number }> };
type Run = { id: string; status: string; requestedUsers: number; virtualUsers: number; concurrentUsers: number; activeSessions: number; totalRequests: number; successfulRequests: number; failedRequests: number; peakRequestsPerSecond: number; latencyMs: number[]; aiLatencyMs: number[]; databaseLatencyMs: number[]; errors: Array<{ name: string; endpoint: string; count: number; severity: string; recommendedFix: string }>; funnel: Record<string, number>; personas: Record<string, number>; features: Record<string, number>; stopReason?: string; targetUrl: string };
type RunDetail = { run: Run; report?: { verdict: string; metrics: { successRate: number; errorRate: number; p50: number; p75: number; p90: number; p95: number; p99: number; aiP95: number; databaseP95: number }; primaryBottleneck: string } };

const sections = ["Overview", "Live Users", "Traffic", "Performance", "AI Usage", "Agents", "User Journeys", "Funnels", "Conversions", "Retention", "Errors", "Database", "API", "Infrastructure", "Load Tests"] as const;

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return <Card className="min-w-0"><CardContent className="flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-[9px] bg-[#F6E4C9] text-[#9A5B21]"><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-xs font-semibold text-[#74695E]">{label}</p><p className="truncate text-xl font-black text-[#29231E]">{value}</p></div></CardContent></Card>;
}

const percentile = (values: number[], percentileValue: number) => values.length ? [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor((values.length - 1) * percentileValue))] : undefined;

export function AnalyticsCenter() {
  const [range, setRange] = useState<Range>("30d");
  const [section, setSection] = useState<(typeof sections)[number]>("Overview");
  const [overview, setOverview] = useState<Overview>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [active, setActive] = useState<RunDetail>();
  const [targetUrl, setTargetUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    try {
      setError(undefined);
      const [nextOverview, list] = await Promise.all([
        requestData<Overview>(`/api/analytics/overview?range=${range}`),
        requestData<{ runs: Run[] }>("/api/analytics/load-tests")
      ]);
      setOverview(nextOverview); setRuns(list.runs);
      const current = active?.run.id || list.runs[0]?.id;
      if (current) setActive(await requestData<RunDetail>(`/api/analytics/load-tests/${current}`));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Analytics Center could not load."); }
  }, [active?.run.id, range]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { const timer = window.setInterval(() => void refresh(), 3000); return () => window.clearInterval(timer); }, [refresh]);

  const run = active?.run;
  const report = active?.report;
  const totalChart = useMemo(() => Math.max(1, ...(overview?.chart.map((point) => point.pageViews) || [1])), [overview]);
  const start = async () => {
    try {
      setStarting(true); setError(undefined);
      const result = await requestData<{ run: Run }>("/api/analytics/load-tests", { method: "POST", body: JSON.stringify({ targetUrl }) });
      setActive({ run: result.run }); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start the load test."); }
    finally { setStarting(false); }
  };
  const stop = async () => { if (!run) return; await requestData(`/api/analytics/load-tests/${run.id}/stop`, { method: "POST" }); await refresh(); };

  const funnel = run?.funnel || {};
  const journeyRows = Object.entries(run?.personas || {}).sort((a, b) => b[1] - a[1]);
  const errors = run?.errors || [];
  const performance = [
    ["p50", report?.metrics.p50], ["p75", report?.metrics.p75], ["p90", report?.metrics.p90], ["p95", report?.metrics.p95], ["p99", report?.metrics.p99],
    ["AI p95", report?.metrics.aiP95 || undefined], ["Database p95", report?.metrics.databaseP95 || undefined]
  ];

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-[12px] border border-[#DDD0BE] bg-[#FAF5ED] p-4 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex gap-2"><Badge tone="warning">Internal only</Badge><Badge tone="online">Customer data excluded</Badge></div><h1 className="mt-2 text-2xl font-black text-[#29231E]">AGENTIA Analytics Center</h1><p className="mt-1 text-sm text-[#5F564D]">Real telemetry, isolated test runs, and guarded capacity analysis.</p></div>
      <div className="flex gap-2"><Select aria-label="Analytics range" value={range} onChange={(event) => setRange(event.target.value as Range)} className="w-28"><option value="today">Last hour</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="all">All time</option></Select><Button variant="secondary" size="icon" aria-label="Refresh analytics" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /></Button></div>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1">{sections.map((item) => <button key={item} onClick={() => setSection(item)} className={`whitespace-nowrap rounded-[9px] border px-3 py-2 text-sm font-semibold ${section === item ? "border-[#C77A2B] bg-[#F6E4C9] text-[#6D4018]" : "border-[#DDD0BE] bg-[#FFF9F1] text-[#5F564D]"}`}>{item}</button>)}</div>
    {error && <div className="rounded-[9px] border border-[#D8B3A9] bg-[#F4E1DC] p-3 text-sm text-[#7A332A]">{error}</div>}
    {section === "Overview" && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total visitors" value={overview?.kpi.totalVisitors ?? "-"} icon={Users}/><Metric label="Active users" value={overview?.kpi.activeNow ?? "-"} icon={Activity}/><Metric label="Sessions" value={overview?.kpi.totalSessions ?? "-"} icon={Clock3}/><Metric label="Pages viewed" value={overview?.kpi.pageViews ?? "-"} icon={BarChart3}/></div><Card><CardHeader><CardTitle>Users and page views over time</CardTitle></CardHeader><CardContent><div className="flex h-44 items-end gap-1">{overview?.chart.map((point) => <div key={point.label} title={`${point.label}: ${point.pageViews} page views`} className="min-w-[6px] flex-1 rounded-t bg-[#D9892B]" style={{ height: `${Math.max(3, (point.pageViews / totalChart) * 100)}%` }} />)}</div><p className="mt-3 text-xs text-[#74695E]">Bars use recorded page views only. Synthetic tests remain excluded.</p></CardContent></Card></>}
    {["Live Users", "Traffic", "AI Usage", "Agents", "Retention", "Database", "API", "Infrastructure"].includes(section) && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="New users" value={overview?.kpi.newUsers ?? 0} icon={Users}/><Metric label="Returning users" value={overview?.kpi.returningUsers ?? 0} icon={Users}/><Metric label="Bounce rate" value={`${overview?.kpi.bounceRate ?? 0}%`} icon={Route}/><Metric label="Events" value={overview?.kpi.totalEvents ?? 0} icon={Activity}/><Card className="sm:col-span-2 xl:col-span-4"><CardContent className="p-5 text-sm text-[#5F564D]">{section} uses actual emitted telemetry. Database, queue, CPU, and memory metrics appear only when a connected probe supplies them; the center intentionally shows no invented values.</CardContent></Card></div>}
    {section === "Performance" && <div className="grid gap-3 md:grid-cols-3">{performance.map(([label, value]) => <Metric key={String(label)} label={`${label} latency`} value={value === undefined ? "Unavailable" : `${value} ms`} icon={Gauge}/>)}</div>}
    {section === "User Journeys" && <Card><CardHeader><CardTitle>Persona journeys in selected test run</CardTitle></CardHeader><CardContent className="space-y-2">{journeyRows.length ? journeyRows.map(([persona, count]) => <div key={persona} className="flex items-center justify-between border-b border-[#E7DBCB] pb-2 text-sm"><span className="font-semibold text-[#29231E]">{persona.replaceAll("_", " ")}</span><span>{count} simulated sessions</span></div>) : <p className="text-sm text-[#74695E]">Select or start a test run to see recorded persona journeys.</p>}</CardContent></Card>}
    {(section === "Funnels" || section === "Conversions") && <Card><CardHeader><CardTitle>Calculated test conversion funnel</CardTitle></CardHeader><CardContent className="space-y-3">{Object.entries(funnel).map(([name, count]) => <div key={name}><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-[#29231E]">{name.replaceAll("_", " ")}</span><span>{count}</span></div><div className="h-2 overflow-hidden rounded bg-[#EDE1D1]"><div className="h-full bg-[#D9892B]" style={{ width: `${Math.min(100, ((count || 0) / Math.max(1, funnel.visitors || 1)) * 100)}%` }} /></div></div>)}</CardContent></Card>}
    {section === "Errors" && <Card><CardHeader><CardTitle>Error groups and recommended fixes</CardTitle></CardHeader><CardContent className="space-y-3">{errors.length ? errors.map((item) => <div key={`${item.name}-${item.endpoint}`} className="rounded-[9px] border border-[#DDD0BE] p-3"><div className="flex justify-between gap-3"><p className="font-bold text-[#29231E]">{item.name}</p><Badge tone={item.severity === "critical" || item.severity === "high" ? "warning" : "blue"}>{item.severity}</Badge></div><p className="mt-1 text-xs text-[#5F564D]">{item.endpoint} · {item.count} occurrences</p><p className="mt-2 text-sm text-[#5F564D]">{item.recommendedFix}</p></div>) : <p className="text-sm text-[#58785F]">No recorded test errors.</p>}</CardContent></Card>}
    {section === "Load Tests" && <div className="space-y-4"><Card><CardHeader><CardTitle>Start guarded load test</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-col gap-3 md:flex-row"><Input aria-label="Test target URL" placeholder="https://your-allow-listed-staging-environment" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} /><Button onClick={() => void start()} disabled={starting || !targetUrl.trim()}><Play className="h-4 w-4" /> {starting ? "Starting" : "Start staged test"}</Button>{run?.status === "running" && <Button variant="danger" onClick={() => void stop()}><CircleStop className="h-4 w-4" /> Stop test</Button>}</div><p className="text-xs text-[#74695E]">The runner allows localhost during development, or an explicitly allow-listed staging origin. It never targets the live application.</p></CardContent></Card>{run && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Virtual users" value={`${run.virtualUsers} / ${run.requestedUsers}`} icon={Users}/><Metric label="Concurrent users" value={run.concurrentUsers} icon={Activity}/><Metric label="Requests/sec peak" value={run.peakRequestsPerSecond.toFixed(1)} icon={Gauge}/><Metric label="Success rate" value={report ? `${report.metrics.successRate.toFixed(1)}%` : "-"} icon={ShieldCheck}/></div><Card><CardContent className="flex flex-wrap items-center gap-3 p-4"><Badge tone={run.status === "running" ? "online" : run.status === "completed" ? "green" : "warning"}>{run.status}</Badge><span className="text-sm font-semibold text-[#29231E]">{report?.verdict || "Preparing report"}</span>{run.stopReason && <span className="text-sm text-[#A54F41]">{run.stopReason}</span>}</CardContent></Card></>}</div>}
  </div>;
}
