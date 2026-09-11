import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { PDFParse } from "pdf-parse";
import JSZip from "jszip";
import { loadEnv } from "../src/config/env";
import { createApp } from "../src/app";
import { MemoryStore } from "../src/db/memory";
import { signAccessToken } from "../src/middleware/auth";
import { FileRepository } from "../src/services/files/repository";
import { HttpError } from "../src/lib/http-error";
import {
  FileGenerationService,
  createFreeContentPage,
  createFreeDocumentPlan,
  fileGenerationModelId,
  likelyFileRequest,
  validatePageContent,
} from "../src/services/files/generator";
import { renderFile, validateFile } from "../src/services/files/render";
import { usesManagedVercelFileQueue } from "../src/services/files/queue-runtime";
import {
  cleanFilename,
  fileRequestSchema,
  pageSchema,
  pageText,
  type ContentPage,
  type DocumentPlan,
} from "../src/services/files/types";

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0))
    await fs.rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
function content(index: number): ContentPage {
  return {
    title: `Learning objective ${index + 1}`,
    kind: "content",
    summary: `Explain learning objective ${index + 1}`,
    notes: "Speaker explanation for this topic.",
    blocks: [
      {
        type: "paragraph",
        text: `This lesson ${index + 1} explains why a neural network uses adjustable parameters to learn a relationship between input measurements and an expected output. Start with a practical task such as estimating the price of a house from its floor area and location. Each training example contains measurements and a known sale price. The model combines these inputs to produce a prediction, then compares its prediction with the observed price. This comparison gives us a useful signal about what needs to change. A small prediction error on one house does not establish that the model understands the entire market. We need examples that represent the range of homes where the system will operate.`,
      },
      {
        type: "paragraph",
        text: "Training changes the parameters gradually using many examples. A loss function translates each prediction error into a number that the optimizer tries to reduce. The learning rate controls how large a parameter adjustment should be. If it is too large, training can jump past useful solutions. If it is too small, useful progress may take a long time. Before choosing settings, separate the examples into training and validation sets. The validation set helps estimate performance on examples that did not determine the current parameters. Keep a final test set separate until the design decisions are finished. Record the data preparation steps along with the selected settings so that another person can reproduce the experiment and investigate unexpected results.",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Check whether the measurements represent the intended population.",
          "Compare against a simple baseline before increasing model complexity.",
        ],
      },
    ],
  };
}
function plan(format: "pdf" | "docx" | "pptx", count: number): DocumentPlan {
  return {
    title: "Neural Network Guide",
    topic: "Neural networks",
    audience: "beginners",
    tone: "educational",
    instructions: "",
    format,
    count,
    pages: Array.from({ length: count }, (_, i) => ({
      title: `Learning objective ${i + 1}`,
      brief: `Explain topic ${i + 1}`,
      chapter: `Chapter ${Math.floor(i / 5) + 1}`,
    })),
  };
}

