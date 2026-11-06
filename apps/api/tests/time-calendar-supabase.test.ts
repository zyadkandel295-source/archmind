import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { loadEnv } from "../src/config/env";
import { MemoryStore } from "../src/db/memory";
import { signAccessToken, signRefreshToken } from "../src/middleware/auth";
import {
  analyzeWorldCupTimeline,
  buildTemporalPromptContext,
  calculateCalendarDateDelta,
  compareTimeZones,
  getDaysInMonth,
  getTimeZoneSnapshot,
  isLeapYear,
  resolveNaturalDateExpressions,
} from "../src/services/time-awareness";

describe("Complete Time, Calendar, Location Awareness & Persistent Per-User Data System", () => {
  it("1. Real-Time Clock, IANA Time Zones, UTC Offsets, DST Transitions, Leap Years & Midnight Rollovers", () => {
    // Winter date: January 15, 2026 at 23:30:00 UTC
    const winterUtc = new Date("2026-01-15T23:30:00.000Z");

    const nyWinter = getTimeZoneSnapshot(winterUtc, "America/New_York");
    expect(nyWinter.utcOffsetMinutes).toBe(-300);
    expect(nyWinter.utcOffsetFormatted).toBe("UTC-05:00");
    expect(nyWinter.isDstActive).toBe(false);
    expect(nyWinter.observesDst).toBe(true);
    expect(nyWinter.localDate).toBe("2026-01-15");

    // Summer date: July 15, 2026 at 23:30:00 UTC (EDT active in New York)
    const summerUtc = new Date("2026-07-15T23:30:00.000Z");
    const nySummer = getTimeZoneSnapshot(summerUtc, "America/New_York");
    expect(nySummer.utcOffsetMinutes).toBe(-240);
    expect(nySummer.utcOffsetFormatted).toBe("UTC-04:00");
    expect(nySummer.isDstActive).toBe(true);

    // Midnight / Date transition: At 2026-01-15T23:30:00Z, it is already 2026-01-16 (01:30 AM) in Cairo and (08:30 AM) in Tokyo!
    const cairoWinter = getTimeZoneSnapshot(winterUtc, "Africa/Cairo");
    expect(cairoWinter.localDate).toBe("2026-01-16");
    expect(cairoWinter.utcOffsetFormatted).toBe("UTC+02:00");

    const tokyoWinter = getTimeZoneSnapshot(winterUtc, "Asia/Tokyo");
    expect(tokyoWinter.localDate).toBe("2026-01-16");
    expect(tokyoWinter.utcOffsetFormatted).toBe("UTC+09:00");

    // Leap year & month length awareness
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2026, 11)).toBe(30);
    expect(getDaysInMonth(2026, 12)).toBe(31);
  });

  it("2. Cross-Time-Zone Comparisons: Egypt vs. United States, New York Time, and 'Is it already tomorrow in Japan?'", () => {
    // At 2026-11-06T16:00:00Z:
    // - Cairo (Africa/Cairo, UTC+2) is 2026-11-06 18:00 (6:00 PM)
    // - New York (America/New_York, UTC-5) is 2026-11-06 11:00 (11:00 AM) -> 7 hours behind Egypt
    // - Tokyo (Asia/Tokyo, UTC+9) is 2026-11-07 01:00 (1:00 AM) -> Already tomorrow in Japan!
    const refUtc = new Date("2026-11-06T16:00:00.000Z");

    const egyptVsUs = compareTimeZones(
      refUtc,
      "Africa/Cairo",
      "America/New_York",
      "Egypt (Cairo)",
      "United States (Eastern / New York)"
    );
    expect(egyptVsUs.differenceHours).toBe(-7);
    expect(egyptVsUs.formattedDifference).toContain("7 hours behind");

    const egyptVsJapan = compareTimeZones(
      refUtc,
      "Africa/Cairo",
      "Asia/Tokyo",
      "Egypt (Cairo)",
      "Japan (Tokyo)"
    );
    expect(egyptVsJapan.differenceHours).toBe(7);
    expect(egyptVsJapan.isTomorrowInTarget).toBe(true);
    expect(egyptVsJapan.relativeDayInTarget).toBe("tomorrow");
    expect(egyptVsJapan.toSnapshot.localDate).toBe("2026-11-07");
  });

  it("3. Natural-Language Date Parsing: 'tomorrow', 'last Friday', 'next Monday', and 'days until January 1'", () => {
    // Reference: Friday, November 6, 2026 in Africa/Cairo
    const refDate = new Date("2026-11-06T12:00:00.000Z");
    const parsed = resolveNaturalDateExpressions(
      "What do I have tomorrow, what happened last Friday, schedule this for next Monday, and how many days until January 1?",
      refDate,
      "Africa/Cairo"
    );

    const byExpr = Object.fromEntries(parsed.map((p) => [p.expression.toLowerCase(), p]));
    expect(byExpr["tomorrow"]?.isoDate).toBe("2026-11-07");
    expect(byExpr["tomorrow"]?.deltaDays).toBe(1);

    expect(byExpr["last friday"]?.isoDate).toBe("2026-10-30");
    expect(byExpr["last friday"]?.deltaDays).toBe(-7);

    expect(byExpr["next monday"]?.isoDate).toBe("2026-11-09");
    expect(byExpr["next monday"]?.deltaDays).toBe(3);

    expect(byExpr["january 1"]?.isoDate).toBe("2027-01-01");
    expect(byExpr["january 1"]?.deltaDays).toBe(56);
  });

  it("4. Timeline & Historical Awareness: FIFA World Cup Chronology and Remaining Days Calculation", () => {
    // Case A: Query asked on May 1, 2026 (before the 2026 FIFA World Cup starts on June 11, 2026)
    const may2026 = new Date("2026-05-01T12:00:00.000Z");
    const wcMay = analyzeWorldCupTimeline(may2026, "Africa/Cairo");
    expect(wcMay.lastCompleted?.year).toBe(2022);
    expect(wcMay.lastCompleted?.winner).toBe("Argentina");
    expect(wcMay.lastCompleted?.hostCountries).toContain("Qatar");
    expect(wcMay.nextUpcoming?.year).toBe(2026);
    expect(wcMay.nextUpcoming?.startDate).toBe("2026-06-11");
    expect(wcMay.nextDelta?.totalDays).toBe(41);

    // Case B: Query asked on November 6, 2026 (after 2026 dates, before 2030 FIFA World Cup)
    const nov2026 = new Date("2026-11-06T12:00:00.000Z");
    const wcNov = analyzeWorldCupTimeline(nov2026, "Africa/Cairo");
    expect(wcNov.nextUpcoming?.year).toBe(2030);
    expect(wcNov.nextUpcoming?.hostCountries).toContain("Morocco");
    expect(wcNov.nextUpcoming?.hostCountries).toContain("Spain");
    expect(wcNov.nextUpcoming?.hostCountries).toContain("Portugal");
    expect(wcNov.nextDelta?.totalDays).toBe(
      calculateCalendarDateDelta("2026-11-06", "2030-06-08").totalDays
    );
  });

  it("5. Agent-Level Integration: Natural-Language Scheduling, Reminders, Timers & Non-Fabricated Location", () => {
    const store = new MemoryStore({ databaseSync: false, diskPersistence: false });
    const user = store.getDemoUser();
    const refDate = new Date("2026-11-06T12:00:00.000Z");

    // 5a. Schedule an event for next Monday + set a timer in natural language without location permission
    const bundle1 = buildTemporalPromptContext({
      question: "Schedule Product Architecture Review for next Monday at 2pm and start a timer for 15 minutes for deep work. Also what is the time difference between Egypt and the United States?",
      userId: user.id,
      userTimeContext: {
        timeZone: "Africa/Cairo",
        location: { permissionGranted: false }
      },
      store,
      now: refDate
    });

    expect(bundle1.executedActions.some((a) => a.type === "calendar_event_created")).toBe(true);
    expect(bundle1.executedActions.some((a) => a.type === "timer_started")).toBe(true);
    expect(bundle1.promptBlock).toContain("Precise GPS location permission has NOT been granted");
    expect(bundle1.promptBlock).toContain("Direct Comparison (Egypt (Cairo) vs. United States");

    // 5b. Follow-up: "Remind me two hours before the event"
    const bundle2 = buildTemporalPromptContext({
      question: "Remind me two hours before the event.",
      userId: user.id,
      userTimeContext: {
        timeZone: "Africa/Cairo",
        location: {
          permissionGranted: true,
          latitude: 30.0444,
          longitude: 31.2357,
          label: "Cairo, Egypt"
        }
      },
      store,
      now: refDate
    });

    expect(bundle2.executedActions.some((a) => a.type === "reminder_scheduled")).toBe(true);
    const updatedEvents = store.listCalendarEvents(user.id);
    expect(updatedEvents[0]?.remindBeforeMinutes).toBe(120);
    expect(bundle2.promptBlock).toContain("AUTHORIZED GPS LOCATION: Latitude 30.0444, Longitude 31.2357");
  });

  it("6. End-to-End API: One-Time Persistent Login, Time/Calendar/Timer Endpoints & Hard Deletion Freeing Database Space", async () => {
    const env = loadEnv();
    const store = new MemoryStore({ databaseSync: false, diskPersistence: false });
    const { app } = createApp({ env, store });

    // Create two distinct users to verify per-user tracking and isolation
    const userA = store.createUser("alice@agentia.dev", "hashed_pw_a");
    const userB = store.createUser("bob@agentia.dev", "hashed_pw_b");

    const tokenA = signAccessToken(env, { id: userA.id, email: userA.email, plan: "pro" });
    const refreshA = signRefreshToken(env, { id: userA.id, email: userA.email, plan: "pro" });
    const tokenB = signAccessToken(env, { id: userB.id, email: userB.email, plan: "free" });

    // Verify One-Time Login long-lived TTL (30 days access token, 365 days refresh token)
    const decodedAccess = jwt.decode(tokenA) as { exp: number; iat: number; sub: string };
    const decodedRefresh = jwt.decode(refreshA) as { exp: number; iat: number; sub: string };
    expect(decodedAccess.exp - decodedAccess.iat).toBeGreaterThanOrEqual(29 * 86400);
    expect(decodedRefresh.exp - decodedRefresh.iat).toBeGreaterThanOrEqual(364 * 86400);

    // Also verify that even an older expired access token signed with our secret preserves userA's exact ID
    const expiredTokenA = jwt.sign(
      { sub: userA.id, email: userA.email, plan: "pro" },
      env.jwtAccessSecret,
      { algorithm: "HS256", expiresIn: -60 }
    );
    const timeRes = await request(app)
      .get("/api/time/context?timeZone=Africa/Cairo&compare=egypt,united states,japan")
      .set("Authorization", `Bearer ${expiredTokenA}`);
    expect(timeRes.status).toBe(200);
    expect(timeRes.body.ok).toBe(true);
    expect(timeRes.body.userTimeZone).toBe("Africa/Cairo");
    expect(timeRes.body.worldClocks.length).toBeGreaterThanOrEqual(3);

    // Create a Calendar Event for User A
    const createEventRes = await request(app)
      .post("/api/calendar/events")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        title: "FIFA World Cup Opening Match Watch Party",
        startTime: "2026-06-11T19:00:00.000Z",
        timeZone: "Africa/Cairo",
        category: "event",
        remindBeforeMinutes: 120
      });
    expect(createEventRes.status).toBe(201);
    const eventId = createEventRes.body.event.id as string;
    expect(createEventRes.body.event.reminderTriggerTime).toBe("2026-06-11T17:00:00.000Z");

    // Verify User B cannot see or delete User A's calendar event
    const listEventsB = await request(app)
      .get("/api/calendar/events")
      .set("Authorization", `Bearer ${tokenB}`);
    expect(listEventsB.body.events).toHaveLength(0);

    // Create and control multiple independent timers for User A
    const timer1Res = await request(app)
      .post("/api/timers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ label: "Timer 1 (Sprint)", kind: "timer", durationMs: 300_000 });
    const timer2Res = await request(app)
      .post("/api/timers")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ label: "Timer 2 (Tea)", kind: "timer", durationMs: 180_000 });
    expect(timer1Res.status).toBe(201);
    expect(timer2Res.status).toBe(201);

    const pauseRes = await request(app)
      .post(`/api/timers/${timer1Res.body.timer.id}/control`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ action: "pause" });
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.timer.status).toBe("paused");

    const resumeRes = await request(app)
      .post(`/api/timers/${timer1Res.body.timer.id}/control`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ action: "resume" });
    expect(resumeRes.status).toBe(200);
    expect(resumeRes.body.timer.status).toBe("running");

    // Track per-user conversation & messages, then test hard deletion freeing space
    const convA = store.ensureConversation({
      assistantId: "default-agent",
      userId: userA.id
    });
    const msg1 = store.addMessage({
      conversationId: convA.id,
      role: "user",
      content: "Hello AGENTIA, save this message in my account.",
      tokensUsed: 12,
      sources: []
    });
    const msg2 = store.addMessage({
      conversationId: convA.id,
      role: "assistant",
      content: "Saved! You can delete individual messages or whole chats to free database space.",
      tokensUsed: 18,
      sources: []
    });
    expect(store.listMessagesForUser(convA.id, userA.id)).toHaveLength(2);
    expect(store.listMessagesForUser(convA.id, userB.id)).toHaveLength(0);

    // User B cannot delete User A's message
    const forbiddenDel = await request(app)
      .delete(`/api/conversations/${convA.id}/messages/${msg1.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(forbiddenDel.status).toBe(403);

    // User A deletes a single message -> permanently removed and space freed
    const delMsgRes = await request(app)
      .delete(`/api/conversations/${convA.id}/messages/${msg1.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(delMsgRes.status).toBe(200);
    expect(delMsgRes.body.deleted).toBe(true);
    expect(delMsgRes.body.spaceFreed).toBe(true);
    expect(delMsgRes.body.freedBytes).toBeGreaterThan(0);
    expect(store.listMessagesForUser(convA.id, userA.id)).toHaveLength(1);
    expect(store.listMessagesForUser(convA.id, userA.id)[0]?.id).toBe(msg2.id);

    // User A deletes the entire conversation -> all messages and conversation purged
    const delConvRes = await request(app)
      .delete(`/api/conversations/${convA.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(delConvRes.status).toBe(200);
    expect(delConvRes.body.deleted).toBe(true);
    expect(delConvRes.body.spaceFreed).toBe(true);
    expect(store.getConversation(convA.id)).toBeUndefined();
    expect(store.listMessages(convA.id)).toHaveLength(0);

    // Clean up calendar event
    const delEventRes = await request(app)
      .delete(`/api/calendar/events/${eventId}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(delEventRes.status).toBe(200);
    expect(delEventRes.body.deleted).toBe(true);
  });
});

