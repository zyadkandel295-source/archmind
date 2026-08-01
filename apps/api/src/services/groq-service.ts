import type { Env } from "../config/env";

export type GroqRequestType = "normal_chat" | "coding" | "math" | "vision" | "file_text_analysis";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface GroqChatParams {
  userId?: string;
  message: string;
  type?: "auto" | GroqRequestType;
  imageUrl?: string;
  fileText?: string;
  history?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  systemPrompt?: string;
}

export interface GroqChatSuccessResult {
  success: true;
  modelUsed: string;
  requestType: GroqRequestType;
  answer: string;
  creditsUsed: number;
  remainingCredits: number;
}

export interface GroqChatErrorResult {
  success: false;
  errorCode: "RATE_LIMITED" | "NO_CREDITS" | "MODEL_UNAVAILABLE" | "INVALID_REQUEST" | "SERVER_ERROR";
  message: string;
}

export type GroqChatResult = GroqChatSuccessResult | GroqChatErrorResult;

const GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";

const CREDIT_COSTS: Record<GroqRequestType, number> = {
  normal_chat: 1,
  coding: 2,
  math: 2,
  file_text_analysis: 3,
  vision: 5
};

const MAX_TOKENS: Record<GroqRequestType, number> = {
  normal_chat: 500,
  coding: 1200,
  math: 1000,
  file_text_analysis: 1500,
  vision: 800
};

const MATH_PATTERNS = [
  /\\(int|frac|sum|matrix|sqrt|partial|lim)/i,
  /\b(calculus|integral|derivative|equation|algebra|trigonometry|solve for|matrix|prove|proof|differentiate)\b/i,
  /=|\+|-|\*|\^/
];

