import { describe, it, expect } from "vitest";
import { calcCost } from "../src/tui.js";

describe("calcCost", () => {
  it("prices Sonnet 4.6 correctly", () => {
    // 1M input @ $3, 1M output @ $15 = $18
    const cost = calcCost("claude-sonnet-4-6", {
      inputTokens: 1_000_000, outputTokens: 1_000_000,
      cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(18, 5);
  });

  it("prices Opus 4.8 correctly", () => {
    // 1M input @ $5, 1M output @ $25 = $30
    const cost = calcCost("claude-opus-4-8", {
      inputTokens: 1_000_000, outputTokens: 1_000_000,
      cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(30, 5);
  });

  it("prices Haiku 4.5 correctly", () => {
    // 1M input @ $1, 1M output @ $5 = $6
    const cost = calcCost("claude-haiku-4-5", {
      inputTokens: 1_000_000, outputTokens: 1_000_000,
      cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(6, 5);
  });

  it("includes cache read cost", () => {
    // 1M cache_read @ $0.3 (Sonnet)
    const cost = calcCost("claude-sonnet-4-6", {
      inputTokens: 0, outputTokens: 0,
      cacheRead: 1_000_000, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(0.3, 5);
  });

  it("includes cache creation cost", () => {
    // 1M cache_write @ $3.75 (Sonnet)
    const cost = calcCost("claude-sonnet-4-6", {
      inputTokens: 0, outputTokens: 0,
      cacheRead: 0, cacheCreation: 1_000_000,
    });
    expect(cost).toBeCloseTo(3.75, 5);
  });

  it("falls back to Sonnet pricing for unknown model", () => {
    const cost = calcCost("claude-unknown-model", {
      inputTokens: 1_000_000, outputTokens: 0,
      cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(3, 5); // Sonnet input price
  });

  it("returns 0 for all-zero usage", () => {
    const cost = calcCost("claude-sonnet-4-6", {
      inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBe(0);
  });

  it("handles fractional tokens correctly", () => {
    // 1000 input tokens @ $3/M = $0.003
    const cost = calcCost("claude-sonnet-4-6", {
      inputTokens: 1000, outputTokens: 0, cacheRead: 0, cacheCreation: 0,
    });
    expect(cost).toBeCloseTo(0.003, 8);
  });
});
