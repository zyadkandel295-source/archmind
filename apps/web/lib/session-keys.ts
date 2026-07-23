const SESSION_KEY = "archmind.session";
const RENEWAL_KEY = "archmind.renewal";
const EMAIL_KEY = "archmind.email";
const DISPLAY_NAME_KEY = "archmind.displayName";
const PHOTO_KEY = "archmind.photoURL";

/** Migrate legacy storage keys once per browser */
function migrateLegacyKeys() {
  if (typeof window === "undefined") return;
  const legacySession = window.localStorage.getItem("archmind.accessToken");
  if (legacySession && !window.localStorage.getItem(SESSION_KEY)) {
    window.localStorage.setItem(SESSION_KEY, legacySession);
    window.localStorage.removeItem("archmind.accessToken");
  }
  const legacyRenewal = window.localStorage.getItem("archmind.refreshToken");
  if (legacyRenewal && !window.localStorage.getItem(RENEWAL_KEY)) {
    window.localStorage.setItem(RENEWAL_KEY, legacyRenewal);
    window.localStorage.removeItem("archmind.refreshToken");
  }
}

export function readSessionCredential() {
  if (typeof window === "undefined") return undefined;
  migrateLegacyKeys();
  return window.localStorage.getItem(SESSION_KEY) ?? undefined;
}

export function readRenewalCredential() {
  if (typeof window === "undefined") return undefined;
  migrateLegacyKeys();
  return window.localStorage.getItem(RENEWAL_KEY) ?? undefined;
}

export function writeSessionCredentials(session: string, renewal?: string) {
  window.localStorage.setItem(SESSION_KEY, session);
  if (renewal) window.localStorage.setItem(RENEWAL_KEY, renewal);
}

export function clearSessionCredentials() {
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(RENEWAL_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
  window.localStorage.removeItem(DISPLAY_NAME_KEY);
  window.localStorage.removeItem(PHOTO_KEY);
  window.localStorage.removeItem("archmind.accessToken");
  window.localStorage.removeItem("archmind.refreshToken");
}

export function readProfileFromStorage() {
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
