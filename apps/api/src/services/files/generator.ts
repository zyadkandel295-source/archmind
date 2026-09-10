import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Queue } from "bullmq";
import { send as sendVercelQueue } from "@vercel/queue";
import type { Env } from "../../config/env";
import { HttpError } from "../../lib/http-error";
import { generateAiResponse } from "../ai-service";
import { FileRepository } from "./repository";
import { usesManagedVercelFileQueue } from "./queue-runtime";
import { validateContentPage, renderFile } from "./render";
import { validateOfficePagination } from "./office-validation";
import {
  cleanFilename,
  pageSchema,
  pageText,
  planSchema,
  type ContentPage,
  type FileRequest,
  type GeneratedFile,
  type DocumentPlan,
} from "./types";

export function validatePageContent(
  page: ContentPage,
  plan: DocumentPlan,
  index: number,
  pages: ContentPage[],
) {
  if (page.title !== plan.pages[index]?.title)
    throw new Error(
      `Follow this outline item exactly: ${plan.pages[index]?.title}. Do not write a different page's topic.`,
    );
  const content = pageText(page);
  if (
    /\[(?:your|insert|add|author|name|date|company|placeholder)[^\]]*\]|lorem ipsum|\bTODO\b/i.test(
      content,
    )
  )
    throw new Error(
      "Remove placeholder fields; use only supplied information or omit the field.",
    );
  const words = content.split(/\s+/).length;
  const minWords = page.blocks.some(
    (b) => b.type === "table" || b.type === "diagram",
  )
    ? 120
    : 220;
  if (plan.format !== "pptx" && page.kind === "content" && words < minWords)
    throw new Error(
      `Page has only ${words} words. Write at least ${minWords + 40} words with concrete explanations and examples.`,
    );
  if (
    page.blocks.some(
      (b) =>
        b.type === "table" &&
        b.rows.some((row) => row.length !== b.headers.length),
    )
  )
    throw new Error("Table rows must match the header column count.");
  if (pages.some((p, i) => i !== index && pageText(p) === content))
    throw new Error("Duplicate content. Write new material for this page.");
  if (
    /\d+(?:\.\d+)?\s*%/.test(content) &&
    !/illustrative|hypothetical|suppose|assum(?:e|ing)/i.test(
      content + page.notes,
    )
  )
    throw new Error(
      "Unverified percentage statistics are not allowed. Remove the figures or use an explicitly labelled hypothetical worked example.",
    );
}

