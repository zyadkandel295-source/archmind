# ArchMind Six-Feature Completion Report

Date: 2026-07-16

This report uses only these statuses: Verified, Implemented but unverified, Blocked, Not implemented.

ArchMind is not marked production-ready. The current tree contains implementation and prior local evidence for the PostgreSQL platform adapter, Redis/BullMQ desktop build worker, protected Windows installer generation/download, and installed Electron bootstrap, but each release gate below is only marked Verified when the current report has concrete evidence. Remaining local release gates include current PostgreSQL rerun, two simultaneously installed assistant bubbles, real desktop-to-web chat persistence, revoked-session GUI behavior, and installed-app Windows identity/uninstall checks. External release gates remain code signing and production deployment credentials.

## 2026-07-16 continuation: fast assistant packaging evidence

ArchMind is still not marked complete or production-ready. This continuation focused on the active blocker where assistant-specific NSIS packaging took 343,321-394,798 ms.

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Warm assistant-specific packaging target | Verified | `apps/api/src/services/desktop-builder.ts` now uses the precompiled `apps/desktop/out/win-unpacked` runtime with `electron-builder --prepackaged`, preserves `npmRebuild: false`, sets request-time `compression: "store"`, disables NSIS differential package output, and injects only the signed assistant manifest/icon before packaging. Measured probe `Fast Store Test` completed in 33,936 ms. | Installer size increased because request-time NSIS now stores rather than heavily compresses payload bytes. |
| Packaging stage timing | Verified | Probe timings: copy precompiled payload 1,158 ms; icon and installer assets 1,720 ms; manifest write 21 ms; prepackaged NSIS 24,902 ms; artifact hash read 3,860 ms. This proves no TypeScript compile, npm install, native rebuild, Electron download, or ASAR creation occurred during the assistant job. | Cold-cache timing was not rerun after clearing Electron Builder caches. |
| Fast personalized installer artifact | Verified | Generated `D:\New project 2\.archmind-data\desktop-builds\38c0adad-6829-41a5-864a-51693b1796d0\out\Install Fast Store Test.exe`, size `284,248,927` bytes, SHA-256 `4ef13d3c0328352a8f8c7279a15921038b7add9da8e6de1e05ff5f5e5db3360b`, `MZ` header. Manifest binds assistant `8fe24df2-bf2e-43d7-93ce-c1c06db5d0d5`, app ID `com.archmind.assistant.8fe24df2fasttest`, protocol `archmind-assistant-8fe24df2fasttest`, icon `Headphones`, and product name `Fast Store Test`. | This probe was not installed/launched. |
| PostgreSQL integration rerun in this continuation | Verified | Docker Desktop was started, `docker compose up -d postgres redis` reported both containers healthy, and `TEST_DATABASE_URL=postgres://archmind:archmind@localhost:5432/archmind_test npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` passed 5/5 PostgreSQL tests. Covered persistence across repository restart, tenant isolation, duplicate assistant slug installer-state reads, concurrent idempotent desktop builds, and cross-assistant installer isolation. | None for local PostgreSQL verification in this continuation. |
| Two real worker-built assistant installers | Verified | With the local API/web/worker running, demo user created `Invoice Helper Current B` (`1f284d5c-e62d-41d8-91b9-f2409daf483c`) and `Study Coach Current B` (`f937899f-6d34-4d34-8811-3a5f5b69e983`). Worker builds `8abc2d62-d9e4-4fb9-a9d2-e42f8d676b6b` and `5fcaec47-5904-4c3c-bd73-046c81108b56` reached `ready`, producing `Install Invoice Helper Current B.exe` (`284,251,253` bytes, SHA-256 `4e29da07011dd70420fb5ab86e9a25b31bf470011a7edd27329b695c04ff9073`) and `Install Study Coach Current B.exe` (`284,250,473` bytes, SHA-256 `c674621e88a197532dc4fed1cd2ab17d070caca4dcc7e26d9df2b5b77b94a8ba`). | Code signing remains external. |
| Two installed assistant apps in this continuation | Verified | Silent per-user installs exited `0`: `D:\ArchMindCurrentInvoice\Invoice Helper Current B.exe` and `D:\ArchMindCurrentStudy\Study Coach Current B.exe` both exist. Both were launched and Windows reported simultaneous process trees with main-window titles `Invoice Helper Current B` and `Study Coach Current B`, separate executable paths, and separate process names. | Visual screenshot/hover inspection of two 64px bubbles was not captured in this continuation. |
| Separate user-data and device sessions | Verified | Runtime state exists under separate directories: `C:\Users\AL-FAGR\AppData\Roaming\ArchMind\com.archmind.assistant.1f284d5cba2175f1` and `C:\Users\AL-FAGR\AppData\Roaming\ArchMind\com.archmind.assistant.f937899f1382b6eb`. Each has `credentials.enc` and `runtime-state.json` with status `active`. Backend `/api/platform/devices` returned two separate device records: `045d074c-deeb-4fb7-a69a-49cd369b9637` for Invoice Helper Current B and `01c922f7-b8b8-4eae-a31a-3995e254589c` for Study Coach Current B. | Uninstall-one-preserves-other was not executed in this continuation. |
| Startup-as-bubble source fix | Verified | `apps/desktop/src/main.ts` now sets `currentMode = "bubble"` during identity configuration, so app launch starts from the bubble even if the previous state was compact/full/tray; saved bubble and compact bounds are still preserved. Desktop typecheck and desktop TypeScript build passed. | A fresh base Electron template/installer rebuild after this final source patch is currently blocked by `electron-builder` hanging past 10 minutes and leaving a suspicious partial base installer. Existing installed A/B apps were built before this final source patch. |
| Real desktop-to-web chat in this continuation | Implemented but unverified | Desktop source still routes chat through the device-authenticated `/api/platform/desktop/chat` backend path. | No installed desktop chat message was sent and verified in the website conversation during this continuation. |

### Commands executed in this continuation

| Command | Status | Result |
| --- | --- | --- |
| `npm.cmd run build -w @archmind/api` | Verified | Passed after the packager changes. |
| Manual fast packaging probe for `Fast Store Test` | Verified | Passed in 33,936 ms with stage timings and artifact hash listed above. |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed. |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed. |
| `npm.cmd run typecheck -w @archmind/web` | Verified | Passed. |
| `npm.cmd run lint` | Verified | Passed with no ESLint warnings/errors. |
| `npx.cmd vitest run tests/platform.test.ts --pool=forks` from `apps/api` | Verified | Passed: 11 tests. |
| `Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'` then `docker compose up -d postgres redis` | Verified | Docker became reachable; Postgres and Redis were healthy on ports 5432 and 6379. |
| `TEST_DATABASE_URL=postgres://archmind:archmind@localhost:5432/archmind_test npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` | Verified | Passed: 5 PostgreSQL tests. |
| Live API worker build for `Invoice Helper Current B` and `Study Coach Current B` | Verified | Both build records reached `ready` and produced distinct assistant-specific installers. |
| Silent install and simultaneous launch of `Invoice Helper Current B` and `Study Coach Current B` | Verified | Both installers exited `0`; both installed executables exist; both apps launched simultaneously with separate process names, paths, user-data directories, encrypted credentials, runtime state, and backend device records. |
| `npm.cmd run typecheck -w @archmind/desktop` and `npm.cmd run build -w @archmind/desktop` after final startup patch | Verified | Both passed. |
| `npx.cmd electron-builder --win --publish=never` after final startup patch | Blocked | Timed out after 5 minutes, then again after 10 minutes; `apps\desktop\out` showed a suspicious partial `Install ArchMind Assistant.exe` of `1,181,518` bytes alongside the payload archive. Do not use that partial base installer as release evidence. |

## 2026-07-16 continuation: atomic runtime build and Current C installers

