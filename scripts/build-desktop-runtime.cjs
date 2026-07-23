const { createHash } = require("node:crypto");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const fss = require("node:fs");
const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..");
const desktopRoot = path.join(workspaceRoot, "apps", "desktop");
const runtimeRoot = path.join(workspaceRoot, ".archmind-data", "desktop-runtime");
const releaseRoot = path.join(runtimeRoot, "releases");
const tmpRoot = path.join(runtimeRoot, "tmp");
const logRoot = path.join(runtimeRoot, "logs");
const lockPath = path.join(runtimeRoot, "runtime-build.lock");
const currentPath = path.join(runtimeRoot, "current.json");
const legacyPartialPath = path.join(desktopRoot, "out", "Install ArchMind Assistant.exe");
const version = process.env.ARCHMIND_DESKTOP_RUNTIME_VERSION ?? `33.2.0-archmind-web-bubble-fast.${Date.now()}`;
const compression = process.env.ARCHMIND_DESKTOP_RUNTIME_COMPRESSION ?? "store";

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fss.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function pathExists(target) {
  return Boolean(await fs.stat(target).catch(() => undefined));
}

async function validateMZ(filePath, minBytes, maxBytes) {
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) throw new Error(`${filePath} is not a file.`);
  if (stat.size < minBytes) throw new Error(`${filePath} is too small: ${stat.size} bytes.`);
  if (stat.size > maxBytes) throw new Error(`${filePath} is too large: ${stat.size} bytes.`);
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(2);
    await handle.read(header, 0, 2, 0);
    if (header.toString("ascii") !== "MZ") throw new Error(`${filePath} does not start with an MZ header.`);
  } finally {
    await handle.close();
  }
  return { stat, sha256: await sha256File(filePath) };
}

async function acquireLock() {
  await fs.mkdir(runtimeRoot, { recursive: true });
  try {
    const handle = await fs.open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({ pid: process.pid, version, startedAt: new Date().toISOString() }, null, 2));
    return handle;
  } catch (error) {
    if (error && error.code === "EEXIST") {
      throw new Error(`Runtime build lock already exists at ${lockPath}. Remove it only after confirming no runtime build is active.`);
    }
    throw error;
  }
}

function run(command, args, cwd, logFile, env = {}) {
  return new Promise((resolve, reject) => {
    const output = fss.createWriteStream(logFile, { flags: "a" });
    const quote = (value) => /[\s"]/u.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
    const commandLine = process.platform === "win32" ? [quote(command), ...args.map(quote)].join(" ") : command;
    const commandArgs = process.platform === "win32" ? [] : args;
    output.write(`\n$ ${process.platform === "win32" ? commandLine : `${command} ${args.join(" ")}`}\n`);
    const child = spawn(commandLine, commandArgs, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env, CI: "1" }
    });
    child.stdout.pipe(output, { end: false });
    child.stderr.pipe(output, { end: false });
    child.on("error", (error) => {
      output.end();
      reject(error);
    });
    child.on("close", (code) => {
      output.write(`\n[exit ${code}]\n`);
      output.end();
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}. See ${logFile}`));
    });
  });
}

async function quarantineLegacyPartial() {
  const stat = await fs.stat(legacyPartialPath).catch(() => undefined);
  if (!stat?.isFile() || stat.size >= 50 * 1024 * 1024) return undefined;
  const quarantineDir = path.join(runtimeRoot, "quarantine");
  await fs.mkdir(quarantineDir, { recursive: true });
  const target = path.join(quarantineDir, `partial-${nowStamp()}-Install ArchMind Assistant.exe`);
  await fs.rename(legacyPartialPath, target).catch(async () => {
    await fs.copyFile(legacyPartialPath, target);
    await fs.rm(legacyPartialPath, { force: true });
  });
  return { from: legacyPartialPath, to: target, bytes: stat.size };
}

async function main() {
  await fs.mkdir(releaseRoot, { recursive: true });
  await fs.mkdir(tmpRoot, { recursive: true });
  await fs.mkdir(logRoot, { recursive: true });

  const lock = await acquireLock();
  const startedAt = new Date();
  const tempDir = path.join(tmpRoot, `${version}-${nowStamp()}-${process.pid}`);
  const outDir = path.join(tempDir, "out");
  const logFile = path.join(logRoot, `${version}-${nowStamp()}.log`);
  let publishedDir;
  try {
    const quarantined = await quarantineLegacyPartial();
    await fs.mkdir(outDir, { recursive: true });

    await run("npm.cmd", ["run", "build", "-w", "@archmind/desktop"], workspaceRoot, logFile);
    await run("npx.cmd", [
      "electron-builder",
      "--win",
      "--publish=never",
      `-c.directories.output=${outDir}`,
      `-c.compression=${compression}`,
      "-c.nsis.differentialPackage=false"
    ], desktopRoot, logFile);

    const files = await fs.readdir(outDir);
    const installerName = files.find((item) => /^Install ArchMind Assistant\.exe$/i.test(item))
      ?? files.find((item) => item.toLowerCase().endsWith(".exe") && !item.startsWith("__uninstaller"));
    if (!installerName) throw new Error(`No installer .exe found in ${outDir}`);

    const installerPath = path.join(outDir, installerName);
    const templateDir = path.join(outDir, "win-unpacked");
    const appAsarPath = path.join(templateDir, "resources", "app.asar");
    if (!(await pathExists(appAsarPath))) throw new Error(`Runtime template is missing ${appAsarPath}`);

    const installer = await validateMZ(installerPath, 50 * 1024 * 1024, 500 * 1024 * 1024);
    const appAsarSha256 = await sha256File(appAsarPath);
    const digest = createHash("sha256").update(`${installer.sha256}:${appAsarSha256}:${version}`).digest("hex");
    publishedDir = path.join(releaseRoot, `${version}-${digest.slice(0, 12)}`);
    if (await pathExists(publishedDir)) await fs.rm(publishedDir, { recursive: true, force: true });
    await fs.rename(outDir, publishedDir);

    const manifest = {
      version,
      digest,
      platform: "windows",
      architecture: "x64",
      buildStartedAt: startedAt.toISOString(),
      buildFinishedAt: new Date().toISOString(),
      buildDurationMs: Date.now() - startedAt.getTime(),
      compression,
      sourceTree: process.env.ARCHMIND_SOURCE_TREE ?? "local-working-tree",
      installerPath: path.join(publishedDir, installerName),
      installerName,
      installerSize: installer.stat.size,
      installerSha256: installer.sha256,
      templateDir: path.join(publishedDir, "win-unpacked"),
      appAsarSha256,
      signatureStatus: "unsigned-dev",
      logFile,
      quarantinedPartial: quarantined
    };
    await fs.writeFile(path.join(publishedDir, "runtime-release.json"), JSON.stringify(manifest, null, 2));
    const tmpCurrent = `${currentPath}.tmp-${process.pid}`;
    await fs.writeFile(tmpCurrent, JSON.stringify(manifest, null, 2));
    await fs.rename(tmpCurrent, currentPath);
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    await lock.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
    if (await pathExists(tempDir)) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
