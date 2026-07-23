import { loadEnv } from "./config/env";
import net from "node:net";
import { MemoryStore } from "./db/memory";
import { PostgresPlatformStore } from "./db/postgres-platform";
import type { PlatformStateStore } from "./db/platform-store";
import { DESKTOP_BUILD_QUEUE, processDesktopBuildJob } from "./services/desktop-build-queue";

function createPlatformStore(env: ReturnType<typeof loadEnv>, memory: MemoryStore): PlatformStateStore {
  if (env.nodeEnv !== "test" && env.databaseUrl && env.platformStore !== "memory") {
    return new PostgresPlatformStore(env.databaseUrl, { runMigrations: Boolean(env.runMigrations) });
  }
  if (env.nodeEnv === "production") {
    throw new Error("DATABASE_URL is required for production platform workers.");
  }
  return memory;
}

function canConnectToRedis(redisUrl: string) {
  return new Promise<boolean>((resolve) => {
    let url: URL;
    try {
      url = new URL(redisUrl);
    } catch {
      resolve(false);
      return;
    }

    const socket = net.createConnection({
      host: url.hostname || "127.0.0.1",
      port: Number(url.port || 6379)
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const env = loadEnv();
  const memory = new MemoryStore();
  const platformStore = createPlatformStore(env, memory);

  if (!env.redisUrl) {
    if (env.nodeEnv === "production") throw new Error("REDIS_URL is required for production workers.");
    console.log("Redis is not configured. Workers are idle in local development mode.");
    return;
  }

  if (!(await canConnectToRedis(env.redisUrl))) {
    if (env.nodeEnv === "production") throw new Error(`Redis is not reachable at ${env.redisUrl}.`);
    console.log(`Redis is configured but not reachable at ${env.redisUrl}. Workers are idle in local development mode.`);
    return;
  }

  const { Worker } = await import("bullmq");

  // Ingestion Worker
  const ingestionWorker = new Worker(
    "archmind-ingestion",
    async (job) => {
      console.log(`Processing source ingestion job ${job.id}`, job.data);
      return {
        indexed: true,
        sourceId: job.data.sourceId,
        assistantId: job.data.assistantId
      };
    },
    {
      connection: {
        url: env.redisUrl
      }
    }
  );

  ingestionWorker.on("completed", (job) => console.log(`Completed ingestion job ${job.id}`));
  ingestionWorker.on("failed", (job, error) => console.error(`Failed ingestion job ${job?.id}`, error));
  ingestionWorker.on("error", (error) => console.error("Ingestion worker Redis error", error));

  const desktopBuildWorker = new Worker(
    DESKTOP_BUILD_QUEUE,
    async (job) => {
      console.log(`Processing desktop build job ${job.id}`);
      return processDesktopBuildJob(platformStore, job.data);
    },
    {
      connection: {
        url: env.redisUrl
      },
      concurrency: 1
    }
  );

  desktopBuildWorker.on("completed", (job) => console.log(`Completed desktop build job ${job.id}`));
  desktopBuildWorker.on("failed", (job, error) => console.error(`Failed desktop build job ${job?.id}`, error));
  desktopBuildWorker.on("error", (error) => console.error("Desktop build worker Redis error", error));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