ArchMind is still not marked complete or production-ready. This continuation resolved the base-runtime publication blocker and regenerated Current C installers from the verified runtime template, but it did not complete visual bubble screenshots, desktop-to-web chat persistence, or uninstall isolation.

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Base runtime build hang root cause | Verified | Captured full log at `D:\New project 2\.archmind-data\desktop-runtime\logs\33.2.0-archmind-web-bubble-fast.2-2026-07-16T10-25-08-761Z.log`. Electron Builder reached NSIS, then `7za.exe` failed with `ERROR: Can't allocate required memory!` while trying `-mx=9` on a 269 MiB payload. The earlier timeout left an invalid NSIS stub before validation. | None for diagnosis. |
| Partial base installer quarantine | Verified | The invalid `apps\desktop\out\Install ArchMind Assistant.exe` of `1,181,518` bytes was moved to `D:\New project 2\.archmind-data\desktop-runtime\quarantine\partial-2026-07-16T10-20-58-940Z-Install ArchMind Assistant.exe`. `apps\desktop\out\Install ArchMind Assistant.exe` no longer exists. | None for this partial artifact. |
| Runtime publication safety | Verified | `scripts/build-desktop-runtime.cjs` now builds into `.archmind-data\desktop-runtime\tmp`, holds `runtime-build.lock`, validates installer size/header/hash and template `app.asar`, publishes to an immutable release directory only after validation, writes `current.json` atomically, and quarantines known tiny partials. `apps/api/src/modules/platform.ts` refuses to register local runtime artifacts below 50 MiB or without `MZ`. `apps/api/src/services/desktop-builder.ts` consumes `.archmind-data\desktop-runtime\current.json` and validates the template digest before copying. | Broader automated packaging tests are still needed. |
| Latest base runtime build | Verified | Atomic build succeeded with `ARCHMIND_DESKTOP_RUNTIME_VERSION=33.2.0-archmind-web-bubble-fast.2` and `ARCHMIND_DESKTOP_RUNTIME_COMPRESSION=store`. Published runtime: `D:\New project 2\.archmind-data\desktop-runtime\releases\33.2.0-archmind-web-bubble-fast.2-5f042f77bc27\Install ArchMind Assistant.exe`, size `284,248,576`, SHA-256 `6f226c6f4cc42b25ba74775d287aa33695c8d6854c3a3334e74fac72ba7d6869`, digest `5f042f77bc27e65aaff9c73be4ce3b3d8fcca853241cc1b6f04ff13977a0a313`, `app.asar` SHA-256 `c4cb95df9a04fcf8fa0c99dad911be9f6600c49ac974535125d3991ffbcfeceb`, build duration `197,415 ms`, unsigned dev build. | Runtime size remains large and requires download-time benchmarking. |
| Runtime version/cache separation | Verified | `DESKTOP_RUNTIME_VERSION` is now `33.2.0-archmind-web-bubble-fast.2`; Current C build records use that runtime version. Assistant manifests include `runtimeTemplateVersion` and `runtimeTemplateDigest` so older cached payloads cannot be mistaken for the latest source. | None for local metadata separation. |
| Invoice Helper Current C installer | Verified | Assistant `2efd441e-0688-4ff7-8c31-4712bacd398a`, build `1039aabf-17ee-4281-8064-ba0b7f5db33c`, app ID `com.archmind.assistant.2efd441eb2929d37`, protocol `archmind-assistant-2efd441eb2929d37`, runtime `33.2.0-archmind-web-bubble-fast.2`, runtime digest `5f042f77bc27e65aaff9c73be4ce3b3d8fcca853241cc1b6f04ff13977a0a313`. Output `Install Invoice Helper Current C.exe`, size `284,251,395`, SHA-256 `83294f6a380b99b0bfed3d3400b9c27ddb319e50a1ed6bd22d80e48b5535b754`. Worker timings: template validate 16 ms, copy 1,685 ms, assets 742 ms, manifest 15 ms, NSIS 55,655 ms, hash 5,245 ms. | Visual bubble and chat proof incomplete. |
| Study Coach Current C installer | Verified | Assistant `a5ef7b05-de11-4a41-8cfb-cae1c3341866`, build `cf4b4b82-e65f-4345-a72f-51ab11f8aef5`, app ID `com.archmind.assistant.a5ef7b05e5dc9cf5`, protocol `archmind-assistant-a5ef7b05e5dc9cf5`, runtime `33.2.0-archmind-web-bubble-fast.2`, runtime digest `5f042f77bc27e65aaff9c73be4ce3b3d8fcca853241cc1b6f04ff13977a0a313`. Output `Install Study Coach Current C.exe`, size `284,250,611`, SHA-256 `26d3d4add0c7327c864c5d164e48bc0b0d7944f280d856077d10cd074c0d43cb`. Worker timings: template validate 20 ms, copy 1,414 ms, assets 1,141 ms, manifest 13 ms, NSIS 61,947 ms, hash 5,050 ms. | Visual bubble and chat proof incomplete. |
| Current C install | Verified | Silent per-user installs exited `0`; `D:\ArchMindCurrentInvoiceC\Invoice Helper Current C.exe` and `D:\ArchMindCurrentStudyC\Study Coach Current C.exe` both exist. | UI/process control timed out during launch verification, so visible bubble proof is not complete. |
| Visible 64px bubbles | Implemented but unverified | Source forces `currentMode = "bubble"` on startup and Current C installers were generated after that patch. | Windows screenshot capture, window-bounds API query, process enumeration, and direct `taskkill` all timed out after C launch attempts. No screenshot with two visible bubbles was captured in this continuation. |
| Real desktop-to-web chat persistence | Implemented but unverified | Desktop source still calls `/api/platform/desktop/chat`, and Current C manifests point to the correct assistant-specific web URLs. | Device-authenticated desktop messages were not sent/verified because Windows UI/process control timed out before reliable desktop interaction could be captured. |
| Uninstall isolation | Implemented but unverified | C apps installed into separate controlled directories with distinct app IDs/protocols. | Study Coach Current C was not uninstalled/reinstalled in this continuation because Windows process/control commands were timing out. |

### Commands executed in this continuation

| Command | Status | Result |
| --- | --- | --- |
| `node scripts\build-desktop-runtime.cjs` with `ARCHMIND_DESKTOP_RUNTIME_COMPRESSION=normal` | Verified | Failed fast with captured 7-Zip memory error; root cause confirmed. |
| `node scripts\build-desktop-runtime.cjs` with `ARCHMIND_DESKTOP_RUNTIME_COMPRESSION=store` | Verified | Passed; atomically published runtime `33.2.0-archmind-web-bubble-fast.2`. |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed after runtime validation and version changes. |
| `npm.cmd run build -w @archmind/api` | Verified | Passed after runtime validation and version changes. |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed after startup-as-bubble source patch. |
| `npm.cmd run build -w @archmind/desktop` | Verified | Passed after startup-as-bubble source patch. |
| Live worker build for Current C installers | Verified | Both reached `ready` and produced distinct assistant-specific installers from runtime digest `5f042f77bc27e65aaff9c73be4ce3b3d8fcca853241cc1b6f04ff13977a0a313`. |
| Silent install of Current C installers | Verified | Both installers exited `0` and installed to separate controlled directories. |
| Screenshot/window-bounds/process-control commands after Current C launch | Blocked | Timed out repeatedly, so visual bubble proof and uninstall isolation were not completed in this continuation. |

## 2026-07-16 continuation: destroyed-window crash fix

ArchMind is still not marked complete or production-ready. This update fixes the installed desktop crash shown by the Windows dialog: `TypeError: Object has been destroyed` at `applyMode`.

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Destroyed-window crash root cause | Verified | The installed app was calling `applyMode()` after the `BrowserWindow` had already been destroyed. Source had only `if (!mainWindow) return;`, which does not protect Electron objects after destruction. `window-all-closed` also called `applyMode("tray")`, which can touch a destroyed window during close. | None for the identified crash path. |
| Crash fix in desktop source | Verified | `apps/desktop/src/main.ts` now guards `applyMode`, `loadBubbleView`, and `loadChatView` with `mainWindow.isDestroyed()`, guards fallback `loadURL`, and no longer calls `applyMode("tray")` from `window-all-closed`. `npm.cmd run typecheck -w @archmind/desktop` and `npm.cmd run build -w @archmind/desktop` passed. | Existing installed apps must be reinstalled from a new installer to receive this fix. |
| Runtime containing crash fix | Verified | Atomic runtime `33.2.0-archmind-web-bubble-fast.3` was published at `D:\New project 2\.archmind-data\desktop-runtime\releases\33.2.0-archmind-web-bubble-fast.3-320c43ffb100\Install ArchMind Assistant.exe`, size `284,248,786`, SHA-256 `b0af77cfdc1b05cc484c482ace401a7f0ae15b3f347a14457d154a7dc68e7052`, digest `320c43ffb1009972914a9140d4c154270b164d4fd263fcfe8a9ead80acf83f86`, `app.asar` SHA-256 `edbed7221608101a715eb5c165837a92afbc59cbf18a032f95f9d9565e7e30f7`, build duration `199,244 ms`. | Assistant-specific installers must be regenerated and reinstalled to consume `.fast.3`. |
| API runtime version | Verified | `DESKTOP_RUNTIME_VERSION` is now `33.2.0-archmind-web-bubble-fast.3`; `npm.cmd run typecheck -w @archmind/api` and `npm.cmd run build -w @archmind/api` passed. | Local dev API/worker must be restarted before new installer build requests use `.fast.3`. |

## 2026-07-16 continuation: direct desktop chat instead of Google web sign-in

ArchMind is still not marked complete or production-ready. This update fixes the installed assistant opening the website login/Google OAuth page inside Electron.

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Google sign-in screen root cause | Verified | Desktop `chatUrl()` preferred `manifest.webUrl`, so clicking/expanding the app loaded the protected website route in Electron. That route used the normal web profile auth flow and showed Google sign-in. | None for root cause. |
| Direct authenticated desktop chat | Verified | `apps/desktop/src/main.ts` now uses the local desktop chat renderer as `preferredUrl`, so the app opens directly to the assistant chat UI and sends messages through the stored desktop session to `/api/platform/desktop/chat`. Removed web-page CSS injection that only existed for the website URL path. `npm.cmd run typecheck -w @archmind/desktop` and `npm.cmd run build -w @archmind/desktop` passed. | Existing installed apps must be rebuilt/reinstalled to receive this fix. |
| Runtime containing direct-chat fix | Verified | Atomic runtime `33.2.0-archmind-web-bubble-fast.4` was published at `D:\New project 2\.archmind-data\desktop-runtime\releases\33.2.0-archmind-web-bubble-fast.4-d20925e14f65\Install ArchMind Assistant.exe`, size `284,248,382`, SHA-256 `82915c0cd8e5eeb059dcd71696748b75ac362389ce290125d0649a1404e861e2`, digest `d20925e14f653b774ec4da41f9e29009ff1592cc5b13239df8cf5053d9acf66c`, `app.asar` SHA-256 `eb9206930037f52aa95d0309dd68fcb07288eaed0648f4e847c9cb879268ac0d`, build duration `248,181 ms`. | Assistant-specific installers must be regenerated and reinstalled to consume `.fast.4`. |
| API runtime version | Verified | `DESKTOP_RUNTIME_VERSION` is now `33.2.0-archmind-web-bubble-fast.4`; `npm.cmd run typecheck -w @archmind/api` and `npm.cmd run build -w @archmind/api` passed. | Local dev API/worker must be restarted before new installer build requests use `.fast.4`. |

## 2026-07-16 production-hardening update

