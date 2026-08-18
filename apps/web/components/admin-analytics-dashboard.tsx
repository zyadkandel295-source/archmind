"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  Compass,
  Download,
  Eye,
  Filter,
  Globe,
  Layers,
  LayoutGrid,
  Monitor,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldAlert,
  Smartphone,
  Tablet,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Zap
} from "lucide-react";
import { requestData } from "@/lib/data-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";

type TimeRange = "today" | "7d" | "30d" | "90d" | "all";

interface OverviewData {
  kpi: {
    totalUsers: number;
    totalVisitors: number;
    totalSessions: number;
    pageViews: number;
    activeNow: number;
    newUsers: number;
    returningUsers: number;
    newUsersPct: number;
    returningUsersPct: number;
    avgSessionDurationSec: number;
    avgSessionDurationFormatted: string;
    bounceRate: number;
    totalEvents: number;
    changes: {
      visitorsPct: number;
      sessionsPct: number;
      pageViewsPct: number;
      eventsPct: number;
    };
  };
  chart: Array<{
    label: string;
    uniqueVisitors: number;
    pageViews: number;
    sessions: number;
  }>;
}

interface PageData {
  totalPageViews: number;
  totalPagesCount: number;
  mostVisited: string;
  leastVisited: string;
  pages: Array<{
    pathname: string;
    views: number;
    uniqueVisitors: number;
    sessions: number;
    avgEngagementTimeSec: number;
    avgEngagementTimeFormatted: string;
    bounceRate: number;
    entries: number;
    exits: number;
    trafficPct: number;
    lastActivity: string;
  }>;
}

interface SourcesData {
  totalSessions: number;
  sources: Array<{ source: string; visitors: number; sessions: number; pct: number }>;
  campaigns: Array<{ campaign: string; visitors: number; sessions: number }>;
}

interface EventsData {
  totalEvents: number;
  events: Array<{ eventName: string; count: number; uniqueVisitors: number; lastTriggered: string; pct: number }>;
}

interface DevicesData {
  devices: Array<{ name: string; count: number; pct: number }>;
  browsers: Array<{ name: string; count: number; pct: number }>;
  os: Array<{ name: string; count: number; pct: number }>;
}

interface GeoData {
  totalVisitors: number;
  countries: Array<{ country: string; visitors: number; pct: number }>;
}

interface LiveData {
  activeNowCount: number;
  feed: Array<{
    id: string;
    type: "page_view" | "event";
    visitorId: string;
    pathname: string;
    title?: string;
    eventName?: string;
    country?: string;
    device?: string;
    timestamp: string;
  }>;
}

