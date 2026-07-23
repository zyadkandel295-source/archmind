import type { Env } from "../config/env";

export async function enqueueIngestion(env: Env, payload: { sourceId: string; assistantId: string }) {
  if (!env.redisUrl) {
    return {
      queued: false,
      reason: "Redis is not configured; source was ingested synchronously in demo mode.",
      payload
    };
  }

  const { Queue } = await import("bullmq");
  const queue = new Queue("archmind-ingestion", {
    connection: {
      url: env.redisUrl
    }
  });
  const job = await queue.add("ingest-source", payload, {
    removeOnComplete: true,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10_000
    }
  });

  await queue.close();
  return {
    queued: true,
    jobId: job.id,
    payload
  };
}
