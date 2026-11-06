"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Calendar,
  Clock,
  Globe,
  MapPin,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  Watch,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export interface UserLocationState {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  label?: string;
  permissionGranted: boolean;
}

export interface ClientCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601 UTC
  endTime?: string;
  timeZone: string;
  category: "event" | "deadline" | "reminder" | "schedule";
  remindBeforeMinutes?: number;
  reminderTriggerTime?: string;
  notified?: boolean;
}

export interface ClientTimerItem {
  id: string;
  label: string;
  kind: "timer" | "countdown";
  durationMs: number;
  remainingMs: number;
  targetTimestampMs?: number;
  status: "running" | "paused" | "completed" | "reset";
  notified?: boolean;
}

export interface StopwatchLap {
  lapNumber: number;
  splitMs: number;
  totalMs: number;
}

const WORLD_CLOCK_CITIES = [
  { label: "New York (US East)", timeZone: "America/New_York" },
  { label: "Los Angeles (US West)", timeZone: "America/Los_Angeles" },
  { label: "London (UK)", timeZone: "Europe/London" },
  { label: "Cairo (Egypt)", timeZone: "Africa/Cairo" },
  { label: "Dubai (UAE)", timeZone: "Asia/Dubai" },
  { label: "Tokyo (Japan)", timeZone: "Asia/Tokyo" },
  { label: "Sydney (Australia)", timeZone: "Australia/Sydney" },
];

export function detectBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getZonedSnapshotClient(date: Date, timeZone: string) {
  let safeTz = timeZone;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: safeTz });
  } catch {
    safeTz = "UTC";
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }

  const year = Number(map.year || date.getUTCFullYear());
  const month = Number(map.month || date.getUTCMonth() + 1);
  const day = Number(map.day || date.getUTCDate());
  let hour = Number(map.hour || 0);
  if (hour === 24) hour = 0;
  const minute = Number(map.minute || 0);
  const second = Number(map.second || 0);

  const asUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const utcFloorMs = Math.floor(date.getTime() / 1000) * 1000;
  const offsetMinutes = Math.round((asUtcMs - utcFloorMs) / 60000);

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absMins = Math.abs(offsetMinutes);
  const offH = String(Math.floor(absMins / 60)).padStart(2, "0");
  const offM = String(absMins % 60).padStart(2, "0");
  const utcOffsetFormatted = `UTC${sign}${offH}:${offM}`;

  // Detect DST by comparing Jan 15 and Jul 15 offsets
  const janDate = new Date(Date.UTC(year, 0, 15, 12, 0, 0));
  const julDate = new Date(Date.UTC(year, 6, 15, 12, 0, 0));
  const getOff = (d: Date) => {
    const dp = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const m: Record<string, string> = {};
    for (const item of dp) if (item.type !== "literal") m[item.type] = item.value;
    let h = Number(m.hour || 0);
    if (h === 24) h = 0;
    const ms = Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), h, Number(m.minute), Number(m.second));
    return Math.round((ms - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  };
  const janOff = getOff(janDate);
  const julOff = getOff(julDate);
  const observesDst = janOff !== julOff;
  const isDstActive = observesDst && offsetMinutes === Math.max(janOff, julOff);

  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const time12 = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTz,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);

  return {
    timeZone: safeTz,
    isoDate,
    weekday: map.weekday || "",
    time12,
    offsetMinutes,
    utcOffsetFormatted,
    isDstActive,
  };
}

function playWebAudioChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.14);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.14 + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.14);
      osc.stop(ctx.currentTime + idx * 0.14 + 0.46);
    });
  } catch {
    // Audio playback blocked or unsupported
  }
}

function triggerBrowserNotification(title: string, body: string) {
  playWebAudioChime();
  toast({ type: "success", title, message: body });
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      // Ignore notification construction failure
    }
  }
}

