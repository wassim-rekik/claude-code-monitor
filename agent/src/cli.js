#!/usr/bin/env node
/**
 * claude-monitor CLI
 *
 * Usage:
 *   claude-monitor init --server https://your-server.com --key SECRET
 *   claude-monitor status
 *   claude-monitor run [--standalone]
 *   claude-monitor uninstall
 */

import { detectIdentity } from "./identity.js";
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
  const { server, key } = flags;
  if (!server || !key) {
    console.error("Usage: claude-monitor init --server <url> --key <key>");
    process.exit(1);
  }

  console.log("\n🔍 Detecting your identity from Claude Code...");
  const user = detectIdentity();

  const config = { user, serverUrl: server.replace(/\/$/, ""), apiKey: key };

  console.log("\n📁 Saving config...");
  saveConfig(config);

  console.log("\n⚙️  Installing background service...");
  await installService(config);

  console.log(`
✅ Done! claude-monitor is running in the background.

   Identity : ${user}
   Server   : ${server}
   Logs dir : ~/.config/claude-monitor/

To check status : claude-monitor status
To uninstall    : claude-monitor uninstall
`);
}

// ─── status ───────────────────────────────────────────────────────────────────
else if (cmd === "status") {
  const config = loadConfig();
  if (!config) {
    console.log("❌ Not configured. Run: claude-monitor init --server <url> --key <key>");
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

  if (standalone) {
    // Standalone: read local logs + print to terminal, no server needed
    const { detectIdentity } = await import("./identity.js");
    const user = detectIdentity();
    startWatcher({ user, serverUrl: null, apiKey: null, intervalMs: 10_000, standalone: true });
  } else {
    const config = loadConfig();
    if (!config) { console.error("Not configured. Run: claude-monitor init"); process.exit(1); }
    startWatcher({ ...config, intervalMs: 10_000 });
  }
}

else {
  console.log(`
claude-monitor — Claude Code usage agent

Commands:
  init        --server <url> --key <key>   First-time setup
  status                                    Show current config
  run         [--standalone]                Run in foreground (--standalone: terminal only, no server)
  uninstall                                 Remove background service
`);
}
