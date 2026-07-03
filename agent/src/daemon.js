#!/usr/bin/env node
/**
 * daemon.js — entry point run by launchd / systemd / Windows registry.
 * Loads saved config and starts the file watcher.
 */

import { loadConfig } from "./service.js";
import { startWatcher } from "./watcher.js";

const config = loadConfig();
if (!config) {
  console.error("[claude-monitor] Not configured. Run: claude-monitor init --server <url> --key <key>");
  process.exit(1);
}

console.log(`[claude-monitor] Starting as ${config.user} → ${config.serverUrl}`);
startWatcher(config);