export function AdminAnalyticsDashboard() {
  const [range, setRange] = useState<TimeRange>("30d");
  const [activeTab, setActiveTab] = useState<"overview" | "pages" | "events" | "sources" | "devices" | "geo" | "live">("overview");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const [overview, setOverview] = useState<OverviewData>();
  const [pages, setPages] = useState<PageData>();
  const [sources, setSources] = useState<SourcesData>();
  const [events, setEvents] = useState<EventsData>();
  const [devices, setDevices] = useState<DevicesData>();
  const [geo, setGeo] = useState<GeoData>();
  const [live, setLive] = useState<LiveData>();

  const [pageSearch, setPageSearch] = useState("");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(undefined);

    try {
      const [ovRes, pgRes, srcRes, evRes, devRes, geoRes, liveRes] = await Promise.all([
        requestData<OverviewData>(`/api/analytics/overview?range=${range}`),
        requestData<PageData>(`/api/analytics/pages?range=${range}`),
        requestData<SourcesData>(`/api/analytics/sources?range=${range}`),
        requestData<EventsData>(`/api/analytics/events?range=${range}`),
        requestData<DevicesData>(`/api/analytics/devices?range=${range}`),
        requestData<GeoData>(`/api/analytics/geo?range=${range}`),
        requestData<LiveData>(`/api/analytics/live`)
      ]);

      setOverview(ovRes);
      setPages(pgRes);
      setSources(srcRes);
      setEvents(evRes);
      setDevices(devRes);
      setGeo(geoRes);
      setLive(liveRes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load real analytics data.";
      setError(msg);
      toast({ type: "error", title: "Analytics Load Error", message: msg });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Periodic poll for live activity tab
  useEffect(() => {
    if (activeTab !== "live") return;
    const interval = setInterval(() => {
      requestData<LiveData>(`/api/analytics/live`)
        .then(setLive)
        .catch(() => undefined);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const filteredPages = useMemo(() => {
    if (!pages?.pages) return [];
    if (!pageSearch.trim()) return pages.pages;
    const q = pageSearch.toLowerCase();
    return pages.pages.filter((p) => p.pathname.toLowerCase().includes(q));
  }, [pages, pageSearch]);

  const kpis = overview?.kpi;

  return (
    <div className="space-y-6">
      {/* Top Bar: Title, Live Status, Time Range Picker, Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2A2555] bg-[#12102A]/80 p-5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl border border-violet-500/30 bg-violet-600/20 text-violet-400">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white">AGÈNTIA Real Analytics</h1>
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                {live?.activeNowCount ?? kpis?.activeNow ?? 0} Active Users Now
              </span>
            </div>
            <p className="text-xs text-[#C4B5FD]">100% First-Party Backend DB Activity Tracking • Zero Fake Data</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex items-center gap-1 rounded-xl border border-[#2A2555] bg-[#1A1638] p-1 text-xs font-semibold text-[#DDD6FE]">
            {(["today", "7d", "30d", "90d", "all"] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  range === r ? "bg-violet-600 font-bold text-white shadow-md shadow-violet-600/30" : "hover:bg-[#25204D] hover:text-white"
                }`}
              >
                {r === "today" ? "Today" : r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : r === "90d" ? "90 Days" : "All Time"}
              </button>
            ))}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="border-[#2A2555] bg-[#1A1638] text-white hover:bg-[#25204D]"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-500/40 bg-red-950/20 p-6 text-red-300">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-red-400" />
            <div>
              <h3 className="font-bold text-white">Analytics Unavailable</h3>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-[#2A2555] pb-2">
        {[
          { id: "overview", label: "Overview", icon: LayoutGrid },
          { id: "pages", label: "Pages", icon: Eye },
          { id: "events", label: "Events", icon: MousePointerClick },
          { id: "sources", label: "Acquisition", icon: Compass },
          { id: "devices", label: "Devices", icon: Monitor },
          { id: "geo", label: "Geography", icon: Globe },
          { id: "live", label: "Live Stream", icon: Zap }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "border border-violet-500/40 bg-violet-600/20 font-bold text-white shadow-lg shadow-violet-600/10"
                  : "text-[#C4B5FD] hover:bg-[#1A1638] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "live" && (
                <span className="ml-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">LIVE</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl bg-[#1A1638]" />
          ))}
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              {/* 8 KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Unique Visitors</span>
                      <Users className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.totalVisitors ?? 0)}</div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                      {(kpis?.changes.visitorsPct ?? 0) >= 0 ? (
                        <span className="flex items-center text-emerald-400">
                          <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />+{kpis?.changes.visitorsPct}%
                        </span>
                      ) : (
                        <span className="flex items-center text-rose-400">
                          <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                          {kpis?.changes.visitorsPct}%
                        </span>
                      )}
                      <span className="text-[#C4B5FD]">vs prior period</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Total Sessions</span>
                      <Layers className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.totalSessions ?? 0)}</div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                      {(kpis?.changes.sessionsPct ?? 0) >= 0 ? (
                        <span className="flex items-center text-emerald-400">
                          <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />+{kpis?.changes.sessionsPct}%
                        </span>
                      ) : (
                        <span className="flex items-center text-rose-400">
                          <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                          {kpis?.changes.sessionsPct}%
                        </span>
                      )}
                      <span className="text-[#C4B5FD]">vs prior period</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Page Views</span>
                      <Eye className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.pageViews ?? 0)}</div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                      {(kpis?.changes.pageViewsPct ?? 0) >= 0 ? (
                        <span className="flex items-center text-emerald-400">
                          <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />+{kpis?.changes.pageViewsPct}%
                        </span>
                      ) : (
                        <span className="flex items-center text-rose-400">
                          <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                          {kpis?.changes.pageViewsPct}%
                        </span>
                      )}
                      <span className="text-[#C4B5FD]">vs prior period</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Avg Session Duration</span>
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{kpis?.avgSessionDurationFormatted || "0s"}</div>
                    <p className="mt-2 text-xs text-[#C4B5FD]">Real engagement time per visitor</p>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Bounce Rate</span>
                      <TrendingUp className="h-4 w-4 text-rose-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{kpis?.bounceRate ?? 0}%</div>
                    <p className="mt-2 text-xs text-[#C4B5FD]">Sessions under 10s with 1 view</p>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Tracked Events</span>
                      <MousePointerClick className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.totalEvents ?? 0)}</div>
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
                      {(kpis?.changes.eventsPct ?? 0) >= 0 ? (
                        <span className="flex items-center text-emerald-400">
                          <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />+{kpis?.changes.eventsPct}%
                        </span>
                      ) : (
                        <span className="flex items-center text-rose-400">
                          <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                          {kpis?.changes.eventsPct}%
                        </span>
                      )}
                      <span className="text-[#C4B5FD]">vs prior period</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">New Visitors</span>
                      <UserPlus className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.newUsers ?? 0)}</div>
                    <p className="mt-2 text-xs font-semibold text-indigo-300">{kpis?.newUsersPct ?? 0}% of total visitors</p>
                  </CardContent>
                </Card>

                <Card className="border-[#2A2555] bg-[#12102A]">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#C4B5FD]">Returning Visitors</span>
                      <UserCheck className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-white">{formatNumber(kpis?.returningUsers ?? 0)}</div>
                    <p className="mt-2 text-xs font-semibold text-cyan-300">{kpis?.returningUsersPct ?? 0}% of total visitors</p>
                  </CardContent>
                </Card>
              </div>

              {/* Time Series Bar Chart */}
              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-violet-400" />
                    Traffic & Engagement Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 flex items-end gap-2 pt-6 pb-2 border-b border-[#2A2555]">
                    {overview?.chart.map((pt, i) => {
                      const maxPv = Math.max(...(overview?.chart.map((c) => c.pageViews) || [1]), 1);
                      const heightPct = Math.max(8, Math.round((pt.pageViews / maxPv) * 100));

                      return (
                        <div key={i} className="flex-1 flex flex-col items-center group relative">
                          {/* Tooltip */}
                          <div className="absolute -top-12 hidden group-hover:flex flex-col items-center bg-[#1A1638] border border-[#2A2555] text-white text-[11px] rounded-lg p-2 z-20 shadow-xl whitespace-nowrap">
                            <span className="font-bold">{pt.label}</span>
                            <span>{pt.pageViews} views • {pt.uniqueVisitors} visitors</span>
                          </div>

                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-violet-700 to-indigo-500 group-hover:from-violet-500 group-hover:to-indigo-400 transition-all shadow-md"
                          />
                          <span className="mt-2 text-[10px] font-medium text-[#C4B5FD] truncate max-w-[36px]">{pt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-6 text-xs text-[#C4B5FD]">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-violet-500"></span> Page Views
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 2: PAGES */}
          {activeTab === "pages" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-xl border border-[#2A2555] bg-[#12102A] px-3 py-2 w-full sm:w-80">
                  <Search className="h-4 w-4 text-[#C4B5FD]" />
                  <input
                    type="text"
                    placeholder="Search page pathname..."
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    className="bg-transparent text-sm text-white focus:outline-none w-full"
                  />
                </div>

                <div className="flex items-center gap-3 text-xs text-[#C4B5FD]">
                  <span>Total Pages: <strong className="text-white">{pages?.totalPagesCount || 0}</strong></span>
                  <span>Most Visited: <strong className="text-violet-400">{pages?.mostVisited || "/"}</strong></span>
                </div>
              </div>

              <Card className="border-[#2A2555] bg-[#12102A] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#DDD6FE]">
                    <thead className="bg-[#1A1638] text-xs uppercase font-semibold text-[#C4B5FD] border-b border-[#2A2555]">
                      <tr>
                        <th className="p-4">Page Pathname</th>
                        <th className="p-4">Views</th>
                        <th className="p-4">Visitors</th>
                        <th className="p-4">Sessions</th>
                        <th className="p-4">Avg Time</th>
                        <th className="p-4">Bounce Rate</th>
                        <th className="p-4">Traffic Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2555]">
                      {filteredPages.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-sm text-[#C4B5FD]">
                            No pages match search query or recorded activity.
                          </td>
                        </tr>
                      ) : (
                        filteredPages.map((pg) => (
                          <tr key={pg.pathname} className="hover:bg-[#1A1638]/50 transition-colors">
                            <td className="p-4 font-bold text-white max-w-xs truncate">{pg.pathname}</td>
                            <td className="p-4 font-semibold text-violet-300">{formatNumber(pg.views)}</td>
                            <td className="p-4">{formatNumber(pg.uniqueVisitors)}</td>
                            <td className="p-4">{formatNumber(pg.sessions)}</td>
                            <td className="p-4 text-amber-300">{pg.avgEngagementTimeFormatted}</td>
                            <td className="p-4">{pg.bounceRate}%</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 bg-[#25204D] rounded-full overflow-hidden">
                                  <div style={{ width: `${Math.min(100, pg.trafficPct)}%` }} className="h-full bg-violet-500 rounded-full" />
                                </div>
                                <span className="text-xs font-semibold">{pg.trafficPct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB 3: EVENTS */}
          {activeTab === "events" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <Card className="border-[#2A2555] bg-[#12102A] overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <MousePointerClick className="h-5 w-5 text-purple-400" />
                    Custom Event Instrumentation ({events?.totalEvents || 0} Total Events)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#DDD6FE]">
                    <thead className="bg-[#1A1638] text-xs uppercase font-semibold text-[#C4B5FD] border-b border-[#2A2555]">
                      <tr>
                        <th className="p-4">Event Name</th>
                        <th className="p-4">Trigger Count</th>
                        <th className="p-4">Unique Visitors</th>
                        <th className="p-4">% of Total</th>
                        <th className="p-4">Last Triggered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2555]">
                      {events?.events.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-sm text-[#C4B5FD]">
                            No custom events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        events?.events.map((ev) => (
                          <tr key={ev.eventName} className="hover:bg-[#1A1638]/50 transition-colors">
                            <td className="p-4 font-bold text-white flex items-center gap-2">
                              <Badge tone="slate">{ev.eventName}</Badge>
                            </td>
                            <td className="p-4 font-semibold text-purple-300">{formatNumber(ev.count)}</td>
                            <td className="p-4">{formatNumber(ev.uniqueVisitors)}</td>
                            <td className="p-4">{ev.pct}%</td>
                            <td className="p-4 text-xs text-[#C4B5FD]">{new Date(ev.lastTriggered).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB 4: ACQUISITION */}
          {activeTab === "sources" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-6 md:grid-cols-2">
              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="h-5 w-5 text-sky-400" />
                    Traffic Sources
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {sources?.sources.map((s) => (
                    <div key={s.source} className="space-y-1">
                      <div className="flex justify-between text-sm font-semibold text-white">
                        <span>{s.source}</span>
                        <span>{s.sessions} sessions ({s.pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[#25204D] rounded-full overflow-hidden">
                        <div style={{ width: `${s.pct}%` }} className="h-full bg-sky-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Filter className="h-5 w-5 text-emerald-400" />
                    UTM Campaigns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {sources?.campaigns.length === 0 ? (
                    <p className="text-sm text-[#C4B5FD] py-4">No UTM campaign links tracked yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {sources?.campaigns.map((c) => (
                        <div key={c.campaign} className="flex items-center justify-between rounded-lg border border-[#2A2555] bg-[#1A1638] p-3 text-sm">
                          <span className="font-bold text-white">{c.campaign}</span>
                          <span className="text-xs text-emerald-400 font-semibold">{c.sessions} sessions</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 5: DEVICES */}
          {activeTab === "devices" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-6 md:grid-cols-3">
              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-indigo-400" />
                    Device Category
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {devices?.devices.map((d) => (
                    <div key={d.name} className="space-y-1">
                      <div className="flex justify-between text-sm font-semibold capitalize text-white">
                        <span>{d.name}</span>
                        <span>{d.count} ({d.pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[#25204D] rounded-full overflow-hidden">
                        <div style={{ width: `${d.pct}%` }} className="h-full bg-indigo-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe className="h-5 w-5 text-teal-400" />
                    Browsers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {devices?.browsers.map((b) => (
                    <div key={b.name} className="space-y-1">
                      <div className="flex justify-between text-sm font-semibold text-white">
                        <span>{b.name}</span>
                        <span>{b.count} ({b.pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[#25204D] rounded-full overflow-hidden">
                        <div style={{ width: `${b.pct}%` }} className="h-full bg-teal-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="h-5 w-5 text-pink-400" />
                    Operating Systems
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {devices?.os.map((o) => (
                    <div key={o.name} className="space-y-1">
                      <div className="flex justify-between text-sm font-semibold text-white">
                        <span>{o.name}</span>
                        <span>{o.count} ({o.pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-[#25204D] rounded-full overflow-hidden">
                        <div style={{ width: `${o.pct}%` }} className="h-full bg-pink-500 rounded-full" />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* TAB 6: GEOGRAPHY */}
          {activeTab === "geo" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <Card className="border-[#2A2555] bg-[#12102A] overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-400" />
                    Country Distribution ({geo?.totalVisitors || 0} Total Visitors)
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-[#DDD6FE]">
                    <thead className="bg-[#1A1638] text-xs uppercase font-semibold text-[#C4B5FD] border-b border-[#2A2555]">
                      <tr>
                        <th className="p-4">Country Code</th>
                        <th className="p-4">Visitor Count</th>
                        <th className="p-4">Traffic Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2555]">
                      {geo?.countries.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-8 text-center text-sm text-[#C4B5FD]">
                            No location header data captured yet.
                          </td>
                        </tr>
                      ) : (
                        geo?.countries.map((c) => (
                          <tr key={c.country} className="hover:bg-[#1A1638]/50 transition-colors">
                            <td className="p-4 font-bold text-white">{c.country}</td>
                            <td className="p-4 font-semibold text-blue-300">{formatNumber(c.visitors)}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-24 bg-[#25204D] rounded-full overflow-hidden">
                                  <div style={{ width: `${c.pct}%` }} className="h-full bg-blue-500 rounded-full" />
                                </div>
                                <span className="text-xs font-semibold">{c.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.div>
          )}

          {/* TAB 7: LIVE STREAM */}
          {activeTab === "live" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <Card className="border-[#2A2555] bg-[#12102A]">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="h-5 w-5 text-emerald-400" />
                    Live Activity Stream
                  </CardTitle>
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    Auto-updating every 5s
                  </span>
                </CardHeader>
                <CardContent className="space-y-3">
                  {live?.feed.length === 0 ? (
                    <p className="text-sm text-[#C4B5FD] py-6 text-center">No recent live activity recorded.</p>
                  ) : (
                    live?.feed.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-xl border border-[#2A2555] bg-[#1A1638] p-3 text-xs text-[#DDD6FE]">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-500/30 bg-violet-600/20 text-violet-300">
                          {item.type === "page_view" ? <Eye className="h-4 w-4" /> : <MousePointerClick className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white">{item.type === "page_view" ? "Page View" : item.eventName}</span>
                            <Badge tone="slate">{item.pathname}</Badge>
                            {item.country && <Badge tone="blue">{item.country}</Badge>}
                          </div>
                          <p className="mt-1 text-[11px] text-[#C4B5FD]">
                            Visitor <code className="text-violet-300">{item.visitorId}</code> • {new Date(item.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
