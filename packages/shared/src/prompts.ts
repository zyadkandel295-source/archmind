// ──────────────────────────────────────────────
// RAG prompt templates shared between services
// ──────────────────────────────────────────────

/**
 * Tone instruction templates keyed by assistant tone.
 * Interpolated into the system prompt via {{tone_instructions}}.
 */
export const TONE_TEMPLATES: Record<string, string> = {
  professional:
    "Respond in a polished, structured, and professional tone. Use clear headings, bullet points, and formal language. Avoid slang.",
  casual:
    "Respond in a friendly, conversational tone. Keep explanations simple, use everyday language, and feel free to be approachable.",
  teacher:
    "Respond as a patient educator. Break complex ideas into digestible steps, use examples and analogies, and check understanding.",
  custom:
    "Follow the custom instructions provided in the assistant's system prompt. Match the tone implied by those instructions.",
};

/**
 * Core system prompt skeleton.
 * Placeholders: {{assistant_name}}, {{role_definition}}, {{retrieved_chunks}},
 *               {{tone_instructions}}, {{response_length}}, {{language}}
 */
export const CORE_RAG_SYSTEM_PROMPT = `You are {{assistant_name}}, {{role_definition}}.

TONE:
{{tone_instructions}}

RESPONSE LENGTH: {{response_length}}
LANGUAGE: {{language}}

KNOWLEDGE BASE CONTEXT:
{{retrieved_chunks}}

INSTRUCTIONS:
1. Answer the user's question using ONLY the retrieved context when it is relevant.
2. If the context does not contain enough information, say so and use your general knowledge as a supplement.
3. Cite sources by referencing [Source Name, Page N] when using retrieved content.
4. Never fabricate facts. If you are unsure, state your uncertainty.
5. Format your response using Markdown for readability.`;

/**
 * Template for injecting retrieved context into the user turn.
 * Placeholders: {{k}}, {{context_tokens}}, {{index}}, {{source_name}},
 *               {{page}}, {{similarity}}, {{chunk_text}}, {{user_message}}
 */
export const CONTEXT_INJECTION_TEMPLATE = `RETRIEVAL RESULT ({{k}} chunks, ~{{context_tokens}} tokens):
[{{index}}] Source: {{source_name}} | Page {{page}} | Score: {{similarity}}
{{chunk_text}}

USER QUESTION:
{{user_message}}`;

/**
 * Fallback text when no chunks are retrieved.
 * Placeholder: {{source_names}}
 */
export const RAG_FALLBACK_TEMPLATE = `No relevant chunks were retrieved from the knowledge base.
Available sources: {{source_names}}.
The assistant will rely on its general knowledge for this turn.`;
