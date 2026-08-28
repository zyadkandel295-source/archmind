import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { DesktopBuildRecord } from "../platform-types";

const workspaceRoot = path.resolve(__dirname, "..", "..", "..", "..");
const desktopRoot = path.join(workspaceRoot, "apps", "desktop");
const artifactRoot = path.join(workspaceRoot, ".archmind-data", "desktop-builds");
const legacyRuntimeTemplateDir = path.join(desktopRoot, "out", "win-unpacked");
const currentRuntimeManifestPath = path.join(workspaceRoot, ".archmind-data", "desktop-runtime", "current.json");
// A Windows app export must contain the authenticated desktop runtime.  The
// lightweight launcher is retained only as an explicit development escape
// hatch; otherwise an export would install successfully but could not perform
// the bootstrap/device-session first run.
const useElectronRuntimeInstaller = process.env.ARCHMIND_DESKTOP_INSTALLER_KIND !== "lightweight";

type RuntimeTemplateManifest = {
  version: string;
  digest: string;
  templateDir: string;
  appAsarSha256: string;
};

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function runtimeApiUrl(apiUrl: string) {
  // Electron's first-run bootstrap can hang on IPv6-first localhost resolution
  // in Windows desktop environments even while the local API is listening on
  // IPv4. Keep deployed URLs untouched, but make a local export unambiguous.
  try {
    const parsed = new URL(apiUrl);
    if (parsed.hostname === "localhost") parsed.hostname = "127.0.0.1";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return apiUrl;
  }
}

function assertInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Desktop artifact escaped the build directory.");
}

function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}\n${output.slice(-4000)}`));
    });
  });
}

function nsisQuote(value: string) {
  return `"${value.replace(/\$/g, "$$").replace(/"/g, "$\\\"")}"`;
}

function safeWindowsLabel(value: string, fallback: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || fallback;
}

async function findMakensis() {
  const candidates = [
    process.env.MAKENSIS_EXE,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "nsis", "nsis-3.0.4.1", "Bin", "makensis.exe") : undefined,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "electron-builder", "Cache", "nsis-3.0.4.1", "nsis-3.0.4.1-1mx3n", "Bin", "makensis.exe") : undefined
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return "makensis";
}

async function copyDirectory(source: string, destination: string) {
  await fs.mkdir(destination, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) {
      await fs.copyFile(from, to, fs.constants.COPYFILE_FICLONE).catch(() => fs.copyFile(from, to));
    }
  }
}

async function pathExists(target: string) {
  return Boolean(await fs.stat(target).catch(() => undefined));
}

async function readCurrentRuntimeTemplate() {
  const raw = await fs.readFile(currentRuntimeManifestPath, "utf8").catch(() => undefined);
  if (raw) {
    try {
      const manifest = JSON.parse(raw) as RuntimeTemplateManifest;
      if (manifest.version && manifest.digest && manifest.templateDir) {
        const appAsar = path.join(manifest.templateDir, "resources", "app.asar");
        if (await pathExists(appAsar)) {
          return manifest;
        }
      }
    } catch {
      // Ignore parse error and fall back to discovering existing release
    }
  }

  // Fallback 1: Discover latest release in .archmind-data/desktop-runtime/releases
  const releasesDir = path.join(workspaceRoot, ".archmind-data", "desktop-runtime", "releases");
  if (await pathExists(releasesDir)) {
    const entries = await fs.readdir(releasesDir, { withFileTypes: true });
    for (const entry of entries.reverse()) {
      if (!entry.isDirectory()) continue;
      const unpackedDir = path.join(releasesDir, entry.name, "win-unpacked");
      const appAsar = path.join(unpackedDir, "resources", "app.asar");
      if (await pathExists(appAsar)) {
        return {
          version: entry.name,
          digest: entry.name.slice(0, 16),
          templateDir: unpackedDir,
          appAsarSha256: ""
        };
      }
    }
  }

  // Fallback 2: Check legacy apps/desktop/out/win-unpacked
  const legacyAsar = path.join(legacyRuntimeTemplateDir, "resources", "app.asar");
  if (await pathExists(legacyAsar)) {
    return {
      version: "legacy-apps-desktop-out",
      digest: "legacy",
      templateDir: legacyRuntimeTemplateDir,
      appAsarSha256: undefined
    };
  }

  throw new Error("Precompiled desktop runtime template is missing. Run 'node scripts/build-desktop-runtime.cjs' to initialize the desktop runtime template.");
}

