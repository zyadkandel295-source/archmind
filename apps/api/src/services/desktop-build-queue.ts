import net from "node:net";
import type { Env } from "../config/env";
import type { PlatformStateStore } from "../db/platform-store";
import { HttpError } from "../lib/http-error";
import type { DesktopBuildRecord } from "../platform-types";
import { buildDesktopInstaller } from "./desktop-builder";
import { PlatformService } from "./platform-service";

export const DESKTOP_BUILD_QUEUE = "archmind-desktop-builds";

export interface DesktopBuildJobData {
  build: DesktopBuildRecord;
  apiUrl: string;
  assistant: { id: string; name: string; color?: string; icon?: string; instructions: string; webUrl?: string };
}

export async function processDesktopBuildJob(platformStore: PlatformStateStore, data: DesktopBuildJobData) {
  const service = new PlatformService(platformStore);
  await service.updateDesktopBuild(data.build.id, { status: "building", error: undefined });
  try {
    // Issue the single-use bootstrap immediately before packaging. Electron builds
    // can take several minutes, so minting it at request time can ship an expired
    // installer even though the build itself succeeded.
    const bootstrap = await service.issueBootstrap(data.build.ownerId, data.build.assistantId, data.build.packageId);
    await service.updateDesktopBuild(data.build.id, { status: "packaging" });
    const result = await buildDesktopInstaller(data.build, {
      apiUrl: data.apiUrl,
      bootstrap,
      assistant: data.assistant
    });
    await service.updateDesktopBuild(data.build.id, { status: "validating_artifact" });
    return await service.updateDesktopBuild(data.build.id, {
      status: "ready",
      artifactPath: result.path,
      artifactSize: result.size,
      artifactSha256: result.sha256
    });
  } catch (error) {
    await service.updateDesktopBuild(data.build.id, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
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

class SerialBuildQueueManager {
  private queue: Array<{
    platformStore: PlatformStateStore;
    data: DesktopBuildJobData;
  }> = [];
  private active = false;

  public enqueue(platformStore: PlatformStateStore, data: DesktopBuildJobData) {
    this.queue.push({ platformStore, data });
    setImmediate(() => this.processNext());
  }

  private async processNext() {
    if (this.active || this.queue.length === 0) return;
    this.active = true;
    const current = this.queue.shift()!;
    const startMs = Date.now();
    console.log(`[DesktopQueue] Starting build ${current.data.build.id} for "${current.data.assistant.name}". Pending queue depth: ${this.queue.length}`);
    try {
      await processDesktopBuildJob(current.platformStore, current.data);
      console.log(`[DesktopQueue] Completed build ${current.data.build.id} in ${Date.now() - startMs}ms`);
    } catch (error) {
      console.error(`[DesktopQueue] Build ${current.data.build.id} failed after ${Date.now() - startMs}ms:`, error instanceof Error ? error.message : error);
    } finally {
      this.active = false;
      this.processNext();
    }
  }

  public get depth() {
    return this.queue.length;
  }
}

const localQueueManager = new SerialBuildQueueManager();

async function runLocalDevBuild(
  platformStore: PlatformStateStore,
  data: DesktopBuildJobData,
  mode: "local-dev" | "local-dev-redis-unreachable"
) {
  localQueueManager.enqueue(platformStore, data);
  return { queued: true, mode, queueDepth: localQueueManager.depth };
}

export async function enqueueDesktopBuild(env: Env, platformStore: PlatformStateStore, data: DesktopBuildJobData) {
  const service = new PlatformService(platformStore);
  if (!env.redisUrl) {
    if (env.nodeEnv === "test") {
      await service.updateDesktopBuild(data.build.id, { status: "queued", buildQueueId: "test-no-redis" });
      return { queued: false, mode: "test-no-redis" as const };
    }
    if (env.nodeEnv === "production") {
      await service.updateDesktopBuild(data.build.id, { status: "failed", error: "Redis is required for production desktop builds." });
      throw new HttpError(503, "Redis is required for production desktop builds.", "REDIS_REQUIRED");
    }
    return runLocalDevBuild(platformStore, data, "local-dev");
  }

  if (!(await canConnectToRedis(env.redisUrl))) {
    if (env.nodeEnv === "production") {
      await service.updateDesktopBuild(data.build.id, { status: "failed", error: "Redis is required for production desktop builds." });
      throw new HttpError(503, "Redis is required for production desktop builds.", "REDIS_REQUIRED");
    }
    console.log(`[DesktopQueue] Redis is configured but not reachable at ${env.redisUrl}. Running desktop build in serial local-dev queue.`);
    return runLocalDevBuild(platformStore, data, "local-dev-redis-unreachable");
  }

  const { Queue } = await import("bullmq");
  const queue = new Queue(DESKTOP_BUILD_QUEUE, { connection: { url: env.redisUrl } });
  const job = await queue.add("build-desktop-installer", data, {
    jobId: data.build.id,
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false
  });
  await queue.close();
  await service.updateDesktopBuild(data.build.id, { status: "queued", buildQueueId: job.id });
  return { queued: true, mode: "bullmq" as const, jobId: job.id };
}
