import { describe, expect, it } from "vitest";
import { CORE_RAG_SYSTEM_PROMPT } from "@archmind/shared";
import { buildAgentiaSystemPrompt } from "../src/services/agentia-system-prompt";

describe("specialist agent instructions", () => {
  it("keeps a configured specialist role in control of chat behavior", () => {
    const prompt = buildAgentiaSystemPrompt({
      assistantName: "Retail Analyst",
      roleInstructions: "Analyze retail sales data. Do not answer unrelated coding questions."
    });

    expect(prompt).toContain("Analyze retail sales data.");
    expect(prompt).toContain("configured specialty and instructions define your role");
    expect(prompt).toContain("If a request falls outside the configured scope");
    expect(prompt).not.toContain("multidisciplinary assistant");
    expect(CORE_RAG_SYSTEM_PROMPT).toContain("Do not perform the unrelated task");
  });

  it("keeps general behavior for an agent without a configured role", () => {
    expect(buildAgentiaSystemPrompt()).toContain("multidisciplinary assistant");
  });
});