async function ensureCurrentRuntimeTemplate() {
  try {
    return await readCurrentRuntimeTemplate();
  } catch (initialError) {
    // The worker builds only the controlled runtime template; it never runs
    // project/user code. CI should prebuild this, but first local exports can
    // safely self-initialize instead of failing with a missing-template error.
    await run("node", ["scripts/build-desktop-runtime.cjs"], workspaceRoot);
    try {
      return await readCurrentRuntimeTemplate();
    } catch {
      throw initialError;
    }
  }
}

async function newestFileMtime(directory: string) {
  let newest = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, await newestFileMtime(target));
    } else if (entry.isFile()) {
      newest = Math.max(newest, (await fs.stat(target)).mtimeMs);
    }
  }
  return newest;
}

async function desktopBundleIsFresh() {
  const distMain = path.join(desktopRoot, "dist", "main.js");
  const distPreload = path.join(desktopRoot, "dist", "preload.js");
  const distMainStat = await fs.stat(distMain).catch(() => undefined);
  const distPreloadStat = await fs.stat(distPreload).catch(() => undefined);
  if (!distMainStat || !distPreloadStat) return false;

  const newestSource = Math.max(
    await newestFileMtime(path.join(desktopRoot, "src")),
    (await fs.stat(path.join(desktopRoot, "tsconfig.json")).catch(() => ({ mtimeMs: 0 }))).mtimeMs,
    (await fs.stat(path.join(desktopRoot, "package.json")).catch(() => ({ mtimeMs: 0 }))).mtimeMs
  );
  return Math.min(distMainStat.mtimeMs, distPreloadStat.mtimeMs) >= newestSource;
}

