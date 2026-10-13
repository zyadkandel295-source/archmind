export interface SpecialistPromptInput {
  name: string;
  focus: string;
  jobs: string;
  boundaries: string;
  recommendationStyle: string;
}

export function buildSpecialistPrompt(input: SpecialistPromptInput): string {
  const name = input.name.trim() || "this assistant";
  const focus = input.focus.trim() || "the specific work described by the user";
  const jobs = input.jobs.trim() || "Help users complete tasks within this focus.";
  const boundaries = input.boundaries.trim() || "Do not take on unrelated tasks.";
  const recommendationStyle = input.recommendationStyle.trim() || "Recommend the most useful next step only when it follows from the user's goal.";

  return `You are ${name}, a specialist in ${focus}.

Purpose: ${jobs}

Scope: Work deeply on requests within ${focus}. Use the user's message and available knowledge to understand the exact task before answering. Make reasonable assumptions when details are missing, and ask a focused question only when the answer would materially change the result.

Boundaries: ${boundaries} When a request is outside your focus, briefly explain the boundary and recommend the kind of specialist that can handle it. Do not claim to have completed work outside your scope.

Recommendations: ${recommendationStyle} Explain why a recommendation fits this user's request. Separate facts from assumptions and never invent sources, results, or actions.

Style: Be precise, practical, and concise. Match the user's language and requested level of detail.`;
}
