import { describe, it, expect } from "vitest";
import { _extractProject, _parseJsonlChunk, _toPayload } from "../src/watcher.js";

const LOGS_ROOT = "/home/user/.claude/projects";

describe("_extractProject", () => {
  it("extracts org/project from nested path", () => {
    const path = `${LOGS_ROOT}/myorg/myrepo/session-abc.jsonl`;
    expect(_extractProject(path, LOGS_ROOT)).toBe("myorg/myrepo");
  });

  it("extracts single-level project", () => {
    const path = `${LOGS_ROOT}/myrepo/session-abc.jsonl`;
    expect(_extractProject(path, LOGS_ROOT)).toBe("myrepo");
  });

  it("returns 'default' when session file is at root", () => {
    const path = `${LOGS_ROOT}/session-abc.jsonl`;
    expect(_extractProject(path, LOGS_ROOT)).toBe("default");
  });

  it("handles deep nesting", () => {
    const path = `${LOGS_ROOT}/org/team/project/session.jsonl`;
    expect(_extractProject(path, LOGS_ROOT)).toBe("org/team/project");
  });
});

describe("_parseJsonlChunk", () => {
  const assistantLine = JSON.stringify({
    type: "assistant",
    session_id: "s1",
    model: "claude-sonnet-4-6",
    timestamp: "2026-07-03T10:00:00Z",
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 20, cache_creation_input_tokens: 0 },
  });

  it("parses valid assistant records", () => {
    const records = _parseJsonlChunk(assistantLine);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("assistant");
    expect(records[0].usage.input_tokens).toBe(100);
  });

  it("filters out non-assistant records", () => {
    const userLine = JSON.stringify({ type: "user", content: "hello" });
    const records = _parseJsonlChunk(`${assistantLine}\n${userLine}`);
    expect(records).toHaveLength(1);
  });

  it("filters out assistant records without usage", () => {
    const noUsage = JSON.stringify({ type: "assistant", content: "hi" });
    const records = _parseJsonlChunk(noUsage);
    expect(records).toHaveLength(0);
  });

  it("silently skips malformed JSON lines", () => {
    const text = `${assistantLine}\n{bad json}\n${assistantLine}`;
    const records = _parseJsonlChunk(text);
    expect(records).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(_parseJsonlChunk("")).toHaveLength(0);
    expect(_parseJsonlChunk("   \n  \n")).toHaveLength(0);
  });

  it("handles multiple records in one chunk", () => {
    const lines = [assistantLine, assistantLine, assistantLine].join("\n");
    expect(_parseJsonlChunk(lines)).toHaveLength(3);
  });
});

describe("_toPayload", () => {
  const raw = {
    session_id: "abc123",
    model: "claude-sonnet-4-6",
    timestamp: "2026-07-03T10:00:00Z",
    usage: {
      input_tokens: 1200,
      output_tokens: 340,
      cache_read_input_tokens: 800,
      cache_creation_input_tokens: 50,
    },
  };

  it("maps all fields correctly", () => {
    const p = _toPayload(raw, "myorg/myrepo");
    expect(p.sessionId).toBe("abc123");
    expect(p.model).toBe("claude-sonnet-4-6");
    expect(p.inputTokens).toBe(1200);
    expect(p.outputTokens).toBe(340);
    expect(p.cacheRead).toBe(800);
    expect(p.cacheCreation).toBe(50);
    expect(p.project).toBe("myorg/myrepo");
    expect(p.timestamp).toBe("2026-07-03T10:00:00Z");
  });

  it("defaults missing usage fields to 0", () => {
    const sparse = { ...raw, usage: { input_tokens: 100 } };
    const p = _toPayload(sparse, "default");
    expect(p.outputTokens).toBe(0);
    expect(p.cacheRead).toBe(0);
    expect(p.cacheCreation).toBe(0);
  });

  it("defaults model to 'unknown' when absent", () => {
    const { model: _m, ...noModel } = raw;
    const p = _toPayload(noModel, "default");
    expect(p.model).toBe("unknown");
  });

  it("uses current timestamp when record has none", () => {
    const { timestamp: _t, ...noTs } = raw;
    const before = new Date().toISOString();
    const p = _toPayload(noTs, "default");
    expect(new Date(p.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });
});
