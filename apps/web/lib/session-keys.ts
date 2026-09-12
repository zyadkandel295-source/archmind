const SESSION_KEY = "archmind.session";
const RENEWAL_KEY = "archmind.renewal";
const EMAIL_KEY = "archmind.email";
const DISPLAY_NAME_KEY = "archmind.displayName";
const PHOTO_KEY = "archmind.photoURL";

// Workspace API credentials deliberately live in memory only. Firebase owns the
// durable browser session (with its supported local persistence), while a fresh
// short-lived workspace credential is exchanged whenever the app starts.
// Keeping API refresh tokens out of localStorage prevents an injected script
// from turning a browser profile into a long-lived API session.
let workspaceAccessToken: string | undefined;
let workspaceRefreshToken: string | undefined;

/** Migrate legacy storage keys once per browser */
function migrateLegacyKeys() {
  if (typeof window === "undefined") return;
  // Previous releases persisted both the workspace access token and refresh
  // token in localStorage. Remove them once; Firebase remains signed in and
  // AuthProvider will exchange a new in-memory workspace session on startup.
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(RENEWAL_KEY);
  window.localStorage.removeItem("archmind.accessToken");
  window.localStorage.removeItem("archmind.refreshToken");

  // Purge legacy hardcoded developer email defaults from existing browsers
  const email = window.localStorage.getItem(EMAIL_KEY);
  if (email === "zyadkandel295@gmail.com" || email === "Zyad.2524033@stemelsadat.moe.edu.eg") {
    window.localStorage.removeItem(EMAIL_KEY);
    window.localStorage.removeItem(DISPLAY_NAME_KEY);
  }
}

export function readSessionCredential() {
  return workspaceAccessToken;
}

export function readRenewalCredential() {
  return workspaceRefreshToken;
}

export function writeSessionCredentials(session: string, renewal?: string) {
  workspaceAccessToken = session;
  workspaceRefreshToken = renewal;
}

export function clearSessionCredentials() {
  workspaceAccessToken = undefined;
  workspaceRefreshToken = undefined;
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(RENEWAL_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
  window.localStorage.removeItem(DISPLAY_NAME_KEY);
  window.localStorage.removeItem(PHOTO_KEY);
  window.localStorage.removeItem("archmind.accessToken");
  window.localStorage.removeItem("archmind.refreshToken");
}

export function readProfileFromStorage() {
  if (typeof window === "undefined") return { email: undefined, displayName: undefined, photoURL: undefined };
  migrateLegacyKeys();
  return {
    email: window.localStorage.getItem(EMAIL_KEY) ?? undefined,
    displayName: window.localStorage.getItem(DISPLAY_NAME_KEY) ?? undefined,
    photoURL: window.localStorage.getItem(PHOTO_KEY) ?? undefined
  };
}

export function writeProfileToStorage(email: string, displayName?: string, photoURL?: string) {
  window.localStorage.setItem(EMAIL_KEY, email);
  if (displayName) window.localStorage.setItem(DISPLAY_NAME_KEY, displayName);
  else window.localStorage.removeItem(DISPLAY_NAME_KEY);
  if (photoURL) window.localStorage.setItem(PHOTO_KEY, photoURL);
  else window.localStorage.removeItem(PHOTO_KEY);
}
