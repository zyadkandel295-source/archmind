// Vercel maps this file directly to /api/health. Keeping an explicit entry
// prevents a Next.js fallback in the monorepo deployment from returning the
// web shell in place of the API health response.
export { default } from "./index";
