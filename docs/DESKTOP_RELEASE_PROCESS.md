# Desktop Release Process

The normal assistant install path must not compile or package Electron. The heavy desktop runtime is built once per ArchMind release, registered as a `desktop_runtime_releases` row, and served as immutable cached bytes. Per-assistant install clicks create only an assistant snapshot plus install intent.

The legacy `/api/platform/desktop/builds` path remains for historical/operator compatibility, but the web Install Assistant button now uses:

```text
POST /api/platform/assistants/:assistantId/install-intents
GET  /api/platform/install-intents/:intentId/runtime-download
POST /api/platform/desktop/install-intents/claim
```

A local unsigned Windows runtime artifact currently exists at:

```text
D:\New project 2\apps\desktop\out\ArchMind Desktop Setup.exe
```

Current local artifact metadata:

- Status: Verified
- Size: `81664520` bytes
- SHA-256: `5FB159CA19AA5EAFC30752B141067F97BB34D8EE7739F252996994CFDC841BD2`
- Signing state: development unsigned

A fresh local runtime can still be generated with `npx electron-builder --win --publish=never` from `apps/desktop`, but that command belongs in an explicit release process or CI job, not in a user request path.

## Release gate

Do not distribute production builds until these gates pass:

1. Use a maintained Electron/Tauri runtime with a locked dependency graph and unique per-assistant application ID, product name, protocol, icon, data directory and installer identity.
2. Bind the assistant ID in signed build configuration; backend ownership/entitlement must remain authoritative.
3. Exchange only a ten-minute, single-use bootstrap credential. Store the returned device secret in Windows Credential Manager/macOS Keychain/Linux Secret Service—never in the installer or plain JSON.
4. Restrict filesystem access to native-picker grants and the canonical scope policy. Implement tray, compact/bubble modes, offline state, revocation response and update verification.
5. Build on clean isolated CI runners; produce SBOM, SHA-256, size, version, platform and signing/provenance metadata. Reject zero-byte, HTML or wrong-magic artifacts.
6. Sign Windows installers with the configured organization certificate and timestamp authority. Notarize/sign macOS only when a real macOS build is supported. Sign update metadata with a separate offline-controlled key.
7. Upload to private artifact storage and expose short-lived, entitlement-checked downloads. Record build and download audit events.
8. Install on clean supported OS images, verify coexistence of two assistants, first launch, revocation, update/rollback protection and uninstall cleanup.

The bootstrap/device APIs and installer generation are prerequisites. Production release still requires live desktop E2E verification, code signing, update-channel signing, artifact provenance, durable object storage/CDN, and environment-specific download authorization checks.
