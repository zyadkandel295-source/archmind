// ──────────────────────────────────────────────
// Zod schemas and inferred types shared between API and Web
// ──────────────────────────────────────────────
import { z } from "zod";

// ─── Plan ────────────────────────────────────
export const planNames = ["free", "pro", "business", "enterprise"] as const;
export type PlanName = (typeof planNames)[number];

// ─── Auth schemas ────────────────────────────
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

// ─── Chat schemas ────────────────────────────
export const chatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  responseLength: z.string().default("medium"),
  language: z.string().default("English"),
});

export const aiChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    })
  ),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

// ─── Source schemas ──────────────────────────
export const urlSourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
});

// ─── Assistant schemas ──────────────────────
export const assistantCreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  systemPrompt: z.string().optional(),
  instructions: z.string().optional(),
  tone: z.enum(["professional", "casual", "teacher", "custom"]),
  isPublic: z.boolean().default(false),
  visibility: z.enum(["public", "private"]).optional(),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  icon: z.string().optional(),
  color: z.string().optional(),
  starterPrompts: z.array(z.string()).default([]),
  enabledTools: z.array(z.string()).default([]),
});

export type AssistantCreateInput = z.infer<typeof assistantCreateSchema>;

export const assistantUpdateSchema = assistantCreateSchema.partial();
export type AssistantUpdateInput = z.infer<typeof assistantUpdateSchema>;

export const assistantActionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["webhook", "whatsapp_share", "copy", "mailto", "external_url"]),
  enabled: z.boolean().default(true),
  config: z.record(z.unknown()).default({}),
});

export type AssistantActionInput = z.infer<typeof assistantActionSchema>;

export const assistantActionUpdateSchema = assistantActionSchema.partial();
export type AssistantActionUpdateInput = z.infer<typeof assistantActionUpdateSchema>;

// ─── Execution Bridge schemas ───────────────
export const bridgeRunSchema = z.object({
  message: z.string().min(1),
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
});

