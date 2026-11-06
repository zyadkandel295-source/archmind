import { Router } from "express";
import { z } from "zod";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import { asyncHandler } from "../lib/async-handler";
import { HttpError } from "../lib/http-error";
import { authenticate } from "../middleware/auth";
import type { AuthedRequest } from "../types";
import {
  analyzeWorldCupTimeline,
  compareTimeZones,
  getTimeZoneSnapshot,
  PLACE_TIMEZONES,
  resolvePlaceFromText,
  resolveSafeTimeZone,
} from "../services/time-awareness";

const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  timeZone: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  category: z.enum(["event", "deadline", "reminder", "schedule"]).optional(),
  remindBeforeMinutes: z.number().min(0).max(43200).optional(),
});

const updateCalendarEventSchema = createCalendarEventSchema.partial().extend({
  notified: z.boolean().optional(),
});

const createTimerSchema = z.object({
  label: z.string().trim().min(1).max(160),
  kind: z.enum(["timer", "countdown"]).optional(),
  durationMs: z.number().min(1000).max(365 * 86_400_000),
  targetTimestamp: z.string().optional(),
});

const controlTimerSchema = z.object({
  action: z.enum(["pause", "resume", "reset", "delete"]),
});

export function timeCalendarRouter(env: Env, store: MemoryStore) {
  const router = Router();

  // Real-time Clock, Time Zone, DST, World Clock & Calendar Context
  router.get(
    "/time/context",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const now = new Date();
      const requestedTz = typeof req.query.timeZone === "string" ? req.query.timeZone : undefined;
      const userTimeZone = resolveSafeTimeZone(requestedTz, "UTC");
      const serverTimeZone = resolveSafeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone, "UTC");

      const userSnapshot = getTimeZoneSnapshot(now, userTimeZone);
      const utcSnapshot = getTimeZoneSnapshot(now, "UTC");
      const serverSnapshot = getTimeZoneSnapshot(now, serverTimeZone);

      // Default world clocks + any custom places passed in ?compare=
      const defaultPlaces = ["new york", "london", "cairo", "dubai", "tokyo", "sydney"];
      const compareQuery = typeof req.query.compare === "string" ? req.query.compare : "";
      const customPlaces = compareQuery
        ? resolvePlaceFromText(compareQuery)
        : defaultPlaces.map((k) => PLACE_TIMEZONES[k]!).filter(Boolean);

      const worldClocks = customPlaces.map((place) =>
        compareTimeZones(now, userTimeZone, place.timeZone, userTimeZone, place.name, place.alternateZones)
      );

      const events = store.listCalendarEvents(req.user!.id);
      const timers = store.listUserTimers(req.user!.id);
      const worldCup = analyzeWorldCupTimeline(now, userTimeZone);

      res.json({
        ok: true,
        serverUtcIso: now.toISOString(),
        userTimeZone,
        userSnapshot,
        utcSnapshot,
        serverSnapshot,
        worldClocks,
        events,
        timers,
        worldCup: {
          todayIso: worldCup.todayIso,
          lastCompleted: worldCup.lastCompleted,
          nextUpcoming: worldCup.nextUpcoming,
          nextDelta: worldCup.nextDelta,
        },
      });
    })
  );

  // List User Calendar Events (plus authorized Google Calendar events if connected)
  router.get(
    "/calendar/events",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const events = store.listCalendarEvents(req.user!.id);
      const user = store.findUserById(req.user!.id);
      const googleAccessToken = user?.googleAccessToken || env.googleCalendarApiToken;
      let googleCalendarConnected = false;

      if (googleAccessToken) {
        try {
          const timeMin = new Date(Date.now() - 7 * 86_400_000).toISOString();
          const gRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&maxResults=25`,
            {
              headers: { Authorization: `Bearer ${googleAccessToken}` },
              signal: AbortSignal.timeout(4500),
            }
          );
          if (gRes.ok) {
            googleCalendarConnected = true;
            const gData = (await gRes.json()) as {
              items?: Array<{
                id?: string;
                summary?: string;
                description?: string;
                location?: string;
                start?: { dateTime?: string; date?: string; timeZone?: string };
                end?: { dateTime?: string; date?: string };
              }>;
            };
            const existingExtIds = new Set(events.map((e) => e.externalId).filter(Boolean));
            for (const item of gData.items ?? []) {
              const startStr = item.start?.dateTime || item.start?.date;
              if (item.id && startStr && !existingExtIds.has(item.id)) {
                const synced = store.createCalendarEvent(req.user!.id, {
                  title: item.summary || "Google Calendar Event",
                  description: item.description,
                  startTime: new Date(startStr).toISOString(),
                  endTime: item.end?.dateTime || item.end?.date ? new Date((item.end.dateTime || item.end.date)!).toISOString() : undefined,
                  timeZone: item.start?.timeZone || "UTC",
                  location: item.location,
                  category: "event",
                  source: "google_calendar",
                  externalId: item.id,
                });
                events.push(synced);
              }
            }
          }
        } catch {
          // Transparently handle disconnected Google Calendar API without fabricating events
        }
      }

      res.json({
        ok: true,
        googleCalendarConnected,
        events: store.listCalendarEvents(req.user!.id),
      });
    })
  );

  router.post(
    "/calendar/events",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = createCalendarEventSchema.parse(req.body);
      const startMs = new Date(input.startTime).getTime();
      if (Number.isNaN(startMs)) {
        throw new HttpError(400, "Invalid startTime ISO timestamp", "INVALID_TIMESTAMP");
      }
      const event = store.createCalendarEvent(req.user!.id, input);
      res.status(201).json({ ok: true, event });
    })
  );

  router.patch(
    "/calendar/events/:id",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = updateCalendarEventSchema.parse(req.body);
      const updated = store.updateCalendarEvent(req.user!.id, req.params.id!, input);
      if (!updated) {
        throw new HttpError(404, "Calendar event not found", "EVENT_NOT_FOUND");
      }
      res.json({ ok: true, event: updated });
    })
  );

  router.delete(
    "/calendar/events/:id",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const deleted = store.deleteCalendarEvent(req.user!.id, req.params.id!);
      res.json({ ok: true, deleted, eventId: req.params.id! });
    })
  );

  // User Timers & Countdowns
  router.get(
    "/timers",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const timers = store.listUserTimers(req.user!.id);
      res.json({ ok: true, timers });
    })
  );

  router.post(
    "/timers",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = createTimerSchema.parse(req.body);
      const timer = store.createUserTimer(req.user!.id, input);
      res.status(201).json({ ok: true, timer });
    })
  );

  router.post(
    "/timers/:id/control",
    authenticate(env, store),
    asyncHandler(async (req: AuthedRequest, res) => {
      const input = controlTimerSchema.parse(req.body);
      const timer = store.controlUserTimer(req.user!.id, req.params.id!, input.action);
      if (!timer) {
        throw new HttpError(404, "Timer not found", "TIMER_NOT_FOUND");
      }
      res.json({ ok: true, action: input.action, timer });
    })
  );

  return router;
}

