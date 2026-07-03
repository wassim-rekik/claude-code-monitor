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
import { calcCost, printRecord, printSummary, printHeader } from "./tui.js";

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
    .filter(r => r.type === "assistant" && r.usage);
}

export function _toPayload(record, project) {
  return {
    sessionId:     record.session_id,
    model:         record.model ?? "unknown",
    inputTokens:   record.usage.input_tokens               ?? 0,
    outputTokens:  record.usage.output_tokens              ?? 0,
    cacheRead:     record.usage.cache_read_input_tokens    ?? 0,
    cacheCreation: record.usage.cache_creation_input_tokens ?? 0,
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

export function startWatcher({ user, serverUrl, apiKey, intervalMs = 60_000, standalone = false }) {
  const cursors = loadState();

  // Accumulated daily totals for standalone summary
  const daily = { tokens: 0, cost: 0, sessions: new Set(), cacheRead: 0, totalInput: 0 };

  if (standalone) printHeader(user);

  async function processFile(filePath) {
    if (!existsSync(filePath)) return;
    const size = statSync(filePath).size;
    const cursor = cursors[filePath] ?? 0;
    if (size <= cursor) return;

    const chunks = [];
    const stream = createReadStream(filePath, { start: cursor, encoding: "utf-8" });
    for await (const chunk of stream) chunks.push(chunk);
    cursors[filePath] = size;
    saveState(cursors);

    const records = _parseJsonlChunk(chunks.join(""));
    if (!records.length) return;

    const project = extractProject(filePath);
    const payload = records.map(r => _toPayload(r, project));

    if (standalone) {
      for (const rec of payload) {
        const totalTok = rec.inputTokens + rec.outputTokens;
        daily.tokens    += totalTok;
        daily.cost      += calcCost(rec.model, rec);
        daily.cacheRead += rec.cacheRead;
        daily.totalInput += rec.inputTokens;
        daily.sessions.add(rec.sessionId);
        printRecord(rec);
      }
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

  function extractProject(filePath) {
    return _extractProject(filePath, CLAUDE_LOGS);
  }

  const watcher = chokidar.watch(`${CLAUDE_LOGS}/**/*.jsonl`, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 500 },
  });

  watcher
    .on("add",    path => processFile(path).catch(console.error))
    .on("change", path => processFile(path).catch(console.error));

  // Periodic poll + summary in standalone mode
  setInterval(() => {
    Object.keys(cursors).forEach(p => processFile(p).catch(console.error));
    if (standalone) {
      printSummary({ ...daily, sessions: daily.sessions.size });
    }
  }, intervalMs);

  if (!standalone) console.log(`[monitor] Watching ${CLAUDE_LOGS} as ${user}`);
  return watcher;
}
