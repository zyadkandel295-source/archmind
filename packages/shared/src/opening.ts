export interface AssistantOpeningInput {
  name: string;
  description?: string;
  instructions?: string;
  systemPrompt?: string;
  starterPrompts?: string[];
  category?: string;
}

export interface AssistantOpeningExperience {
  greeting: string;
  recommendedMessages: string[];
}

const GENERIC_MESSAGES = [
  "How can you help me?",
  "Summarize this for me.",
  "Help me solve this problem.",
  "Give me suggestions."
];

const CATEGORY_MESSAGES = {
  math: [
    "Explain a math problem step by step.",
    "Give me a practice question.",
    "Check my solution and tell me where I went wrong.",
    "Summarize this concept in simple words."
  ],
  coding: [
    "Help me debug this error.",
    "Review this code and improve it.",
    "Explain this function step by step.",
    "Help me build this feature."
  ],
  writing: [
    "Rewrite this message professionally.",
    "Help me write an email.",
    "Improve the grammar and style of this text.",
    "Make this paragraph clearer."
  ],
  research: [
    "Summarize this document.",
    "Extract the main ideas.",
    "Compare these two sources.",
    "Turn this into clear notes."
  ],
  support: [
    "Draft a support reply.",
    "Summarize this customer issue.",
    "Answer this customer question.",
    "Improve this support response."
  ],
  arabic: [
    "اشرح هذا الموضوع ببساطة.",
    "لخص هذا النص.",
    "ساعدني في حل هذه المشكلة خطوة بخطوة.",
    "راجع إجابتي واقترح تحسينات."
  ]
} as const;

type OpeningCategory = keyof typeof CATEGORY_MESSAGES;

function cleanText(value?: string) {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMessage(value: string) {
  return cleanText(value)
    .replace(/^(system|developer|assistant|user)\s*:/i, "")
    .replace(/\b(api[_ -]?key|secret|token|password)\b.*$/i, "")
    .trim()
    .slice(0, 120);
}

function uniqueMessages(messages: string[]) {
  const seen = new Set<string>();
  return messages
    .map(cleanMessage)
    .filter((message) => {
      if (message.length < 3) return false;
      const key = message.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
}

function isPossessiveName(name: string) {
  return /^[A-Z0-9 _-]{3,}$/.test(name) || /\b(bot|coder|gpt|ai)\b/i.test(name);
}

function detectCategory(input: AssistantOpeningInput): OpeningCategory | undefined {
  const text = `${input.category ?? ""} ${input.name} ${input.description ?? ""} ${input.instructions ?? input.systemPrompt ?? ""}`.toLowerCase();
  if (/[\u0600-\u06ff]/.test(text)) return "arabic";
  if (/\b(math|algebra|calculus|geometry|equation|student|solve)\b/.test(text)) return "math";
  if (/\b(code|coding|debug|software|programming|typescript|javascript|python|full-stack|app|feature|error)\b/.test(text)) return "coding";
  if (/\b(email|essay|write|writing|grammar|style|paragraph|social post|copy)\b/.test(text)) return "writing";
  if (/\b(research|paper|sources|summarize|extract|compare|notes|document)\b/.test(text)) return "research";
  if (/\b(customer|support|ticket|reply|polite|professional|company knowledge|question)\b/.test(text)) return "support";
  return undefined;
}

function greetingFor(input: AssistantOpeningInput, category?: OpeningCategory) {
  const name = cleanText(input.name) || "assistant";
  const prefix = isPossessiveName(name) ? `Hi, I am ${name}.` : `Hi, I am your ${name}.`;

  if (category === "arabic") {
    return `${prefix} يمكنني مساعدتك بناء على تعليماتي. كيف أساعدك اليوم؟`;
  }
  if (category === "math") {
    return `${prefix} I can help you understand math step by step. What would you like to solve today?`;
  }
  if (category === "coding") {
    return `${prefix} I can help you debug code, explain errors, and improve your project. What are you working on?`;
  }
  if (category === "support") {
    return `${prefix} I can help answer customer questions clearly and professionally. What do you need help with?`;
  }
  if (category === "writing") {
    return `${prefix} I can help make your writing clearer and more polished. What would you like to write?`;
  }
  if (category === "research") {
    return `${prefix} I can help summarize sources and extract key ideas. What would you like to review?`;
  }

  const description = cleanText(input.description);
  if (description.length > 16) {
    return `${prefix} I can help with ${description.replace(/[.!?]+$/, "")}. How can I help today?`;
  }

  return `${prefix} How can I help you today?`;
}

export function generateAssistantOpeningExperience(input: AssistantOpeningInput): AssistantOpeningExperience {
  const category = detectCategory(input);
  const manualPrompts = uniqueMessages(input.starterPrompts ?? []);
  const categoryPrompts = category ? [...CATEGORY_MESSAGES[category]] : [];
  const recommendedMessages = uniqueMessages([
    ...manualPrompts,
    ...(manualPrompts.length >= 3 ? [] : categoryPrompts),
    ...GENERIC_MESSAGES
  ]).slice(0, Math.max(3, Math.min(5, manualPrompts.length || categoryPrompts.length || GENERIC_MESSAGES.length)));

  return {
    greeting: greetingFor(input, category),
    recommendedMessages
  };
}