export const FILE_QUEUE = "archmind-file-generation";
export const FILE_WORKER_HEARTBEAT = "archmind:file-worker:heartbeat";
const FILE_GENERATION_RELIABLE_MODEL = "nex-agi/nex-n2.5-mini:free";
/** File creation is deliberately restricted to OpenRouter's free model tier. */
export function fileGenerationModelId(requestedModel: string) {
  if (
    requestedModel === "nvidia/nemotron-3-ultra:free" ||
    !requestedModel.endsWith(":free")
  )
    return FILE_GENERATION_RELIABLE_MODEL;
  return requestedModel;
}
export function likelyFileRequest(text: string, hasPrevious = false) {
  if (
    /\b(?:create|make|generate|write|prepare|build|export|produce|download)\b/i.test(
      text,
    ) &&
    /\b(?:pdf|docx|pptx|powerpoint|word document|presentation|report|study guide|business proposal|\d+[ -]page)\b/i.test(
      text,
    )
  )
    return true;
  return (
    hasPrevious &&
    /^(?:please\s+)?(?:add|remove|shorten|expand|change|revise|edit|rewrite|make (?:it|this)|export|convert|create a (?:pdf|docx|word)|retry|regenerate)\b/i.test(
      text.trim(),
    )
  );
}
export type JsonModel = (
  system: string,
  prompt: string,
  signal: AbortSignal,
) => Promise<string>;
export class FileGenerationService {
  readonly repository: FileRepository;
  readonly model: JsonModel;
  constructor(
    readonly env: Env,
    repository?: FileRepository,
    model?: JsonModel,
    readonly queuePrefix = "bull",
  ) {
    this.repository = repository ?? new FileRepository(env);
    const configuredModel =
      process.env.FILE_GENERATION_MODEL || env.openrouterDefaultModel;
    // The historical free Nemotron alias returns empty structured completions.
    // Keep all document jobs on the free tier even if a general chat model is
    // configured separately, so file generation never creates paid usage.
    const modelId = fileGenerationModelId(configuredModel);
    this.model =
      model ??
      ((system, prompt, signal) =>
        generateAiResponse({
          env,
          assistantConfig: { model: modelId },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          temperature: 0.35,
          // Keep the largest request below the OpenRouter allowance used by
          // this deployment. Six thousand tokens is ample for a 50-unit
          // outline and prevents the queue from failing before generation.
          maxTokens: system.includes("You plan") ? 6000 : 3000,
          signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
        }));
  }
  async submit(userId: string, request: FileRequest) {
    await this.repository.assertConfigured();
    if (this.env.nodeEnv === "production" && !usesManagedVercelFileQueue()) {
      const queue = new Queue(FILE_QUEUE, {
        prefix: this.queuePrefix,
        connection: { url: this.env.redisUrl, maxRetriesPerRequest: 1 },
      });
      try {
        if (!(await (await queue.client).get(FILE_WORKER_HEARTBEAT)))
          throw new Error("Worker offline");
      } catch {
        throw new HttpError(
          503,
          "The document worker is temporarily unavailable. Please try again shortly.",
          "FILE_WORKER_UNAVAILABLE",
        );
      } finally {
        await queue.close();
      }
    }
    if (!this.env.openrouterApiKey)
      throw new HttpError(
        503,
        "The document generation model is not configured.",
        "FILES_MODEL_UNAVAILABLE",
      );
    const parent = request.parentId
      ? await this.repository.owned(request.parentId, userId)
      : undefined;
    if (
      parent &&
      ((request.conversationId &&
        parent.conversationId !== request.conversationId) ||
        (request.assistantId && parent.assistantId !== request.assistantId))
    )
      throw new HttpError(
        404,
        "Previous file not found in this conversation.",
        "FILE_NOT_FOUND",
      );
    const retry =
      parent && /^retry generation$/i.test(request.description.trim());
    if (retry)
      request = {
        ...parent.request,
        parentId: parent.id,
        requestId: request.requestId,
      };
    const format =
      request.format ??
      (/\b(pptx|powerpoint|slides?|presentation)\b/i.test(request.description)
        ? "pptx"
        : /\b(docx|word)\b/i.test(request.description)
          ? "docx"
          : /\bpdf\b/i.test(request.description)
            ? "pdf"
            : (parent?.format ?? "pdf"));
    const numeric = request.description.match(
      /\b(\d+)\s*[- ]?\s*(?:more\s+|additional\s+)?(?:pages?|slides?)\b/i,
    );
    const naturalLength =
      numeric &&
      Number(numeric[1]) +
        (parent && /\badd\b/i.test(request.description)
          ? (parent.plan?.count ?? 0)
          : 0);
    if (naturalLength && naturalLength > 50)
      throw new HttpError(
        400,
        "Documents support up to 50 pages or slides.",
        "FILE_SIZE_LIMIT",
      );
    if (
      (request.slides && format !== "pptx") ||
      (request.pages && format === "pptx")
    )
      throw new HttpError(
        400,
        "Use slides for PowerPoint and pages for documents.",
        "INVALID_FILE_LENGTH",
      );
    const time = new Date().toISOString();
    const candidate: GeneratedFile = {
      id: randomUUID(),
      userId,
      conversationId:
        parent?.conversationId ?? request.conversationId ?? randomUUID(),
      assistantId: parent?.assistantId ?? request.assistantId,
      request,
      requestId: request.requestId ?? randomUUID(),
      parentId: parent?.id,
      filename: cleanFilename(
        request.title ?? parent?.plan?.title ?? "Document",
        format,
      ),
      format,
      createdAt: time,
      updatedAt: time,
      status: "queued",
      stage: "Queued",
      completedUnits: 0,
      totalUnits: 0,
      size: 0,
      count: 0,
      pages: [],
    };
    if (retry && parent?.plan) {
      candidate.plan = parent.plan;
      candidate.pages = parent.pages;
      candidate.completedUnits = parent.pages.length;
      candidate.totalUnits = parent.plan.count;
      candidate.filename = parent.filename;
    }
    const file = await this.repository.create(candidate);
    if (
      file.id === candidate.id &&
      (this.env.redisUrl || usesManagedVercelFileQueue())
    ) {
      // Metadata is also the outbox. Worker reconciliation recovers enqueue/network failures.
      try {
        await this.enqueue(file.id);
      } catch {
        if (usesManagedVercelFileQueue()) {
          file.status = "failed";
          file.stage = "Failed";
          file.error = "Document generation could not be queued. Retry generation.";
          await this.repository.save(file);
          throw new HttpError(
            503,
            "The document-generation queue is temporarily unavailable. Please try again shortly.",
            "FILE_WORKER_UNAVAILABLE",
          );
        }
        /* Reconciled by the worker from durable queued records. */
      }
    }
    return file;
  }
  async enqueue(id: string) {
    if (usesManagedVercelFileQueue()) {
      await sendVercelQueue(
        FILE_QUEUE,
        { fileId: id },
        { idempotencyKey: id, retentionSeconds: 604800 },
      );
      return;
    }
    if (!this.env.redisUrl) return;
    const queue = new Queue(FILE_QUEUE, {
      prefix: this.queuePrefix,
      connection: {
        url: this.env.redisUrl,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    });
    try {
      await queue.waitUntilReady();
      await queue.add(
        "generate-file",
        { fileId: id },
        {
          jobId: id,
          attempts: 3,
          backoff: { type: "exponential", delay: 10000 },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } finally {
      await queue.close();
    }
  }
  async json<S extends z.ZodTypeAny>(
    schema: S,
    system: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<z.output<S>> {
    let problem = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      signal.throwIfAborted();
      try {
        const result = await this.model(
          `${system}\nReturn only valid JSON. No markdown fences. Never claim to create files yourself.`,
          `${prompt}${problem ? `\nPrevious response was invalid: ${problem}. Correct it.` : ""}`,
          signal,
        );
        return schema.parse(
          JSON.parse(
            result
              .trim()
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```$/, ""),
          ),
        );
      } catch (error) {
        if (signal.aborted) throw error;
        problem =
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Invalid JSON";
      }
    }
    throw new Error(`Model content validation failed: ${problem}`);
  }
  async run(id: string) {
    const file = await this.repository.get(id);
    if (!file || file.status === "completed") return;
    const remaining =
      60 * 60 * 1000 - (Date.now() - Date.parse(file.createdAt));
    const signal = AbortSignal.timeout(Math.max(1, remaining));
    const save = () => this.repository.save(file);
    try {
      file.status = "generating";
      file.error = undefined;
      file.stage = "Analyzing request";
      await save();
      const parent = file.parentId
        ? await this.repository.owned(file.parentId, file.userId)
        : undefined;
      if (parent && !["completed", "failed"].includes(parent.status))
        throw new Error(
          "The previous document is not ready. Retry after it finishes.",
        );
      if (!file.plan) {
        file.stage = "Preparing outline";
        await save();
        const prompt = JSON.stringify({
          request: file.request,
          defaultFormat: file.format,
          previous: parent?.plan,
        });
        const naturalCount = file.request.description.match(
          /\b(\d+)\s*[- ]?\s*(?:more\s+|additional\s+)?(?:pages?|slides?)\b/i,
        );
        const added =
          parent && /\badd\b/i.test(file.request.description) && naturalCount;
        const target =
          file.request.pages ??
          file.request.slides ??
          (naturalCount
            ? Number(naturalCount[1]) + (added ? (parent!.plan?.count ?? 0) : 0)
            : undefined);
        if (target && target > 50)
          throw new Error("The requested edit exceeds 50 pages or slides.");
        const validatedPlan = planSchema.superRefine((plan, ctx) => {
          if (
            plan.pages.length !== plan.count ||
            (target && plan.count !== target)
          )
            ctx.addIssue({
              code: "custom",
              message: `Return exactly ${target ?? plan.count} outline items and matching count.`,
            });
          if (file.request.format && plan.format !== file.request.format)
            ctx.addIssue({
              code: "custom",
              message: `Use ${file.request.format} format.`,
            });
          if (file.request.title && plan.title !== file.request.title)
            ctx.addIssue({
              code: "custom",
              message: `Preserve the supplied title exactly.`,
            });
          if (
            new Set(plan.pages.map((p) => p.title.toLowerCase())).size !==
            plan.count
          )
            ctx.addIssue({
              code: "custom",
              message: "Every page needs a distinct title and purpose.",
            });
        });
        const plan = await this.json(
          validatedPlan,
          `You plan coherent, useful documents. Extract the user's requested format, title, topic, audience, tone and instructions. Default to 5 pages or 10 slides only when no length is specified. Count includes cover/references. Respect explicit page/slide counts and add counts to previous length when editing. Maximum 50. Return {title,topic,audience,tone,format,count,instructions,pages:[{title,brief,chapter,reusePage?}]}. Each pages item is ONE physical page or slide. Exactly count items. Provide distinct meaningful topics, examples, explanations, summaries and references when asked. Chapters may span multiple pages. For edits preserve the previous outline and mark unchanged items with reusePage (1-based original index), only when their content remains appropriate. Style or tone changes require rewriting affected pages. A format-only export between PDF/DOCX should reuse every page. Never invent citations, URLs or factual statistics.`,
          prompt,
          signal,
        );
        if (plan.pages.length !== plan.count)
          throw new Error("Outline length did not match the requested count.");
        const explicit = file.request.pages ?? file.request.slides;
        if (explicit && plan.count !== explicit)
          throw new Error("Outline did not honor the requested length.");
        if (file.request.format && plan.format !== file.request.format)
          throw new Error("Outline did not honor the requested format.");
        if (
          new Set(plan.pages.map((p) => p.title.toLowerCase())).size !==
          plan.count
        )
          throw new Error("Outline contains duplicate page titles.");
        file.plan = plan;
        file.format = plan.format;
        file.filename = cleanFilename(plan.title, plan.format);
        file.totalUnits = plan.count;
        await save();
      }
      const plan = file.plan;
      for (let index = 0; index < plan.count; index++) {
        signal.throwIfAborted();
        const checkpoint = file.pages[index];
        if (checkpoint) {
          try {
            validatePageContent(checkpoint, plan, index, file.pages);
            await validateContentPage(checkpoint, plan, index);
            continue;
          } catch {
            /* Repair only the invalid saved page. */
          }
        }
        file.stage = `Generating ${plan.format === "pptx" ? "slide" : "page"} ${index + 1}/${plan.count}`;
        await save();
        const outline = plan.pages[index]!;
        const reusable =
          outline.reusePage && parent?.pages[outline.reusePage - 1];
        let page: ContentPage | undefined;
        if (
          reusable &&
          (parent!.format === "pptx") === (plan.format === "pptx")
        )
          page = { ...reusable, title: outline.title };
        let issue = checkpoint
          ? "The saved page overflowed its layout. Use fewer blocks and less visible text."
          : "";
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            page ??= await this.json(
              pageSchema,
              `Write one fully developed page of the supplied document plan, in the requested language and tone. Return {title,kind,blocks,notes,summary}. kind is title|section|content|references. Blocks: {type:"paragraph",text}, {type:"heading",text}, {type:"list",ordered:boolean,items:string[]}, {type:"table",headers:string[],rows:string[][]}, {type:"diagram",steps:string[]}. Use **bold** and *italic* sparingly. No HTML, raw LaTex, remote images, fake citations, placeholder text, repeated padding or fabricated numbers. Tables max 5 columns/6 rows, identical column counts. Diagrams are simple numbered processes. Notes contain speaker explanation and sources. Summary is a short context bridge for subsequent pages. ${plan.format === "pptx" ? "For slides use 35-90 visible words, at most 4 blocks, short bullets or one table. Put detail in speaker notes (100-220 words). Title slides are minimal." : "For document body pages write 260-340 meaningful words with 3-5 substantial paragraphs and optional subheading/list/table. Cover and reference pages may be shorter. Never exceed 370 words. A table replaces some prose. Use content to fill the page; do not pad with repetition."}`,
              JSON.stringify({
                title: plan.title,
                topic: plan.topic,
                audience: plan.audience,
                tone: plan.tone,
                instructions: plan.instructions,
                request: file.request,
                outline: plan.pages,
                currentOutlineItem: outline,
                requiredPageTitle: outline.title,
                page: index + 1,
                previousSummaries: file.pages.map((p) => p.summary),
                previousPage: parent?.pages[index],
                correction: issue,
              }),
              signal,
            );
            validatePageContent(page, plan, index, file.pages);
            await validateContentPage(page, plan, index);
            break;
          } catch (error) {
            issue = error instanceof Error ? error.message : "Invalid page";
            page = undefined;
          }
        }
        if (!page)
          throw new Error(
            `Content validation failed on page ${index + 1}: ${issue}`,
          );
        file.pages[index] = page;
        file.completedUnits = file.pages.length;
        await save();
      }
      file.status = "rendering";
      file.stage = "Formatting document";
      await save();
      const bytes = await renderFile(plan, file.pages);
      if (plan.format !== "pdf") {
        file.stage = "Validating Office layout";
        await save();
        file.countIsEstimate =
          !(await validateOfficePagination(bytes, plan.format, plan.count)) &&
          plan.format === "docx";
      }
      file.stage = "Creating file";
      await save();
      await this.repository.upload(file, bytes);
      file.stage = "Finalizing";
      await save();
      const stored = await this.repository.download({
        ...file,
        status: "completed",
      });
      if (!stored.equals(bytes))
        throw new Error("Stored file verification failed.");
      file.count = plan.count;
      file.status = "completed";
      file.stage = "Ready";
      await save();
    } catch (error) {
      const stage = file.stage;
      console.error("[File generation]", {
        id: file.id,
        stage,
        error: error instanceof Error ? error.message : "Unknown failure",
      });
      file.status = "failed";
      file.error = `Document generation failed during ${stage.toLowerCase()}. Retry generation.`;
      file.stage = "Failed";
      await save();
      throw error;
    }
  }
}
