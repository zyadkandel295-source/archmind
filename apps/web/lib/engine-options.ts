/** Presentation-layer engine tiers — internal values stay opaque to the UI */
export type EngineTier = "standard" | "reasoning" | "specialist";

const ENGINE_MAP: Record<EngineTier, { label: string; value: string }> = {
  standard: { label: "Standard Engine", value: "openrouter/auto" },
  reasoning: { label: "Advanced Reasoning Engine", value: "deepseek/deepseek-r1:free" },
  specialist: { label: "Creative Specialist Engine", value: "deepseek/deepseek-chat-v3-0324:free" }
};

export const ENGINE_OPTIONS = (Object.keys(ENGINE_MAP) as EngineTier[]).map((tier) => ({
  tier,
  label: ENGINE_MAP[tier].label,
  value: ENGINE_MAP[tier].value
}));

export const DEFAULT_ENGINE_VALUE = ENGINE_MAP.standard.value;

export function engineTierFromValue(value: string): EngineTier {
  if (value.includes("r1")) return "reasoning";
  if (value.includes("chat") || value.includes("v3")) return "specialist";
  return "standard";
}

export function engineLabel(value: string) {
  return ENGINE_MAP[engineTierFromValue(value)]?.label ?? ENGINE_MAP.standard.label;
}

export function engineValueForTier(tier: EngineTier) {
  return ENGINE_MAP[tier].value;
}
