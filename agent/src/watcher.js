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
    ? record.cwd.split("/").filter(Boolean).slice(-2).join("/")
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

export function startWatcher({ user, serverUrl, apiKey, intervalMs = 60_000, standalone = false, since = null, rangeLabel = "today" }) {
  // standalone: always start from byte 0 so the time filter controls what's shown
  const cursors = standalone ? {} : loadState();

  // Groups keyed by "project|||model" for the grouped dashboard
  const groups = new Map();

  function accumulateRecord(rec) {
    if (since && new Date(rec.timestamp) < since) return;
    const key = `${rec.project}|||${rec.model}`;
    if (!groups.has(key)) {
      groups.set(key, { project: rec.project, model: rec.model, tokens: 0, cost: 0, sessions: new Set() });
    }
    const g = groups.get(key);
    g.tokens += rec.inputTokens + rec.outputTokens;
    g.cost   += calcCost(rec.model, rec);
    g.sessions.add(rec.sessionId);
  }

  async function processFile(filePath) {
    if (!existsSync(filePath)) return;
    const size = statSync(filePath).size;
    const cursor = cursors[filePath] ?? 0;
    if (size <= cursor) return;

    const chunks = [];
    const stream = createReadStream(filePath, { start: cursor, encoding: "utf-8" });
    for await (const chunk of stream) chunks.push(chunk);
    cursors[filePath] = size;
    if (!standalone) saveState(cursors);

    const records = _parseJsonlChunk(chunks.join(""));
    if (!records.length) return;

    const project = _extractProject(filePath, CLAUDE_LOGS);
    const payload = records.map(r => _toPayload(r, project));

    if (standalone) {
      for (const rec of payload) accumulateRecord(rec);
    } else {
      try {
        const res = await fetch(`${serverUrl}/api/usage`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey },
          body: JSON.stringify({ user, records: payload }),
        });
        if (!res.ok) console.error(`[monitor] Server error ${res.status}`);
        else console.log(`[monitor] Shipped ${payload.length} records for ${user}`);
      } catch (e) {
        console.error("[monitor] Network error:", e.message);
      }
    }
  }

  const watcher = chokidar.watch(`${CLAUDE_LOGS}/**/*.jsonl`, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });

  watcher
    .on("add",    path => processFile(path).catch(console.error))
    .on("change", path => processFile(path).catch(console.error));

  if (standalone) {
    // Render immediately after startup files settle, then on every interval
    setTimeout(() => renderDashboard(groups, user, rangeLabel), 3000);
    setInterval(() => {
      Object.keys(cursors).forEach(p => processFile(p).catch(console.error));
      renderDashboard(groups, user, rangeLabel);
    }, intervalMs);
  } else {
    console.log(`[monitor] Watching ${CLAUDE_LOGS} as ${user}`);
  }

  return watcher;
}
