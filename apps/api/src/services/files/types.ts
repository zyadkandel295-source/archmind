import { z } from "zod";

export const formatSchema = z.enum(["pdf", "docx", "pptx"]);
export type FileFormat = z.infer<typeof formatSchema>;
export const fileRequestSchema = z
  .object({
    description: z.string().trim().min(3).max(10000),
    format: formatSchema.optional(),
    title: z.string().trim().min(1).max(160).optional(),
    pages: z.number().int().min(1).max(50).optional(),
    slides: z.number().int().min(1).max(50).optional(),
    audience: z.string().max(300).optional(),
    tone: z.string().max(300).optional(),
    instructions: z.string().max(5000).optional(),
    conversationId: z.string().uuid().optional(),
    assistantId: z.string().max(150).optional(),
    parentId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
  })
  .strict();
export type FileRequest = z.infer<typeof fileRequestSchema>;
const text = z.string().trim().min(1).max(3000);
export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text }),
  z.object({ type: z.literal("heading"), text: text.max(120) }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean().default(false),
    items: z.array(text.max(350)).min(1).max(8),
  }),
  z.object({
    type: z.literal("table"),
    headers: z.array(text.max(80)).min(2).max(5),
    rows: z
      .array(z.array(text.max(180)).min(2).max(5))
      .min(1)
      .max(8),
  }),
  z.object({
    type: z.literal("diagram"),
    steps: z.array(text.max(100)).min(2).max(5),
  }),
]);
export const pageSchema = z.object({
  title: text.max(120),
  kind: z
    .enum(["title", "section", "content", "references"])
    .default("content"),
  blocks: z.array(blockSchema).min(1).max(10),
  notes: z.string().max(4000).default(""),
  summary: text.max(600),
});
export type ContentPage = z.infer<typeof pageSchema>;
export const planSchema = z.object({
  title: text.max(160),
  topic: text.max(500),
  audience: text.max(300),
  tone: text.max(200),
  format: formatSchema,
  count: z.number().int().min(1).max(50),
  instructions: z.string().max(5000).default(""),
  pages: z
    .array(
      z.object({
        title: text.max(120),
        brief: text.max(700),
        chapter: text.max(120),
        reusePage: z.number().int().min(1).max(50).optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type DocumentPlan = z.infer<typeof planSchema>;
export type FileStatus =
  "queued" | "generating" | "rendering" | "completed" | "failed";
export interface GeneratedFile {
  id: string;
  userId: string;
  conversationId: string;
  assistantId?: string;
  request: FileRequest;
  requestId: string;
  parentId?: string;
  filename: string;
  format: FileFormat;
  createdAt: string;
  updatedAt: string;
  status: FileStatus;
  stage: string;
  completedUnits: number;
  totalUnits: number;
  size: number;
  count: number;
  storagePath?: string;
  error?: string;
  countIsEstimate?: boolean;
  plan?: DocumentPlan;
  pages: ContentPage[];
}
export const MIME: Record<FileFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export function fileView(file: GeneratedFile) {
  const { storagePath, pages, userId, ...view } = file;
  return view;
}
export function cleanFilename(title: string, format: FileFormat) {
  const stem = title
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 100);
  return `${stem && !/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(stem) ? stem : "AGENTIA_Document"}.${format}`;
}
export function pageText(page: ContentPage) {
  return page.blocks
    .map((b) =>
      b.type === "paragraph" || b.type === "heading"
        ? b.text
        : b.type === "list"
          ? b.items.join(" ")
          : b.type === "diagram"
            ? b.steps.join(" ")
            : [...b.headers, ...b.rows.flat()].join(" "),
    )
    .join("\n");
}
