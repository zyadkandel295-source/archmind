import type { Env } from "../config/env";
import type { AssistantRecord } from "../types";
import { OpenRouterService, type OpenRouterChatParams } from "./openrouter-service";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type TaskType = "normal" | "math" | "coding" | "research";

export interface GroqChoice {
  provider: "openrouter";
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

export function chooseGroqModel(
  userMessage: string,
  env: Env,
  assistantConfig?: Pick<AssistantRecord, "model"> | null
): GroqChoice {
  const taskType = detectTaskType(userMessage);

  return {
    provider: "openrouter",
    model: assistantConfig?.model || env.openrouterDefaultModel,
    taskType,
    reason: assistantConfig?.model ? "assistant_model" : "default_model"
  };
}

export const choose_provider_and_model = chooseGroqModel;

export async function generateAiResponse(input: {
  env: Env;
  userMessage?: string;
  messages?: AiMessage[];
  chatHistory?: AiMessage[] | null;
  temperature?: number;
  assistantConfig?: Pick<AssistantRecord, "model"> | null;
  userId?: string;
}) {
  const userMessage = input.userMessage ?? (input.messages ? extractUserMessage(input.messages) : "");
  const openrouter = new OpenRouterService(input.env);

  let systemPrompt: string | undefined;
  const history: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];

  if (input.messages) {
    for (const msg of input.messages) {
      if (msg.role === "system" && !systemPrompt) {
        systemPrompt = msg.content;
      } else {
        history.push(msg);
      }
    }
  } else if (input.chatHistory) {
    for (const msg of input.chatHistory) {
      if (msg.role === "system" && !systemPrompt) {
        systemPrompt = msg.content;
      } else {
        history.push(msg);
      }
    }
  }

  const params: OpenRouterChatParams = {
    userId: input.userId || "anonymous_user",
    message: userMessage,
    type: "auto",
    history,
    systemPrompt,
    temperature: input.temperature
  };

  const result = await openrouter.chat(params);
  if (result.success) {
    return result.answer;
  }

  console.error(`[OpenRouter AI Response Error] ${result.errorCode}: ${result.message}`);
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
