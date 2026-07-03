/**
 * tui.js — terminal live log for standalone mode.
 * No interactive deps — just chalk + formatted console output.
 */

import chalk from "chalk";

const PRICING = {
  "claude-opus-4-8":   { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3,  cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite: 1.25 },
};

export function calcCost(model, usage) {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (
    (usage.inputTokens  / 1e6) * p.input +
    (usage.outputTokens / 1e6) * p.output +
    (usage.cacheRead    / 1e6) * p.cacheRead +
    (usage.cacheCreation/ 1e6) * p.cacheWrite
  );
}

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

const MODEL_COLOR = {
  "claude-opus-4-8":   chalk.hex("#a78bfa"),
  "claude-sonnet-4-6": chalk.hex("#34d399"),
  "claude-haiku-4-5":  chalk.hex("#60a5fa"),
};

function modelLabel(model) {
  const color = MODEL_COLOR[model] ?? chalk.white;
  const short = model.replace("claude-", "").replace("-20", " (").replace(/(\d{2})$/, "$1)");
  return color(short.padEnd(14));
}

export function printRecord(record) {
  const cost = calcCost(record.model, record);
  const line = [
    chalk.dim(`[${ts()}]`),
    modelLabel(record.model),
    chalk.cyan(`+${fmt(record.inputTokens)} in`),
    chalk.dim("/"),
    chalk.green(`${fmt(record.outputTokens)} out`),
    chalk.dim(`cache: ${fmt(record.cacheRead)}r/${fmt(record.cacheCreation)}w`),
    chalk.yellow(`$${cost.toFixed(4)}`),
    chalk.dim(record.project ?? ""),
  ].join("  ");
  console.log(line);
}

export function printSummary(state) {
  const { tokens, cost, sessions, cacheRead, totalInput } = state;
  const cacheHitPct = totalInput > 0 ? Math.round((cacheRead / (totalInput + cacheRead)) * 100) : 0;
  const cacheStatus = cacheHitPct > 30
    ? chalk.green(`${cacheHitPct}% ✓`)
    : chalk.yellow(`${cacheHitPct}% (low)`);

  const sep = chalk.dim("─".repeat(60));
  console.log(`\n${sep}`);
  console.log(
    chalk.bold(" Today  ") +
    chalk.white(`${fmt(tokens)} tokens`) + "  " +
    chalk.yellow(`$${cost.toFixed(4)}`) + "  " +
    chalk.dim(`${sessions} sessions`) + "  " +
    "cache: " + cacheStatus
  );
  console.log(`${sep}\n`);
}

export function printHeader(user) {
  const sep = chalk.dim("─".repeat(60));
  console.log(`\n${sep}`);
  console.log(
    chalk.bold(" Claude Monitor") +
    chalk.dim("  ·  live  ·  ") +
    chalk.white(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })) +
    chalk.dim("  ·  ") +
    chalk.cyan(user)
  );
  console.log(`${sep}\n`);
}
