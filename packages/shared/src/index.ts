// ──────────────────────────────────────────────
// @archmind/shared – Shared types, schemas, and constants
// ──────────────────────────────────────────────
export { API_ROUTES } from "./routes";
export { CORE_RAG_SYSTEM_PROMPT, CONTEXT_INJECTION_TEMPLATE, RAG_FALLBACK_TEMPLATE, TONE_TEMPLATES } from "./prompts";
export { generateAssistantOpeningExperience } from "./opening";
export type { AssistantOpeningExperience, AssistantOpeningInput } from "./opening";
export {
  AGENTIA_APP_MANIFEST_SCHEMA_VERSION,
  agentiaAppManifestSchema,
  appArchitectureSchema,
  appAuthenticationModeSchema,
  appInferenceModeSchema,
  appPermissionSchema,
  appPlatformSchema,
  canonicalJson,
  containsManifestSecret,
  parseAgentiaAppManifest
} from "./app-manifest";
export type { AgentiaAppManifest } from "./app-manifest";
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