const CODING_PATTERNS = [
  /```/,
  /\b(function|import|const|var|let|def|class|public|private|return|async|await|typescript|javascript|python|react|express|sql|bug|debug|refactor|error|stack trace)\b/i
];

/** Mask API keys to keep logs safe (e.g., gsk_...3pY) */
export function maskKey(key: string): string {
  if (!key || key.length < 8) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// In-memory credit store for per-user daily quota management
interface UserCreditState {
  credits: number;
  lastReset: string;
}

const userCreditStore = new Map<string, UserCreditState>();
const DEFAULT_DAILY_CREDITS = 50;

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getUserState(userId: string): UserCreditState {
  const today = getTodayString();
  let state = userCreditStore.get(userId);
  if (!state || state.lastReset !== today) {
    state = { credits: DEFAULT_DAILY_CREDITS, lastReset: today };
    userCreditStore.set(userId, state);
  }
  return state;
}

export function getUserCredits(userId: string): number {
  return getUserState(userId).credits;
}

export function deductUserCredits(userId: string, amount: number): number {
  const state = getUserState(userId);
  state.credits = Math.max(0, state.credits - amount);
  return state.credits;
}

export function setUserCredits(userId: string, amount: number): void {
  const state = getUserState(userId);
  state.credits = amount;
}

export function resetCreditStore(): void {
  userCreditStore.clear();
}

let keyRotationIndex = 0;

export class GroqService {
  constructor(private readonly env: Env) {}

  /** Classify request into task types: normal_chat, coding, math, vision, file_text_analysis */
  classifyRequest(params: GroqChatParams): GroqRequestType {
    if (params.type && params.type !== "auto") {
      return params.type;
    }
    if (params.imageUrl) {
      return "vision";
    }
    if (params.fileText) {
      return "file_text_analysis";
    }
    const msg = params.message ?? "";
    if (MATH_PATTERNS.some((pattern) => pattern.test(msg))) {
      return "math";
    }
    if (CODING_PATTERNS.some((pattern) => pattern.test(msg))) {
      return "coding";
    }
    return "normal_chat";
  }

  /** Select primary model and ordered fallback models for a given request type */
  getModelChain(type: GroqRequestType, hasExtractedText = false): string[] {
    const defaultModel = this.env.groqDefaultModel || "llama-3.3-70b-versatile";
    const codingModel = this.env.groqCodingModel || "llama-3.3-70b-versatile";
    const mathModel = this.env.groqMathModel || "llama-3.3-70b-versatile";
    const visionModel = this.env.groqVisionModel || "llama-3.2-11b-vision-preview";
    const fallbackModel = this.env.groqFallbackModel || "llama-3.1-8b-instant";

    switch (type) {
      case "normal_chat":
        return [defaultModel, codingModel];
      case "coding":
        return [codingModel, fallbackModel];
      case "math":
        return [mathModel, codingModel, fallbackModel];
      case "vision":
        return hasExtractedText ? [visionModel, fallbackModel] : [visionModel];
      case "file_text_analysis":
        return [fallbackModel, codingModel];
      default:
        return [defaultModel, fallbackModel];
    }
  }

  /** Retrieve available Groq API keys */
  getApiKeys(): string[] {
    if (this.env.groqApiKeys && this.env.groqApiKeys.length > 0) {
      return this.env.groqApiKeys;
    }
    if (this.env.groqApiKey) {
      return [this.env.groqApiKey];
    }
    return [];
  }

  /** Process chat request through Groq API with 5-key rotation, fallback routing, and credit enforcement */
  async chat(params: GroqChatParams): Promise<GroqChatResult> {
    if (!params.message && !params.imageUrl && !params.fileText) {
      return {
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "Request must include a message, imageUrl, or fileText."
      };
    }

    const apiKeys = this.getApiKeys();
    if (apiKeys.length === 0) {
      return {
        success: false,
        errorCode: "SERVER_ERROR",
        message: "GROQ_API_KEY is not configured on the backend."
      };
    }

    const requestType = this.classifyRequest(params);
    const cost = CREDIT_COSTS[requestType] ?? 1;
    const userId = params.userId || "anonymous_user";
    const currentCredits = getUserCredits(userId);

    if (currentCredits < cost) {
      return {
        success: false,
        errorCode: "NO_CREDITS",
        message: `You have insufficient credits (${currentCredits} remaining, ${cost} required for ${requestType}).`
      };
    }

    const maxTokens = MAX_TOKENS[requestType] ?? 500;
    const modelChain = this.getModelChain(requestType, Boolean(params.fileText));

    const messages: GroqMessage[] = [];
    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }

    if (params.history && params.history.length > 0) {
      const recentHistory = params.history.slice(-8);
      for (const h of recentHistory) {
        messages.push({ role: h.role, content: h.content });
      }
    }

    let userContent: string | Array<{ type: string; text?: string; image_url?: { url: string } }> = params.message || "";
    if (params.fileText) {
      userContent = `[Attached File Content]:\n${params.fileText.slice(0, 4000)}\n\n[User Request]:\n${params.message}`;
    } else if (params.imageUrl) {
      userContent = [
        { type: "text", text: params.message || "Analyze this image." },
        { type: "image_url", image_url: { url: params.imageUrl } }
      ];
    }
    messages.push({ role: "user", content: userContent });

    let lastErrorStatus = 0;
    let lastErrorMessage = "";
    let rateLimitedOccurred = false;
    const maxAttempts = 3;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const model = modelChain[attempt % modelChain.length]!;
      const apiKeyIndex = (keyRotationIndex + attempt) % apiKeys.length;
      const apiKey = apiKeys[apiKeyIndex]!;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25_000);

        const response = await fetch(GROQ_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: maxTokens
          })
        }).finally(() => clearTimeout(timeout));

        if (response.status === 429) {
          rateLimitedOccurred = true;
          keyRotationIndex = (keyRotationIndex + 1) % apiKeys.length;
          console.warn(`[GroqService] Key ${maskKey(apiKey)} rate limited (429). Rotating to key index ${keyRotationIndex}.`);
          lastErrorStatus = 429;
          lastErrorMessage = "Groq rate limit exceeded.";
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          lastErrorStatus = response.status;
          lastErrorMessage = errorBody?.error?.message || `Groq API returned HTTP ${response.status}.`;
          console.warn(`[GroqService] Attempt ${attempt + 1} with model ${model} and key ${maskKey(apiKey)} failed: ${lastErrorMessage}`);
          continue;
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const answer = data.choices?.[0]?.message?.content?.trim();

        if (!answer) {
          lastErrorMessage = "Groq API returned an empty response.";
          continue;
        }

        // Successfully generated answer — deduct credits and return
        const remainingCredits = deductUserCredits(userId, cost);
        keyRotationIndex = apiKeyIndex; // Keep active working key

        return {
          success: true,
          modelUsed: model,
          requestType,
          answer,
          creditsUsed: cost,
          remainingCredits
        };
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : "Network error during Groq API call.";
        console.warn(`[GroqService] Network error on attempt ${attempt + 1}: ${lastErrorMessage}`);
      }
    }

    if (rateLimitedOccurred) {
      return {
        success: false,
        errorCode: "RATE_LIMITED",
        message: "AI service is currently rate limited. Please try again in a few moments."
      };
    }

    return {
      success: false,
      errorCode: lastErrorStatus >= 500 || lastErrorStatus === 0 ? "MODEL_UNAVAILABLE" : "SERVER_ERROR",
      message: lastErrorMessage || "Unable to complete AI request."
    };
  }
}
