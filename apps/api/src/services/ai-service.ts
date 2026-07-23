import type { Env } from "../config/env";
import type { AssistantRecord } from "../types";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type TaskType = "normal" | "math" | "coding" | "research";
type VerificationStatus = "VERIFIED_CORRECT" | "VERIFIED_INCORRECT" | "VERIFICATION_SKIPPED" | "VERIFICATION_FAILED";

interface OpenRouterChoice {
  provider: "openrouter";
  model: string;
  taskType: TaskType;
  reason: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string | number;
  };
}

interface ProviderFailure {
  provider: "openrouter";
  status?: number;
  message: string;
}

interface VerificationResult {
  status: VerificationStatus;
  answer: string;
  warning?: string;
}

export const AI_PROVIDERS_UNAVAILABLE_MESSAGE =
  "OpenRouter is temporarily unavailable. Check the backend API key, model access, quota, billing, and server logs, then try again.";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

const MATH_KEYWORDS = [
  "math",
  "calculus",
  "proof",
  "prove",
  "equation",
  "integral",
  "integrate",
  "derivative",
  "differentiate",
  "limit",
  "algebra",
  "geometry",
  "trigonometry",
  "matrix",
  "probability",
  "statistics",
  "solve for",
  "simplify",
  "factor"
];

const CODING_KEYWORDS = [
  "code",
  "coding",
  "debug",
  "debugging",
  "error",
  "bug",
  "api",
  "fastapi",
  "react",
  "next.js",
  "nextjs",
  "typescript",
  "javascript",
  "python",
  "node",
  "express",
  "sql",
  "database",
  "import",
  "syntax",
  "stack trace",
  "component",
  "function"
];

const RESEARCH_KEYWORDS = [
  "research",
  "paper",
  "academic",
  "citation",
  "citations",
  "sources",
  "literature review",
  "study",
  "studies",
  "thesis",
  "essay",
  "report",
  "whitepaper",
  "analyze deeply",
  "explain deeply"
];

