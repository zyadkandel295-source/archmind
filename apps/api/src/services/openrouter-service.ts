import type { Env } from "../config/env";

export type OpenRouterRequestType = "normal_chat" | "coding" | "math" | "vision" | "file_text_analysis";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface OpenRouterChatParams {
  userId?: string;
  message: string;
  type?: "auto" | OpenRouterRequestType;
  imageUrl?: string;
  fileText?: string;
  history?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  systemPrompt?: string;
}

export interface OpenRouterChatSuccessResult {
  success: true;
  modelUsed: string;
  requestType: OpenRouterRequestType;
  routingReason: string;
  answer: string;
  creditsUsed: number;
  remainingCredits: number;
}

export interface OpenRouterChatErrorResult {
  success: false;
  errorCode: "RATE_LIMITED" | "NO_CREDITS" | "MODEL_UNAVAILABLE" | "INVALID_REQUEST" | "SERVER_ERROR";
  message: string;
}

export type OpenRouterChatResult = OpenRouterChatSuccessResult | OpenRouterChatErrorResult;

export const ROUTER_SYSTEM_PROMPT = `You are an advanced, cost-optimized API Router Agent. Your sole responsibility is to inspect incoming user requests (prompts and attachments) and dynamically route them to the most capable FREE OpenRouter model based strictly on the asset type.

AVAILABLE TARGET MODELS:
1. NVIDIA NEMOTRON 3 ULTRA (nvidia/nemotron-3-ultra-550b-a55b:free)
   - Capabilities: Massive text-only reasoning, 1-million token context window.
   - Use Case: Pure text queries, code repositories, large text files, CSVs, or PDFs containing text.
2. GOOGLE GEMMA 4 31B (google/gemma-4-31b-it:free)
   - Capabilities: Multimodal vision understanding.
   - Use Case: Any request containing an image, screenshot, chart, diagram, or scanned graphic document.

ROUTING LOGIC & CONSTRAINTS:
- ALWAYS check for the presence of an image file or an image_url data type first.
- IF an image is present -> IMMEDIATELY route to google/gemma-4-31b-it:free.
- IF NO image is present -> DEFAULT to nvidia/nemotron-3-ultra-550b-a55b:free to leverage its superior reasoning capabilities and massive knowledge base.
- CRITICAL: Never attempt to pass an image to the Nvidia model, as it will crash.`;

export const OPENROUTER_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

export const TEXT_MODEL_PRIMARY = "nvidia/nemotron-3-ultra-550b-a55b:free";
export const TEXT_MODEL_FALLBACK = "nvidia/nemotron-3-ultra:free";

export const VISION_MODEL_PRIMARY = "google/gemma-4-31b-it:free";
export const VISION_MODEL_FALLBACK = "google/gemma-3-27b-it:free";

const CREDIT_COSTS: Record<OpenRouterRequestType, number> = {
  normal_chat: 1,
  coding: 2,
  math: 2,
  file_text_analysis: 3,
  vision: 5
};

const userCreditStore = new Map<string, { credits: number; lastReset: string }>();
const DEFAULT_DAILY_CREDITS = 50;

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

function getUserState(userId: string) {
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

export interface ModelRouteDecision {
  selected_model: string;
  routing_reason: string;
  is_vision: boolean;
}

export function routeRequest(params: OpenRouterChatParams): ModelRouteDecision {
  const hasImage = Boolean(params.imageUrl);

  if (hasImage) {
    return {
      selected_model: VISION_MODEL_PRIMARY,
      routing_reason: "Image asset detected in request. Routing to Multimodal Vision model Google Gemma 4 31B.",
      is_vision: true
    };
  }

  return {
    selected_model: TEXT_MODEL_PRIMARY,
    routing_reason: "Text query or text document detected. Routing to NVIDIA Nemotron 3 Ultra (550B context) for high-reasoning accuracy.",
    is_vision: false
  };
}

export class OpenRouterService {
  constructor(private readonly env?: Env) {}

  classifyRequest(params: OpenRouterChatParams): OpenRouterRequestType {
    if (params.type && params.type !== "auto") return params.type;
    if (params.imageUrl) return "vision";
    if (params.fileText) return "file_text_analysis";
    return "normal_chat";
  }

  async chat(params: OpenRouterChatParams): Promise<OpenRouterChatResult> {
    if (!params.message && !params.imageUrl && !params.fileText) {
      return {
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "Request must include a message, imageUrl, or fileText."
      };
    }

    const apiKey = this.env?.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
    const route = routeRequest(params);
    const requestType = this.classifyRequest(params);
    const cost = CREDIT_COSTS[requestType] ?? 1;
    const userId = params.userId || "anonymous_user";
    const currentCredits = getUserCredits(userId);

    if (currentCredits < cost) {
      return {
        success: false,
        errorCode: "NO_CREDITS",
        message: `You have insufficient credits (${currentCredits} remaining, ${cost} required).`
      };
    }

    const messages: OpenRouterMessage[] = [];
    
    // Inject system prompt or router context
    if (params.systemPrompt) {
      messages.push({ role: "system", content: params.systemPrompt });
    }

    if (params.history && params.history.length > 0) {
      for (const h of params.history.slice(-8)) {
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

    const modelsToTry = route.is_vision 
      ? [VISION_MODEL_PRIMARY, VISION_MODEL_FALLBACK] 
      : [TEXT_MODEL_PRIMARY, TEXT_MODEL_FALLBACK, this.env?.openrouterDefaultModel || "nvidia/nemotron-3-ultra:free"];

    let lastErrorMessage = "";

    for (const modelCandidate of modelsToTry) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35_000);

        const response = await fetch(OPENROUTER_COMPLETIONS_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": this.env?.appUrl || "http://localhost:3000",
            "X-Title": "AGENTIA",
            "Content-Type": "application/json"
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: modelCandidate,
            messages,
            temperature: params.temperature ?? 0.7
          })
        }).finally(() => clearTimeout(timeout));

        if (response.status === 429) {
          return {
            success: false,
            errorCode: "RATE_LIMITED",
            message: "OpenRouter API rate limit exceeded. Please try again in a few moments."
          };
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          lastErrorMessage = errorBody?.error?.message || `OpenRouter API returned HTTP ${response.status} for model ${modelCandidate}.`;
          console.warn(`[OpenRouterService] ${lastErrorMessage}. Trying fallback model...`);
          continue;
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const answer = data.choices?.[0]?.message?.content?.trim();

        if (!answer) {
          lastErrorMessage = `OpenRouter returned an empty response for model ${modelCandidate}.`;
          continue;
        }

        const remainingCredits = deductUserCredits(userId, cost);

        return {
          success: true,
          modelUsed: modelCandidate,
          requestType,
          routingReason: route.routing_reason,
          answer,
          creditsUsed: cost,
          remainingCredits
        };
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : "Network error during OpenRouter API call.";
      }
    }

    return {
      success: false,
      errorCode: "SERVER_ERROR",
      message: "This LLM model is currently under development. We will be in touch soon!"
    };
  }
}

// Backward compatibility alias
export const GroqService = OpenRouterService;
export type GroqChatParams = OpenRouterChatParams;
export type GroqChatResult = OpenRouterChatResult;
export type GroqRequestType = OpenRouterRequestType;
