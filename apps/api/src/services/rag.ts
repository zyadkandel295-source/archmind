import {
  CONTEXT_INJECTION_TEMPLATE,
  CORE_RAG_SYSTEM_PROMPT,
  RAG_FALLBACK_TEMPLATE,
  TONE_TEMPLATES
} from "@archmind/shared";
import type { Env } from "../config/env";
import type { MemoryStore } from "../db/memory";
import type { AssistantRecord, RetrievedChunk } from "../types";
import { LlmService } from "./llm";

function interpolate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ""));
}

function formatChunks(chunks: RetrievedChunk[]) {
  return chunks
    .map(
      (chunk, index) =>
        `[${index + 1}] Source: ${chunk.sourceName} | Page ${chunk.page ?? "n/a"} | Score: ${chunk.similarity}\n${chunk.text}`
    )
    .join("\n\n");
}

function tokenEstimate(text: string) {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.35);
}

function buildNoContextPrompt(question: string) {
  return `RETRIEVAL RESULT:
No relevant knowledge-base chunks were retrieved for this turn.

USER QUESTION:
${question}

Answer normally using your general knowledge and reasoning. Do not refuse solely because retrieval returned no context.`;
}

export class RagService {
  private llm: LlmService;

  constructor(
    private env: Env,
    private store: MemoryStore
  ) {
    this.llm = new LlmService(env);
  }

  retrieve(assistantId: string, question: string, userId?: string) {
    return this.store.retrieveChunks(assistantId, question, 5, userId);
  }

  buildPrompt(assistant: AssistantRecord, question: string, chunks: RetrievedChunk[], options: { responseLength: string; language: string }) {
    const sourceNames = [...new Set(chunks.map((chunk) => chunk.sourceName))].join(", ") || "no ready sources yet";
    const hasRetrievedContext = chunks.length > 0;
    const retrievedChunks =
      hasRetrievedContext
        ? formatChunks(chunks)
        : interpolate(RAG_FALLBACK_TEMPLATE, {
            source_names: sourceNames
          });

    const systemPrompt = interpolate(CORE_RAG_SYSTEM_PROMPT, {
      assistant_name: assistant.name,
      role_definition: assistant.systemPrompt || assistant.description || "a helpful RAG-enhanced assistant",
      retrieved_chunks: retrievedChunks,
      tone_instructions: TONE_TEMPLATES[assistant.tone] ?? "",
      response_length: options.responseLength,
      language: options.language
    });

    const contextPrompt = hasRetrievedContext
      ? interpolate(CONTEXT_INJECTION_TEMPLATE, {
          k: chunks.length,
          context_tokens: tokenEstimate(retrievedChunks),
          index: 1,
          source_name: chunks[0]?.sourceName ?? "none",
          page: chunks[0]?.page ?? "n/a",
          similarity: chunks[0]?.similarity ?? 0,
          chunk_text: chunks[0]?.text ?? "",
          user_message: question
        })
      : buildNoContextPrompt(question);

    return {
      systemPrompt,
      contextPrompt
    };
  }

  async generateAnswer(input: {
    assistant: AssistantRecord;
    question: string;
    chunks: RetrievedChunk[];
    responseLength: string;
    language: string;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  }) {
    const prompts = this.buildPrompt(input.assistant, input.question, input.chunks, {
      responseLength: input.responseLength,
      language: input.language
    });

    return this.llm.chat({
      model: input.assistant.model,
      temperature: input.assistant.temperature,
      assistantConfig: input.assistant,
      messages: [
        { role: "system", content: prompts.systemPrompt },
        ...(input.chatHistory ?? []),
        { role: "user", content: prompts.contextPrompt }
      ]
    });
  }
}
