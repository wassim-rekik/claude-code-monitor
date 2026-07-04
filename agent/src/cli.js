#!/usr/bin/env node
/**
 * cc-track CLI
 *
 * Usage:
 *   cc-track init --user you@example.com --server https://your-server.com --key SECRET
 *   cc-track status
 *   cc-track run [--standalone] [--user <email>] [--range <r>]
 *   cc-track uninstall
 */

import { userInfo } from "os";
import { saveConfig, loadConfig, installService, uninstallService } from "./service.js";
import { startWatcher } from "./watcher.js";

const args  = process.argv.slice(2);
const cmd   = args[0];
const flags = Object.fromEntries(
  args.slice(1)
    .filter(a => a.startsWith("--"))
    .map(a => {
      const [k, ...v] = a.slice(2).split("=");
      return [k, v.join("=") || args[args.indexOf(`--${k}`) + 1]];
    })
);

// ─── init ─────────────────────────────────────────────────────────────────────
if (cmd === "init") {
  const { user, server, key } = flags;
  if (!user || !server || !key) {
    console.error("Usage: cc-track init --user <email> --server <url> --key <key>");
    process.exit(1);
  }

  const config = { user, serverUrl: server.replace(/\/$/, ""), apiKey: key };

  console.log("\n📁 Saving config...");
  saveConfig(config);

  console.log("\n⚙️  Installing background service...");
  await installService(config);

  console.log(`
✅ Done! cc-track is running in the background.

   User     : ${user}
   Server   : ${server}
   Logs dir : ~/.config/cc-track-agent/

To check status : cc-track status
To uninstall    : cc-track uninstall
`);
}

// ─── status ───────────────────────────────────────────────────────────────────
else if (cmd === "status") {
  const config = loadConfig();
  if (!config) {
    console.log("❌ Not configured. Run: cc-track init --server <url> --key <key>");
    process.exit(1);
  }
  console.log(`
✓ Configured
  User   : ${config.user}
  Server : ${config.serverUrl}
`);
}

// ─── uninstall ────────────────────────────────────────────────────────────────
else if (cmd === "uninstall") {
  uninstallService();
  console.log("✓ Uninstalled");
}

// ─── run (foreground, for dev/debug) ─────────────────────────────────────────
else if (cmd === "run") {
  const standalone = "standalone" in flags;
  const rangeArg   = flags.range ?? "today";
  const since      = parseSince(rangeArg);

  if (standalone) {
    const user = flags.user || userInfo().username;
    startWatcher({ user, serverUrl: null, apiKey: null, intervalMs: 10_000, standalone: true, since, rangeLabel: rangeArg });
  } else {
    const config = loadConfig();
    if (!config) { console.error("Not configured. Run: cc-track init"); process.exit(1); }
    startWatcher({ ...config, intervalMs: 10_000, since, rangeLabel: rangeArg });
  }
}

else {
  console.log(`
cc-track — Claude Code usage agent

Commands:
  init        --user <email> --server <url> --key <key>   First-time setup
  status                                                    Show current config
  run         [--standalone] [--user <email>] [--range r]  Run in foreground
                --standalone  terminal only, no server
                --user        your identifier (default: OS username)
                --range       today (default) | 7d | 30d | all
  uninstall                                                 Remove background service
`);
}

function parseSince(range) {
  if (range === "all") return null;
  if (range === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const days = parseInt(range, 10);
  if (!isNaN(days)) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
