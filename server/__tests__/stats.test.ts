import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
  getStats: vi.fn(),
}));

import { GET } from "@/app/api/stats/route";
import { getStats } from "@/lib/db";

const MOCK_STATS = {
  daily: [
    { date: "2026-07-01", opus: 80000, sonnet: 200000, haiku: 50000, total: 330000, cost: 12.45, cacheHit: 35, sessions: 3 },
    { date: "2026-07-02", opus: 60000, sonnet: 180000, haiku: 40000, total: 280000, cost: 10.20, cacheHit: 28, sessions: 2 },
  ],
  projects: [],
  summary: {
    totalTokens: 610000,
    totalCost: 22.65,
    totalSessions: 5,
    avgCacheHit: 32,
    burnRate5h: { used: 45000, limit: 800000, pct: 6 },
  },
};

function makeReq(params: Record<string, string>) {
  const url = new URL("http://localhost/api/stats");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getStats).mockResolvedValue(MOCK_STATS);
});

describe("GET /api/stats", () => {
  it("returns stats with default user=all and range=14", async () => {
    const res = await GET(makeReq({}));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.daily).toHaveLength(2);
    expect(body.summary.totalTokens).toBe(610000);
    expect(getStats).toHaveBeenCalledWith("all", 14);
  });

  it("passes user param to getStats", async () => {
    await GET(makeReq({ user: "dev@example.com", range: "7" }));
    expect(getStats).toHaveBeenCalledWith("dev@example.com", 7);
  });

  it("passes range param to getStats", async () => {
    await GET(makeReq({ range: "30" }));
    expect(getStats).toHaveBeenCalledWith("all", 30);
  });

  it("response shape includes daily array and summary", async () => {
    const res = await GET(makeReq({}));
    const body = await res.json();
    expect(body).toHaveProperty("daily");
    expect(body).toHaveProperty("summary");
    expect(body.summary).toHaveProperty("burnRate5h");
    expect(body.summary.burnRate5h).toHaveProperty("used");
    expect(body.summary.burnRate5h).toHaveProperty("pct");
  });

  it("daily rows have expected fields", async () => {
    const res = await GET(makeReq({}));
    const { daily } = await res.json();
    expect(daily[0]).toMatchObject({
      date: expect.any(String),
      opus: expect.any(Number),
      sonnet: expect.any(Number),
      haiku: expect.any(Number),
      total: expect.any(Number),
      cost: expect.any(Number),
      cacheHit: expect.any(Number),
      sessions: expect.any(Number),
    });
  });
});
