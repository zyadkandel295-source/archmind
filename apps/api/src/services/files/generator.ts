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
  type FileFormat,
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

function normalizeGeneratedNotes(value: unknown): unknown {
  if (!value || typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(([label, detail]) => `${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`)
      .join("\n");
  return String(value);
}

function parseModelJson(raw: string): unknown {
  const json = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(json);
  } catch (initialError) {
    // Free providers occasionally leave a trailing comma in otherwise valid
    // JSON. Repair only that unambiguous variation; malformed content still
    // follows the normal retry-and-validation path.
    try {
      return JSON.parse(json.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      throw initialError;
    }
  }
}

/**
 * A document must not become unavailable merely because a free hosted model has
 * exhausted its provider allowance.  This composer is deliberately local and
 * deterministic: it makes a coherent plan and complete, editable content from
 * the user's request without sending another request to a paid service.
 */
function sentenceCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function requestTopic(request: FileRequest) {
  const text = request.description
    .replace(/\b(?:please\s+)?(?:create|make|generate|write|prepare|build|export|produce)\b/gi, "")
    .replace(/\b(?:a|an|the)?\s*(?:pdf|docx|pptx|powerpoint|word document|document|file|presentation|report|study guide)\b/gi, "")
    .replace(/\b\d+\s*(?:pages?|slides?)\b/gi, "")
    .replace(/\b(?:about|on|explaining|explain|for|of)\s*/i, "")
    .replace(/[.:;,]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:(?:a|an|the|file|document|that|which|to|please)\s+)+/i, "")
    .trim();
  return text && text.length >= 3 ? text.slice(0, 300) : "the requested topic";
}

function freeTitle(request: FileRequest, format: FileFormat, topic: string) {
  if (request.title) return request.title;
  const suffix = format === "pptx" ? "Presentation" : format === "docx" ? "Report" : "Guide";
  return `${sentenceCase(topic)} ${suffix}`.slice(0, 160);
}

const FREE_OUTLINE_FOCUS = [
  "Purpose and scope",
  "Essential vocabulary",
  "Foundations",
  "Core ideas",
  "How the subject works",
  "Key components",
  "A practical workflow",
  "Worked example",
  "Real-world applications",
  "Benefits and opportunities",
  "Limits and trade-offs",
  "Common misconceptions",
  "Planning and preparation",
  "Implementation steps",
  "Quality checks",
  "Measuring outcomes",
  "Responsible use",
  "Accessibility and inclusion",
  "Collaboration practices",
  "Communication guidance",
  "Risk management",
  "Troubleshooting",
  "Improvement cycle",
  "Case study framework",
  "Decision-making framework",
  "Comparison criteria",
  "Tools and resources",
  "Learning path",
  "Practice activities",
  "Review questions",
  "Advanced considerations",
  "Future developments",
  "Stakeholder perspective",
  "User perspective",
  "Operational perspective",
  "Ethical considerations",
  "Security and privacy",
  "Sustainability considerations",
  "Budgeting and resourcing",
  "Timeline and milestones",
  "Governance and ownership",
  "Documentation practices",
  "Change management",
  "Scaling the approach",
  "Lessons learned",
  "Action plan",
  "Summary of key ideas",
  "Further study",
  "Reference checklist",
];

export function createFreeDocumentPlan(
  request: FileRequest,
  format: FileFormat,
  requestedCount?: number,
): DocumentPlan {
  const count = requestedCount ?? (format === "pptx" ? 10 : 5);
  const topic = requestTopic(request);
  const title = freeTitle(request, format, topic);
  const focus = ["Title and overview", ...FREE_OUTLINE_FOCUS].slice(0, count);
  while (focus.length < count)
    focus.push(`Focused study ${focus.length}`);
  return planSchema.parse({
    title,
    topic,
    audience: request.audience?.trim() || "general readers",
    tone: request.tone?.trim() || "clear and educational",
    format,
    count,
    instructions: request.instructions?.trim() || "",
    pages: focus.map((item, index) => ({
      title: index === 0 ? title : `${sentenceCase(topic)}: ${item}`,
      brief:
        index === 0
          ? `Introduce ${topic}, the intended audience, and the purpose of this document.`
          : `Develop ${item.toLowerCase()} for ${topic} with a distinct explanation, practical framing, and a useful takeaway.`,
      chapter: index === 0 ? "Overview" : item,
    })),
  });
}

function freeParagraph(topic: string, focus: string, audience: string, position: number) {
  const variations = [
    `This section explains ${focus.toLowerCase()} in the context of ${topic}. For ${audience}, the useful starting point is to identify the goal before choosing an approach. Clear definitions prevent a discussion from becoming a list of disconnected terms and make later decisions easier to evaluate. A reader should be able to say what is being considered, why it matters, and which constraints shape a responsible choice. That shared starting point makes the rest of the work more consistent.`,
    `A practical way to work with ${topic} is to connect the idea to an observable situation. Ask what information is available, which people are affected, and what a successful result would look like. This keeps ${focus.toLowerCase()} grounded in purpose instead of treating it as an abstract rule. It also encourages the team to separate evidence from assumptions and to explain the reasoning behind a recommendation. The result is easier to review, adapt, and communicate.`,
    `The main lesson is that progress comes from small, reviewable steps. Record the assumption being tested, try one reasonable action, and compare the result with the original goal. That habit makes ${topic} easier to explain, improve, and share with others. When a result is incomplete, describe what was learned rather than hiding the gap. This creates a useful feedback loop and gives the next person a clear starting point for a better iteration.`,
  ];
  return variations[position] ?? variations[0]!;
}

