import { generateAssistantOpeningExperience } from "@archmind/shared";
import type { AssistantRecord } from "../types";

export function getAssistantOpeningExperience(assistant: AssistantRecord) {
  return generateAssistantOpeningExperience({
    name: assistant.name,
    description: assistant.description,
    instructions: assistant.systemPrompt,
    starterPrompts: assistant.starterPrompts
  });
}
