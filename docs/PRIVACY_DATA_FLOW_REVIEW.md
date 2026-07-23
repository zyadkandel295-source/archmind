# ArchMind Privacy and Data Flow Review

Date: 2026-07-16

Status vocabulary: Verified, Implemented but unverified, Not implemented, Blocked.

## Data inventory

| Data class | Where it appears | Status | Notes |
|---|---|---:|---|
| User account identifiers | API auth, web session, PostgreSQL records | Implemented but unverified | Must remain tenant-scoped and excluded from unnecessary logs. |
| OAuth tokens | API auth callback and token storage | Verified | Google callback now uses a one-time handoff code instead of token query parameters; regression test verifies no access/refresh token in callback URL. |
| Assistant metadata | Web UI, API, desktop manifests, installer metadata | Implemented but unverified | Per-assistant name, icon, ID, protocol, and app identity are expected in the desktop package. |
| Desktop device/session tokens | Desktop credential storage and platform sessions | Implemented but unverified | Windows credential protection/encrypted credential files were observed previously; reverify on latest runtime. |
| Conversations/messages | API/web/desktop chat and PostgreSQL | Implemented but unverified | Need end-to-end proof that desktop and web see the same persisted conversation. |
| Local file paths | Desktop approved-folder and local action flows | Implemented but unverified | Paths must be canonicalized and scoped to approved folders. |
| Installer artifacts | Local runtime cache and protected downloads | Implemented but unverified | Artifact metadata includes size/hash/runtime-template digest. |
| Audit records | API audit trail/PostgreSQL | Implemented but unverified | Must survive API restart and preserve tenant isolation. |

## Privacy risks

### Token leakage through URLs

Status: Verified

OAuth access/refresh tokens are no longer sent through Google callback URL query parameters. The remaining auth privacy hardening is to move long-lived browser session material toward HttpOnly same-site cookies or an equivalent design.

### Excessive OAuth scopes

Status: Implemented but unverified

The OAuth login route requests broad Google scopes. If these scopes are required for optional integrations, the product should clearly separate basic sign-in from optional high-privilege Google actions and request incremental consent only when needed.

### Desktop local file exposure

Status: Implemented but unverified

Desktop local actions must enforce:

- approved-folder allowlisting;
- canonical path checks;
- symlink and traversal rejection;
- approval before sensitive actions;
- audit logging for durable accountability.

The release evidence still needs the real invoice-folder vertical slice on temporary local files.

## Required public-release controls

- No tokens in URLs.
- No sensitive values in logs, screenshots, telemetry, or reports.
- Tenant isolation tests for users, assistants, devices, installers, memories, builds, and conversations.
- Clear user-visible permissions for folders, clipboard, selected text, and screen capture.
- Data deletion/uninstall behavior that does not remove unrelated assistants or shared user files.