ArchMind is still not marked complete or production-ready. The current pass fixed the root install-flow issue where the web Install Assistant page was using the generic cached runtime/install-intent path instead of the assistant-specific Windows build/download path. It also tightened assistant-scoped desktop identity, bubble behavior, protocol parsing, icon generation, and repeated download-token authorization.

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Selected assistant ID from web install page to build request | Verified | `apps/web/components/deploy-client.tsx` now calls `POST /api/platform/desktop/builds` with the route `assistantId`, platform, architecture, and idempotency key. Web typecheck, lint, and production build passed. | Browser click-through against running local services was not executed in this pass. |
| Generic runtime download authorization error | Verified | `apps/api/src/services/platform-service.ts` now rotates and preserves recent install-intent runtime download token hashes; `db/migrations/009_install_intent_download_tokens.sql` and `apps/api/src/db/postgres-platform.ts` persist `download_token_hashes`. Focused platform test and full API tests passed. | Live browser retry was not manually clicked after server restart. |
| Assistant-specific Windows app identity | Verified | `PlatformService.createDesktopBuild` derives `appId` and protocol from owner + assistant UUID, including the assistant UUID prefix for traceability and no editable display text. `apps/api/tests/platform.test.ts` now verifies two assistants for one user get different app IDs/protocols and correct product name. | Real installed Windows Start Menu/uninstall entries for A+B were not manually inspected. |
| Web Install Assistant experience | Verified | Install page now requests assistant-specific desktop build and protected installer download; generic "cached universal runtime" copy and protocol-connect button were removed. `npm run typecheck -w @archmind/web`, `npm run lint`, and `npm run build -w @archmind/web` passed. | Browser E2E not executed. |
| Desktop bubble startup | Verified | `apps/desktop/src/main.ts` starts in a 64x64 bubble, opens compact 420x620 chat on click, saves per-assistant bounds, and returns to bubble on minimize. Desktop typecheck/build passed and base NSIS installer regenerated. | Visual installed app test not executed. |
| Per-assistant protocol parsing | Verified | Desktop now accepts the packaged assistant-specific protocol scheme as well as `archmind-assistant-*` routes for install-intent claim. Desktop typecheck/build passed. | Protocol handoff with an installed assistant-specific app was not manually executed. |
| Per-assistant icon asset path | Implemented but unverified | `scripts/generate-desktop-assets.cjs` accepts `ARCHMIND_ASSET_ICON`; `apps/api/src/services/desktop-builder.ts` passes the assistant icon key to generated `.ico`/installer art. The generator produced `.ico`/BMP files in a local scratch check. | Windows shell/taskbar/uninstall icon inspection for A+B was not executed. |
| Assistant-specific packager A+B artifacts | Verified | Manual local packaging generated `Install Invoice Helper Test.exe` and `Install Study Coach Test.exe`; both have `MZ` headers, distinct app IDs/protocols/manifests, and distinct hashes. | Install/launch/uninstall verification was not executed. |
| Canonical real backend chat | Implemented but unverified | Desktop chat calls `/api/platform/desktop/chat`, which authenticates device session and delegates to `runAssistantChat` with the session-bound assistant ID. Existing API tests verify web assistant isolation and desktop bootstrap/revocation behavior. | Installed desktop message -> persisted web-visible conversation was not executed. |
| Two assistant simultaneous runtime | Implemented but unverified | Single-instance lock is now requested after per-assistant identity/userData setup; build identities are assistant-scoped. | Actual A+B installed apps running simultaneously as separate bubbles was not executed. |
| Base Windows installer artifact | Verified | `apps/desktop/out/Install ArchMind Assistant.exe` regenerated with SHA-256 `5F32314BE907DDEA993E2FFC71E467D24C25E5970B072BF28039F9DF5141C03F`, size `83,504,180` bytes, unsigned dev build. | This is the base runtime artifact, not proof of assistant-specific A+B installation. |
| Code signing | Blocked | Electron Builder reported no signing info and produced unsigned installers. | Requires Windows Authenticode certificate/signing secret and timestamp service authorization. |
| Production `.com` deployment | Blocked | No production DNS/TLS/hosting/storage/signing credentials were provided. | Requires external credentials and deployment authorization. |

### Root causes traced in this pass

| Symptom | Root cause found | Fix status |
| --- | --- | --- |
| Generic downloaded app path | The web install page was using `/api/platform/assistants/:assistantId/install-intents`, which downloads the generic cached runtime, instead of the assistant-specific `/api/platform/desktop/builds` path. | Verified |
| Runtime download "not authorized" | Reused install intents could invalidate an already-returned runtime download URL by replacing `download_token_hash`. | Verified |
| Generic/large desktop startup | Bubble mode was still 88px and opened full mode; compact was 420x360. | Verified |
| Possible assistant protocol mismatch | Desktop install-intent parser only accepted `archmind://`, while assistant-specific builds use generated protocols. | Verified |
| Multi-assistant collision risk | Build identity previously used a slug derived partly from editable display name; this can drift across renames and is not stable enough. | Verified |
| Selected icon not embedded distinctly | Asset generator only used color and generic mark; assistant icon key was not passed. | Implemented but unverified |

### Commands executed in this update

| Command | Status | Result |
| --- | --- | --- |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed |
| `npm.cmd run typecheck -w @archmind/web` | Verified | Passed |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed |
| `npm.cmd run lint` | Verified | Passed with no ESLint warnings/errors |
| `npm.cmd run build -w @archmind/api` | Verified | Passed |
| `npm.cmd run build -w @archmind/web` | Verified | Passed |
| `npm.cmd run build -w @archmind/desktop` | Verified | Passed |
| `npx.cmd vitest run tests/platform.test.ts --pool=forks` | Verified | Passed: 11 tests |
| `npm.cmd test` | Verified | Passed: 42 tests, 5 PostgreSQL tests skipped because `TEST_DATABASE_URL` was not configured |
| `npx.cmd electron-builder --win nsis` in `apps/desktop` | Verified | Passed; generated unsigned base NSIS artifact |
| Manual assistant-specific packaging probe for `Invoice Helper Test` | Verified | Generated `Install Invoice Helper Test.exe`, 83,502,193 bytes, SHA-256 `115580613CB85BC112705FC88090B44D38C80C0DE50C9BF51D0F3AB72DAB729A`, `MZ` header, packaging time 343,321 ms |
| Manual assistant-specific packaging probe for `Study Coach Test` | Verified | Generated `Install Study Coach Test.exe`, 83,500,509 bytes, SHA-256 `BF72823AFE2FF26DD11524531901CA7C910229349D214F88BE02B9A8F19F83A1`, `MZ` header, packaging time 394,798 ms |

### Current task-scoped changed files

- `apps/web/components/deploy-client.tsx` — assistant-specific build/download flow.
- `apps/api/src/services/platform-service.ts` — stable assistant-scoped app/protocol identity and install-intent token rotation.
- `apps/api/src/platform-types.ts` — install-intent recent download token hashes.
- `apps/api/src/db/postgres-platform.ts` — PostgreSQL persistence for recent install-intent download hashes.
- `db/migrations/009_install_intent_download_tokens.sql` — safe migration for repeated install download authorization.
- `apps/api/tests/platform.test.ts` — A/B assistant desktop identity regression.
- `apps/api/src/services/desktop-builder.ts` — passes assistant icon to packaging assets and uses safe package name.
- `scripts/generate-desktop-assets.cjs` — generates assistant-key-influenced icon artwork.
- `apps/desktop/src/main.ts` — 64px bubble, compact chat on click, per-assistant protocol parsing.

### Explicitly not verified yet

| Required proof | Status | Reason |
| --- | --- | --- |
| Create Assistant A and B through the browser | Implemented but unverified | Browser E2E not executed. |
| Download two current assistant-specific installers | Verified | Local packager produced two current assistant-specific NSIS installers with distinct filenames, manifests, sizes, and hashes. |
| Install A and B as Windows apps with their own shortcuts/uninstall entries | Implemented but unverified | Manual Windows installer execution not completed. |
| Run A and B simultaneously as separate bubbles | Implemented but unverified | Manual runtime test not completed. |
| Desktop A message persists and appears in website A history | Implemented but unverified | Installed desktop chat E2E not executed. |
| PostgreSQL restart persistence | Implemented but unverified | `TEST_DATABASE_URL` not configured during this pass. |

## 1. Executive outcome

| Gate | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| PostgreSQL production runtime | Implemented but unverified | `apps/api/src/db/postgres-platform.ts`, `db/migrations/005_six_features_foundation.sql`, and `apps/api/src/app.ts` implement PostgreSQL platform storage and fail closed in production without `DATABASE_URL`. | No local `TEST_DATABASE_URL` or live PostgreSQL service was available; database tests were skipped. |
| Real desktop runtime | Verified | `apps/desktop` builds with TypeScript and `npx electron-builder --win --publish=never` generated a Windows NSIS installer. | Installed-app manual/E2E verification was not run. |
| Real vertical-slice desktop invoice workflow | Implemented but unverified | Desktop runtime contains approved-folder watcher, invoice extraction, approval preview, CSV append, processed move, backend audit reporting, and undo conflict checks. | Needs a running installed desktop E2E test on real temporary local files. |
| Production preparation | Implemented but unverified | Lint, type-check, tests, web/API/desktop builds, and installer generation pass locally; desktop build endpoint and Redis/BullMQ worker code are implemented. | Custom domain, code-signing certs, OAuth callbacks, storage, and deployment secrets remain external requirements. |

## 2. Architecture implemented

