/**
 * service.js
 * Installs the agent as a background service that auto-starts on login.
 * Mac  → launchd plist
 * Linux → systemd user unit
 * Windows → registry Run key
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR  = join(homedir(), ".config", "claude-monitor");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const AGENT_SCRIPT = join(__dirname, "daemon.js");

export function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(`✓ Config saved → ${CONFIG_FILE}`);
}

export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) return null;
  return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
}

// ─── macOS launchd ───────────────────────────────────────────────────────────
function installMac(config) {
  const plistPath = join(
    homedir(), "Library", "LaunchAgents", "com.claude-monitor.plist"
  );
  const nodePath = execSync("which node", { encoding: "utf-8" }).trim();

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-monitor</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${AGENT_SCRIPT}</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>${CONFIG_DIR}/stdout.log</string>

  <key>StandardErrorPath</key>
  <string>${CONFIG_DIR}/stderr.log</string>
</dict>
</plist>`;

  writeFileSync(plistPath, plist);

  try { execSync(`launchctl unload "${plistPath}" 2>/dev/null`); } catch {}
  execSync(`launchctl load "${plistPath}"`);

  console.log(`✓ LaunchAgent installed → ${plistPath}`);
  console.log(`  Logs: ${CONFIG_DIR}/stdout.log`);
}

// ─── Windows registry Run key ────────────────────────────────────────────────
function installWindows(config) {
  const nodePath = execSync("where node", { encoding: "utf-8" }).split("\n")[0].trim();
  const cmd = `"${nodePath}" "${AGENT_SCRIPT}"`;
  const regKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

  execSync(`reg add "${regKey}" /v "ClaudeMonitor" /t REG_SZ /d "${cmd}" /f`);
  console.log(`✓ Registry Run key set`);

  const { spawn } = await import("child_process");
  spawn(nodePath, [AGENT_SCRIPT], { detached: true, stdio: "ignore" }).unref();
}

export async function installService(config) {
  const platform = process.platform;
  if (platform === "darwin") return installMac(config);
  if (platform === "win32")  return installWindows(config);

  const unitDir = join(homedir(), ".config", "systemd", "user");
  mkdirSync(unitDir, { recursive: true });
  const unitPath = join(unitDir, "claude-monitor.service");
  const nodePath = execSync("which node", { encoding: "utf-8" }).trim();

  writeFileSync(unitPath, `[Unit]
Description=Claude Code Usage Monitor

[Service]
ExecStart=${nodePath} ${AGENT_SCRIPT}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`);
  execSync("systemctl --user daemon-reload");
  execSync("systemctl --user enable --now claude-monitor");
  console.log(`✓ systemd user service installed`);
}

export function uninstallService() {
  const platform = process.platform;
  if (platform === "darwin") {
    const plistPath = join(homedir(), "Library", "LaunchAgents", "com.claude-monitor.plist");
    try {
      execSync(`launchctl unload "${plistPath}"`);
      execSync(`rm "${plistPath}"`);
      console.log("✓ LaunchAgent removed");
    } catch (e) { console.error(e.message); }
  } else if (platform === "win32") {
    execSync(`reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v ClaudeMonitor /f`);
    console.log("✓ Registry key removed");
  } else {
    execSync("systemctl --user disable --now claude-monitor");
    console.log("✓ systemd service removed");
  }
}
