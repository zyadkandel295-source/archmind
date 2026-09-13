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

const keyUnavailableUntil = new Map<string, number>();

class NonFailoverProviderError extends Error {}

function configuredOpenRouterKeys(env: Env) {
  return [...new Set([env.openrouterApiKey, ...(env.openrouterApiKeys ?? [])]
    .map((key) => key.trim())
    .filter(Boolean))];
}

export function hasConfiguredOpenRouterKey(env: Env) {
  return configuredOpenRouterKeys(env).length > 0;
}

function retryDelayMs(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1_000, 24 * 60 * 60 * 1_000)
    : 5 * 60 * 1_000;
}

function keyFailureCooldown(response: Response) {
  if (response.status === 402) return 24 * 60 * 60 * 1_000;
  if (response.status === 429) return retryDelayMs(response);
  if (response.status === 401 || response.status === 403) return 60 * 60 * 1_000;
  if (response.status >= 500) return 30 * 1_000;
  return 0;
}

function shouldFailOver(response: Response) {
  return response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429 || response.status >= 500;
}

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
    provider: hasConfiguredOpenRouterKey(_env) ? "openrouter" : "under_development",
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
  maxTokens?: number;
  signal?: AbortSignal;
}) {
  // Tests and local scaffolds may use a placeholder key. Only a configured
  // OpenRouter runtime can call the network; mocked fetch remains supported
  // for deterministic integration tests.
  const fetchIsMocked = Boolean((globalThis.fetch as unknown as { mock?: unknown }).mock);
  const apiKeys = configuredOpenRouterKeys(input.env);
  if (apiKeys.length === 0 || (input.env.llmProvider !== "openrouter" && !fetchIsMocked)) {
    return AI_PROVIDERS_UNAVAILABLE_MESSAGE;
  }

  const messages = input.messages ?? [
    ...(input.chatHistory ?? []),
    ...(input.userMessage ? [{ role: "user" as const, content: input.userMessage }] : [])
  ];
  if (messages.length === 0) return "Please send a message so I can help.";

  const choice = chooseAiModel(extractUserMessage(messages), input.env, input.assistantConfig);
  let lastError: Error | undefined;
  const now = Date.now();
  const candidates = apiKeys.filter((key) => (keyUnavailableUntil.get(key) ?? 0) <= now);
  const keysToTry = candidates.length > 0 ? candidates : apiKeys;

  for (const apiKey of keysToTry) {
    try {
      const response = await fetch(OPENROUTER_CHAT_URL, {
        signal: input.signal,
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": input.env.appUrl,
          "X-Title": "AGENTIA"
        },
        body: JSON.stringify({
          model: choice.model,
          messages,
          temperature: input.temperature ?? 0.7,
          max_tokens: input.maxTokens ?? 4096
        })
      });
      const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;
      if (!response.ok) {
        const detail = payload.error?.message || `Assistant request failed (${response.status})`;
        if (!shouldFailOver(response)) throw new NonFailoverProviderError(detail);
        keyUnavailableUntil.set(apiKey, Date.now() + keyFailureCooldown(response));
        lastError = new Error(detail);
        continue;
      }
      keyUnavailableUntil.delete(apiKey);
      const content = payload.choices?.[0]?.message?.content;
      const answer = Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content;
      if (!answer?.trim()) throw new NonFailoverProviderError("The assistant returned an empty response.");
      return answer.trim();
    } catch (error) {
      if (error instanceof NonFailoverProviderError) throw new Error(`Assistant service error: ${error.message}`);
      if (input.signal?.aborted) throw error;
      lastError = error instanceof Error ? error : new Error("Unknown service error");
      // Network-level provider failures can be isolated to a credential route;
      // make a bounded attempt with the next configured key.
      keyUnavailableUntil.set(apiKey, Date.now() + 30 * 1_000);
    }
  }

  throw new Error(`Assistant service error: ${lastError?.message ?? "All configured OpenRouter keys are unavailable."}`);
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