| Component | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| PostgreSQL platform repository adapter | Implemented but unverified | `PostgresPlatformStore` maps workflows, runs, approvals, grants, audit, undo, memories, settings, packages, versions, licenses, entitlements, bootstrap tokens, devices, sessions, desktop builds, and installer downloads to PostgreSQL tables. | Requires live PostgreSQL verification. |
| Migration 005 | Implemented but unverified | `db/migrations/005_six_features_foundation.sql` adds safe `create table if not exists`, `alter table ... add column if not exists`, indexes, foreign keys, uniqueness constraints, tenant-scoped columns, expiration fields, and RLS policies. | Requires applying against a real existing database. |
| JSON-to-PostgreSQL import | Implemented but unverified | `npm run import:platform-json -w @archmind/api` imports existing JSON platform data when present. | Not run against a live PostgreSQL target locally. |
| MemoryStore containment | Verified | API tests verify production app creation fails when production platform data would silently use memory storage. | Core legacy app data still has existing repo architecture outside the six-feature platform store. |
| Redis/BullMQ desktop build queue | Implemented but unverified | `apps/api/src/services/desktop-build-queue.ts` enqueues desktop build jobs, `apps/api/src/worker.ts` starts a BullMQ worker, and production fails without Redis. | No live `REDIS_URL` was available for queue/worker proof. |
| Website install surface | Verified | `apps/web/components/deploy-client.tsx` exposes Install Assistant, Rebuild Installer, build polling, protected download, installer metadata, and device revocation UI. `npm run build` passed. | Browser-level click-through was not run. |
| Electron desktop runtime | Verified | `npm run typecheck -w @archmind/desktop`, `npm run build -w @archmind/desktop`, and `npx electron-builder --win --publish=never` passed. | Runtime install/login/workflow E2E was not run. |

## 3. Complete user journeys

| Journey | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Create assistant on website | Verified | Existing API/web assistant flows pass in `npm test` and `npm run build`. | None identified in this pass. |
| Configure assistant identity and instructions | Verified | API tests cover assistant create/edit/duplicate/delete and assistant-specific chat routing. | None identified in this pass. |
| Create zero-code workflow | Verified | `apps/api/tests/platform.test.ts` verifies workflow creation, versioning, activation, run creation, and audit chain behavior. | Live PostgreSQL version remains unverified. |
| Click Install Assistant | Implemented but unverified | Deploy page now calls `/api/platform/desktop/builds`, polls build status, and downloads through authorized blob fetch. | Needs browser E2E against a running API. |
| Backend verifies ownership and entitlement before build | Verified | Platform tests verify build request succeeds for owner and rejects cross-user assistant access. | Package entitlement build path needs live package marketplace test coverage. |
| BullMQ build states from queued to ready | Implemented but unverified | Build job code updates `queued`, `building`, `packaging`, `validating_artifact`, `ready`, and `failed`. | No live Redis worker run was available. |
| Assistant-specific installer download | Implemented but unverified | Build records include assistant-specific product name, app ID, protocol, assistant version, architecture, branding hash, size, checksum, and protected download token. | API-to-artifact end-to-end build was not run with live worker. |
| Install and bootstrap desktop app | Implemented but unverified | Desktop bootstrap exchange is implemented and API tests verify bootstrap token single-use behavior. | Actual installed app bootstrap was not run. |
| Desktop chat and local folder actions | Implemented but unverified | Desktop runtime has chat window, approved-folder selection, watcher, local file operations, approval dialog, audit reporting, and undo. | Needs installed runtime E2E. |
| Trust Center device revoke | Implemented but unverified | Deploy page lists devices and calls revoke endpoint; API tests verify revocation behavior. | Needs browser + desktop session E2E. |

## 4. Feature-by-feature status

| Capability | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Production PostgreSQL | Implemented but unverified | PostgreSQL adapter, migration 005, import tool, and fail-closed production guard are present. | No live PostgreSQL verification. |
| Redis/BullMQ | Implemented but unverified | Queue and worker implementation added for desktop builds; production requires Redis. | No live Redis verification. |
| Zero-code workflow | Verified | API platform tests verify workflow lifecycle and run records. | Live PostgreSQL path unverified. |
| Trust and approvals | Verified | API tests verify approval-required execution and denial prevents modification. | Desktop approval UI E2E unverified. |
| Audit and undo | Verified | API tests verify append-only audit chain and safe undo behavior for server-side local action execution. | Desktop undo E2E unverified. |
| Local actions | Verified | API tests operate on real temporary local files for granted-folder action and undo. | Desktop watcher/action E2E unverified. |
| Personal memory | Verified | API tests verify memory isolation across users. | PostgreSQL-backed memory path skipped without database. |
| Packaging | Verified | Electron builder generated `apps/desktop/out/ArchMind Desktop Setup.exe`. | Code signing blocked by missing certificate. |
| Licensing | Verified | API tests verify package publishing safety and free entitlement grant. | Paid checkout credentials unavailable. |
| Install Assistant button | Implemented but unverified | Deploy UI implementation and production web build passed. | Browser E2E not run. |
| Per-assistant installer | Implemented but unverified | API build records and manifest staging support per-assistant identity. | Worker-generated per-assistant artifact not run through live Redis. |
| Secure bootstrap | Verified | API tests verify single-use bootstrap exchange and revoked device behavior. | Installed desktop exchange unverified. |
| Installed desktop app | Implemented but unverified | Runtime and installer build successfully. | Actual install/open/login workflow not run. |
| Invoice workflow | Implemented but unverified | Desktop code implements invoice watcher-to-CSV flow and undo safeguards. | Required E2E through desktop runtime remains. |
| Two-assistant coexistence | Implemented but unverified | Runtime uses per-assistant app ID, protocol, product name, shortcut/tray identity, and user-data directory. | Two installed branded assistants were not manually verified. |
| Custom-domain deployment | Blocked | Deployment requirements are documented in `.env.example` and this report. | Requires DNS, TLS, hosting, domain ownership, and environment secrets. |
| Code signing | Blocked | Installer generation works unsigned; electron-builder reported no signing info. | Requires Windows code-signing certificate and secrets. |

## 5. PostgreSQL verification

| Check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Real repository adapter exists | Implemented but unverified | `apps/api/src/db/postgres-platform.ts`. | Needs live database. |
| Migration 005 has tables/indexes/FKs/tenancy/expiration | Implemented but unverified | `db/migrations/005_six_features_foundation.sql`. | Needs migration apply test. |
| Production refuses MemoryStore fallback | Verified | `apps/api/tests/platform.test.ts` includes fail-closed production test; `npm test` passed. | None identified. |
| Persistence across API restart | Implemented but unverified | `apps/api/tests/postgres-platform.test.ts` creates records, reinstantiates store, and verifies retrieval when `TEST_DATABASE_URL` exists. | Test skipped locally because no `TEST_DATABASE_URL` was configured. |
| Cross-user and cross-assistant database isolation | Implemented but unverified | PostgreSQL isolation tests exist behind `TEST_DATABASE_URL`; memory-backed API isolation tests passed. | Needs database run. |

## 6. Queue/worker verification

| Check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Desktop build endpoint enabled | Verified | `POST /api/platform/desktop/builds`, `GET /api/platform/desktop/builds`, and `GET /api/platform/desktop/builds/:id` are covered by passing API tests. | Live worker artifact generation unverified. |
| Production Redis requirement | Implemented but unverified | Queue code throws `REDIS_REQUIRED` in production without Redis before issuing bootstrap. | Needs production-like Redis test. |
| BullMQ worker | Implemented but unverified | `apps/api/src/worker.ts` registers `DESKTOP_BUILD_QUEUE` worker. | No live Redis worker was run. |
| Build state machine | Implemented but unverified | Job processor transitions through building, packaging, validating artifact, ready, and failed states. | Needs live queue execution. |

## 7. Website verification

| Check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Deploy page has Install Assistant | Verified | `npm run build` includes `/assistants/[id]/deploy`; lint and type-check pass. | Browser E2E not run. |
| Protected installer download client | Implemented but unverified | `apps/web/lib/data-client.ts` adds authorized blob download; deploy UI uses it for installer downloads. | Browser E2E not run. |
| Device revocation UI | Implemented but unverified | Deploy UI lists assistant devices and calls `DELETE /api/platform/devices/:id`. | Browser E2E not run. |
| Companion modal no longer says coming soon | Verified | `apps/web/components/download-companion-modal.tsx` links users to the assistant deploy/install page. | None identified. |

## 8. Desktop verification

| Check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Windows first platform | Verified | `npx electron-builder --win --publish=never` generated a Windows NSIS setup executable. | Manual Windows install test not run. |
| Assistant-specific identity | Implemented but unverified | Build service stages assistant-specific manifest fields and app identity; desktop runtime reads manifest. | Need per-assistant artifact run through worker. |
| Secure long-term session storage | Implemented but unverified | Desktop runtime uses Electron `safeStorage` when available. | Need installed runtime verification. |
| Device registration/revocation | Verified | API tests cover bootstrap exchange and revocation. | Desktop revoked-session E2E unverified. |
| Full, compact, floating-bubble, tray modes | Implemented but unverified | Desktop runtime implements these modes. | Manual runtime UI verification not run. |
| Native folder selection and canonical path enforcement | Implemented but unverified | Electron dialog and realpath containment checks are implemented. | Desktop E2E not run. |
| Folder watcher and local file actions | Implemented but unverified | Desktop runtime uses real watcher and file operations. | Desktop E2E not run. |
| Notifications, launch at login, global shortcut, clipboard/selected-text/screen permissions | Implemented but unverified | Runtime hooks exist for these desktop capabilities. | Manual OS-level verification not run. |

## 9. Installer verification

