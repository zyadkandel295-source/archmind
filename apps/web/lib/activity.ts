"use client";

export interface ActivityEvent {
  id: string;
  type: string;
  path: string;
  email?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const STORAGE_KEY = "archmind.activity.v1";
const MAX_LOCAL_EVENTS = 150;

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function firebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    collection: process.env.NEXT_PUBLIC_FIREBASE_ACTIVITY_COLLECTION || "site_activity"
  };
}

function readEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ActivityEvent[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeEvents(events: ActivityEvent[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_LOCAL_EVENTS)));
}

function toFirestoreFields(event: ActivityEvent) {
  return {
    fields: {
      id: { stringValue: event.id },
      type: { stringValue: event.type },
      path: { stringValue: event.path },
      email: { stringValue: event.email ?? "" },
      metadata: { stringValue: JSON.stringify(event.metadata ?? {}) },
      createdAt: { timestampValue: event.createdAt }
    }
  };
}

export function getCloudActivityStatus() {
  const config = firebaseConfig();
  return {
    enabled: Boolean(config.apiKey && config.projectId),
    projectId: config.projectId,
    collection: config.collection
  };
}

/** @deprecated Use getCloudActivityStatus */
export const getFirebaseActivityStatus = getCloudActivityStatus;

export function listActivityEvents() {
  return readEvents();
}

export function recordActivity(type: string, metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;

  const event: ActivityEvent = {
    id: makeId(),
    type,
    path: window.location.pathname,
    email: window.localStorage.getItem("archmind.email") ?? undefined,
    metadata,
    createdAt: new Date().toISOString()
  };

  writeEvents([event, ...readEvents()]);

  fetch("/api/site-activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true
  }).catch(() => undefined);
}
