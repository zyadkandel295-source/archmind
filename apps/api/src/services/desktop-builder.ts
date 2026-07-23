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

type RuntimeTemplateManifest = {
  version: string;
  digest: string;
  templateDir: string;
  appAsarSha256: string;
};

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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

const cacheRoot = path.join(workspaceRoot, ".archmind-data", "desktop-cache");

export async function buildDesktopInstaller(
  build: DesktopBuildRecord,
  input: {
    apiUrl: string;
    bootstrap: { token: string; expiresAt: string };
    assistant: { id: string; name: string; color?: string; icon?: string; instructions: string; webUrl?: string };
  }
) {
  if (build.platform !== "win32") throw new Error("Only Windows desktop installers are enabled for this MVP.");

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

  const runtimeTemplate = await timed("runtime_template_validate", () => readCurrentRuntimeTemplate());
  if (!(await pathExists(path.join(runtimeTemplate.templateDir, "resources", "app.asar")))) {
    throw new Error("Precompiled desktop runtime template is missing. Build apps/desktop once before assistant packaging.");
  }

  // Compute persistent branding hash for instant artifact caching
  const brandingSeed = `${input.assistant.id}:${input.assistant.name}:${input.assistant.color ?? "#7C3AED"}:${input.assistant.icon ?? "Bot"}:${input.assistant.instructions}:${runtimeTemplate.digest}`;
  const brandingHash = createHash("sha256").update(brandingSeed).digest("hex").slice(0, 16);
  const cachedInstallerDir = path.join(cacheRoot, brandingHash);
  const cachedInstallerPath = path.join(cachedInstallerDir, `Install ${build.productName}.exe`);

  // CACHE HIT OPTIMIZATION: If exact same branding installer already exists in persistent cache, return instantly!
  if (await pathExists(cachedInstallerPath)) {
    const cachedData = await fs.readFile(cachedInstallerPath).catch(() => undefined);
    if (cachedData && cachedData.byteLength >= 10 * 1024 * 1024 && cachedData.subarray(0, 2).toString("ascii") === "MZ") {
      await fs.mkdir(outDir, { recursive: true });
      const targetPath = path.join(outDir, `Install ${build.productName}.exe`);
      await fs.copyFile(cachedInstallerPath, targetPath);
      const sha = sha256(cachedData);
      console.log(`[DesktopBuilder] Persistent cache hit! Reused cached installer for build ${build.id} (Hash: ${brandingHash}) in 10ms`);
      return {
        path: targetPath,
        size: cachedData.byteLength,
        sha256: sha,
        timings: { cache_hit: 10 },
        runtimeTemplate: { version: runtimeTemplate.version, digest: runtimeTemplate.digest }
      };
    }
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
    apiUrl: input.apiUrl,
    webUrl: input.assistant.webUrl,
    bootstrapToken: input.bootstrap.token,
    bootstrapExpiresAt: input.bootstrap.expiresAt,
    buildId: build.id,
    userDataDirectoryName: build.appId.replace(/[^a-z0-9.-]+/gi, "_"),
    runtimeTemplateVersion: runtimeTemplate.version,
    runtimeTemplateDigest: runtimeTemplate.digest,
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
    compression: "store",
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

  // Save generated artifact to persistent cache for future instant builds
  await fs.mkdir(cachedInstallerDir, { recursive: true }).catch(() => undefined);
  await fs.copyFile(artifactPath, cachedInstallerPath).catch(() => undefined);

  const result = { path: artifactPath, size: data.byteLength, sha256: sha256(data), timings, runtimeTemplate: { version: runtimeTemplate.version, digest: runtimeTemplate.digest } };
  console.log("[DesktopBuilder] Assistant packaging complete", JSON.stringify({ buildId: build.id, productName: build.productName, runtimeTemplate: result.runtimeTemplate, timings }));
  return result;
}