| Check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Real Windows installer artifact | Verified | `apps/desktop/out/ArchMind Desktop Setup.exe` generated by electron-builder. | None for unsigned artifact generation. |
| Installer header | Verified | Header read from artifact is `MZ`. | None identified. |
| Installer size | Verified | Artifact size is `81664520` bytes. | None identified. |
| Installer checksum | Verified | SHA-256 is `5FB159CA19AA5EAFC30752B141067F97BB34D8EE7739F252996994CFDC841BD2`. | None identified. |
| Protected installer download validation | Implemented but unverified | API validates build ownership, status, token, artifact path, size, checksum, and headers before download. | Needs live ready build download. |
| Code signing | Blocked | electron-builder generated unsigned installer and reported no signing info. | Requires certificate and signing secrets. |

## 10. Invoice workflow verification

| Required proof | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Workflow operates on real temporary local files | Verified | API local-action tests use real temp files for folder grant/action/undo. | Desktop invoice watcher E2E unverified. |
| Access outside approved folder is rejected | Verified | API tests verify canonical grant enforcement for local actions. | Desktop E2E unverified. |
| Denied approval prevents modification | Verified | API tests verify approval denial blocks execution. | Desktop approval dialog E2E unverified. |
| Revoked device cannot continue | Verified | API tests verify revoked device behavior. | Desktop revoked-session E2E unverified. |
| Duplicate file events do not produce duplicate rows | Implemented but unverified | Desktop runtime has duplicate-event suppression. | Desktop watcher E2E unverified. |
| Undo does not overwrite newer user changes | Verified | API undo test verifies safe undo conflict behavior for local action state. | Desktop CSV undo E2E unverified. |
| Audit record survives API restart | Implemented but unverified | PostgreSQL restart test exists behind `TEST_DATABASE_URL`. | Live PostgreSQL unavailable. |

## 11. Two-assistant isolation verification

| Isolation area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| User A cannot access User B workflows | Verified | API tests verify cross-user workflow access is rejected. | PostgreSQL-backed version skipped without database. |
| User A cannot access User B memories | Verified | API tests verify memory isolation across users. | PostgreSQL-backed version skipped without database. |
| User A cannot access User B desktop builds | Verified | API tests verify another user receives 404 for a build and cannot request a build for another user's assistant. | Live database version unverified. |
| User A cannot access User B installer | Implemented but unverified | Download endpoint checks owner, token, and build readiness. | Needs live ready artifact download test. |
| Two differently branded assistants coexist | Implemented but unverified | Runtime/build identity fields are assistant-scoped. | Need two installed assistant artifacts on Windows. |

## 12. Security controls

| Control | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Single-use bootstrap exchange | Verified | API tests cover successful exchange and rejected reuse. | Desktop exchange E2E unverified. |
| Expiring download token | Implemented but unverified | Installer download records store hashed token, expiry, and downloaded timestamp. | Live ready download E2E unverified. |
| Path traversal and symlink protection | Implemented but unverified | Desktop runtime and API services use canonical path checks and containment rules. | Desktop E2E unverified. |
| Installer path escape guard | Implemented but unverified | Desktop builder validates artifact path remains inside package output. | API worker artifact path not run live. |
| Installer header/size/checksum validation | Verified | Generated artifact has `MZ` header, expected size range, and recorded SHA-256. | Protected API download of ready artifact unverified. |
| Forbidden private package fields | Verified | API tests verify package publish rejects nested private data. | None identified. |

## 13. Tests and commands

| Command | Status | Result |
| --- | --- | --- |
| `npm test` | Verified | Passed: 41 tests, 2 skipped PostgreSQL tests requiring `TEST_DATABASE_URL`. |
| `npm run typecheck` | Verified | Passed for shared, API, web, and desktop. |
| `npm run lint` | Verified | Passed with no ESLint warnings or errors. |
| `npm run build` | Verified | Passed for shared, API, Next.js production web build, and desktop TypeScript build. |
| `npx electron-builder --win --publish=never` in `apps/desktop` | Verified | Passed and produced a Windows NSIS setup executable. |

## 14. Artifact information

| Artifact | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Windows setup executable | Verified | `D:\New project 2\apps\desktop\out\ArchMind Desktop Setup.exe`. | Code signing unavailable. |
| Size | Verified | `81664520` bytes. | None identified. |
| Header | Verified | `MZ`. | None identified. |
| SHA-256 | Verified | `5FB159CA19AA5EAFC30752B141067F97BB34D8EE7739F252996994CFDC841BD2`. | None identified. |
| Electron-builder workspace safety | Verified | `apps/desktop/package.json` sets `npmRebuild: false`; installer run skipped dependency rebuild and preserved root dev tooling. | None identified. |

## 15. Deployment readiness

| Area | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| API build | Verified | `npm run build` passed API TypeScript build. | None identified. |
| Web build | Verified | `npm run build` passed Next.js production build. | None identified. |
| Desktop build | Verified | Desktop TypeScript build and Windows installer generation passed. | Code signing unavailable. |
| Production database config | Implemented but unverified | Production fails closed without PostgreSQL. | Needs real `DATABASE_URL`, migrations applied, and restart proof. |
| Production Redis config | Implemented but unverified | Production build endpoint and worker require Redis. | Needs real `REDIS_URL` and worker smoke test. |
| Custom `.com` domain | Blocked | Repo cannot prove DNS/TLS/domain ownership locally. | Requires external hosting and DNS setup. |

## 16. External credentials required

| Requirement | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| PostgreSQL database | Verified | Local PostgreSQL is running and migration replay/persistence were verified. | Production database access is still required for deployment. |
| Redis | Verified | Local Redis/BullMQ build worker was exercised. | Production Redis deployment is still required. |
| Windows code-signing certificate | Blocked | electron-builder reported no signing info. | Provide certificate, password, and signing configuration. |
| Custom domain DNS/TLS | Blocked | No domain ownership or hosting target was provided. | Configure DNS, TLS, and hosting provider records. |
| OAuth callbacks | Blocked | External OAuth provider credentials were unavailable. | Configure callback URLs and provider secrets. |
| Object/file storage | Blocked | No production storage credentials were provided. | Configure storage bucket, access keys, and retention policy. |
| Paid checkout | Blocked | Licensing/free entitlement is implemented; paid checkout needs provider secrets. | Configure Stripe or equivalent payment credentials. |

## 17. Remaining blockers

| Blocker | Status | Evidence | Required next proof |
| --- | --- | --- | --- |
| Live PostgreSQL persistence | Implemented but unverified | Tests exist but skipped without `TEST_DATABASE_URL`. | Run migrations, create records, restart API/store, retrieve same records, verify cross-user isolation. |
| Live Redis/BullMQ worker | Implemented but unverified | Queue and worker code exist. | Run API + worker + Redis and observe build state to `ready`. |
| Installed desktop invoice workflow | Implemented but unverified | Desktop runtime code exists. | Run installed app against real temp folder and verify invoice-to-CSV-to-processed-to-audit-to-undo flow. |
| Per-assistant installer through backend | Implemented but unverified | Build endpoint, queue, builder, manifest staging, and protected download exist. | Request build through web/API, worker builds artifact, protected download succeeds. |
| Code signing | Blocked | Installer generation is unsigned. | Sign installer with production certificate and verify signature. |
| Custom domain deployment | Blocked | Local build is verified only. | Deploy API/web/worker with DNS/TLS and verify `.com` routing. |

## 18. Exact manual checks

| Manual check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Install generated Windows setup executable | Implemented but unverified | Installer artifact exists. | Run on Windows desktop and confirm installed app opens. |
| Bootstrap from website installer | Implemented but unverified | Secure bootstrap is implemented and API-tested. | Download protected installer from deploy page and confirm single-use exchange. |
| Verify credential-protected session survives restart | Implemented but unverified | Desktop uses secure storage. | Restart app and confirm session remains valid; revoke device and confirm it stops. |
| Verify four desktop modes | Implemented but unverified | Runtime implements modes. | Switch full, compact, bubble, and tray modes manually. |
| Verify approved-folder workflow | Implemented but unverified | Runtime implements folder watcher and invoice flow. | Run invoice scenario with real local files. |
| Verify two assistants installed simultaneously | Implemented but unverified | Per-assistant identity fields exist. | Install two differently branded assistants and confirm no app ID, protocol, shortcut, tray, or user-data collisions. |

## 19. Publication checklist

| Publication item | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Commit source changes | Not implemented | Worktree remains dirty and was not staged or committed in this pass. | User direction required before staging because unrelated existing changes are present. |
| Run database migrations in production | Blocked | Migration exists. | Requires production database access. |
| Start production worker | Blocked | Worker exists. | Requires Redis and deployment environment. |
| Publish signed desktop installer | Blocked | Unsigned installer generation is verified. | Requires code-signing certificate and release channel. |
| Publish custom-domain web/API | Blocked | Production web/API builds pass. | Requires DNS/TLS/hosting/secrets. |
| Mark six features production-ready | Not implemented | This report intentionally does not mark the project production-ready. | Requires all live PostgreSQL, Redis, desktop E2E, installer signing, and deployment checks to pass. |

## 20. Installation-page investigation (2026-07-13)

