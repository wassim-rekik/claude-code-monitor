/**
 * identity.js
 * Detects developer identity without any API calls or ToS violations.
 *
 * Strategy (in order):
 *  1. macOS Keychain  → JWT decode → email
 *  2. ~/.claude/.credentials.json → JWT decode → email
 *  3. git config user.email
 *  4. OS username (last resort)
 */

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir, userInfo } from "os";
import { join } from "path";

/**
 * Decode a JWT payload without verifying the signature.
 * We only need the email claim — no API call required.
 */
function decodeJwtEmail(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    // Node 18+ has atob; use Buffer fallback for older
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf-8")
    );
    // Anthropic JWTs typically carry email in `email` or `sub` (if it looks like an email)
    if (payload.email) return payload.email;
    if (typeof payload.sub === "string" && payload.sub.includes("@")) return payload.sub;
    return null;
  } catch {
    return null;
  }
}

/** macOS only: read OAuth token from system Keychain */
function readMacKeychain() {
  if (process.platform !== "darwin") return null;
  try {
    // Claude Code stores credentials under this service name
    const raw = execSync(
      'security find-generic-password -s "claude-code-credentials" -w 2>/dev/null',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();
    // The stored value is a JSON string containing { access_token, ... }
    const parsed = JSON.parse(raw);
    return decodeJwtEmail(parsed.access_token || parsed.token || raw);
  } catch {
    return null;
  }
}

/** Cross-platform: read ~/.claude/.credentials.json */
function readCredentialsFile() {
  const paths = [
    join(homedir(), ".claude", ".credentials.json"),
    join(homedir(), ".config", "claude", ".credentials.json"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const raw = JSON.parse(readFileSync(p, "utf-8"));
      const token = raw.access_token || raw.oauthToken || Object.values(raw)[0]?.access_token;
      if (token) {
        const email = decodeJwtEmail(token);
        if (email) return email;
      }
    } catch { /* continue */ }
  }
  return null;
}

/** git config user.email */
function readGitEmail() {
  try {
    return execSync("git config --global user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

/** Final fallback: machine OS username */
function readOsUsername() {
  try { return userInfo().username; } catch { return "unknown"; }
}

export function detectIdentity() {
  const sources = [
    { name: "macOS Keychain", fn: readMacKeychain },
    { name: "~/.claude/.credentials.json", fn: readCredentialsFile },
    { name: "git config", fn: readGitEmail },
    { name: "OS username", fn: readOsUsername },
  ];

  for (const { name, fn } of sources) {
    const value = fn();
    if (value) {
      console.log(`✓ Identity detected via ${name}: ${value}`);
      return value;
    }
  }
  return "unknown";
}
