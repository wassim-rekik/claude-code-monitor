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
import { fileURLToPath } from "url";
import { saveConfig, loadConfig, installService, uninstallService } from "./service.js";
import { startWatcher } from "./watcher.js";

const RUN_INTERVAL_MS = 10_000;

/** Pure helpers — exported for testing */
export function _parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;

    const eqIndex = arg.indexOf("=");
    if (eqIndex !== -1) {
      flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

const USER_ID_PATTERN = /^[\w.@+-]+$/;

export function _isValidUserId(value) {
  return typeof value === "string" && value.length > 0 && USER_ID_PATTERN.test(value);
}

export function _parseSince(range) {
  if (range === "all") return null;

  const days = parseInt(range, 10);
  if (range !== "today" && !isNaN(days)) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  // "today" and any unrecognized range both default to start of today
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function main() {
  const args  = process.argv.slice(2);
  const cmd   = args[0];
  const flags = _parseFlags(args.slice(1));

  if (cmd === "init") {
    const { user, server, key } = flags;
    if (!user || !server || !key) {
      console.error("Usage: cc-track init --user <email> --server <url> --key <key>");
      process.exit(1);
    }
    if (!_isValidUserId(user)) {
      console.error(`Invalid --user value: "${user}". Use only letters, numbers, and . _ - + @`);
      process.exit(1);
    }

    const config = { user, serverUrl: server.replace(/\/$/, ""), apiKey: key };

    try {
      console.log("\n📁 Saving config...");
      saveConfig(config);

      console.log("\n⚙️  Installing background service...");
      await installService(config);
    } catch (e) {
      console.error(`\n✗ Setup failed: ${e.message}`);
      process.exit(1);
    }

    console.log(`
✅ Done! cc-track is running in the background.

   User     : ${user}
   Server   : ${server}
   Logs dir : ~/.config/cc-track-agent/

To check status : cc-track status
To uninstall    : cc-track uninstall
`);
  }

  else if (cmd === "status") {
    const config = loadConfig();
    if (!config) {
      console.log("❌ Not configured. Run: cc-track init --user <email> --server <url> --key <key>");
      process.exit(1);
    }
    console.log(`
✓ Configured
  User   : ${config.user}
  Server : ${config.serverUrl}
`);
  }

  else if (cmd === "uninstall") {
    uninstallService();
    console.log("✓ Uninstalled");
  }

  else if (cmd === "run") {
    const standalone = "standalone" in flags;
    const rangeArg   = flags.range ?? "today";
    const since      = _parseSince(rangeArg);

    if (standalone) {
      const user = flags.user || userInfo().username;
      if (!_isValidUserId(user)) {
        console.error(`Invalid --user value: "${user}". Use only letters, numbers, and . _ - + @`);
        process.exit(1);
      }
      startWatcher({ user, serverUrl: null, apiKey: null, intervalMs: RUN_INTERVAL_MS, standalone: true, since, rangeLabel: rangeArg });
    } else {
      const config = loadConfig();
      if (!config) { console.error("Not configured. Run: cc-track init"); process.exit(1); }
      startWatcher({ ...config, intervalMs: RUN_INTERVAL_MS, since, rangeLabel: rangeArg });
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
}

// Only run when executed directly (as the CLI entrypoint), not when imported for testing.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
