// Opt-in real-model acceptance test. Uses isolated local durable storage by default.
// Run: npx tsx apps/api/src/tools/test-file-generation-live.ts [pdf:5 pdf:20 pdf:49 pptx:10 pptx:30 docx:5]
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { loadEnv } from "../config/env";
import { MemoryStore } from "../db/memory";
import { createApp } from "../app";
import { signAccessToken } from "../middleware/auth";
import { FileRepository } from "../services/files/repository";
import { FileGenerationService } from "../services/files/generator";
import { validateFile } from "../services/files/render";
import type { FileFormat } from "../services/files/types";

async function main() {
  const configured = loadEnv();
  assert(
    configured.openrouterApiKey,
    "OPENROUTER_API_KEY is required; this test never mocks the model.",
  );
  const env = {
    ...configured,
    nodeEnv: "test",
    databaseUrl: undefined,
    redisUrl: undefined,
    platformStore: "memory" as const,
  };
  // Prevent unrelated application subsystems from reading network dependencies.
  process.env.NODE_ENV = "test";
  delete process.env.REDIS_URL;
  const directory = path.resolve(
    process.env.FILE_ACCEPTANCE_DIR ||
      path.join("tmp", "file-generation-live", randomUUID()),
  );
  const repository = new FileRepository(env, directory);
  const service = new FileGenerationService(env, repository);
  const store = new MemoryStore({
    databaseSync: false,
    diskPersistence: false,
  });
  const app = createApp({ env, store, fileService: service }).app;
  const user = {
    id: (await repository.list())[0]?.userId ?? randomUUID(),
    email: "file-acceptance@example.invalid",
    plan: "pro" as const,
  };
  const auth = `Bearer ${signAccessToken({ ...env, jwtAccessTtl: "8h" }, user)}`;
  const other = `Bearer ${signAccessToken(env, { ...user, id: randomUUID() })}`;
  const cases = process.argv.slice(2).length
    ? process.argv.slice(2)
    : ["pdf:5", "pdf:20", "pdf:49", "pptx:10", "pptx:30", "docx:5"];
  console.log(`Acceptance output: ${directory}`);
  for (const entry of cases) {
    const [format, number] = entry.split(":") as [FileFormat, string];
    const count = Number(number);
    const description = `Create a ${count}-${format === "pptx" ? "slide" : "page"} ${format} explaining neural networks for beginners with meaningful examples, headings and a comparison table. Include the title page in the total count.`;
    let saved = (await repository.list(user.id)).find(
      (f) => f.request.description === description,
    );
    if (
      saved?.status === "completed" &&
      process.env.FILE_ACCEPTANCE_REVALIDATE === "1"
    ) {
      const revised = await request(app)
        .post(`/api/files/${saved.id}/regenerate`)
        .set("Authorization", auth)
        .send({ description: "Retry generation" })
        .expect(202);
      saved = await repository.get(revised.body.file.id);
    }
    if (!saved) {
      const response = await request(app)
        .post("/api/chat")
        .set("Authorization", auth)
        .send({ messages: [{ role: "user", content: description }] })
        .expect(200);
      const meta = JSON.parse(
        response.text
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5),
      );
      saved = await repository.get(meta.generatedFile.id);
    }
    const id = saved!.id;
    await request(app)
      .get(`/api/files/${id}/download`)
      .set("Authorization", auth)
      .expect(saved!.status === "completed" ? 200 : 409);
    const timer = setInterval(() => {
      void repository.get(id).then((f) => console.log(`${entry}: ${f?.stage}`));
    }, 15000);
    try {
      await service.run(id);
    } finally {
      clearInterval(timer);
    }
    const complete = await request(app)
      .get(`/api/files/${id}/status`)
      .set("Authorization", auth)
      .expect(200);
    assert.equal(complete.body.file.status, "completed");
    assert.equal(complete.body.file.count, count);
    const file = await repository.owned(id, user.id);
    const bytes = await repository.download(file);
    await validateFile(bytes, format, count);
    await request(app)
      .get(`/api/files/${id}/download`)
      .set("Authorization", auth)
      .expect(200)
      .expect("Content-Length", String(bytes.length));
    for (const route of [
      `/api/files/${id}/status`,
      `/api/files/${id}/download`,
      `/api/conversations/${file.conversationId}/files`,
    ])
      await request(app).get(route).set("Authorization", other).expect(404);
    await request(app)
      .post(`/api/files/${id}/regenerate`)
      .set("Authorization", other)
      .send({ description: "Change title" })
      .expect(404);
    const reopened = new FileRepository(env, directory);
    assert.deepEqual(
      await reopened.download(await reopened.owned(id, user.id)),
      bytes,
    );
    await fs.writeFile(
      path.join(directory, `${format}-${count}.${format}`),
      bytes,
    );
    console.log(
      `PASS ${entry}: ${bytes.length} bytes, authenticated download, ownership, persistent reopen`,
    );
    if (entry === "pdf:5") {
      const edit = await request(app)
        .post("/api/chat")
        .set("Authorization", auth)
        .send({
          conversationId: file.conversationId,
          messages: [
            {
              role: "user",
              content:
                "Change the title to Neural Networks Made Clear and create a DOCX version too.",
            },
          ],
        })
        .expect(200);
      const revised = JSON.parse(
        edit.text
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5),
      ).generatedFile;
      await service.run(revised.id);
      const revision = await repository.owned(revised.id, user.id);
      assert.equal(revision.format, "docx");
      assert.equal(revision.parentId, id);
      assert.deepEqual(await repository.download(file), bytes);
      console.log(`PASS chat edit: ${revision.filename}; original preserved`);
    }
  }
  await repository.close();
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
