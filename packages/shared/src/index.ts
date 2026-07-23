// ──────────────────────────────────────────────
// @archmind/shared – Shared types, schemas, and constants
// ──────────────────────────────────────────────
export { API_ROUTES } from "./routes";
export { CORE_RAG_SYSTEM_PROMPT, CONTEXT_INJECTION_TEMPLATE, RAG_FALLBACK_TEMPLATE, TONE_TEMPLATES } from "./prompts";
export { generateAssistantOpeningExperience } from "./opening";
export type { AssistantOpeningExperience, AssistantOpeningInput } from "./opening";
export {
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetConfirmSchema,
  chatRequestSchema,
  aiChatRequestSchema,
  urlSourceSchema,
  assistantCreateSchema,
  assistantUpdateSchema,
  assistantActionSchema,
  assistantActionUpdateSchema,
  bridgeRunSchema,
  approvalDecisionSchema,
} from "./schemas";
export type {
  PlanName,
  AssistantCreateInput,
  AssistantUpdateInput,
  AssistantActionInput,
  AssistantActionUpdateInput,
} from "./schemas";
