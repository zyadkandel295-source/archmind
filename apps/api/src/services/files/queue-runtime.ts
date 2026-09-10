/**
 * Vercel Functions cannot host an always-on BullMQ process. The managed
 * queue is the production worker on Vercel; other deployments retain the
 * existing Redis/BullMQ worker.
 */
export function usesManagedVercelFileQueue() {
  const backend = process.env.FILE_GENERATION_QUEUE_BACKEND?.trim();
  if (backend === "vercel") return true;
  if (backend === "bullmq") return false;
  return process.env.VERCEL === "1";
}