| Observed failure | Status | Root cause and evidence | Resolution / remaining blocker |
| --- | --- | --- | --- |
| `GET /api/assistants` returns 401 | Verified | The running API returned a controlled 401 only when no bearer credential was supplied. A disposable authenticated development account returned 200 from the same route. The web client had independent file-download authentication, and simultaneous 401s could each initiate refresh/redirect work. | `apps/web/lib/data-client.ts` now centralizes bearer-header creation, `credentials: include`, single-flight refresh, one retry, and one sign-in redirect for data and file requests. Browser login with a live Firebase identity remains Implemented but unverified. |
| `GET /api/analytics/overview` returns 401 | Verified | The same authenticated development account returned 200; unauthenticated calls are correctly protected. | Uses the centralized web client path. Browser login/session recovery remains Implemented but unverified. |
| `GET /api/platform/devices` returns 500 | Verified | The historical valid-bearer failure was caused by PostgreSQL `ECONNREFUSED`, which the former handler collapsed to a generic 500. | With the local container running, the endpoint returns authenticated device data; unavailable storage returns structured `503 PLATFORM_STORE_UNAVAILABLE` with a correlation ID. |
| `GET /api/platform/desktop/builds` returns 500 | Verified | The historical valid-bearer failure was the same unavailable PostgreSQL platform-store read. | With migrations through 007 applied locally, the endpoint reads persisted builds; unavailable storage remains a structured 503. |
| `POST /api/platform/desktop/builds` returns 500 | Verified | Reproduced with a valid bearer token and an owned assistant. The first platform-state read failed because PostgreSQL was unreachable. | The route now requires an idempotency key and returns structured store/worker errors rather than hiding them. Real build completion remains Implemented but unverified until PostgreSQL and Redis worker are available. |
| Duplicate install requests and failure notifications | Verified | The page previously polled via an effect keyed to the complete build array and created a fresh toast on each failed call; the endpoint did not consume an idempotency key. | The page now has an in-flight request guard, an idempotency key, one cancellable polling timer, bounded retry only for retryable errors, and keyed/updatable failure toasts. API tests verify duplicate build requests return the same build. Browser Strict Mode behavior is Implemented but unverified. |
| Share/embed controls on install page | Verified | `deploy-client.tsx` contained assistant URL, iframe text, clipboard state/handlers, Copy link, and Open assistant controls. | Removed from the install page. The page now presents only assistant identity, Windows build/install state, download, device management, and instructions. |

| Current check | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Authenticated assistant and analytics API calls | Verified | Disposable authenticated development account received 200 from both endpoints. | Browser Firebase session exchange not manually exercised in this pass. |
| Unavailable PostgreSQL error contract | Verified | Valid authenticated platform requests reproduced the current connection refusal; API test verifies the code returns `503 PLATFORM_STORE_UNAVAILABLE`, a correlation ID, and `retryable: true`. | Restart the running API to load this source change, then start/reconnect PostgreSQL. |
| Build idempotency | Verified | Sequential live requests reused one build, and the PostgreSQL integration suite now proves concurrent requests atomically return one canonical build. | None for local database proof. |
| Real installer after website click | Implemented but unverified | Existing verified artifact: `apps/desktop/out/ArchMind Desktop Setup.exe`, size `81664520`, SHA-256 `5FB159CA19AA5EAFC30752B141067F97BB34D8EE7739F252996994CFDC841BD2`. | PostgreSQL is currently unreachable and Redis/worker E2E is not available; no live assistant-specific website download or installed-app bootstrap was claimed. |

| `npm run typecheck` | Verified | Passed for shared, API, web, and desktop after the installation-page changes. | None identified. |
| `npm run lint` | Verified | Passed with no warnings or errors after the installation-page changes. | None identified. |
| `npm run build -w @archmind/web` | Verified | Production Next.js build passed and includes `/assistants/[id]/deploy`. | API/shared/desktop builds passed earlier in the continuation; the combined build command timed out while Next.js was building, then the web build was rerun successfully on its own. |
| `npm test` | Verified | 41 passed, 2 PostgreSQL tests skipped because `TEST_DATABASE_URL` is not configured. | Live PostgreSQL restart/isolation proof remains unavailable. |

## 21. Local production-runtime evidence (2026-07-14)

This section supersedes earlier statements that local PostgreSQL or Redis were unavailable. It does not mark ArchMind or the six features production-ready.

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| PostgreSQL migrations | Verified | Local Docker PostgreSQL accepted migrations `001` through `007`; `schema_migrations` contains all seven and rerunning the migration runner completed without changes. | Production migration execution still requires production database access. |
| PostgreSQL persistence and isolation | Verified | `TEST_DATABASE_URL=postgres://archmind:archmind@localhost:5432/archmind_test npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` passed 2 tests. It persisted platform data across a new store instance and rejected cross-tenant access. | Core legacy user/assistant records remain separately bridged from the existing store. |
| PostgreSQL API restart persistence | Verified | A ready build `540b8465-a19a-475a-bab6-0204bde8fda3` was read, the API was restarted, and the same owner retrieved the same `ready` record and SHA-256 with PostgreSQL and Redis health true. | None for the local proof. |
| Redis/BullMQ worker | Verified | Local Redis accepted `PING`; the worker consumed a live queued build and transitioned it to `ready`. | Production worker deployment remains environment-specific. |
| Idempotent desktop build request | Verified | Two live owner requests with the same idempotency key returned build `540b8465-a19a-475a-bab6-0204bde8fda3`; only one BullMQ build ran. The route now issues a bootstrap only after a new build is created. | The focused regression suite was resource-constrained before its final completion. |
| Per-assistant Windows installer | Verified | The worker generated `D:\New project 2\.archmind-data\desktop-builds\540b8465-a19a-475a-bab6-0204bde8fda3\out\ArchMind Invoice E2E Setup.exe`, 81,664,737 bytes, header `MZ`, SHA-256 `52d597d3113085c58891de031447bc4a504383f461392d5698bd68602785fca3`. | Installer is unsigned; signing is Blocked pending a certificate. |
| Protected installer download | Verified | An unrelated owner received `404` for download authorization. The owner downloaded 81,664,737 bytes through the protected endpoint; headers, `MZ`, and SHA-256 matched the build record. | Browser click-through remains Implemented but unverified. |
| Secure bootstrap and revocation | Verified | Live bootstrap exchange succeeded; replay returned `401`; revoking the registered device caused its desktop session to return `401`. | Installed-app bootstrap is Implemented but unverified. |
| Desktop runtime and invoice vertical slice | Implemented but unverified | Electron source provides assistant-specific manifest identity, Windows credential-backed storage when available, approved-folder dialog, canonical-path and symlink checks, watcher, invoice preview/approval, CSV append, move, audit, notification, and conflict-safe undo. | Requires a manually observed installed Windows app run using temporary files, denial, duplicate events, outside-folder rejection, undo conflict, and two branded installers. |
| Code signing and custom `.com` deployment | Blocked | Neither a Windows signing certificate nor custom-domain DNS/TLS, hosting, OAuth, storage, and production secrets are in the workspace. | Provide those external credentials and deployment access. |

| Verification command | Status | Result |
| --- | --- | --- |
| PostgreSQL integration tests | Verified | 3 passed against `archmind_test`, including concurrent desktop-build idempotency. |
| API migration runner | Verified | Applied and reran migrations `001`–`007` on local PostgreSQL. |
| Live worker build | Verified | BullMQ produced the assistant-specific NSIS installer and stored its verified metadata in PostgreSQL. |
| API restart check | Verified | Same protected build record survived a real API restart. |
| Focused API regression suite after bootstrap ordering fix | Implemented but unverified | Host pagefile pressure caused the test process to exceed the command window; source-level regression assertion was added. |

## 22. Current installer and installed-runtime evidence (2026-07-14)

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Current worker-built installer | Verified | Build `ccdfa7c5-f118-437d-8ba7-dfcf64c2e052` for assistant `44000c70-5854-4f9e-831f-22ce1a702a78` reached `ready` through local Redis/BullMQ. It was created at `2026-07-14T14:59:38.588Z`, uses runtime `33.2.0`/assistant version `1`, and produced `D:\New project 2\.archmind-data\desktop-builds\ccdfa7c5-f118-437d-8ba7-dfcf64c2e052\out\ArchMind Invoice E2E Setup.exe`. |
| Artifact integrity | Verified | `ArchMind Invoice E2E Setup.exe` is 81,665,160 bytes, begins with `MZ`, and has SHA-256 `918bf4263bd90411b2e98ba39d5a7689284a844a96a4ff2a7e7e3692dee30dc8`. |
| Protected owner download | Verified | The owner downloaded the final installer through `download-authorization` and the protected HTTP endpoint; the response was `200` and the downloaded executable was used for installation. Earlier live checks returned `404` to another user. Browser click-through remains Implemented but unverified. |
| Windows installation | Verified | The protected downloaded installer exited `0` and installed `D:\ArchMindE2ETest3\ArchMind Invoice E2E.exe`; the product name, app ID `com.archmind.archmind-invoice-e2e-44000c70-5854-4f9e-831f-22ce1a702a78`, and Start Menu identity are assistant-specific. |
| Installed bootstrap/device registration | Verified | Launching the installed executable wrote `C:\Users\AL-FAGR\AppData\Roaming\ArchMind\com.archmind.archmind-invoice-e2e-44000c70-5854-4f9e-831f-22ce1a702a78\runtime-state.json` with `active` and registered device `4b60330f-18b2-41ae-8b90-0d79b4981616`. |
| Protected session restart | Verified | `credentials.enc` exists under the assistant-specific user-data directory, does not contain the plaintext `sessionToken` marker, and a subsequent launch reported `active` with the same device still active. |
| Bootstrap timing | Verified | Bootstrap issuance moved from the build-request route into the worker immediately before packaging; its one-time expiry is 30 minutes. This prevents a build-duration expiry from being baked into an otherwise valid installer. |
| Desktop startup hardening | Verified | User-data identity is configured before Electron `ready`; startup errors terminate deterministically; the tray now uses an in-memory assistant-colored SVG rather than treating the executable as an image. |
| Installed invoice watcher, native folder approval, CSV write, move, audit, undo | Implemented but unverified | Code and API tests cover watcher, path checks, approval, real local action/undo, audit, and denial. This environment cannot drive or observe the native folder picker and approval dialog, so the installed GUI sequence has not been observed. |
| Installed desktop reaction to a live device revocation | Implemented but unverified | Backend bootstrap replay and revoked-session checks returned `401`; the installed app polls the session every 30 seconds. A GUI observation of its revoked status and blocked local action remains required. |

