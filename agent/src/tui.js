import chalk from "chalk";

const PRICING = {
  "claude-opus-4-8":   { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3,  cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite: 1.25 },
};

const MODEL_COLOR = {
  "claude-opus-4-8":   chalk.hex("#a78bfa"),
  "claude-sonnet-4-6": chalk.hex("#34d399"),
  "claude-haiku-4-5":  chalk.hex("#60a5fa"),
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

function shortModel(model) {
  return model
    .replace("claude-", "")
    .replace("opus-4-8", "opus-4.8")
    .replace("sonnet-4-6", "sonnet-4.6")
    .replace("haiku-4-5", "haiku-4.5");
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/**
 * Clears the terminal and renders a grouped summary table.
 * @param {Map<string, {project, model, tokens, cost, sessions: Set}>} groups
 * @param {string} user
 */
export function renderDashboard(groups, user, rangeLabel = "today") {
  process.stdout.write("\x1b[2J\x1b[0;0H");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour12: false });

  const W = 66;
  const sep = chalk.dim("─".repeat(W));

  console.log(`\n${sep}`);
  console.log(
    chalk.bold(" cc-track") +
    chalk.dim("  ·  ") + chalk.white(dateStr) +
    chalk.dim("  ·  ") + chalk.cyan(user) +
    chalk.dim("  ·  range: ") + chalk.white(rangeLabel) +
    chalk.dim(`  ·  ${timeStr}`)
  );
  console.log(sep);

  const rows = [...groups.values()]
    .map(g => ({ ...g, sessionCount: g.sessions.size }))
    .sort((a, b) => b.tokens - a.tokens);

  if (rows.length === 0) {
    console.log(chalk.dim("\n  Watching for activity — use Claude Code to see data here.\n"));
    console.log(sep + "\n");
    return;
  }

  const C = { proj: 28, model: 12, tokens: 9, cost: 9, sessions: 8 };

  console.log("\n" + [
    chalk.dim("Project".padEnd(C.proj)),
    chalk.dim("Model".padEnd(C.model)),
    chalk.dim("Tokens".padStart(C.tokens)),
    chalk.dim("Cost".padStart(C.cost)),
    chalk.dim("Sessions".padStart(C.sessions)),
  ].join("  "));
  console.log(chalk.dim("─".repeat(W)));

  let totalTokens = 0, totalCost = 0, totalSessions = 0;

  for (const row of rows) {
    const modelColor = MODEL_COLOR[row.model] ?? chalk.white;
    console.log([
      chalk.white(truncate(row.project, C.proj).padEnd(C.proj)),
      modelColor(shortModel(row.model).padEnd(C.model)),
      chalk.cyan(fmt(row.tokens).padStart(C.tokens)),
      chalk.yellow(`$${row.cost.toFixed(3)}`.padStart(C.cost)),
      chalk.dim(String(row.sessionCount).padStart(C.sessions)),
    ].join("  "));
    totalTokens += row.tokens;
    totalCost += row.cost;
    totalSessions += row.sessionCount;
  }

  console.log(chalk.dim("─".repeat(W)));
  console.log([
    chalk.bold("TOTAL".padEnd(C.proj + C.model + 2)),
    chalk.bold.cyan(fmt(totalTokens).padStart(C.tokens)),
    chalk.bold.yellow(`$${totalCost.toFixed(3)}`.padStart(C.cost)),
    chalk.dim(String(totalSessions).padStart(C.sessions)),
  ].join("  "));

  console.log(`\n${sep}\n`);
}
