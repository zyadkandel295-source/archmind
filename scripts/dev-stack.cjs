const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");

const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const rootDir = process.cwd();

function quoteArg(arg) {
  if (!isWindows) return arg;
  return /[\s"&|<>^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function httpReady(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      response.once("end", () => resolve(response.statusCode < 500));
    });
    request.once("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.once("error", () => resolve(false));
  });
}

function prefixLines(name, stream) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) process.stdout.write(`[${name}] ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) process.stdout.write(`[${name}] ${buffer}\n`);
  });
}

function ensureSharedBuild() {
  const sharedEntry = path.join(rootDir, "packages", "shared", "dist", "index.js");
  if (fs.existsSync(sharedEntry)) return;

  console.log("[DEV] Shared package has not been built yet; building it once.");
  const result = spawnSync(npmCommand, ["run", "build", "-w", "@archmind/shared"], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      NO_UPDATE_NOTIFIER: "1"
    }
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readEnvFile() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs.readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
      })
  );
}

async function ensureDockerServices() {
  const envFile = readEnvFile();
  const databaseUrl = process.env.DATABASE_URL ?? envFile.DATABASE_URL ?? "";
  const redisUrl = process.env.REDIS_URL ?? envFile.REDIS_URL ?? "";
  const platformStore = process.env.ARCHMIND_PLATFORM_STORE ?? envFile.ARCHMIND_PLATFORM_STORE ?? "";
  const needsPostgres = platformStore === "postgres" || /^postgres(?:ql)?:\/\//i.test(databaseUrl);
  const needsRedis = /^redis:\/\//i.test(redisUrl);
  const postgresReady = !needsPostgres || await portOpen(5432);
  const redisReady = !needsRedis || await portOpen(6379);
  if (postgresReady && redisReady) return;

  console.log("[DEV] PostgreSQL/Redis are required but not reachable; attempting docker compose...");
  const result = spawnSync("docker", ["compose", "up", "-d", ...(needsPostgres ? ["postgres"] : []), ...(needsRedis ? ["redis"] : [])], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      NO_UPDATE_NOTIFIER: "1"
    }
  });
  if (result.status !== 0) {
    console.warn("");
    console.warn("╔══════════════════════════════════════════════════════════════════╗");
    console.warn("║  Docker/PostgreSQL unavailable; using local MemoryStore         ║");
    console.warn("║  for desktop development only. NOT suitable for production.     ║");
    console.warn("╚══════════════════════════════════════════════════════════════════╝");
    console.warn("");
    process.env.ARCHMIND_PLATFORM_STORE = "memory";
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    return;
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const postgresNowReady = !needsPostgres || await portOpen(5432);
    const redisNowReady = !needsRedis || await portOpen(6379);
    if (postgresNowReady && redisNowReady) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  console.warn("");
  console.warn("╔══════════════════════════════════════════════════════════════════╗");
  console.warn("║  Docker services started but PostgreSQL/Redis not reachable.    ║");
  console.warn("║  Falling back to local MemoryStore for desktop development.     ║");
  console.warn("╚══════════════════════════════════════════════════════════════════╝");
  console.warn("");
  process.env.ARCHMIND_PLATFORM_STORE = "memory";
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
}

async function startService(service) {
  if (service.port && await portOpen(service.port)) {
    if (!service.healthUrl || await httpReady(service.healthUrl)) {
      console.log(`[${service.name}] Port ${service.port} is already healthy; reusing the existing local service.`);
      return undefined;
    }
    console.log(`[${service.name}] Port ${service.port} is listening but did not answer ${service.healthUrl}; not reusing the stale service.`);
    console.log(`[${service.name}] Stop the process using port ${service.port}, then run npm run dev again.`);
    process.exitCode = 1;
    return undefined;
  }

  const command = isWindows ? [npmCommand, ...service.args].map(quoteArg).join(" ") : npmCommand;
  const args = isWindows ? [] : service.args;
  const child = spawn(command, args, {
    cwd: rootDir,
    shell: isWindows,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      npm_config_update_notifier: "false",
      NO_UPDATE_NOTIFIER: "1"
    }
  });

  prefixLines(service.name, child.stdout);
  prefixLines(service.name, child.stderr);

  child.on("exit", async (code) => {
    if (service.port && await portOpen(service.port)) {
      console.log(`[${service.name}] Wrapper exited with code ${code}, but port ${service.port} is still live; keeping the dev stack running.`);
      return;
    }
    if (code && !shuttingDown) {
      console.error(`[${service.name}] exited with code ${code}.`);
      process.exitCode = code;
    }
  });

  return child;
}

let shuttingDown = false;
const children = [];

async function main() {
  ensureSharedBuild();
  await ensureDockerServices();

  const services = [
    { name: "API", port: 4000, healthUrl: "http://localhost:4000/api/platform/desktop/session", args: ["run", "dev", "-w", "@archmind/api"] },
    { name: "WEB", port: 3000, healthUrl: "http://localhost:3000", args: ["run", "dev", "-w", "@archmind/web"] },
    { name: "WORKER", args: ["run", "worker", "-w", "@archmind/api"] }
  ];

  for (const service of services) {
    const child = await startService(service);
    if (child) children.push(child);
  }

  if (children.length === 0) {
    console.log("[DEV] API and web are already running.");
    setInterval(() => undefined, 60_000);
  }
}

function shutdown() {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((error) => {
  console.error("[DEV] failed to start", error);
  process.exit(1);
});
