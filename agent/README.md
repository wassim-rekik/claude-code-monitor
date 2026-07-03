# cc-track-agent

Monitor your Claude Code token usage from the terminal — grouped by project and model, filtered by time range. No Anthropic API calls. No server required for standalone mode.

---

## Requirements

- Node.js 18 or later
- Claude Code installed and used at least once (so `~/.claude/projects/` exists)

---

## Installation

```bash
npm install -g cc-track-agent
```

---

## Standalone mode — terminal dashboard

No server, no configuration needed. Just run:

```bash
cc-track run --standalone
```

The dashboard refreshes every 10 seconds and shows usage grouped by project and model:

```
──────────────────────────────────────────────────────────────────
 cc-track  ·  03 Jul 2026  ·  you@example.com  ·  range: today  ·  10:45:00
──────────────────────────────────────────────────────────────────

Project                       Model            Tokens       Cost  Sessions
──────────────────────────────────────────────────────────────────
myorg/frontend                sonnet-4.6       149.3k     $9.08         3
myorg/backend                 sonnet-4.6        85.3k     $5.65         2
myorg/infra                   haiku-4.5          5.8k     $0.16         1
──────────────────────────────────────────────────────────────────
TOTAL                                          240.4k    $14.89         6

──────────────────────────────────────────────────────────────────
```

### Time range filter

By default only today's usage is shown. Use `--range` to change the window:

```bash
cc-track run --standalone                  # today (default)
cc-track run --standalone --range 7d       # last 7 days
cc-track run --standalone --range 30d      # last 30 days
cc-track run --standalone --range all      # all history
```

---

## Server mode — ship to team dashboard

Point the agent at a running [claude-monitor server](../server/README.md):

```bash
cc-track init --server https://your-server.com --key YOUR_API_KEY
```

`init` does three things:
1. Auto-detects your identity (see [Identity detection](#identity-detection) below)
2. Saves config to `~/.config/cc-track-agent/config.json`
3. Installs a background service that starts automatically on login

Once initialized, the agent runs silently in the background and ships every new usage record to the server within seconds.

### One-line team installer

Distribute this to every developer on your team:

```bash
curl -fsSL https://your-server.com/install.sh | bash -s -- \
  --server https://your-server.com \
  --key YOUR_API_KEY
```

---

## CLI reference

| Command | Description |
|---|---|
| `cc-track init --server <url> --key <key>` | First-time setup: detect identity, save config, install background service |
| `cc-track status` | Show current configuration |
| `cc-track run --standalone [--range <r>]` | Terminal dashboard — no server needed |
| `cc-track run` | Run in foreground using saved server config |
| `cc-track uninstall` | Stop and remove the background service |

---

## Identity detection

The agent resolves your identity automatically — no manual email entry. It tries each source in order and stops at the first match:

| Priority | Source | How |
|---|---|---|
| 1 | **macOS Keychain** | Reads the Claude Code OAuth token, decodes email from the JWT |
| 2 | **`~/.claude/.credentials.json`** | Same JWT decode, works cross-platform |
| 3 | **`git config --global user.email`** | Your global git identity |
| 4 | **OS username** | Last-resort fallback |

No API call is ever made to Anthropic during identity detection.

---

## Background service (server mode)

After `cc-track init`, a platform-native service is installed:

| Platform | Mechanism | Config location |
|---|---|---|
| macOS | launchd LaunchAgent | `~/Library/LaunchAgents/com.cc-track-agent.plist` |
| Linux | systemd user unit | `~/.config/systemd/user/cc-track-agent.service` |
| Windows | Registry Run key | `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` |

Logs are written to `~/.config/cc-track-agent/stdout.log` and `stderr.log`.

```bash
cc-track uninstall   # stop and remove the service
```

---

## What data is read

The agent reads JSONL files written by Claude Code:

```
~/.claude/projects/<project>/<session-id>.jsonl
```

Only `assistant` messages with token usage are processed. User messages, tool results, and metadata lines are ignored. Zero-token synthetic entries are skipped.

### What gets sent to the server (server mode only)

```json
{
  "user": "you@example.com",
  "records": [{
    "sessionId": "abc123",
    "model": "claude-sonnet-4-6",
    "inputTokens": 1200,
    "outputTokens": 340,
    "cacheRead": 800,
    "cacheCreation": 0,
    "timestamp": "2026-07-03T10:15:00.000Z",
    "project": "myorg/myrepo"
  }]
}
```

Sent to `POST {serverUrl}/api/usage` with an `x-api-key` header. Cursors are persisted in `~/.claude/.monitor-state.json` so no record is shipped twice across restarts.

In standalone mode, nothing leaves your machine.

---

## Pricing used for cost estimates

Calculated locally using public Anthropic pricing (per million tokens):

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| claude-opus-4-8 | $5 | $25 | $0.50 | $6.25 |
| claude-sonnet-4-6 | $3 | $15 | $0.30 | $3.75 |
| claude-haiku-4-5 | $1 | $5 | $0.10 | $1.25 |

These are estimates only. No Anthropic API call is made.

---

## Development

```bash
npm install
npm test           # run tests once
npm run test:watch # watch mode
```

Tests cover pricing math, JSONL parsing, project extraction, record transformation, identity fallback chain, and service module exports. All tests run without network access or filesystem side effects.
