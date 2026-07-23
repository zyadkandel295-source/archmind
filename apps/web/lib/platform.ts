/** Base URL for workspace data requests (never shown in the UI) */
export function getPlatformBaseUrl() {
  return process.env.NEXT_PUBLIC_PLATFORM_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "";
}