export function formatDurationClock(ms: number): string {
  const safe = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatStopwatchMs(ms: number): string {
  const safe = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  const centis = Math.floor((safe % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

interface TimeCalendarHubProps {
  userTimeZone: string;
  locationState: UserLocationState;
  onRequestLocation: () => void;
  onClearLocation: () => void;
  calendarEvents: ClientCalendarEvent[];
  onAddCalendarEvent: (ev: Omit<ClientCalendarEvent, "id">) => Promise<void>;
  onDeleteCalendarEvent: (id: string) => Promise<void>;
  timers: ClientTimerItem[];
  onStartTimer: (label: string, durationMs: number, kind?: "timer" | "countdown", targetIso?: string) => void;
  onControlTimer: (id: string, action: "pause" | "resume" | "reset" | "delete") => void;
}

export function TimeCalendarHub({
  userTimeZone,
  locationState,
  onRequestLocation,
  onClearLocation,
  calendarEvents,
  onAddCalendarEvent,
  onDeleteCalendarEvent,
  timers,
  onStartTimer,
  onControlTimer,
}: TimeCalendarHubProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"clock" | "calendar" | "timers" | "stopwatch" | "countdown">("clock");
  const [nowDate, setNowDate] = useState<Date>(() => new Date());

  // Calendar form state
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("09:00");
  const [eventCategory, setEventCategory] = useState<ClientCalendarEvent["category"]>("event");
  const [remindMins, setRemindMins] = useState<number>(120);

  // Timer form state
  const [timerLabel, setTimerLabel] = useState("");
  const [timerMinutes, setTimerMinutes] = useState("5");
  const [timerSeconds, setTimerSeconds] = useState("0");

  // Countdown form state
  const [countdownLabel, setCountdownLabel] = useState("");
  const [countdownDate, setCountdownDate] = useState("");

  // Stopwatch state (monotonic timestamp based)
  const [swRunning, setSwRunning] = useState(false);
  const [swAccumulatedMs, setSwAccumulatedMs] = useState(0);
  const [swDisplayMs, setSwDisplayMs] = useState(0);
  const [swLaps, setSwLaps] = useState<StopwatchLap[]>([]);
  const swStartedAtRef = useRef<number | null>(null);

  // Update real-time clock every second
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowDate(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // High-frequency stopwatch ticker when running
  useEffect(() => {
    if (!swRunning) return;
    swStartedAtRef.current = performance.now();
    const id = window.setInterval(() => {
      if (swStartedAtRef.current !== null) {
        setSwDisplayMs(swAccumulatedMs + (performance.now() - swStartedAtRef.current));
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [swRunning, swAccumulatedMs]);

  const handleStopwatchStartPause = useCallback(() => {
    if (swRunning) {
      const delta = swStartedAtRef.current !== null ? performance.now() - swStartedAtRef.current : 0;
      const nextTotal = swAccumulatedMs + delta;
      setSwAccumulatedMs(nextTotal);
      setSwDisplayMs(nextTotal);
      swStartedAtRef.current = null;
      setSwRunning(false);
    } else {
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission().catch(() => undefined);
      }
      swStartedAtRef.current = performance.now();
      setSwRunning(true);
    }
  }, [swRunning, swAccumulatedMs]);

  const handleStopwatchReset = useCallback(() => {
    swStartedAtRef.current = null;
    setSwRunning(false);
    setSwAccumulatedMs(0);
    setSwDisplayMs(0);
    setSwLaps([]);
  }, []);

  const handleStopwatchLap = useCallback(() => {
    const totalMs = swDisplayMs;
    const prevTotal = swLaps[0]?.totalMs ?? 0;
    const splitMs = Math.max(0, totalMs - prevTotal);
    setSwLaps((prev) => [{ lapNumber: prev.length + 1, splitMs, totalMs }, ...prev]);
  }, [swDisplayMs, swLaps]);

  const localSnap = useMemo(() => getZonedSnapshotClient(nowDate, userTimeZone), [nowDate, userTimeZone]);
  const utcSnap = useMemo(() => getZonedSnapshotClient(nowDate, "UTC"), [nowDate]);

  const runningTimers = useMemo(
    () => timers.filter((t) => t.status === "running" && t.remainingMs > 0),
    [timers]
  );

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventDate) return;
    const isoStart = new Date(`${eventDate}T${eventTime || "09:00"}:00`).toISOString();
    await onAddCalendarEvent({
      title: eventTitle.trim(),
      startTime: isoStart,
      timeZone: userTimeZone,
      category: eventCategory,
      remindBeforeMinutes: remindMins > 0 ? remindMins : undefined,
      reminderTriggerTime:
        remindMins > 0 ? new Date(new Date(isoStart).getTime() - remindMins * 60_000).toISOString() : undefined,
    });
    setEventTitle("");
  };

  const handleStartCustomTimer = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.max(0, Number(timerMinutes) || 0);
    const secs = Math.max(0, Number(timerSeconds) || 0);
    const totalMs = (mins * 60 + secs) * 1000;
    if (totalMs < 1000) return;
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }
    onStartTimer(timerLabel.trim() || `${mins}m ${secs}s Timer`, totalMs, "timer");
    setTimerLabel("");
  };

  const handleStartCustomCountdown = (e: React.FormEvent) => {
    e.preventDefault();
    if (!countdownDate) return;
    const target = new Date(`${countdownDate}T00:00:00`);
    const durationMs = Math.max(1000, target.getTime() - Date.now());
    onStartTimer(
      countdownLabel.trim() || `Countdown to ${countdownDate}`,
      durationMs,
      "countdown",
      target.toISOString()
    );
    setCountdownLabel("");
  };

  return (
    <div className="relative">
      {/* Header Trigger Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        title={`Local Time (${localSnap.timeZone} • ${localSnap.utcOffsetFormatted}${localSnap.isDstActive ? " • DST" : ""}) — Click to open Time, Calendar, Timers & World Clock`}
        className={cn(
          "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
          open
            ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
            : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-cyan-400/30 hover:bg-white/[0.08] hover:text-white"
        )}
      >
        <Clock className="h-3.5 w-3.5 text-cyan-400" />
        <span className="font-mono tracking-tight">{localSnap.time12}</span>
        <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300 md:inline">
          {localSnap.utcOffsetFormatted}
        </span>
        {runningTimers.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
            <Timer className="h-3 w-3 animate-pulse" />
            {formatDurationClock(runningTimers[0]!.remainingMs)}
          </span>
        )}
        {calendarEvents.length > 0 && (
          <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
            {calendarEvents.length}
          </span>
        )}
      </button>

      {/* Expandable Time, Calendar, Location & Timer Hub Popover */}
      {open && (
        <div className="fixed right-3 top-16 z-50 w-[94vw] max-w-[460px] rounded-2xl border border-white/15 bg-[#090d1a]/95 p-4 text-slate-100 shadow-[0_24px_64px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
          {/* Top Bar */}
          <div className="mb-3 flex items-start justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-white">{localSnap.time12}</span>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                  {localSnap.utcOffsetFormatted}
                </span>
                {localSnap.isDstActive && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                    DST Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {localSnap.weekday}, {localSnap.isoDate} • IANA: <span className="text-slate-200">{localSnap.timeZone}</span>
              </p>
              <p className="text-[11px] text-slate-500">
                UTC Reference: {utcSnap.isoDate} {utcSnap.time12}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close Time & Calendar Hub"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Location Permission Bar */}
          <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <MapPin className={cn("h-3.5 w-3.5", locationState.permissionGranted ? "text-emerald-400" : "text-slate-400")} />
              <span className="text-slate-300">
                {locationState.permissionGranted && locationState.latitude !== undefined
                  ? `Authorized GPS: ${locationState.latitude.toFixed(3)}, ${locationState.longitude?.toFixed(3)}`
                  : "Location: Using system IANA time zone only"}
              </span>
            </div>
            {locationState.permissionGranted ? (
              <button
                type="button"
                onClick={onClearLocation}
                className="rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 text-[11px] text-rose-300 hover:bg-rose-500/20"
              >
                Revoke
              </button>
            ) : (
              <button
                type="button"
                onClick={onRequestLocation}
                className="rounded-md border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/25"
              >
                Share Location
              </button>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mb-3 grid grid-cols-5 gap-1 rounded-xl bg-white/[0.04] p-1 text-[11px] font-medium">
            {[
              { id: "clock", label: "World", icon: Globe },
              { id: "calendar", label: "Calendar", icon: Calendar },
              { id: "timers", label: "Timers", icon: Timer },
              { id: "stopwatch", label: "Stopwatch", icon: Watch },
              { id: "countdown", label: "Countdowns", icon: Bell },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition",
                    isActive ? "bg-cyan-500/20 text-cyan-200 shadow-sm" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab 1: World Clock & Time Zone Comparisons */}
          {activeTab === "clock" && (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {WORLD_CLOCK_CITIES.map((city) => {
                const snap = getZonedSnapshotClient(nowDate, city.timeZone);
                const diffHours = Number(((snap.offsetMinutes - localSnap.offsetMinutes) / 60).toFixed(1));
                const diffSign = diffHours > 0 ? `+${diffHours}h` : diffHours < 0 ? `${diffHours}h` : "Same TZ";
                const dayRel =
                  snap.isoDate > localSnap.isoDate
                    ? "Tomorrow"
                    : snap.isoDate < localSnap.isoDate
                    ? "Yesterday"
                    : "Today";
                return (
                  <div
                    key={city.timeZone}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-slate-200">{city.label}</div>
                      <div className="text-[11px] text-slate-400">
                        {city.timeZone} • {snap.utcOffsetFormatted} • <span className="text-cyan-300">{diffSign}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-white">{snap.time12}</div>
                      <div className="text-[10px] text-slate-400">
                        {dayRel} ({snap.isoDate})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Calendar Events, Schedules & Reminders */}
          {activeTab === "calendar" && (
            <div className="space-y-3">
              <form onSubmit={handleCreateEventSubmit} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Event title (e.g., Team Sprint Review)"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <input
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={remindMins}
                    onChange={(e) => setRemindMins(Number(e.target.value))}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value={0}>No reminder</option>
                    <option value={15}>Remind 15m before</option>
                    <option value={60}>Remind 1h before</option>
                    <option value={120}>Remind 2h before</option>
                    <option value={1440}>Remind 1 day before</option>
                  </select>
                  <select
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value as ClientCalendarEvent["category"])}
                    className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="event">Event</option>
                    <option value="schedule">Schedule</option>
                    <option value="deadline">Deadline</option>
                    <option value="reminder">Reminder</option>
                  </select>
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </form>

              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {calendarEvents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No events scheduled. Add one above or ask the agent: &ldquo;Schedule a meeting for next Monday&rdquo;.
                  </p>
                ) : (
                  calendarEvents.map((ev) => {
                    const snap = getZonedSnapshotClient(new Date(ev.startTime), userTimeZone);
                    return (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-white">{ev.title}</div>
                          <div className="text-[11px] text-slate-400">
                            {snap.weekday}, {snap.isoDate} at {snap.time12}
                            {ev.remindBeforeMinutes ? ` • Bell ${ev.remindBeforeMinutes}m before` : ""}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDeleteCalendarEvent(ev.id)}
                          className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                          title="Delete event"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Multi-Timers */}
          {activeTab === "timers" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "1m", ms: 60_000 },
                  { label: "5m", ms: 300_000 },
                  { label: "10m", ms: 600_000 },
                  { label: "25m Focus", ms: 1_500_000 },
                  { label: "1h", ms: 3_600_000 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onStartTimer(`${preset.label} Timer`, preset.ms, "timer")}
                    className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleStartCustomTimer} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <input
                  type="text"
                  value={timerLabel}
                  onChange={(e) => setTimerLabel(e.target.value)}
                  placeholder="Label"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                />
                <input
                  type="number"
                  min={0}
                  max={999}
                  value={timerMinutes}
                  onChange={(e) => setTimerMinutes(e.target.value)}
                  className="w-14 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-center text-xs text-white"
                  title="Minutes"
                />
                <span className="text-xs text-slate-400">m</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={timerSeconds}
                  onChange={(e) => setTimerSeconds(e.target.value)}
                  className="w-14 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-center text-xs text-white"
                  title="Seconds"
                />
                <span className="text-xs text-slate-400">s</span>
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  Start
                </button>
              </form>

              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {timers.filter((t) => t.kind === "timer").length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    No active timers. Start multiple independent timers above or ask the agent in chat.
                  </p>
                ) : (
                  timers
                    .filter((t) => t.kind === "timer")
                    .map((timer) => (
                      <div
                        key={timer.id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                      >
                        <div>
                          <div className="font-medium text-white">{timer.label}</div>
                          <div className="font-mono text-sm font-bold text-cyan-300">
                            {formatDurationClock(timer.remainingMs)}
                            {timer.status === "completed" && (
                              <span className="ml-2 text-xs text-emerald-400">Done!</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {timer.status === "running" ? (
                            <button
                              type="button"
                              onClick={() => onControlTimer(timer.id, "pause")}
                              className="rounded-lg border border-white/10 p-1.5 text-amber-300 hover:bg-white/10"
                              title="Pause"
                            >
                              <Pause className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onControlTimer(timer.id, "resume")}
                              className="rounded-lg border border-white/10 p-1.5 text-emerald-300 hover:bg-white/10"
                              title="Resume"
                            >
                              <Play className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onControlTimer(timer.id, "reset")}
                            className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"
                            title="Reset"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onControlTimer(timer.id, "delete")}
                            className="rounded-lg border border-white/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}

          {/* Tab 4: High-Precision Stopwatch */}
          {activeTab === "stopwatch" && (
            <div className="space-y-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-black/40 py-4 font-mono text-3xl font-bold tracking-wider text-cyan-300">
                {formatStopwatchMs(swDisplayMs)}
              </div>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={handleStopwatchStartPause}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold",
                    swRunning ? "bg-amber-500 text-slate-950" : "bg-cyan-500 text-slate-950"
                  )}
                >
                  {swRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {swRunning ? "Pause" : swDisplayMs > 0 ? "Resume" : "Start"}
                </button>
                <button
                  type="button"
                  disabled={!swRunning && swDisplayMs === 0}
                  onClick={handleStopwatchLap}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 disabled:opacity-40"
                >
                  Lap
                </button>
                <button
                  type="button"
                  onClick={handleStopwatchReset}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
              {swLaps.length > 0 && (
                <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2 text-xs">
                  {swLaps.map((lap) => (
                    <div key={lap.lapNumber} className="flex justify-between font-mono text-slate-300">
                      <span>Lap #{lap.lapNumber}</span>
                      <span>+{formatStopwatchMs(lap.splitMs)}</span>
                      <span className="text-white">{formatStopwatchMs(lap.totalMs)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 5: Event Countdowns */}
          {activeTab === "countdown" && (
            <div className="space-y-3">
              <form onSubmit={handleStartCustomCountdown} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <input
                  type="text"
                  value={countdownLabel}
                  onChange={(e) => setCountdownLabel(e.target.value)}
                  placeholder="Event (e.g., Launch Day)"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                />
                <input
                  type="date"
                  value={countdownDate}
                  onChange={(e) => setCountdownDate(e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-cyan-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  Add
                </button>
              </form>

              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {timers.filter((t) => t.kind === "countdown").map((cd) => (
                  <div
                    key={cd.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-medium text-white">{cd.label}</div>
                      <div className="font-mono text-xs font-semibold text-cyan-300">
                        {formatDurationClock(cd.remainingMs)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onControlTimer(cd.id, "delete")}
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-500/20 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { triggerBrowserNotification };

