import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  migrate: vi.fn().mockResolvedValue(undefined),
  getUsers: vi.fn(),
}));

import { GET } from "@/app/api/users/route";
import { getUsers } from "@/lib/db";

const MOCK_USERS = [
  { id: "alice@example.com", label: "alice@example.com", avatar: "AE" },
  { id: "bob@example.com",   label: "bob@example.com",   avatar: "BE" },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUsers).mockResolvedValue(MOCK_USERS);
});

describe("GET /api/users", () => {
  it("returns list of users", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ id: "alice@example.com", label: "alice@example.com", avatar: "AE" });
  });

  it("calls getUsers once per request", async () => {
    await GET();
    expect(getUsers).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no users have sent data", async () => {
    vi.mocked(getUsers).mockResolvedValueOnce([]);
    const res = await GET();
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("each user has id, label, and avatar fields", async () => {
    const res = await GET();
    const body = await res.json();
    for (const u of body) {
      expect(u).toHaveProperty("id");
      expect(u).toHaveProperty("label");
      expect(u).toHaveProperty("avatar");
      expect(u.avatar).toHaveLength(2);
    }
  });
});
