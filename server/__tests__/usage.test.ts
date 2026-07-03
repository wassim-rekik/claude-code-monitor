import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock the db module before importing the route
vi.mock("@/lib/db", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
  insertRecords: vi.fn().mockResolvedValue(3),
}));

import { POST } from "@/app/api/usage/route";
import { insertRecords } from "@/lib/db";

const VALID_KEY = "test-api-key";

function makeReq(body: unknown, key?: string) {
  return new NextRequest("http://localhost/api/usage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-api-key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_KEY = VALID_KEY;
});

describe("POST /api/usage", () => {
  it("returns 401 with no api key", async () => {
    const res = await POST(makeReq({ user: "u", records: [] }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 401 with wrong api key", async () => {
    const res = await POST(makeReq({ user: "u", records: [] }, "wrong-key"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when user field is missing", async () => {
    const res = await POST(makeReq({ records: [] }, VALID_KEY));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid payload");
  });

  it("returns 400 when records is not an array", async () => {
    const res = await POST(makeReq({ user: "u@e.com", records: "bad" }, VALID_KEY));
    expect(res.status).toBe(400);
  });

  it("inserts records and returns count on success", async () => {
    const records = [
      { sessionId: "s1", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50, cacheRead: 0, cacheCreation: 0, timestamp: "2026-07-03T10:00:00Z", project: "test/repo" },
      { sessionId: "s2", model: "claude-opus-4-8",   inputTokens: 200, outputTokens: 80, cacheRead: 0, cacheCreation: 0, timestamp: "2026-07-03T10:01:00Z", project: "test/repo" },
    ];
    const res = await POST(makeReq({ user: "dev@example.com", records }, VALID_KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(3); // mock returns 3
    expect(insertRecords).toHaveBeenCalledWith("dev@example.com", records);
  });

  it("inserts 0 records for empty array without error", async () => {
    vi.mocked(insertRecords).mockResolvedValueOnce(0);
    const res = await POST(makeReq({ user: "dev@example.com", records: [] }, VALID_KEY));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(0);
  });
});
