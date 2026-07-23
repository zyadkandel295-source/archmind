# ArchMind Frontend Privacy and Accessibility Report

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Privacy review

| Area | Status | Notes |
|---|---:|---|
| Token handling in URLs | Verified | Google OAuth callback now places only a short-lived handoff code in the URL; a regression test verifies tokens are absent and the code is one-use. |
| Auth refresh behavior | Implemented but unverified | Logs show expired access tokens are refreshed successfully, then assistant/dashboard requests recover. |
| Installer error messages | Implemented but unverified | Errors display correlation references instead of stack traces or secrets. |
| Desktop chat fallback messaging | Implemented but unverified | Network failures should show Offline; only confirmed revocation should show Session revoked. Needs latest-runtime verification. |
| Site activity telemetry | Implemented but unverified | Activity endpoint receives events; verify no sensitive message/token/file-path payloads are sent. |

## Accessibility review

Status: Implemented but unverified

The desktop bubble and web install page still need a formal accessibility pass. Required checks:

- keyboard access for install/rebuild/download actions;
- visible focus states;
- accessible names for assistant icon, bubble, close/minimize, folder, send, and tray actions;
- tooltip/accessibility name contains the real assistant name;
- contrast checks for dark purple UI states and error banners;
- screen-reader-friendly install status and error references;
- no motion-only status indicators.

## Required tests before public release

- Run automated accessibility checks on the web install page and assistant chat.
- Manually inspect keyboard-only install and chat flow.
- Verify desktop bubble has an accessibility name equal to the assistant name.
- Verify two bubbles do not overlap completely and both remain reachable.