describe("native file rendering", () => {
  it("rejects outline drift and placeholders, including on resumed pages", () => {
    expect(() =>
      validatePageContent(
        { ...content(0), title: "Wrong topic" },
        plan("pdf", 1),
        0,
        [],
      ),
    ).toThrow("outline");
    expect(() =>
      validatePageContent(
        {
          ...content(0),
          blocks: [{ type: "paragraph", text: "Presented by [Your Name]" }],
        },
        plan("pptx", 1),
        0,
        [],
      ),
    ).toThrow("placeholder");
  });
  it.each([5, 20, 49, 50])(
    "renders and parses %i selectable PDF pages",
    async (count) => {
      const bytes = await renderFile(
        plan("pdf", count),
        Array.from({ length: count }, (_, i) => content(i)),
      );
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        expect(result.total).toBe(count);
        expect(result.text).toContain(`Learning objective ${count}`);
        expect(result.text).toContain("validation set");
      } finally {
        await parser.destroy();
      }
    },
  );
  it.each([10, 30, 50])(
    "renders %i native slides including tables and speaker notes",
    async (count) => {
      const pages = Array.from({ length: count }, (_, i): ContentPage => ({
        ...content(i),
        blocks:
          i === 3
            ? [
                {
                  type: "table",
                  headers: ["Method", "Purpose"],
                  rows: [
                    ["Training", "Fit parameters"],
                    ["Validation", "Choose settings"],
                  ],
                },
              ]
            : [
                {
                  type: "list",
                  ordered: true,
                  items: [
                    `Learning objective ${i + 1}`,
                    "Fit parameters on training examples.",
                    "Measure performance on held-out examples.",
                  ],
                },
              ],
      }));
      const bytes = await renderFile(plan("pptx", count), pages);
      const zip = await JSZip.loadAsync(bytes);
      expect(
        Object.keys(zip.files).filter((n) =>
          /^ppt\/slides\/slide\d+\.xml$/.test(n),
        ),
      ).toHaveLength(count);
      expect(
        await zip.file("ppt/slides/slide4.xml")!.async("string"),
      ).toContain("<a:tbl>");
      expect(
        await zip.file("ppt/notesSlides/notesSlide1.xml")!.async("string"),
      ).toContain("Speaker explanation");
    },
  );
  it("creates editable DOCX with heading hierarchy, numbering and native tables", async () => {
    const pages = [
      content(0),
      {
        ...content(1),
        blocks: [
          {
            type: "table" as const,
            headers: ["Input", "Output"],
            rows: [["Measurements", "Prediction"]],
          },
        ],
      },
    ];
    const bytes = await renderFile(plan("docx", 2), pages);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("w:pageBreakBefore");
    expect(xml).toContain("Heading1");
    expect(zip.file("word/footer1.xml")).toBeTruthy();
  });
  it("rejects empty, corrupt and oversized files and overflow", async () => {
    await expect(
      validateFile(Buffer.from("fake pdf"), "pdf", 5),
    ).rejects.toThrow();
    await expect(
      renderFile(plan("pdf", 1), [
        {
          ...content(0),
          blocks: [{ type: "paragraph", text: "Too much text. ".repeat(1000) }],
        },
      ]),
    ).rejects.toThrow(/dense/);
    expect(
      fileRequestSchema.safeParse({ description: "A report", pages: 51 })
        .success,
    ).toBe(false);
    expect(cleanFilename("../../CON", "pdf")).toBe("AGENTIA_Document.pdf");
    expect(cleanFilename('A report\r\n"/path', "docx")).not.toMatch(/[\r\n"/]/);
  });
});

async function setup(
  model?: ConstructorParameters<typeof FileGenerationService>[2],
) {
  const env = {
    ...loadEnv(),
    nodeEnv: "test",
    databaseUrl: undefined,
    redisUrl: undefined,
    openrouterApiKey: "test-only",
    demoAuth: false,
  };
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "agentia-files-test-"),
  );
  dirs.push(directory);
  const repo = new FileRepository(env, directory);
  const service = new FileGenerationService(env, repo, model);
  const store = new MemoryStore({
    databaseSync: false,
    diskPersistence: false,
  });
  const app = createApp({ env, store, fileService: service }).app;
  const user = {
    id: randomUUID(),
    email: "owner@example.test",
    plan: "pro" as const,
  };
  return {
    env,
    repo,
    service,
    store,
    app,
    user,
    auth: `Bearer ${signAccessToken(env, user)}`,
    other: `Bearer ${signAccessToken(env, { ...user, id: randomUUID() })}`,
  };
}
describe("file service ownership and persistence", () => {
  it("uses free OpenRouter models for document jobs", () => {
    expect(fileGenerationModelId("nvidia/nemotron-3-ultra:free")).toBe(
      "nex-agi/nex-n2.5-mini:free",
    );
    expect(fileGenerationModelId("qwen/qwen3-coder")).toBe(
      "nex-agi/nex-n2.5-mini:free",
    );
    expect(fileGenerationModelId("nex-agi/nex-n2.5-mini:free")).toBe(
      "nex-agi/nex-n2.5-mini:free",
    );
  });
  it("creates a complete local document when a free model has no quota", () => {
    const documentPlan = createFreeDocumentPlan(
      {
        format: "pdf",
        pages: 5,
        description: "Create a 5 page PDF explaining artificial intelligence for beginners",
      },
      "pdf",
      5,
    );
    const pages = documentPlan.pages.map((_, index) =>
      createFreeContentPage(documentPlan, index),
    );
    expect(documentPlan.count).toBe(5);
    expect(new Set(documentPlan.pages.map((page) => page.title)).size).toBe(5);
    pages.forEach((page, index) =>
      validatePageContent(page, documentPlan, index, pages),
    );
  });
  it.each(["pdf", "docx", "pptx"] as const)(
    "renders the free built-in composer as a valid native %s file",
    async (format) => {
      const documentPlan = createFreeDocumentPlan(
        {
          format,
          pages: format === "pptx" ? undefined : 5,
          slides: format === "pptx" ? 10 : undefined,
          description: `Create a ${format === "pptx" ? "10 slide" : "5 page"} guide to artificial intelligence`,
        },
        format,
        format === "pptx" ? 10 : 5,
      );
      const pages = documentPlan.pages.map((_, index) =>
        createFreeContentPage(documentPlan, index),
      );
      const bytes = await renderFile(documentPlan, pages);
      expect(bytes.length).toBeGreaterThan(100);
      await expect(validateFile(bytes, format, documentPlan.count)).resolves.toBeUndefined();
    },
  );
  it("normalizes structured speaker notes returned by free providers", async () => {
    const { service } = await setup(async () =>
      JSON.stringify({
        ...content(0),
        notes: { speaker: "Explain the worked example.", sources: ["Course notes"] },
      }),
    );
    const parsed = await service.json(
      pageSchema,
      "Write one page",
      "{}",
      new AbortController().signal,
    );
    expect(parsed.notes).toContain("speaker: Explain the worked example.");
    expect(parsed.notes).toContain("sources:");
  });
  it("uses Vercel's managed queue in serverless production while preserving the BullMQ override", () => {
    vi.stubEnv("VERCEL", "1");
    expect(usesManagedVercelFileQueue()).toBe(true);
    vi.stubEnv("FILE_GENERATION_QUEUE_BACKEND", "bullmq");
    expect(usesManagedVercelFileQueue()).toBe(false);
    vi.stubEnv("FILE_GENERATION_QUEUE_BACKEND", "vercel");
    expect(usesManagedVercelFileQueue()).toBe(true);
  });
  it("accepts multiple configured browser origins without an invalid CSP", async () => {
    const { env, store, service } = await setup();
    const app = createApp({
      env: {
        ...env,
        corsOrigin: "https://first.example,https://second.example",
      },
      store,
      fileService: service,
    }).app;
    for (const origin of ["https://first.example", "https://second.example"])
      await request(app)
        .get("/api/health")
        .set("Origin", origin)
        .expect(200)
        .expect("Access-Control-Allow-Origin", origin);
    await request(app)
      .get("/api/health")
      .set("Origin", "https://untrusted.example")
      .expect(403);
  });
  it("creates an assistant conversation for the file button and avoids duplicate history", async () => {
    const { app, auth, store, user } = await setup();
    const assistant = store.createAssistant(user.id, {
      name: "File Assistant",
      description: "Documents",
      systemPrompt: "Create useful files",
      tone: "professional",
      model: "standard",
      temperature: 0.3,
      isPublic: false,
      enabledTools: [],
      starterPrompts: [],
    });
    const input = {
      description: "Explain artificial intelligence",
      format: "pdf",
      pages: 2,
      assistantId: assistant.id,
      requestId: randomUUID(),
    };
    const first = await request(app)
      .post("/api/files/generate")
      .set("Authorization", auth)
      .send(input)
      .expect(202);
    const id = first.body.file.conversationId;
    expect(store.getConversation(id)?.userId).toBe(user.id);
    expect(store.listMessages(id)).toHaveLength(2);
    await request(app)
      .post("/api/files/generate")
      .set("Authorization", auth)
      .send({ ...input, conversationId: id })
      .expect(202);
    expect(store.listMessages(id)).toHaveLength(2);
  });
  it("exposes a safe actionable migration error instead of a generic failure", async () => {
    const { app, auth, repo } = await setup();
    vi.spyOn(repo, "assertConfigured").mockRejectedValue(
      new HttpError(503, "internal diagnostic", "FILES_MIGRATION_REQUIRED"),
    );
    const result = await request(app)
      .post("/api/files/generate")
      .set("Authorization", auth)
      .send({ description: "Make a PDF" })
      .expect(503);
    expect(result.body.error.code).toBe("FILES_MIGRATION_REQUIRED");
    expect(result.body.error.message).toContain("migration 016");
    expect(result.body.error.message).not.toContain("internal diagnostic");
  });
  it("runs chat -> pipeline -> storage -> authenticated download and reload, retaining edits", async () => {
    const model = vi.fn(async (_system: string, prompt: string) => {
      const p = JSON.parse(prompt);
      return JSON.stringify(p.page ? content(p.page - 1) : plan("pdf", 5));
    });
    const { app, auth, other, service, repo, env, user } = await setup(model);
    const response = await request(app)
      .post("/api/chat")
      .set("Authorization", auth)
      .send({
        messages: [
          {
            role: "user",
            content: "Create a 5-page PDF about neural networks",
          },
        ],
      })
      .expect(200);
    const meta = JSON.parse(
      response.text
        .split("\n")
        .find((l) => l.startsWith("data:"))!
        .slice(5),
    );
    const file = meta.generatedFile;
    expect(file.status).toBe("queued");
    expect(file.storagePath).toBeUndefined();
    await request(app)
      .get(`/api/files/${file.id}/download`)
      .set("Authorization", auth)
      .expect(409);
    await service.run(file.id);
    const ready = await request(app)
      .get(`/api/files/${file.id}/status`)
      .set("Authorization", auth)
      .expect(200);
    expect(ready.body.file.count).toBe(5);
    await request(app)
      .get(`/api/files/${file.id}/download`)
      .set("Authorization", auth)
      .expect(200)
      .expect("Content-Type", /application\/pdf/);
    const reopened = new FileRepository(env, repo.directory);
    expect((await reopened.owned(file.id, user.id)).status).toBe("completed");
    expect(
      (await reopened.download(await reopened.owned(file.id, user.id))).length,
    ).toBeGreaterThan(100);
    for (const suffix of ["status", "download"])
      await request(app)
        .get(`/api/files/${file.id}/${suffix}`)
        .set("Authorization", other)
        .expect(404);
    await request(app)
      .post(`/api/files/${file.id}/regenerate`)
      .set("Authorization", other)
      .send({ description: "Add a chapter" })
      .expect(404);
    await request(app)
      .get(`/api/conversations/${file.conversationId}/files`)
      .set("Authorization", other)
      .expect(404);
    await request(app)
      .post("/api/files/generate")
      .set("Authorization", other)
      .send({
        description: "A new report",
        conversationId: file.conversationId,
      })
      .expect(404);
    const edit = await request(app)
      .post(`/api/files/${file.id}/regenerate`)
      .set("Authorization", auth)
      .send({ description: "Make it more professional" })
      .expect(202);
    expect(edit.body.file.id).not.toBe(file.id);
    expect(edit.body.file.parentId).toBe(file.id);
    await service.run(edit.body.file.id);
    expect((await repo.get(file.id))!.status).toBe("completed");
    const history = await request(app)
      .get(`/api/conversations/${file.conversationId}/files`)
      .set("Authorization", auth)
      .expect(200);
    expect(history.body.files).toHaveLength(2);
  });
  it("rejects forged tokens, unknown IDs and unsupported formats", async () => {
    const { app, auth } = await setup();
    for (const credential of [
      undefined,
      "Bearer session_other_user",
      "Bearer garbage",
    ]) {
      const req = request(app).get("/api/files");
      if (credential) req.set("Authorization", credential);
      await req.expect(401);
    }
    await request(app)
      .post("/api/files/generate")
      .set("Authorization", auth)
      .send({ description: "a report", format: "exe" })
      .expect(400);
    await request(app)
      .get("/api/files/../../secret/status")
      .set("Authorization", auth)
      .expect(404);
    await request(app)
      .get(`/api/files/${randomUUID()}/download`)
      .set("Authorization", auth)
      .expect(404);
  });
  it("persists useful errors without publishing a download, and bounds concurrent admission", async () => {
    const { service, repo, user } = await setup(async () => "not json");
    vi.spyOn(repo, "upload").mockRejectedValue(new Error("forced storage failure"));
    const first = await service.submit(user.id, {
      description: "Create a PDF",
      requestId: randomUUID(),
    });
    expect((await service.submit(user.id, first.request)).id).toBe(first.id);
    await service.submit(user.id, { description: "Create another PDF" });
    await expect(
      service.submit(user.id, { description: "Create a third PDF" }),
    ).rejects.toThrow(/already generating/);
    await expect(service.run(first.id)).rejects.toThrow(/forced storage failure/);
    const failed = (await repo.get(first.id))!;
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Retry generation");
    await expect(repo.download(failed)).rejects.toThrow(/not ready/);
  });
  it("detects natural file intent without treating ordinary questions as generation", () => {
    expect(likelyFileRequest("Explain what a PDF is")).toBe(false);
    expect(
      likelyFileRequest("Create a 30-slide presentation about AGENTIA"),
    ).toBe(true);
    expect(likelyFileRequest("Make it more professional", true)).toBe(true);
    expect(likelyFileRequest("Add a comparison table", false)).toBe(false);
  });
});
