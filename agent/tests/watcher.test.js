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

// Actual Claude Code JSONL format: usage nested under record.message, cwd for project
const makeRecord = (overrides = {}) => JSON.stringify({
  type: "assistant",
  sessionId: "s1",
  timestamp: "2026-07-03T10:00:00Z",
  cwd: "/Users/dev/projects/my-app",
  message: {
    model: "claude-sonnet-4-6",
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      cache_read_input_tokens: 20,
      cache_creation_input_tokens: 0,
    },
  },
  ...overrides,
});

describe("_parseJsonlChunk", () => {
  const assistantLine = makeRecord();

  it("parses valid assistant records", () => {
    const records = _parseJsonlChunk(assistantLine);
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("assistant");
    expect(records[0].message.usage.input_tokens).toBe(100);
  });

  it("filters out non-assistant records", () => {
    const userLine = JSON.stringify({ type: "user", content: "hello" });
    const records = _parseJsonlChunk(`${assistantLine}\n${userLine}`);
    expect(records).toHaveLength(1);
  });

  it("filters out assistant records without message.usage", () => {
    const noUsage = JSON.stringify({ type: "assistant", message: { content: "hi" } });
    expect(_parseJsonlChunk(noUsage)).toHaveLength(0);
  });

  it("filters out zero-token records (synthetic entries)", () => {
    const zeroTokens = JSON.stringify({
      type: "assistant",
      message: { model: "<synthetic>", usage: { input_tokens: 0, output_tokens: 0 } },
    });
    expect(_parseJsonlChunk(zeroTokens)).toHaveLength(0);
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
    type: "assistant",
    sessionId: "abc123",
    timestamp: "2026-07-03T10:00:00Z",
    cwd: "/Users/dev/projects/myorg/myrepo",
    message: {
      model: "claude-sonnet-4-6",
      usage: {
        input_tokens: 1200,
        output_tokens: 340,
        cache_read_input_tokens: 800,
        cache_creation_input_tokens: 50,
      },
    },
  };

  it("maps all fields correctly", () => {
    const p = _toPayload(raw, "fallback");
    expect(p.sessionId).toBe("abc123");
    expect(p.model).toBe("claude-sonnet-4-6");
    expect(p.inputTokens).toBe(1200);
    expect(p.outputTokens).toBe(340);
    expect(p.cacheRead).toBe(800);
    expect(p.cacheCreation).toBe(50);
    expect(p.project).toBe("myorg/myrepo");
    expect(p.timestamp).toBe("2026-07-03T10:00:00Z");
  });

  it("uses cwd last 2 segments as project name", () => {
    const p = _toPayload(raw, "fallback");
    expect(p.project).toBe("myorg/myrepo");
  });

  it("falls back to provided project when cwd is absent", () => {
    const { cwd: _, ...noCwd } = raw;
    const p = _toPayload(noCwd, "fallback-project");
    expect(p.project).toBe("fallback-project");
  });

  it("strips date suffix from model name", () => {
    const withDate = { ...raw, message: { ...raw.message, model: "claude-haiku-4-5-20251001" } };
    const p = _toPayload(withDate, "fallback");
    expect(p.model).toBe("claude-haiku-4-5");
  });

  it("defaults missing usage fields to 0", () => {
    const sparse = { ...raw, message: { model: "claude-sonnet-4-6", usage: { input_tokens: 100 } } };
    const p = _toPayload(sparse, "fallback");
    expect(p.outputTokens).toBe(0);
    expect(p.cacheRead).toBe(0);
    expect(p.cacheCreation).toBe(0);
  });

  it("defaults model to 'unknown' when absent", () => {
    const noModel = { ...raw, message: { usage: raw.message.usage } };
    const p = _toPayload(noModel, "fallback");
    expect(p.model).toBe("unknown");
  });

  it("uses current timestamp when record has none", () => {
    const { timestamp: _t, ...noTs } = raw;
    const before = new Date().toISOString();
    const p = _toPayload(noTs, "fallback");
    expect(new Date(p.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
  });
});
