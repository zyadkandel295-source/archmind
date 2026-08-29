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
  "The assistant service is not ready yet. Please try again shortly.";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  error?: { message?: string };
};

function extractUserMessage(messages: AiMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function resolveConfiguredModel(requestedModel: string | undefined, env: Env) {
  // Browser clients only send opaque response-profile values. Keep the actual
  // configured runtime choice on the server and never expose it in the UI.
  // `llama-3.1-8b-instant` was a legacy Groq identifier persisted on older
  // assistants. It is not a valid OpenRouter model ID, so route it through the
  // production-configured default instead of sending a request the provider
  // will deterministically reject.
  if (!requestedModel || ["standard", "reasoning", "specialist", "llama-3.1-8b-instant"].includes(requestedModel)) {
    return env.openrouterDefaultModel;
  }
  return requestedModel;
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
    model: resolveConfiguredModel(assistantConfig?.model, _env),
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
      throw new Error(payload.error?.message || `Assistant request failed (${response.status})`);
    }
    const content = payload.choices?.[0]?.message?.content;
    const answer = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content;
    if (!answer?.trim()) throw new Error("The assistant returned an empty response.");
    return answer.trim();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown service error";
    throw new Error(`Assistant service error: ${detail}`);
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
