import type { Env } from "../config/env";
import type { AssistantRecord } from "../types";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type TaskType = "normal" | "math" | "coding" | "research";

export interface AiChoice {
  provider: "under_development";
  model: string;
  taskType: TaskType;
  reason: string;
}

export const AI_PROVIDERS_UNAVAILABLE_MESSAGE =
  "This LLM model is currently under development. We will be in touch soon!";

function extractUserMessage(messages: AiMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

export function detectTaskType(message: string): TaskType {
  const lower = message.toLowerCase();
  if (/calculus|integral|derivative|equation|algebra|proof|solve for|matrix/.test(lower)) return "math";
  if (/code|coding|debug|bug|function|import|const|python|typescript|javascript|react/.test(lower)) return "coding";
  if (message.length > 1200 || lower.includes("research") || lower.includes("paper")) return "research";
  return "normal";
}

export function chooseAiModel(
  userMessage: string,
  _env: Env,
  assistantConfig?: Pick<AssistantRecord, "model"> | null
): AiChoice {
  const taskType = detectTaskType(userMessage);

  return {
    provider: "under_development",
    model: assistantConfig?.model || "auto",
    taskType,
    reason: assistantConfig?.model ? "assistant_model" : "default_model"
  };
}

export const choose_provider_and_model = chooseAiModel;

export async function generateAiResponse(_input: {
  env: Env;
  userMessage?: string;
  messages?: AiMessage[];
  chatHistory?: AiMessage[] | null;
  temperature?: number;
  assistantConfig?: Pick<AssistantRecord, "model"> | null;
  userId?: string;
}) {
  return AI_PROVIDERS_UNAVAILABLE_MESSAGE;
}

export async function generateAssistantResponse(input: {
  env: Env;
  assistant: Pick<AssistantRecord, "systemPrompt" | "model" | "temperature">;
  userMessage: string;
  chatHistory?: AiMessage[] | null;
  userId?: string;
}) {
  return generateAiResponse({
    env: input.env,
    userMessage: input.userMessage,
    chatHistory: [
      { role: "system", content: input.assistant.systemPrompt },
      ...(input.chatHistory ?? [])
    ],
    assistantConfig: input.assistant,
    temperature: input.assistant.temperature,
    userId: input.userId
  });
}

export const generate_ai_response = generateAiResponse;
