import type { Env } from "../config/env";
import { AI_PROVIDERS_UNAVAILABLE_MESSAGE, generateAiResponse, type AiMessage } from "./ai-service";
import type { AssistantRecord } from "../types";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export const DISABLED_LLM_RESPONSE = AI_PROVIDERS_UNAVAILABLE_MESSAGE;

export class LlmService {
  constructor(private env: Env) {}

  async chat(input: {
    messages: LlmMessage[];
    temperature?: number;
    model?: string;
    assistantConfig?: Pick<AssistantRecord, "model"> | null;
  }) {
    return generateAiResponse({
      env: this.env,
      messages: input.messages as AiMessage[],
      temperature: input.temperature,
      assistantConfig: input.assistantConfig ?? (input.model ? { model: input.model } : undefined)
    });
  }

  async embed(_text: string, _model?: string) {
    return [];
  }
}