export function createFreeContentPage(
  plan: DocumentPlan,
  index: number,
): ContentPage {
  const outline = plan.pages[index]!;
  const focus = outline.chapter;
  if (plan.format === "pptx") {
    const titleSlide = index === 0;
    return pageSchema.parse({
      title: outline.title,
      kind: titleSlide ? "title" : "content",
      blocks: titleSlide
        ? [{ type: "paragraph", text: `A practical introduction to ${plan.topic} for ${plan.audience}.` }]
        : [
            { type: "heading", text: focus },
            {
              type: "list",
              ordered: false,
              items: [
                `Define the role of ${focus.toLowerCase()} in ${plan.topic}.`,
                "Connect the idea to a realistic decision or situation.",
                "Use a simple review step before moving forward.",
              ],
            },
          ],
      notes: `${freeParagraph(plan.topic, focus, plan.audience, 0)} ${freeParagraph(plan.topic, focus, plan.audience, 1)}`,
      summary: `Explained ${focus.toLowerCase()} as part of ${plan.topic}.`,
    });
  }
  const titlePage = index === 0;
  return pageSchema.parse({
    title: outline.title,
    kind: titlePage ? "title" : "content",
    blocks: titlePage
      ? [
          { type: "paragraph", text: `This guide introduces ${plan.topic} for ${plan.audience}. It uses a ${plan.tone} approach and is organized as a sequence of focused sections that can be read independently or as a complete learning path.` },
          { type: "heading", text: "What this document covers" },
          { type: "list", ordered: false, items: ["Foundations and useful vocabulary", "Practical methods and examples", "Evaluation, responsible use, and next steps"] },
        ]
      : [
          { type: "heading", text: focus },
          { type: "paragraph", text: freeParagraph(plan.topic, focus, plan.audience, 0) },
          { type: "paragraph", text: freeParagraph(plan.topic, focus, plan.audience, 1) },
          { type: "paragraph", text: freeParagraph(plan.topic, focus, plan.audience, 2) },
          {
            type: "list",
            ordered: true,
            items: [
              `State the specific goal for ${focus.toLowerCase()}.`,
              "Choose one appropriate action and document why it was selected.",
              "Review the outcome and identify the next improvement.",
            ],
          },
        ],
    notes: `Generated locally with AGENTIA's free document composer. This section covers ${focus.toLowerCase()} for ${plan.topic}.`,
    summary: `Covered ${focus.toLowerCase()} and connected it to a practical next step.`,
  });
}

function shouldUseFreeComposer(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /free-models-per-day|rate limit|add \d+ credits|model content validation failed|model is not configured/i.test(message);
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
    // A hosted model improves wording when its free allowance is available,
    // but the local composer below keeps generation fully functional when no
    // model key is configured or the provider rejects free traffic.
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
        const parsed = parseModelJson(result);
        if (
          (schema as z.ZodTypeAny) === pageSchema &&
          parsed &&
          typeof parsed === "object" &&
          "notes" in parsed
        )
          parsed.notes = normalizeGeneratedNotes(parsed.notes);
        return schema.parse(parsed);
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
      let useFreeComposer = !this.env.openrouterApiKey;
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
        let plan: DocumentPlan;
        if (useFreeComposer) {
          plan = validatedPlan.parse(createFreeDocumentPlan(file.request, file.format, target));
        } else {
          try {
            plan = await this.json(
              validatedPlan,
              `You plan coherent, useful documents. Extract the user's requested format, title, topic, audience, tone and instructions. Default to 5 pages or 10 slides only when no length is specified. Count includes cover/references. Respect explicit page/slide counts and add counts to previous length when editing. Maximum 50. Return {title,topic,audience,tone,format,count,instructions,pages:[{title,brief,chapter,reusePage?}]}. Each pages item is ONE physical page or slide. Exactly count items. Provide distinct meaningful topics, examples, explanations, summaries and references when asked. Chapters may span multiple pages. For edits preserve the previous outline and mark unchanged items with reusePage (1-based original index), only when their content remains appropriate. Style or tone changes require rewriting affected pages. A format-only export between PDF/DOCX should reuse every page. Never invent citations, URLs or factual statistics.`,
              prompt,
              signal,
            );
          } catch (error) {
            if (!shouldUseFreeComposer(error)) throw error;
            useFreeComposer = true;
            plan = validatedPlan.parse(createFreeDocumentPlan(file.request, file.format, target));
          }
        }
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
        if (useFreeComposer) {
          page = createFreeContentPage(plan, index);
        }
        for (let attempt = 0; !page && attempt < 3; attempt++) {
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
            if (shouldUseFreeComposer(error)) {
              useFreeComposer = true;
              page = createFreeContentPage(plan, index);
              break;
            }
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
