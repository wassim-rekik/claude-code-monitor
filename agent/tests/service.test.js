import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("fs", () => ({
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => "{}"),
}));

vi.mock("child_process", () => ({
  execSync: vi.fn(() => "/usr/local/bin/node\n"),
}));

describe("service module", () => {
  test("loadConfig and saveConfig are exported functions", async () => {
    const { loadConfig, saveConfig } = await import("../src/service.js");
    expect(typeof loadConfig).toBe("function");
    expect(typeof saveConfig).toBe("function");
  });

  test("installService and uninstallService are exported functions", async () => {
    const { installService, uninstallService } = await import("../src/service.js");
    expect(typeof installService).toBe("function");
    expect(typeof uninstallService).toBe("function");
  });

  test("loadConfig returns null when config file does not exist", async () => {
    const { loadConfig } = await import("../src/service.js");
    const result = loadConfig();
    expect(result).toBeNull();
  });
});
