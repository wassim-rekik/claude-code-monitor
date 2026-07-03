import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock child_process and fs before importing the module under test
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));
vi.mock("fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
}));
vi.mock("os", () => ({
  homedir: () => "/home/testuser",
  userInfo: () => ({ username: "testuser" }),
}));

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { detectIdentity } from "../src/identity.js";

function makeJwt(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encoded}.signature`;
}

beforeEach(() => {
  vi.clearAllMocks();
  existsSync.mockReturnValue(false);
});

describe("detectIdentity", () => {
  it("returns email from macOS Keychain JWT (email claim)", () => {
    if (process.platform !== "darwin") return;
    const token = makeJwt({ email: "keychain@example.com" });
    execSync.mockReturnValueOnce(JSON.stringify({ access_token: token }));
    expect(detectIdentity()).toBe("keychain@example.com");
  });

  it("returns email from credentials file JWT (email claim)", () => {
    existsSync.mockImplementation(p => p.includes(".credentials.json"));
    const token = makeJwt({ email: "creds@example.com" });
    readFileSync.mockReturnValue(JSON.stringify({ access_token: token }));
    // On non-darwin, keychain is skipped so credentials file is tried first
    expect(detectIdentity()).toBe("creds@example.com");
  });

  it("falls back to git config email", () => {
    existsSync.mockReturnValue(false);
    execSync.mockImplementation(cmd => {
      if (cmd.includes("security")) throw new Error("no keychain");
      if (cmd.includes("git config")) return "git@example.com\n";
      throw new Error("unknown");
    });
    const result = detectIdentity();
    expect(result).toBe("git@example.com");
  });

  it("falls back to OS username as last resort", () => {
    existsSync.mockReturnValue(false);
    execSync.mockImplementation(() => { throw new Error("no cmd"); });
    expect(detectIdentity()).toBe("testuser");
  });

  it("reads sub claim when email is absent but sub looks like email", () => {
    existsSync.mockImplementation(p => p.includes(".credentials.json"));
    const token = makeJwt({ sub: "sub@example.com" });
    readFileSync.mockReturnValue(JSON.stringify({ access_token: token }));
    expect(detectIdentity()).toBe("sub@example.com");
  });

  it("skips sub when it does not look like an email", () => {
    existsSync.mockImplementation(p => p.includes(".credentials.json"));
    const token = makeJwt({ sub: "user-id-1234" });
    readFileSync.mockReturnValue(JSON.stringify({ access_token: token }));
    execSync.mockImplementation(cmd => {
      if (cmd.includes("git config")) return "git@example.com\n";
      throw new Error("no cmd");
    });
    expect(detectIdentity()).toBe("git@example.com");
  });
});
