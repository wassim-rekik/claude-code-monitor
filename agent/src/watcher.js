/**
 * watcher.js
 * Watches ~/.claude/projects/**\/*.jsonl and either:
 *  - ships new records to the server (default), or
 *  - prints them to the terminal (standalone mode)
 */

import chokidar from "chokidar";
import { createReadStream, statSync, existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { calcCost, renderDashboard } from "./tui.js";

const CLAUDE_LOGS = join(homedir(), ".claude", "projects");
const STATE_FILE  = join(homedir(), ".claude", ".monitor-state.json");

const DEFAULT_INTERVAL_MS       = 60_000;
const INITIAL_RENDER_DELAY_MS   = 3_000;
const WRITE_STABILITY_THRESHOLD_MS = 2_000;
const WRITE_POLL_INTERVAL_MS    = 500;
const PROJECT_PATH_SEGMENTS     = 2; // e.g. cwd "/Users/dev/myorg/myrepo" -> "myorg/myrepo"

/** Pure helpers — exported for testing */
export function _extractProject(filePath, logsRoot) {
  const parts = filePath.replace(logsRoot, "").split("/").filter(Boolean);
  return parts.slice(0, -1).join("/") || "default";
}

export function _parseJsonlChunk(text) {
  return text
    .split("\n")
    .filter(Boolean)
    .flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } })
    .filter(r => r.type === "assistant" && r.message?.usage &&
                 (r.message.usage.input_tokens ?? 0) + (r.message.usage.output_tokens ?? 0) > 0);
}

export function _toPayload(record, fallbackProject) {
  const usage = record.message?.usage ?? {};
  const model = (record.message?.model ?? record.model ?? "unknown")
    .replace(/-\d{8}$/, ""); // strip date suffix e.g. -20251001
  const project = record.cwd
    ? record.cwd.split("/").filter(Boolean).slice(-PROJECT_PATH_SEGMENTS).join("/")
    : fallbackProject;
  return {
    sessionId:     record.sessionId ?? record.session_id,
    model,
    inputTokens:   usage.input_tokens                ?? 0,
    outputTokens:  usage.output_tokens               ?? 0,
    cacheRead:     usage.cache_read_input_tokens     ?? 0,
    cacheCreation: usage.cache_creation_input_tokens ?? 0,
    timestamp:     record.timestamp ?? new Date().toISOString(),
    project,
  };
}

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch { return {}; }
}
function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function startWatcher({ user, serverUrl, apiKey, intervalMs = DEFAULT_INTERVAL_MS, standalone = false, since = null, rangeLabel = "today" }) {
  // standalone: always start from byte 0 so the time filter controls what's shown
  const cursors = standalone ? {} : loadState();

  // Groups keyed by "project|||model" for the grouped dashboard
  const groups = new Map();

  function accumulateRecord(record) {
    if (since && new Date(record.timestamp) < since) return;
    const key = `${record.project}|||${record.model}`;
    if (!groups.has(key)) {
      groups.set(key, { project: record.project, model: record.model, tokens: 0, cost: 0, sessions: new Set() });
    }
    const group = groups.get(key);
    group.tokens += record.inputTokens + record.outputTokens;
    group.cost   += calcCost(record.model, record);
    group.sessions.add(record.sessionId);
  }

  async function processFile(filePath) {
    if (!existsSync(filePath)) return;
    const size = statSync(filePath).size;
    const cursor = cursors[filePath] ?? 0;
    if (size <= cursor) return;

    const chunks = [];
    const stream = createReadStream(filePath, { start: cursor, encoding: "utf-8" });
    for await (const chunk of stream) chunks.push(chunk);

    const records = _parseJsonlChunk(chunks.join(""));

    if (standalone) {
      cursors[filePath] = size;
      const project = _extractProject(filePath, CLAUDE_LOGS);
      for (const record of records.map(r => _toPayload(r, project))) {
        accumulateRecord(record);
      }
      return;
    }

    // Server mode: only advance cursor after confirmed delivery
    if (!records.length) {
      cursors[filePath] = size;
      saveState(cursors);
      return;
    }

    const project = _extractProject(filePath, CLAUDE_LOGS);
    const payload = records.map(r => _toPayload(r, project));

    try {
      const res = await fetch(`${serverUrl}/api/usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ user, records: payload }),
      });
      if (res.ok) {
        cursors[filePath] = size;
        saveState(cursors);
        console.log(`[cc-track] Shipped ${payload.length} records for ${user}`);
      } else {
        console.error(`[cc-track] Server error ${res.status} — will retry`);
      }
    } catch (e) {
      console.error("[cc-track] Network error:", e.message, "— will retry");
    }
  }

  function logProcessingError(filePath, err) {
    console.error(`[cc-track] Failed to process ${filePath}:`, err.message);
  }

  const watcher = chokidar.watch(`${CLAUDE_LOGS}/**/*.jsonl`, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: WRITE_STABILITY_THRESHOLD_MS, pollInterval: WRITE_POLL_INTERVAL_MS },
  });

  watcher
    .on("add",    path => processFile(path).catch(err => logProcessingError(path, err)))
    .on("change", path => processFile(path).catch(err => logProcessingError(path, err)));

  if (standalone) {
    // Render immediately after startup files settle, then on every interval
    setTimeout(() => renderDashboard(groups, user, rangeLabel), INITIAL_RENDER_DELAY_MS);
    setInterval(() => {
      Object.keys(cursors).forEach(p => processFile(p).catch(err => logProcessingError(p, err)));
      renderDashboard(groups, user, rangeLabel);
    }, intervalMs);
  } else {
    console.log(`[cc-track] Watching ${CLAUDE_LOGS} as ${user}`);
  }

  return watcher;
}
