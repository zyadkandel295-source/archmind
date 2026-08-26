/* Build and register the immutable Electron runtime template used by exports. */
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const desktopRoot = path.join(root, "apps", "desktop");
const runtimeRoot = path.join(root, ".archmind-data", "desktop-runtime");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

if (process.env.AGENTIA_SKIP_DESKTOP_COMPILE !== "true") {
  run(npm, ["run", "build", "-w", "@archmind/desktop"], root);
}
run(npx, ["electron-builder", "--win", "--x64", "--publish=never", "--dir"], desktopRoot);

const templateDir = path.join(desktopRoot, "out", "win-unpacked");
const appAsar = path.join(templateDir, "resources", "app.asar");
if (!fs.existsSync(appAsar)) throw new Error("Electron runtime build completed without resources/app.asar.");

const packageJson = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));
const digest = sha256(appAsar);
const version = `${packageJson.version}-electron-${packageJson.devDependencies.electron}-${digest.slice(0, 12)}`;
const releaseDir = path.join(runtimeRoot, "releases", version);
const savedTemplate = path.join(releaseDir, "win-unpacked");
fs.mkdirSync(releaseDir, { recursive: true });
fs.cpSync(templateDir, savedTemplate, { recursive: true, force: true });
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.writeFileSync(path.join(runtimeRoot, "current.json"), JSON.stringify({
  version,
  digest,
  templateDir: savedTemplate,
  appAsarSha256: digest,
  platform: "windows",
  architecture: "x64",
  builtAt: new Date().toISOString()
}, null, 2));
console.log(`Registered Agentia desktop runtime ${version}`);
