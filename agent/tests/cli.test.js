import { describe, it, expect } from "vitest";
import { _parseFlags, _parseSince, _isValidUserId } from "../src/cli.js";

describe("_parseFlags", () => {
  it("parses --key=value syntax", () => {
    expect(_parseFlags(["--user=alice@example.com"])).toEqual({ user: "alice@example.com" });
  });

  it("parses --key value syntax", () => {
    expect(_parseFlags(["--user", "alice@example.com"])).toEqual({ user: "alice@example.com" });
  });

  it("treats a flag with no following value as boolean true", () => {
    expect(_parseFlags(["--standalone"])).toEqual({ standalone: true });
  });

  it("does not swallow the next flag as a boolean flag's value", () => {
    const flags = _parseFlags(["--standalone", "--range", "7d"]);
    expect(flags).toEqual({ standalone: true, range: "7d" });
  });

  it("parses multiple mixed flags", () => {
    const flags = _parseFlags(["--user", "bob", "--server=https://x.com", "--standalone"]);
    expect(flags).toEqual({ user: "bob", server: "https://x.com", standalone: true });
  });

  it("ignores non-flag positional arguments", () => {
    expect(_parseFlags(["positional", "--user", "bob"])).toEqual({ user: "bob" });
  });

  it("returns an empty object for no flags", () => {
    expect(_parseFlags([])).toEqual({});
  });
});

describe("_parseSince", () => {
  it("returns null for 'all'", () => {
    expect(_parseSince("all")).toBeNull();
  });

  it("returns start of today for 'today'", () => {
    const d = _parseSince("today");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("returns N days ago for a numeric range", () => {
    const now = new Date();
    const d = _parseSince("7");
    const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(7);
  });

  it("falls back to start of today for an unrecognized range", () => {
    const d = _parseSince("bogus");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("_isValidUserId", () => {
  it("accepts an email address", () => {
    expect(_isValidUserId("alice@example.com")).toBe(true);
  });

  it("accepts an OS username", () => {
    expect(_isValidUserId("wassimrekik")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(_isValidUserId("")).toBe(false);
  });

  it("rejects values containing path separators", () => {
    expect(_isValidUserId("../../etc/passwd")).toBe(false);
  });

  it("rejects values containing shell metacharacters", () => {
    expect(_isValidUserId("alice; rm -rf /")).toBe(false);
    expect(_isValidUserId("$(whoami)")).toBe(false);
    expect(_isValidUserId("alice`whoami`")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(_isValidUserId(undefined)).toBe(false);
    expect(_isValidUserId(true)).toBe(false);
  });
});