function containsAny(message: string, keywords: string[]) {
  const lower = message.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function isComplexPrompt(message: string) {
  return message.length > 1200 || message.split(/\s+/).filter(Boolean).length > 180;
}

export function detectTaskType(message: string): TaskType {
  if (containsAny(message, MATH_KEYWORDS)) return "math";
  if (containsAny(message, CODING_KEYWORDS)) return "coding";
  if (containsAny(message, RESEARCH_KEYWORDS) || isComplexPrompt(message)) return "research";
  return "normal";
}

function extractUserMessage(messages: AiMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function buildHistory(chatHistory: AiMessage[] | null | undefined, userMessage: string): AiMessage[] {
  const history = chatHistory?.filter((message) => message.content.trim()) ?? [];
  return [...history, { role: "user", content: userMessage }];
}

function cleanModel(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function openRouterErrorMessage(status?: number) {
  if (status === 401 || status === 403) {
    return "OpenRouter rejected the API key or model access. Check OPENROUTER_API_KEY and the selected model.";
  }
  if (status === 429) {
    return "OpenRouter is rate-limited right now. Please wait a moment and try again.";
  }
  if (status && status >= 500) {
    return "OpenRouter returned a provider error. Please try again shortly.";
  }
  return "OpenRouter request failed.";
}

function safeOpenRouterHeaders(env: Env): Record<string, string> | undefined {
  if (!env.openRouterApiKey) return undefined;
  return {
    Authorization: `Bearer ${env.openRouterApiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": env.appUrl,
    "X-Title": "ArchMind"
  };
}

async function postOpenRouterChatCompletion(input: {
  env: Env;
  model: string;
  messages: AiMessage[];
  temperature?: number;
  timeoutMs?: number;
}) {
  const headers = safeOpenRouterHeaders(input.env);
  if (!headers) {
    throw {
      provider: "openrouter",
      status: 401,
      message: "OPENROUTER_API_KEY is not configured on the backend."
    } satisfies ProviderFailure;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: input.temperature ?? 0.7,
        stream: false
      })
    });
  } catch (error) {
    throw {
      provider: "openrouter",
      message: error instanceof Error && error.name === "AbortError" ? "OpenRouter timed out." : "OpenRouter network request failed."
    } satisfies ProviderFailure;
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
  if (!response.ok) {
    throw {
      provider: "openrouter",
      status: response.status,
      message: data?.error?.message ?? openRouterErrorMessage(response.status)
    } satisfies ProviderFailure;
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw {
      provider: "openrouter",
      status: response.status,
      message: "OpenRouter returned an empty response."
    } satisfies ProviderFailure;
  }

  return text;
}

export function chooseOpenRouterModel(
  userMessage: string,
  env: Env,
  assistantConfig?: Pick<AssistantRecord, "model"> | null
): OpenRouterChoice {
  const taskType = detectTaskType(userMessage);

  if (taskType === "math") {
    return {
      provider: "openrouter",
      model: env.openRouterReasoningModel,
      taskType,
      reason: "math_reasoning"
    };
  }

  if (taskType === "coding") {
    return {
      provider: "openrouter",
      model: env.openRouterCodingModel,
      taskType,
      reason: "coding_or_debugging"
    };
  }

  if (taskType === "research") {
    return {
      provider: "openrouter",
      model: isComplexPrompt(userMessage) ? env.openRouterReasoningModel : env.openRouterDefaultModel,
      taskType,
      reason: "research_or_complex_prompt"
    };
  }

  return {
    provider: "openrouter",
    model: cleanModel(assistantConfig?.model, env.openRouterDefaultModel),
    taskType,
    reason: assistantConfig?.model ? "assistant_model" : "default_model"
  };
}

export const choose_provider_and_model = chooseOpenRouterModel;

export async function callOpenRouter(input: {
  env: Env;
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}) {
  return postOpenRouterChatCompletion({
    env: input.env,
    model: cleanModel(input.model, input.env.openRouterDefaultModel),
    messages: input.messages,
    temperature: input.temperature,
    timeoutMs: input.timeoutMs
  });
}

async function generateWithOpenRouterFallback(input: {
  env: Env;
  choice: OpenRouterChoice;
  messages: AiMessage[];
  temperature?: number;
  timeoutMs?: number;
}) {
  const failures: ProviderFailure[] = [];
  const models = [input.choice.model, input.env.openRouterDefaultModel].filter(
    (model, index, all) => model && all.indexOf(model) === index
  );

  for (const model of models) {
    try {
      return await callOpenRouter({
        env: input.env,
        model,
        messages: input.messages,
        temperature: input.temperature,
        timeoutMs: input.timeoutMs
      });
    } catch (error) {
      failures.push(normalizeFailure(error));
    }
  }

  console.error("OpenRouter generation failed", failures.map((failure) => ({ status: failure.status, message: failure.message })));
  return AI_PROVIDERS_UNAVAILABLE_MESSAGE;
}

function parseVerifierOutput(raw: string, originalAnswer: string): VerificationResult {
  const trimmed = raw.trim();
  if (trimmed.startsWith("VERIFIED_CORRECT")) {
    return {
      status: "VERIFIED_CORRECT",
      answer: originalAnswer
    };
  }

  if (trimmed.startsWith("VERIFIED_INCORRECT")) {
    const corrected = trimmed.match(/CORRECTED_ANSWER:\s*([\s\S]*)/i)?.[1]?.trim();
    return {
      status: "VERIFIED_INCORRECT",
      answer: corrected || originalAnswer
    };
  }

  const corrected = trimmed.match(/CORRECTED_ANSWER:\s*([\s\S]*)/i)?.[1]?.trim();
  if (corrected) {
    return {
      status: "VERIFIED_INCORRECT",
      answer: corrected
    };
  }

  return {
    status: "VERIFICATION_FAILED",
    answer: originalAnswer
  };
}

function buildVerifierMessages(input: {
  question: string;
  answer: string;
  verifierInstructions: string;
}): AiMessage[] {
  return [
    {
      role: "system",
      content: `${input.verifierInstructions}

Return exactly one of these formats:
VERIFIED_CORRECT

or:
VERIFIED_INCORRECT
CORRECTED_ANSWER: <the complete corrected answer the user should see>

Do not include hidden analysis, logs, provider names, or commentary outside that format.`
    },
    {
      role: "user",
      content: `Question:
${input.question}

Answer to verify:
${input.answer}`
    }
  ];
}

async function runVerifier(input: {
  env: Env;
  question: string;
  answer: string;
  instructions: string;
  model?: string;
}) {
  const verifierModel = input.model ?? input.env.openRouterVerifierModel;
  console.log("Verifier provider/model:", "openrouter", verifierModel);

  const raw = await callOpenRouter({
    env: input.env,
    model: verifierModel,
    messages: buildVerifierMessages({
      question: input.question,
      answer: input.answer,
      verifierInstructions: input.instructions
    }),
    temperature: 0,
    timeoutMs: 30_000
  });

  return parseVerifierOutput(raw, input.answer);
}

export async function verifyMathAnswer(question: string, answer: string, env: Env): Promise<VerificationResult> {
  if (!env.enableAnswerVerification || !env.verifyMath) {
    return { status: "VERIFICATION_SKIPPED", answer };
  }

  return runVerifier({
    env,
    question,
    answer,
    model: env.openRouterReasoningModel || env.openRouterVerifierModel,
    instructions:
      "You are a strict math verifier. Check every step, notation, assumptions, calculations, and the final answer. If any step or final result is wrong, replace the answer with a correct solution."
  });
}

export async function verifyCodeAnswer(question: string, answer: string, env: Env): Promise<VerificationResult> {
  if (!env.enableAnswerVerification || !env.verifyCode) {
    return { status: "VERIFICATION_SKIPPED", answer };
  }

  return runVerifier({
    env,
    question,
    answer,
    model: env.openRouterCodingModel || env.openRouterVerifierModel,
    instructions:
      "You are a senior code reviewer. Check syntax, imports, missing variables, broken logic, wrong file paths, security issues, and whether the answer matches the request. If it is wrong or weak, replace it with corrected code and a concise explanation."
  });
}

export async function verifyResearchAnswer(question: string, answer: string, env: Env): Promise<VerificationResult> {
  if (!env.enableAnswerVerification || !env.verifyResearch) {
    return { status: "VERIFICATION_SKIPPED", answer };
  }

  return runVerifier({
    env,
    question,
    answer,
    model: env.openRouterVerifierModel,
    instructions:
      "You are a careful research editor. Check for hallucinations, unsupported claims, weak structure, missing citation placeholders, and overconfident wording. If weak, improve structure and add citation placeholders where real sources are needed without inventing citations."
  });
}

function shouldVerifyNormalAnswer(question: string, answer: string) {
  return isComplexPrompt(question) || answer.length > 1800;
}

export async function improveAnswerIfNeeded(question: string, answer: string, taskType: TaskType, env: Env): Promise<VerificationResult> {
  try {
    if (taskType === "math") {
      const result = await verifyMathAnswer(question, answer, env);
      if (result.status === "VERIFICATION_SKIPPED") console.log("Verifier provider/model:", "none", "skipped");
      console.log("Verification result:", result.status);
      return result;
    }

    if (taskType === "coding") {
      const result = await verifyCodeAnswer(question, answer, env);
      if (result.status === "VERIFICATION_SKIPPED") console.log("Verifier provider/model:", "none", "skipped");
      console.log("Verification result:", result.status);
      return result;
    }

    if (taskType === "research") {
      const result = await verifyResearchAnswer(question, answer, env);
      if (result.status === "VERIFICATION_SKIPPED") console.log("Verifier provider/model:", "none", "skipped");
      console.log("Verification result:", result.status);
      return result;
    }

    if (env.enableAnswerVerification && shouldVerifyNormalAnswer(question, answer)) {
      const result = await runVerifier({
        env,
        question,
        answer,
        model: env.openRouterVerifierModel,
        instructions:
          "You are a quality-control editor. Check whether this complex general answer is clear, accurate, well structured, and directly answers the user. If weak, replace it with an improved answer."
      });
      console.log("Verification result:", result.status);
      return result;
    }

    console.log("Verifier provider/model:", "none", "skipped");
    console.log("Verification result:", "VERIFICATION_SKIPPED");
    return { status: "VERIFICATION_SKIPPED", answer };
  } catch (error) {
    console.log("Verification result:", "VERIFICATION_FAILED");
    console.error("OpenRouter verifier failed", normalizeFailure(error));
    const warning =
      taskType === "normal" ? undefined : "\n\n_Note: I could not complete the automatic quality check, so please double-check critical details._";
    return {
      status: "VERIFICATION_FAILED",
      answer: `${answer}${warning ?? ""}`,
      warning
    };
  }
}

export async function generateAiResponse(input: {
  env: Env;
  userMessage?: string;
  messages?: AiMessage[];
  chatHistory?: AiMessage[] | null;
  temperature?: number;
  assistantConfig?: Pick<AssistantRecord, "model"> | null;
}) {
  const userMessage = input.userMessage ?? (input.messages ? extractUserMessage(input.messages) : "");
  const messages = input.messages ?? buildHistory(input.chatHistory, userMessage);
  const choice = chooseOpenRouterModel(userMessage, input.env, input.assistantConfig);

  console.log("Task type:", choice.taskType);
  console.log("Main provider/model:", choice.provider, choice.model);

  const answer = await generateWithOpenRouterFallback({
    env: input.env,
    choice,
    messages,
    temperature: input.temperature,
    timeoutMs: 30_000
  });

  if (answer === AI_PROVIDERS_UNAVAILABLE_MESSAGE) {
    console.log("Verifier provider/model:", "none", "skipped");
    console.log("Verification result:", "VERIFICATION_SKIPPED");
    return answer;
  }

  const verified = await improveAnswerIfNeeded(userMessage, answer, choice.taskType, input.env);
  return verified.answer;
}

export async function generateAssistantResponse(input: {
  env: Env;
  assistant: Pick<AssistantRecord, "systemPrompt" | "model" | "temperature">;
  userMessage: string;
  chatHistory?: AiMessage[] | null;
}) {
  return generateAiResponse({
    env: input.env,
    userMessage: input.userMessage,
    chatHistory: [
      { role: "system", content: input.assistant.systemPrompt },
      ...(input.chatHistory ?? [])
    ],
    assistantConfig: input.assistant,
    temperature: input.assistant.temperature
  });
}

export const generate_ai_response = generateAiResponse;

function normalizeFailure(error: unknown): ProviderFailure {
  if (error && typeof error === "object" && "message" in error) {
    const maybeFailure = error as Partial<ProviderFailure>;
    return {
      provider: "openrouter",
      status: maybeFailure.status,
      message: String(maybeFailure.message)
    };
  }

  return {
    provider: "openrouter",
    message: "Unknown OpenRouter error."
  };
}
