import { QueueClient } from "@vercel/queue";
import { z } from "zod";
import { loadEnv } from "../src/config/env";
import { FileGenerationService } from "../src/services/files/generator";

const messageSchema = z.object({ fileId: z.string().uuid() });
const queue = new QueueClient();

// This handler is private: Vercel invokes it only for the configured queue
// trigger. Queue delivery is durable and retried, replacing the impossible
// always-on BullMQ process in a serverless deployment.
const handler = queue.handleNodeCallback<{ fileId: string }>(
  async (message, metadata) => {
    const { fileId } = messageSchema.parse(message);
    const service = new FileGenerationService(loadEnv());
    try {
      await service.repository.assertConfigured();
      await service.run(fileId);
    } finally {
      await service.repository.close();
    }
    console.log(`[File queue] completed ${metadata.messageId} for ${fileId}`);
  },
  {
    // A long document can resume from persisted page checkpoints after a
    // function timeout, deployment, or transient model/provider failure.
    visibilityTimeoutSeconds: 3600,
    retry: (_error, metadata) =>
      metadata.deliveryCount >= 3
        ? { acknowledge: true }
        : { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 15) },
  },
);

export default handler;
module.exports = handler;
