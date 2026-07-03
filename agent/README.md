# claude-monitor agent

The agent is a lightweight Node.js process that runs on each developer's machine. It watches the local JSONL files that Claude Code writes, extracts token usage from every assistant response, and either:

- Prints a **live terminal log** (standalone mode — no server needed), or
- **Ships records to your team server** over HTTP (server mode).

---

## Requirements

- Node.js 18 or later
- Claude Code installed and used at least once (so `~/.claude/projects/` exists)

---

## Installation

### Global install from npm

```bash
npm install -g claude-monitor
```

### One-line installer (server mode only)

If your team runs the server, distribute this command to every developer:

```bash
curl -fsSL https://your-server.com/install.sh | bash -s -- \
  --server https://your-server.com \
  --key YOUR_API_KEY
```

This checks Node.js ≥ 18, installs the package globally, auto-detects the developer's identity, and registers a background service that starts on login.

---

## Modes

### Standalone — terminal live log

No server, no configuration. Just run:

```bash
claude-monitor run --standalone
```

You will see a live stream of every new assistant response as Claude Code writes it, plus a rolling daily summary:

```
────────────────────────────────────────────────────────────
 Claude Monitor  ·  live  ·  03 Jul 2026  ·  you@example.com
────────────────────────────────────────────────────────────

 [10:41:02]  sonnet-4-6      +1.2k in  /  340 out   cache: 800r/0w   $0.0042  myorg/myrepo
 [10:41:09]  opus-4-8        +5.0k in  /  1.2k out  cache: 2.1kr/0w  $0.0560  myorg/myrepo

────────────────────────────────────────────────────────────
 Today  45,320 tokens   $1.24   5 sessions   cache: 34% ✓
────────────────────────────────────────────────────────────
```

The summary prints every 60 seconds and updates incrementally — no restart needed.

### Server mode — ship to team dashboard

Point the agent at your running server:

```bash
claude-monitor init --server https://your-server.com --key YOUR_API_KEY
```

`init` does three things:
1. Auto-detects your identity (see [Identity detection](#identity-detection) below)
2. Saves config to `~/.config/claude-monitor/config.json`
3. Installs a background service so monitoring starts automatically on login

Once initialized, the agent runs silently in the background. Every new usage record is shipped to `POST /api/usage` on your server within seconds.

---

## CLI reference

| Command | Description |
|---|---|
| `claude-monitor init --server <url> --key <key>` | First-time setup: detect identity, save config, install background service |
| `claude-monitor status` | Show current configuration (user, server URL) |
| `claude-monitor run` | Run in foreground using saved config (useful for debugging) |
| `claude-monitor run --standalone` | Run in foreground, terminal log only — no server required |
| `claude-monitor uninstall` | Stop and remove the background service |

---

## Identity detection

The agent resolves your identity automatically — no manual email entry. It tries each source in order and stops at the first match:

| Priority | Source | How |
|---|---|---|
| 1 | **macOS Keychain** | Reads the Claude Code OAuth token and decodes the email from the JWT payload |
| 2 | **`~/.claude/.credentials.json`** | Same JWT decode, works cross-platform |
| 3 | **`git config --global user.email`** | Your global git identity |
| 4 | **OS username** | Last-resort fallback |

No API call is ever made to Anthropic during identity detection.

---

## Background service

After `claude-monitor init`, a platform-native service is installed that starts the agent on login:

| Platform | Mechanism | Config location |
|---|---|---|
| macOS | launchd LaunchAgent | `~/Library/LaunchAgents/com.claude-monitor.plist` |
| Linux | systemd user unit | `~/.config/systemd/user/claude-monitor.service` |
| Windows | Registry Run key | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |

**Logs** are written to:
- `~/.config/claude-monitor/stdout.log`
- `~/.config/claude-monitor/stderr.log`

To remove the service at any time:

```bash
claude-monitor uninstall
```

---

## Configuration file

Config is stored at `~/.config/claude-monitor/config.json`:

```json
{
  "user": "you@example.com",
  "serverUrl": "https://your-server.com",
  "apiKey": "your-api-key"
}
```

You can edit this file directly if you need to update the server URL or key without re-running `init`.

---

## What gets sent to the server

Each assistant response from Claude Code produces one record:

```json
{
  "user": "you@example.com",
  "records": [
    {
      "sessionId": "abc123",
      "model": "claude-sonnet-4-6",
      "inputTokens": 1200,
      "outputTokens": 340,
      "cacheRead": 800,
      "cacheCreation": 0,
      "timestamp": "2026-07-03T10:15:00.000Z",
      "project": "myorg/myrepo"
    }
  ]
}
```

Records are sent to `POST {serverUrl}/api/usage` with an `x-api-key` header. Cursor positions are persisted in `~/.claude/.monitor-state.json` so no record is sent twice, even across restarts.

---

## Local log files

The agent reads from:

```
~/.claude/projects/<org>/<project>/<session-id>.jsonl
```

Only `assistant` messages that include a `usage` field are processed. User messages, tool results, and metadata lines are ignored.

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

Tests cover pricing math, JSONL parsing, project path extraction, record transformation, and the identity fallback chain. All tests run without network access or filesystem side effects.

---

## Pricing used for cost estimates

Cost estimates are calculated locally using public Anthropic pricing (per million tokens):

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| claude-opus-4-8 | $5 | $25 | $0.50 | $6.25 |
| claude-sonnet-4-6 | $3 | $15 | $0.30 | $3.75 |
| claude-haiku-4-5 | $1 | $5 | $0.10 | $1.25 |

These are estimates only. No Anthropic API call is made to verify actual billing.
