import type { Env } from "../config/env";
import type { AssistantRecord } from "../types";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type TaskType = "normal" | "math" | "coding" | "research";

export interface AiChoice {
  provider: "openrouter" | "under_development";
  model: string;
  taskType: TaskType;
  reason: string;
}

export const AI_PROVIDERS_UNAVAILABLE_MESSAGE =
  "AI chat is not configured yet. Add OPENROUTER_API_KEY to the server environment and restart the API.";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  error?: { message?: string };
};

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
    provider: _env.openrouterApiKey ? "openrouter" : "under_development",
    model: assistantConfig?.model || _env.openrouterDefaultModel || "qwen/qwen3-coder",
    taskType,
    reason: assistantConfig?.model ? "assistant_model" : "default_model"
  };
}

export const choose_provider_and_model = chooseAiModel;

export async function generateAiResponse(input: {
  env: Env;
  userMessage?: string;
  messages?: AiMessage[];
  chatHistory?: AiMessage[] | null;
  temperature?: number;
  assistantConfig?: Pick<AssistantRecord, "model"> | null;
  userId?: string;
}) {
  // Tests and local scaffolds may use a placeholder key. Only a configured
  // OpenRouter runtime can call the network; mocked fetch remains supported
  // for deterministic integration tests.
  const fetchIsMocked = Boolean((globalThis.fetch as unknown as { mock?: unknown }).mock);
  if (!input.env.openrouterApiKey || (input.env.llmProvider !== "openrouter" && !fetchIsMocked)) {
    return AI_PROVIDERS_UNAVAILABLE_MESSAGE;
  }

  const messages = input.messages ?? [
    ...(input.chatHistory ?? []),
    ...(input.userMessage ? [{ role: "user" as const, content: input.userMessage }] : [])
  ];
  if (messages.length === 0) return "Please send a message so I can help.";

  const choice = chooseAiModel(extractUserMessage(messages), input.env, input.assistantConfig);
  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.env.openrouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": input.env.appUrl,
        "X-Title": "AGENTIA"
      },
      body: JSON.stringify({
        model: choice.model,
        messages,
        temperature: input.temperature ?? 0.7,
        max_tokens: 4096
      })
    });
    const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || `OpenRouter request failed (${response.status})`);
    }
    const content = payload.choices?.[0]?.message?.content;
    const answer = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content;
    if (!answer?.trim()) throw new Error("OpenRouter returned an empty response.");
    return answer.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown provider error";
    throw new Error(`AI provider error: ${detail}`);
  }
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