| Current source changes | Status | Why |
| --- | --- | --- |
| `apps/api/src/db/platform-store.ts`, `apps/api/src/db/postgres-platform.ts`, `apps/api/src/services/platform-service.ts`, `db/migrations/007_desktop_build_identity_versions.sql`, `apps/api/tests/postgres-platform.test.ts` | Verified | Adds PostgreSQL-atomic desktop build creation and canonical idempotent reuse; removes invalid one-build-ever identity constraints while retaining owner/idempotency uniqueness. Real PostgreSQL concurrency test passed. |
| `apps/api/src/modules/platform.ts`, `apps/api/src/services/desktop-build-queue.ts`, `apps/api/tests/platform.test.ts` | Verified | Preserves MemoryStore test ownership checks and moves one-time bootstrap minting into the worker immediately before packaging. Focused API route test passed. |
| `apps/desktop/src/main.ts` | Verified | Explicit permission prompt, pre-ready assistant user-data configuration, valid tray icon, non-secret runtime state, and deterministic startup failure handling. Current installer installation, launch, bootstrap, and restart were executed. |

| Current automated verification | Status | Result |
| --- | --- | --- |
| `npm.cmd test` | Verified | 41 passed and 3 PostgreSQL tests skipped when `TEST_DATABASE_URL` was not present in the shell environment. |
| `npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` with local Docker `archmind_test` | Verified | 3 PostgreSQL tests passed: persistence across repository restart, tenant isolation, and concurrent desktop-build idempotency. |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed after PostgreSQL atomic build and worker-bootstrap changes. |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed after installed-runtime fixes. |
| `git diff --check` (ArchMind-scoped files) | Verified | No whitespace errors. |

## 23. Bubble installer and applied desktop runtime evidence (2026-07-14)

This section supersedes earlier installed-runtime evidence for the latest desktop source state. It does not mark the six-feature project production-ready.

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Bubble-mode desktop source | Verified | `apps/desktop/src/main.ts` now defaults first launch to `bubble`, persists mode in `desktop-state.json`, renders human-readable secure-session/folder status instead of raw JSON, and keeps explicit controls for folder approval, undo, launch-at-login, bubble, compact, full, and tray. | None for source-level bubble behavior. |
| Revoked-session local state | Implemented but unverified | The desktop runtime now writes `runtime-state.json` with `revoked` when the API returns `401` or `403`, and shows a desktop notification when supported. | Needs a live installed-app observation after revoking the current device. |
| Current worker-built Bubble installer | Verified | Authenticated local API user `fc4a5d09-deb9-4c78-a46c-5c0c8e5f536d` created assistant `e1621fe6-6b73-4b58-adda-834f6620084e`; BullMQ build `751ece6d-4037-4fb1-82c9-3b91b4a974bf` reached `ready` and produced `D:\New project 2\.archmind-data\desktop-builds\751ece6d-4037-4fb1-82c9-3b91b4a974bf\out\ArchMind Bubble Invoice Setup.exe`. | Installer remains unsigned until a Windows signing certificate is provided. |
| Protected Bubble installer download | Verified | Protected owner download produced `D:\New project 2\.archmind-data\bubble-downloads\ArchMind Bubble Invoice Setup.exe`, 81,666,136 bytes, header `MZ`, SHA-256 `f035bcdbd3c527f180b401a9c874245babd390b846eb5bbb4dd7a3cb9a2b1547`, matching the PostgreSQL build record. | Browser click-through remains Implemented but unverified. |
| Installed Bubble app | Verified | The verified installer exited `0` and installed `D:\ArchMindBubbleTest\ArchMind Bubble Invoice.exe`; the launched process wrote active runtime state under `C:\Users\AL-FAGR\AppData\Roaming\ArchMind\com.archmind.archmind-bubble-invoice-e1621fe6-6b73-4b58-adda-834f6620084e`. | None for local install/launch/bootstrap proof. |
| Bubble mode applied after install | Verified | Installed app persisted `desktop-state.json` with `"mode": "bubble"` at `2026-07-14T15:25:22.766Z`; the assistant process is running from `D:\ArchMindBubbleTest\ArchMind Bubble Invoice.exe`. | Visual inspection of the window is still manual. |
| Secure session storage | Verified | `credentials.enc` exists in the assistant-specific user-data directory, is 246 bytes, and does not contain the plaintext `sessionToken` marker. Backend device `d23c2509-3a2c-4b5b-9c59-4aeb7256a671` is registered for the Bubble assistant. | None for local credential-file proof. |
| Installed invoice workflow through native dialogs | Implemented but unverified | The runtime code covers native approved-folder selection, folder watcher, path enforcement, invoice preview approval, CSV append, move-to-processed, audit, notification, and undo. | Requires human or UI-automation confirmation of the folder picker and approval dialog using temporary files. |
| Two branded assistants coexisting | Implemented but unverified | `ArchMind Invoice E2E` and `ArchMind Bubble Invoice` have distinct app IDs, protocols, install directories, and user-data directories. Both were installed on this Windows machine. | A visual tray/shortcut collision check remains manual. |
| Code signing and custom `.com` deployment | Blocked | Local unsigned installer generation, protected download, install, and launch are verified; no signing certificate, DNS/TLS, hosting target, OAuth callback credentials, production storage, or payment secrets were provided. | Provide external credentials and deployment access. |

| Verification command | Status | Result |
| --- | --- | --- |
| `npm.cmd run typecheck` | Verified | Passed for shared, API, web, and desktop after the Bubble runtime changes. |
| `npm.cmd run lint` | Verified | Passed with no warnings or errors. |
| `npm.cmd test` | Verified | 41 passed; PostgreSQL tests were skipped only because the shell lacked `TEST_DATABASE_URL`. |
| `npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` with local Docker `archmind_test` | Verified | 3 passed. |
| `npm.cmd run build` | Verified | Passed for shared, API, production web, and desktop. |

## 24. Assistant chat desktop app evidence (2026-07-14)

This section supersedes the earlier desktop Bubble UI evidence. The installed app is now a one-chat assistant app first, with local folder automation controls secondary.

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Separate assistant-named desktop app | Verified | `ArchMind Bubble Invoice` is installed at `D:\ArchMindBubbleTest\ArchMind Bubble Invoice.exe` with assistant-specific app ID `com.archmind.archmind-bubble-invoice-e1621fe6-6b73-4b58-adda-834f6620084e` and user-data directory under `C:\Users\AL-FAGR\AppData\Roaming\ArchMind\com.archmind.archmind-bubble-invoice-e1621fe6-6b73-4b58-adda-834f6620084e`. | None for local installed identity proof. |
| Desktop opens as chat app | Verified | `apps/desktop/src/main.ts` now loads `renderChat()` rather than the setup/control renderer. The default view is assistant name, connected state, one message thread, and one message composer; folder and undo controls are secondary. | Visual polish can still be refined after user feedback. |
| Bubble launch behavior | Verified | Final installed launch wrote `desktop-state.json` with `"mode": "bubble"` and active `runtime-state.json`; source now converts saved `tray` mode back to `bubble` on a new app launch. | None for local launch proof. |
| Device-authenticated desktop chat endpoint | Verified | Added `/api/platform/desktop/chat`; a fresh bootstrap exchange produced a desktop session and `POST /api/platform/desktop/chat` returned conversation `5efbaba5-ea7a-4927-9b8c-ba1e0168a1c4` with answer `Hello.`. | None for local endpoint proof. |
| Final protected installer | Verified | Build `7b01c4cf-28ec-45f4-bb02-a83c8ee37d18` reached `ready`; protected download produced `D:\New project 2\.archmind-data\chat-final-downloads\ArchMind Bubble Invoice Final Chat Setup.exe`, 81,667,598 bytes, `MZ` header, SHA-256 `5d6ba5b1a9c6747363900a93c0373c09a1fd57b83d942cffb825be678bff75d8`, matching the PostgreSQL build record. | Installer remains unsigned until code-signing credentials are provided. |
| Final install and launch | Verified | The final installer exited `0`, installed over `D:\ArchMindBubbleTest`, launched PID `19012`, and the app remained running. | None for local install/launch proof. |
| Installed invoice workflow through native dialogs | Implemented but unverified | The chat app still includes approved-folder selection, watcher, invoice preview, approval, CSV append, processed move, audit, and undo code. | Requires observed native folder picker and invoice approval workflow with temporary files. |

| Verification command | Status | Result |
| --- | --- | --- |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed after adding the device-authenticated desktop chat route. |
| `npm.cmd run build -w @archmind/api` | Verified | Passed after adding the desktop chat route and clean invalid-session guard. |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed after replacing the default desktop renderer with the chat app. |
| `npm.cmd run build -w @archmind/desktop` | Verified | Passed after replacing the default desktop renderer with the chat app. |

## 25. Fast universal-runtime assistant install refactor (2026-07-15)

This section supersedes normal assistant installation behavior described in earlier sections. ArchMind is still not marked production-ready.

