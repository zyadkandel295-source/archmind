import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@archmind/shared": path.resolve(dirname, "../../packages/shared/src/index.ts")
    }
  },
  test: {
    pool: "threads",
    fileParallelism: false,
    testTimeout: 60_000
  }
});
