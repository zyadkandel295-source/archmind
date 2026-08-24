/** Presentation-layer engine tiers — internal values stay opaque to the UI */
export type EngineTier = "standard" | "reasoning" | "specialist";

const ENGINE_MAP: Record<EngineTier, { label: string; value: string }> = {
  standard: { label: "PHOENIX General Intelligence", value: "qwen/qwen3-30b-a3b-instruct-2507" },
  reasoning: { label: "Advanced Reasoning Engine", value: "qwen/qwen3-next-80b-a3b-thinking" },
  specialist: { label: "Qwen Coder · Files & Markdown", value: "qwen/qwen3-coder" }
};

export const ENGINE_OPTIONS = (Object.keys(ENGINE_MAP) as EngineTier[]).map((tier) => ({
  tier,
  label: ENGINE_MAP[tier].label,
  value: ENGINE_MAP[tier].value
}));

export const DEFAULT_ENGINE_VALUE = ENGINE_MAP.standard.value;

export function engineTierFromValue(value: string): EngineTier {
  if (value.includes("oss") || value.includes("gpt")) return "reasoning";
  if (value.includes("qwen") || value.includes("code")) return "specialist";
  return "standard";
}

export function engineLabel(value: string) {
  return ENGINE_MAP[engineTierFromValue(value)]?.label ?? ENGINE_MAP.standard.label;
}

export function engineValueForTier(tier: EngineTier) {
  return ENGINE_MAP[tier].value;
}