async function buildLightweightWebInstaller(
  build: DesktopBuildRecord,
  input: {
    apiUrl: string;
    bootstrap: { token: string; expiresAt: string };
    assistant: { id: string; name: string; color?: string; icon?: string; instructions: string; webUrl?: string };
    appManifest?: Record<string, unknown>;
  },
  packageDir: string,
  outDir: string,
  assetsDir: string,
  timings: Record<string, number>,
  timed: <T>(name: string, operation: () => Promise<T>) => Promise<T>
) {
  const installPayloadDir = path.join(packageDir, "payload");
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(installPayloadDir, { recursive: true });
  await timed("installer_assets", () => run("node", ["scripts/generate-desktop-assets.cjs"], workspaceRoot, {
    ARCHMIND_ASSET_OUT: assetsDir,
    ARCHMIND_ASSET_COLOR: input.assistant.color ?? "#7C3AED",
    ARCHMIND_ASSET_ICON: input.assistant.icon ?? "Bot"
  }));

  const webUrl = input.assistant.webUrl ?? `${process.env.APP_URL ?? "https://www.agentia-ai.cloud"}/assistants/${encodeURIComponent(input.assistant.id)}/chat`;
  const manifest = {
    schemaVersion: 3,
    runtime: "agentia-web-launcher",
    assistantId: input.assistant.id,
    assistantName: input.assistant.name,
    assistantColor: input.assistant.color,
    assistantIcon: input.assistant.icon,
    assistantInstructions: input.assistant.instructions,
    appId: build.appId,
    productName: build.productName,
    protocol: build.protocol,
    apiUrl: runtimeApiUrl(input.apiUrl),
    webUrl,
    bootstrapToken: input.bootstrap.token,
    bootstrapExpiresAt: input.bootstrap.expiresAt,
    buildId: build.id,
    userDataDirectoryName: build.appId.replace(/[^a-z0-9.-]+/gi, "_"),
    appManifest: input.appManifest,
    createdAt: new Date().toISOString()
  };

  const launcher = [
    "Option Explicit",
    "Dim shell, target",
    "Set shell = CreateObject(\"WScript.Shell\")",
    `target = ${JSON.stringify(webUrl)}`,
    "shell.Run target, 1, False"
  ].join("\r\n");

  await timed("manifest_write", async () => {
    await fs.writeFile(path.join(installPayloadDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(installPayloadDir, "Launch.vbs"), launcher);
    await fs.copyFile(path.join(assetsDir, "archmind-assistant.ico"), path.join(installPayloadDir, "archmind-assistant.ico"));
  });

  const nsisScript = path.join(packageDir, "installer.nsi");
  const shortcutName = safeWindowsLabel(build.productName, "AGENTIA Assistant");
  const installerPath = path.join(outDir, `Install ${shortcutName}.exe`);
  const appInstallDir = `$LOCALAPPDATA\\Programs\\AGENTIA\\${build.appId.replace(/[^a-z0-9._-]+/gi, "_")}`;
  const script = [
    "!include MUI2.nsh",
    `Name ${nsisQuote(build.productName)}`,
    `OutFile ${nsisQuote(installerPath)}`,
    "Unicode true",
    "RequestExecutionLevel user",
    `InstallDir "${appInstallDir}"`,
    `Icon ${nsisQuote(path.join(assetsDir, "archmind-assistant.ico"))}`,
    `UninstallIcon ${nsisQuote(path.join(assetsDir, "archmind-assistant.ico"))}`,
    `!define MUI_ICON ${nsisQuote(path.join(assetsDir, "archmind-assistant.ico"))}`,
    `!define MUI_UNICON ${nsisQuote(path.join(assetsDir, "archmind-assistant.ico"))}`,
    "!insertmacro MUI_PAGE_WELCOME",
    "!insertmacro MUI_PAGE_DIRECTORY",
    "!insertmacro MUI_PAGE_INSTFILES",
    "!define MUI_FINISHPAGE_RUN \"$INSTDIR\\Launch.vbs\"",
    `!define MUI_FINISHPAGE_RUN_TEXT ${nsisQuote(`Launch ${build.productName}`)}`,
    "!insertmacro MUI_PAGE_FINISH",
    "!insertmacro MUI_UNPAGE_CONFIRM",
    "!insertmacro MUI_UNPAGE_INSTFILES",
    "!insertmacro MUI_LANGUAGE \"English\"",
    "Section \"Install\"",
    "  SetOutPath \"$INSTDIR\"",
    `  File /r ${nsisQuote(path.join(installPayloadDir, "*"))}`,
    "  CreateDirectory \"$SMPROGRAMS\\AGENTIA\"",
    `  CreateShortCut "$SMPROGRAMS\\AGENTIA\\${shortcutName}.lnk" "$WINDIR\\System32\\wscript.exe" '"$INSTDIR\\Launch.vbs"' "$INSTDIR\\archmind-assistant.ico"`,
    `  CreateShortCut "$DESKTOP\\${shortcutName}.lnk" "$WINDIR\\System32\\wscript.exe" '"$INSTDIR\\Launch.vbs"' "$INSTDIR\\archmind-assistant.ico"`,
    "  WriteUninstaller \"$INSTDIR\\Uninstall.exe\"",
    "SectionEnd",
    "Section \"Uninstall\"",
    `  Delete "$SMPROGRAMS\\AGENTIA\\${shortcutName}.lnk"`,
    `  Delete "$DESKTOP\\${shortcutName}.lnk"`,
    "  Delete \"$INSTDIR\\manifest.json\"",
    "  Delete \"$INSTDIR\\Launch.vbs\"",
    "  Delete \"$INSTDIR\\archmind-assistant.ico\"",
    "  Delete \"$INSTDIR\\Uninstall.exe\"",
    "  RMDir \"$INSTDIR\"",
    "SectionEnd"
  ].join("\r\n");
  await fs.writeFile(nsisScript, script);

  const makensis = await findMakensis();
  await timed("nsis_lightweight_installer", () => run(makensis, [nsisScript], packageDir));
  const data = await timed("artifact_hash_read", () => fs.readFile(installerPath));
  if (data.byteLength < 50 * 1024) throw new Error(`Generated installer is suspiciously small: ${data.byteLength} bytes.`);
  if (data.byteLength > 50 * 1024 * 1024) throw new Error(`Generated installer is too large for the configured Supabase storage tier: ${data.byteLength} bytes.`);
  if (data.subarray(0, 2).toString("ascii") !== "MZ") throw new Error("Generated installer does not have a Windows PE MZ header.");
  console.log("[DesktopBuilder] Lightweight assistant installer complete", JSON.stringify({ buildId: build.id, productName: build.productName, bytes: data.byteLength, timings }));
  return { path: installerPath, size: data.byteLength, sha256: sha256(data), timings, runtimeTemplate: { version: "agentia-web-launcher", digest: "nsis-lightweight" } };
}

export async function buildDesktopInstaller(
  build: DesktopBuildRecord,
  input: {
    apiUrl: string;
    bootstrap: { token: string; expiresAt: string };
    assistant: { id: string; name: string; color?: string; icon?: string; instructions: string; webUrl?: string };
    appManifest?: Record<string, unknown>;
  }
) {
  if (build.platform !== "win32") throw new Error("Only Windows desktop installers are enabled for this MVP.");

  const apiUrl = runtimeApiUrl(input.apiUrl);

  const packageDir = path.join(artifactRoot, build.id);
  const outDir = path.join(packageDir, "out");
  const assetsDir = path.join(packageDir, "assets");
  const prepackagedDir = path.join(packageDir, "win-unpacked");
  const timings: Record<string, number> = {};
  const timed = async <T>(name: string, operation: () => Promise<T>) => {
    const started = Date.now();
    try {
      return await operation();
    } finally {
      timings[name] = Date.now() - started;
    }
  };
  await fs.mkdir(packageDir, { recursive: true });

  if (!useElectronRuntimeInstaller) {
    return buildLightweightWebInstaller(build, input, packageDir, outDir, assetsDir, timings, timed);
  }

  const runtimeTemplate = await timed("runtime_template_validate", () => ensureCurrentRuntimeTemplate());
  if (!(await pathExists(path.join(runtimeTemplate.templateDir, "resources", "app.asar")))) {
    throw new Error("Precompiled desktop runtime template is missing. Build apps/desktop once before assistant packaging.");
  }

  await timed("copy_precompiled_payload", () => copyDirectory(runtimeTemplate.templateDir, prepackagedDir));
  await timed("icon_and_installer_assets", () => run("node", ["scripts/generate-desktop-assets.cjs"], workspaceRoot, {
    ARCHMIND_ASSET_OUT: assetsDir,
    ARCHMIND_ASSET_COLOR: input.assistant.color ?? "#7C3AED",
    ARCHMIND_ASSET_ICON: input.assistant.icon ?? "Bot"
  }));

  const manifest = {
    schemaVersion: 2,
    assistantId: input.assistant.id,
    assistantName: input.assistant.name,
    assistantColor: input.assistant.color,
    assistantIcon: input.assistant.icon,
    assistantInstructions: input.assistant.instructions,
    appId: build.appId,
    productName: build.productName,
    protocol: build.protocol,
    apiUrl,
    webUrl: input.assistant.webUrl,
    bootstrapToken: input.bootstrap.token,
    bootstrapExpiresAt: input.bootstrap.expiresAt,
    buildId: build.id,
    userDataDirectoryName: build.appId.replace(/[^a-z0-9.-]+/gi, "_"),
    runtimeTemplateVersion: runtimeTemplate.version,
    runtimeTemplateDigest: runtimeTemplate.digest,
    // The export payload is configuration only; it is kept distinct from the
    // short-lived bootstrap exchange credential above.
    appManifest: input.appManifest,
    createdAt: new Date().toISOString()
  };
  await timed("manifest_write", async () => {
    await fs.writeFile(path.join(packageDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await fs.writeFile(path.join(prepackagedDir, "resources", "manifest.json"), JSON.stringify(manifest, null, 2));
    await fs.copyFile(path.join(assetsDir, "archmind-assistant.ico"), path.join(prepackagedDir, "resources", "archmind-assistant.ico"));
    const genericExe = path.join(prepackagedDir, "ArchMind Assistant.exe");
    const brandedExe = path.join(prepackagedDir, `${build.productName}.exe`);
    if (await pathExists(genericExe)) await fs.rename(genericExe, brandedExe).catch(async () => {
      await fs.copyFile(genericExe, brandedExe);
      await fs.rm(genericExe, { force: true });
    });
  });

  const pkg = JSON.parse(await fs.readFile(path.join(desktopRoot, "package.json"), "utf8")) as Record<string, unknown>;
  pkg.name = build.appId.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  pkg.productName = build.productName;
  pkg.main = "dist/main.js";
  pkg.build = {
    appId: build.appId,
    productName: build.productName,
    electronVersion: "33.2.0",
    npmRebuild: false,
    // Stored (uncompressed) NSIS payloads have produced unstable installers
    // on Windows. Use the builder's tested compression path for exported
    // application payloads instead.
    compression: "normal",
    directories: { output: "out" },
    files: ["**/*"],
    extraResources: [
      { from: "manifest.json", to: "manifest.json" },
      { from: "assets/archmind-assistant.ico", to: "archmind-assistant.ico" }
    ],
    protocols: [{ name: build.productName, schemes: [build.protocol] }],
    win: { target: "nsis", icon: "assets/archmind-assistant.ico" },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      runAfterFinish: true,
      installerIcon: "assets/archmind-assistant.ico",
      uninstallerIcon: "assets/archmind-assistant.ico",
      installerHeader: "assets/installer-header.bmp",
      installerSidebar: "assets/installer-sidebar.bmp",
      differentialPackage: false,
      artifactName: "Install ${productName}.${ext}"
    }
  };
  await fs.writeFile(path.join(packageDir, "package.json"), JSON.stringify(pkg, null, 2));

  await timed("electron_builder_prepackaged_nsis", () => run("npx", ["electron-builder", "--win", "--publish=never", "--prepackaged", "win-unpacked"], packageDir));
  const artifact = (await fs.readdir(outDir)).find((item) => item.toLowerCase().endsWith(".exe"));
  if (!artifact) throw new Error("electron-builder completed but no Windows .exe artifact was produced.");
  const artifactPath = path.join(outDir, artifact);
  assertInside(packageDir, artifactPath);
  const data = await timed("artifact_hash_read", () => fs.readFile(artifactPath));
  if (data.byteLength < 10 * 1024 * 1024) throw new Error(`Generated installer is suspiciously small: ${data.byteLength} bytes.`);
  if (data.byteLength > 500 * 1024 * 1024) throw new Error(`Generated installer is unexpectedly large: ${data.byteLength} bytes.`);
  if (data.subarray(0, 2).toString("ascii") !== "MZ") throw new Error("Generated installer does not have a Windows PE MZ header.");

  const result = { path: artifactPath, size: data.byteLength, sha256: sha256(data), timings, runtimeTemplate: { version: runtimeTemplate.version, digest: runtimeTemplate.digest } };
  console.log("[DesktopBuilder] Assistant packaging complete", JSON.stringify({ buildId: build.id, productName: build.productName, runtimeTemplate: result.runtimeTemplate, timings }));
  return result;
}