```text
Create assistant
      |
      v
Publish immutable assistant snapshot
      |
      v
Click Install -> fast install intent -> signed snapshot
      |                              |
      | runtime absent               | runtime present
      v                              v
download cached universal EXE     archmind:// secure claim
      |                              |
      v                              v
install + sign in/claim ----------> register assistant profile
                                     |
                                     v
                           branded desktop bubble
```

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Original bottleneck trace | Verified | The old normal path was `apps/web/components/deploy-client.tsx` -> `POST /api/platform/desktop/builds` -> `apps/api/src/services/desktop-build-queue.ts` -> `buildDesktopInstaller` -> `npx electron-builder --win --publish=never` in `apps/api/src/services/desktop-builder.ts`. That path compiles/packages Electron for an assistant request. | A fresh five-minute worker timing was not rerun because Docker Desktop was unavailable in this session. |
| Universal runtime artifact | Verified | Existing local runtime installer: `D:\New project 2\apps\desktop\out\ArchMind Desktop Setup.exe`, 81,664,520 bytes, SHA-256 `5FB159CA19AA5EAFC30752B141067F97BB34D8EE7739F252996994CFDC841BD2`, unsigned development artifact. | Production signing and CDN upload are Blocked. |
| Runtime release data model | Implemented but unverified | Migration `db/migrations/008_fast_assistant_install.sql` adds `desktop_runtime_releases` with version/platform/architecture/channel/status/artifact key/path/filename/MIME/size/SHA-256/signature status/API compatibility/schema timestamps and indexes. `PostgresPlatformStore` maps it. | Docker/PostgreSQL was not reachable in this session, so migration 008 was not applied locally. |
| Assistant snapshots | Verified | `PlatformService.createAssistantInstallIntent` creates immutable snapshot records with assistant/version/display name/icon digest/instruction digest/manifest digest/signature/key ID and no raw tokens. API test verifies signature exists. | Production asymmetric signing key management is Blocked. Current local signature uses development server-side HMAC. |
| Assistant install intents | Verified | `POST /api/platform/assistants/:assistantId/install-intents` creates/reuses a short-lived idempotent intent, binds owner/assistant/snapshot/runtime/platform/architecture, stores hashed claim/download secrets, and returns in milliseconds in the focused test. | Load p50/p95 under production traffic is Not implemented. |
| No per-assistant Electron build on normal install | Verified | API test `creates a fast signed assistant install intent without creating a desktop build` passed and asserts `desktopBuilds` stays empty after the install-intent request. | Browser E2E click was not executed in this session. |
| Protected universal runtime download | Verified | `GET /api/platform/install-intents/:intentId/runtime-download` validates owner + hashed token + runtime readiness and serves bytes with content type, length, disposition, ETag, runtime version, and SHA-256 headers. Focused API test downloads a cached artifact and verifies headers. | Range request support is Not implemented. CDN/object-storage signed URL support is Not implemented. |
| Already-installed protocol claim path | Implemented but unverified | Desktop main process parses `archmind://install-assistant?intent=...`, exchanges via `/api/platform/desktop/install-intents/claim`, stores credentials with Electron `safeStorage`, saves the signed snapshot, and opens bubble mode. | A live installed protocol-launch test was not run in this session. |
| Device-assistant binding model | Implemented but unverified | Migration 008 adds `device_assistants`; `claimAssistantInstallIntent` creates a device session and assistant binding for multiple assistants on one runtime. | PostgreSQL migration and two-assistant live claim were not rerun in this session. |
| Web install experience | Verified | `apps/web/components/deploy-client.tsx` now calls the fast install-intent endpoint, says “Preparing your assistant snapshot”, starts the cached runtime download, and states no per-assistant Electron build is started. `npm.cmd run lint -w @archmind/web` and `npm.cmd run typecheck -w @archmind/web` passed. | Runtime-present detection/custom-protocol fallback UI is Implemented but unverified. |
| Legacy build route separation | Implemented but unverified | Legacy `/api/platform/desktop/builds` and BullMQ worker remain available for historical/operator behavior, while the web normal Install button no longer calls them. | Explicit operator-only release command for publishing stable runtime releases is Not implemented. |
| Docker PostgreSQL/Redis verification this session | Blocked | `docker compose ps` failed: Docker config access denied and Docker engine pipe missing. | Start Docker Desktop, then rerun migrations and PostgreSQL integration tests. |
| Code signing and public `.com` deployment | Blocked | No Windows signing certificate, production manifest-signing key management, object storage/CDN credentials, DNS/TLS/domain access, or deployment secrets are present in the workspace. | Provide external credentials and deployment authorization. |

| Verification command | Status | Result |
| --- | --- | --- |
| `npm.cmd run typecheck -w @archmind/api` | Verified | Passed after adding runtime release, snapshot, install-intent, protected download, and claim APIs. |
| `npm.cmd run typecheck -w @archmind/web` | Verified | Passed after replacing the normal install button with fast install intent + cached runtime download. |
| `npm.cmd run typecheck -w @archmind/desktop` | Verified | Passed after adding protocol install-intent claim support. |
| `npm.cmd run lint -w @archmind/web` | Verified | Passed with no warnings or errors. |
| `npm.cmd test -w @archmind/api -- platform.test.ts` | Verified | 11 tests passed, including install-intent idempotency/download/no-desktop-build assertion. |
| `docker compose ps` | Blocked | Docker Desktop was not reachable: `failed to connect to the docker API at npipe:////./pipe/docker_engine`. |

## 26. Full rerun and PostgreSQL verification (2026-07-16)

This section updates the blocked Docker/PostgreSQL status from section 25. ArchMind is still not marked production-ready because public release blockers remain.

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Full root production build | Verified | `npm.cmd run build` passed for shared, API, production web, and desktop TypeScript build. Runtime: 283.2 seconds. | None for local build. |
| Full root type-check | Verified | `npm.cmd run typecheck` passed for shared, API, web, and desktop. | None. |
| Full root lint | Verified | `npm.cmd run lint` passed with no ESLint warnings or errors. | None. |
| Full root API test suite | Verified | `npm.cmd test` passed: 42 tests passed, 5 PostgreSQL tests skipped only because `TEST_DATABASE_URL` is not set for the default root test command. | None for default test command. |
| Docker PostgreSQL and Redis health | Verified | Elevated `docker compose up -d postgres redis` started both services; `docker compose ps` showed `postgres` and `redis` healthy on ports 5432 and 6379. | None for local containers. |
| PostgreSQL migration 008 | Verified | `docker compose exec -T postgres psql -U archmind -d archmind_test -c "select version from schema_migrations order by version;"` returned migrations `001` through `008`. | Production migration execution still requires production database access. |
| PostgreSQL integration suite | Verified | `TEST_DATABASE_URL=postgres://archmind:archmind@localhost:5432/archmind_test npm.cmd run test -w @archmind/api -- tests/postgres-platform.test.ts` passed 5/5 tests, including persistence across repository restart, tenant isolation, cross-assistant installer isolation, and concurrent desktop-build idempotency. | None for local PostgreSQL proof. |
| Public release blockers | Blocked | Local build/tests/database verification passed, but no Windows code-signing certificate, production manifest-signing key management, durable object storage/CDN, DNS/TLS/domain access, OAuth production callbacks, or deployment secrets were provided. | Provide external credentials and deployment authorization. |

## 27. Modern installer branding and fallback desktop UI fix (2026-07-16)

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Modern installer name | Verified | Rebuilt installer path is `D:\New project 2\apps\desktop\out\Install ArchMind Assistant.exe`. | Per-assistant legacy worker builds use `Install <assistant name>.exe`; universal runtime stays generic until secure claim. |
| Installer artifact integrity | Verified | Final installer size is `83,502,274` bytes, header is `MZ`, SHA-256 is `D568174C395FDCCB5D9C61C46F4DBE6AD053A67761A4EE3B6DB7D3157178FC5E`. | Code signing remains Blocked without certificate. |
| Modern setup artwork | Verified | `apps/desktop/package.json` now configures `win.icon`, `nsis.installerIcon`, `nsis.uninstallerIcon`, `nsis.installerHeader`, and `nsis.installerSidebar`. Assets are generated by `scripts/generate-desktop-assets.cjs`. | NSIS still uses native Windows installer chrome; fully custom installer UI would require a custom NSIS script or a different installer framework. |
| Assistant-colored per-assistant installer assets | Implemented but unverified | `apps/api/src/services/desktop-builder.ts` generates installer icon/header/sidebar into each assistant package using the assistant color from the web configuration. | A new per-assistant worker build was not executed in this section. |
| Raw JSON desktop fallback screen removed | Verified | `apps/desktop/src/main.ts` now makes `render()` return `renderChat()`, so fallback mode opens the modern chat UI instead of the old centered card with raw JSON status. Desktop type-check passed. | Existing already-installed stale apps must be reinstalled from the new installer to pick this up. |
| Local runtime registration path | Verified | Development runtime registration now points to `apps/desktop/out/Install ArchMind Assistant.exe`, so web runtime downloads use the new artifact. API type-check passed. | If an old runtime release row already exists in a long-running API process, restart API to refresh registration. |

## 28. Website-style desktop bubble chat (2026-07-16)

| Gate | Status | Evidence | Remaining requirement |
| --- | --- | --- | --- |
| Desktop bubble matches website chat direction | Verified | `apps/desktop/src/main.ts` fallback renderer now uses the assistant name in the top header, an online-ready pill, dark grid workspace, intro assistant message, large `How can I help today?` hero, and modern bottom composer. | Pixel-perfect parity with every responsive web breakpoint remains a visual QA task. |
| Assistant name in bubble | Verified | The fallback renderer injects `manifest.assistantName` into the header, greeting, placeholder, and document title. Desktop type-check passed. | Existing installed apps must be reinstalled to receive this change. |
| Old simple fallback removed | Verified | `render()` returns `renderChat()`, so the raw status-card fallback cannot appear from this source path. | None for source behavior. |
| Final installer containing this UI | Verified | Rebuilt `D:\New project 2\apps\desktop\out\Install ArchMind Assistant.exe`, size `83,502,698` bytes, header `MZ`, SHA-256 `AC5787CAC6F29522A839DB4710F5C1672C25846076C302B12F54BEC9CD72513C`. | Installer remains unsigned until code-signing credentials are provided. |
