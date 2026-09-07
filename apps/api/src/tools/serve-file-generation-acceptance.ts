// Isolated local acceptance server. Real model, real BullMQ, real disk persistence.
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { loadEnv } from "../config/env";
import { MemoryStore } from "../db/memory";
import { createApp } from "../app";
import { FileRepository } from "../services/files/repository";
import { FILE_QUEUE, FileGenerationService } from "../services/files/generator";
import { signAccessToken } from "../middleware/auth";

async function main() {
  const configured = loadEnv();
  if (!configured.redisUrl)
    throw new Error("A real Redis connection is required for acceptance.");
  const env = {
    ...configured,
    nodeEnv: "test",
    databaseUrl: undefined,
    platformStore: "memory" as const,
    corsOrigin: "http://localhost:3100",
  };
  process.env.NODE_ENV = "test";
  delete process.env.REDIS_URL;
  const directory = path.resolve("tmp/file-ui-acceptance");
  const repo = new FileRepository(env, directory);
  const store = new MemoryStore({
    databaseSync: false,
    diskPersistence: false,
  });
  const owner = {
    id: randomUUID(),
    email: "file-ui@example.invalid",
    plan: "pro" as const,
  };
  const assistant = store.createAssistant(owner.id, {
    name: "File Acceptance Assistant",
    description: "File generation acceptance",
    systemPrompt: "Help users create accurate, useful documents.",
    tone: "professional",
    model: "standard",
    temperature: 0.3,
    isPublic: false,
    enabledTools: [],
    starterPrompts: [],
  });
  const prefix = `acceptance-${randomUUID()}`;
  const service = new FileGenerationService(env, repo, undefined, prefix);
  const worker = new Worker(FILE_QUEUE, (job) => service.run(job.data.fileId), {
    prefix,
    connection: { url: env.redisUrl },
    concurrency: 1,
    lockDuration: 120000,
  });
  worker.on("error", (error) => console.error(error.message));
  worker.on("completed", (job) => console.log(`Worker completed ${job.id}`));
  worker.on("failed", (job, error) =>
    console.error(`Worker failed ${job?.id}: ${error.message}`),
  );
  const { app } = createApp({ env, store, fileService: service });
  const server = app.listen(4401, "127.0.0.1");
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "session.txt"),
    JSON.stringify({
      token: signAccessToken({ ...env, jwtAccessTtl: "2h" }, owner),
      assistantId: assistant.id,
      userId: owner.id,
    }),
    { mode: 0o600 },
  );
  console.log(
    "Acceptance API/worker ready on 127.0.0.1:4401; session saved in tmp/file-ui-acceptance/session.txt",
  );
  const shutdown = async () => {
    server.close();
    await worker.close();
    await repo.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
