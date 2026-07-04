// Per-model pricing (USD per token) and cost calculation.
// Mirrors agent/src/tui.js — model keys have no date suffix, the agent strips it before sending.
// Fallback for unknown models: sonnet pricing.

export interface ModelPricing {
  input:      number;
  output:     number;
  cacheRead:  number;
  cacheWrite: number;
}

export const FALLBACK_MODEL = "claude-sonnet-4-6";

export const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-8":   { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1, output: 5,  cacheRead: 0.1, cacheWrite: 1.25 },
};

const TOKENS_PER_UNIT = 1e6;

export function calcCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheRead: number,
  cacheCreation: number,
): number {
  const pricing = PRICING[model] ?? PRICING[FALLBACK_MODEL];
  return (
    (inputTokens / TOKENS_PER_UNIT) * pricing.input +
    (outputTokens / TOKENS_PER_UNIT) * pricing.output +
    (cacheRead / TOKENS_PER_UNIT) * pricing.cacheRead +
    (cacheCreation / TOKENS_PER_UNIT) * pricing.cacheWrite
  );
}

export type ModelFamily = "opus" | "sonnet" | "haiku";

export function modelFamily(model: string): ModelFamily {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  return "sonnet";
}
