import { describe, it, expect } from "vitest";

// Test the pure cost calculation logic extracted from db.ts
// We replicate the pricing table here to test it in isolation

const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-8":   { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3,  cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite: 1.25 },
};

function calcCost(model: string, inp: number, out: number, cr: number, cc: number) {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (inp / 1e6) * p.input + (out / 1e6) * p.output +
         (cr  / 1e6) * p.cacheRead + (cc  / 1e6) * p.cacheWrite;
}

describe("server calcCost", () => {
  it("Sonnet 4.6: 1M input + 1M output = $18", () => {
    expect(calcCost("claude-sonnet-4-6", 1e6, 1e6, 0, 0)).toBeCloseTo(18);
  });

  it("Opus 4.8: 1M input + 1M output = $30", () => {
    expect(calcCost("claude-opus-4-8", 1e6, 1e6, 0, 0)).toBeCloseTo(30);
  });

  it("Haiku 4.5: 1M input + 1M output = $6", () => {
    expect(calcCost("claude-haiku-4-5", 1e6, 1e6, 0, 0)).toBeCloseTo(6);
  });

  it("Cache read adds to cost at reduced rate", () => {
    // 1M Sonnet cache read @ $0.3
    expect(calcCost("claude-sonnet-4-6", 0, 0, 1e6, 0)).toBeCloseTo(0.3);
  });

  it("Cache creation adds to cost", () => {
    // 1M Sonnet cache write @ $3.75
    expect(calcCost("claude-sonnet-4-6", 0, 0, 0, 1e6)).toBeCloseTo(3.75);
  });

  it("Unknown model falls back to Sonnet pricing", () => {
    expect(calcCost("claude-future-model", 1e6, 0, 0, 0)).toBeCloseTo(3);
  });
});

describe("avatar generation", () => {
  // Replicate the avatar logic from db.ts getUsers()
  function makeAvatar(userId: string) {
    const parts = userId.split(/[@.\s]/);
    return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
  }

  it("extracts initials from email address", () => {
    expect(makeAvatar("wassim.rekik@example.com")).toBe("WR");
  });

  it("handles simple username without dots", () => {
    expect(makeAvatar("john@example.com")).toBe("JE");
  });

  it("uses ? for empty input", () => {
    expect(makeAvatar("")).toBe("?");
  });

  it("handles single-part username", () => {
    expect(makeAvatar("admin")).toBe("A");
  });
});
