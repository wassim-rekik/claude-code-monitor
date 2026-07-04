#!/usr/bin/env node
/**
 * daemon.js — entry point run by launchd / systemd / Windows registry.
 * Loads saved config and starts the file watcher.
 */

import { loadConfig } from "./service.js";
import { startWatcher } from "./watcher.js";

const config = loadConfig();
if (!config) {
  console.error("[cc-track] Not configured. Run: cc-track init --user <email> --server <url> --key <key>");
  process.exit(1);
}

console.log(`[cc-track] Starting as ${config.user} → ${config.serverUrl}`);
startWatcher(config);
