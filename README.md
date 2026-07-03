# claude-monitor

**Open-source Claude Code usage monitor for teams.**

Track token consumption, costs, cache efficiency, and active sessions across your entire team — without any Anthropic API calls. Reads the JSONL logs Claude Code already writes to disk.

```
~/.claude/projects/**/*.jsonl  →  claude-monitor  →  team dashboard
```

---

## Why

Claude Code writes a detailed record of every conversation to local JSONL files. claude-monitor reads those files and turns them into actionable data — per developer, per project, per model — so your team can understand its AI spending without instrumenting anything in your codebase.

**No API calls to Anthropic.** No credentials on the server. No code changes needed.

---

## Two modes

### Standalone — terminal only

Install on one machine, see your own usage immediately. Zero infrastructure.

```bash
npm install -g cc-track-agent
cc-track run --standalone
```

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

### Full stack — team dashboard

Run the server once with Docker, then install the agent on every developer machine. Everyone's usage flows into one place.

```bash
# Server (run once, anywhere)
cp .env.example .env   # set API_KEY and DB_PASSWORD
docker compose up --build
# → http://localhost:3000

# Each developer (one command per machine)
npm install -g cc-track-agent
cc-track init --server https://your-server.com --key YOUR_API_KEY
```

---

## Dashboard

The self-hosted web dashboard updates in real time from the PostgreSQL database.

- **5-hour burn rate** — rolling token window vs. your Claude plan limit, with color-coded alert levels
- **Token usage by model** — Opus, Sonnet, and Haiku breakdown in stacked bar and area charts
- **Daily cost estimate** — computed locally from public pricing, no API call needed
- **Cache hit rate** — warns when caching is underutilised (< 30%)
- **Team breakdown** — per-developer table with tokens, cost, sessions, and cache rate
- **Time range** — 7, 14, or 30-day window
- **Per-user view** — switch between team aggregate and individual developer

---

## How it works

```
Developer machine                         Your server
─────────────────────────────────────     ────────────────────────────────
Claude Code writes:                       Next.js 16 + PostgreSQL
~/.claude/projects/                       (Docker Compose)
  └── org/
      └── project/
          └── session.jsonl               POST /api/usage
                   │                             │
            claude-monitor agent ────────────────┘
            (background service)                 │
            reads new bytes only         stores in pg
            cursor-based, no duplicates          │
                                         GET /api/stats
                                                 │
                                         React dashboard
```

The agent installs as a native background service per platform:

| Platform | Mechanism |
|---|---|
| macOS | launchd LaunchAgent |
| Linux | systemd user unit |
| Windows | Registry Run key |

After `cc-track init`, it starts automatically on login and runs silently.

---

## Identity detection

The agent auto-detects each developer's identity — no manual configuration. It tries in order:

1. **macOS Keychain** — decodes the email from Claude Code's OAuth JWT
2. **`~/.claude/.credentials.json`** — same JWT decode, cross-platform
3. **`git config user.email`** — global git identity
4. **OS username** — last-resort fallback

---

## Repository structure

```
claude-monitor/
├── agent/                  # npm package — installed on each developer's machine
│   ├── src/
│   │   ├── cli.js          # CLI entrypoint
│   │   ├── daemon.js       # Background service entry point
│   │   ├── watcher.js      # JSONL file watcher + HTTP shipper
│   │   ├── tui.js          # Terminal live log (standalone mode)
│   │   ├── identity.js     # Developer identity detection
│   │   └── service.js      # launchd / systemd / registry install
│   ├── tests/              # Vitest unit tests
│   ├── install.sh          # One-line curl installer
│   └── package.json
│
├── server/                 # Self-hosted dashboard — runs in Docker
│   ├── app/
│   │   ├── api/
│   │   │   ├── usage/      # POST  — receive records from agents
│   │   │   ├── stats/      # GET   — aggregated data for dashboard
│   │   │   └── users/      # GET   — team member list
│   │   └── page.tsx        # Dashboard entry point
│   ├── components/
│   │   └── Dashboard.tsx   # React client component
│   ├── lib/db.ts           # PostgreSQL pool + queries + auto-migration
│   ├── __tests__/          # Vitest unit tests
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting started

### Prerequisites

| Component | Requirement |
|---|---|
| Agent | Node.js 18+, Claude Code |
| Server | Docker + Docker Compose v2 |

### Option A — Standalone (one developer, no server)

```bash
npm install -g cc-track-agent
cc-track run --standalone
```

Leave it running in a terminal while you work. Stop it with `Ctrl+C` at any time.

### Option B — Full team setup

**Step 1 — Start the server**

```bash
git clone https://github.com/wassim-rekik/cc-track.git
cd claude-monitor
cp .env.example .env
# Edit .env: set API_KEY and DB_PASSWORD
docker compose up --build -d
```

**Step 2 — Install the agent on each developer machine**

```bash
npm install -g cc-track-agent
cc-track init --server https://your-server.com --key YOUR_API_KEY
```

Or distribute the one-liner:

```bash
curl -fsSL https://your-server.com/install.sh | bash -s -- \
  --server https://your-server.com \
  --key YOUR_API_KEY
```

**Step 3 — Open the dashboard**

```
http://your-server.com:3000
```

Data appears as soon as the first developer uses Claude Code after installing the agent.

---

## Sending data manually (curl)

Useful for testing or scripting:

```bash
curl -X POST http://localhost:3000/api/usage \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "dev@example.com",
    "records": [{
      "sessionId": "test-session-1",
      "model": "claude-sonnet-4-6",
      "inputTokens": 1200,
      "outputTokens": 340,
      "cacheRead": 800,
      "cacheCreation": 0,
      "timestamp": "2026-07-03T10:00:00Z",
      "project": "myorg/myrepo"
    }]
  }'
```

---

## Development

This is an npm workspace. You can run commands from the root or inside each package.

```bash
# Install all dependencies
npm install

# Run all tests (agent + server)
npm test

# Watch mode per package
npm run test:watch:agent
npm run test:watch:server
```

**Agent only:**

```bash
cd agent
npm install
npm test
```

**Server only (requires PostgreSQL):**

```bash
cd server
npm install
export DATABASE_URL=postgresql://monitor:password@localhost:5432/claude_monitor
export API_KEY=dev-key
npm run dev       # http://localhost:3000
npm test          # unit tests — no database needed
```

---

## Test suite

53 tests, ~470ms, no network or database required.

| Package | Files | Tests | Coverage |
|---|---|---|---|
| `agent` | 3 | 28 | Cost calculation, JSONL parsing, path extraction, record mapping, identity fallback |
| `server` | 4 | 25 | API auth, request validation, query params, response shape, cost math, avatar generation |

---

## Configuration reference

### `.env` (server)

| Variable | Description |
|---|---|
| `API_KEY` | Shared secret. Agents include this in every request. |
| `DB_PASSWORD` | PostgreSQL password. |

### `~/.config/cc-track-agent/config.json` (agent)

```json
{
  "user": "you@example.com",
  "serverUrl": "https://your-server.com",
  "apiKey": "your-api-key"
}
```

---

## Pricing reference

Cost estimates are computed locally. No API call is made.

| Model | Input | Output | Cache read | Cache write |
|---|---|---|---|---|
| claude-opus-4-8 | $5 / M | $25 / M | $0.50 / M | $6.25 / M |
| claude-sonnet-4-6 | $3 / M | $15 / M | $0.30 / M | $3.75 / M |
| claude-haiku-4-5 | $1 / M | $5 / M | $0.10 / M | $1.25 / M |

Prices per million tokens. Figures are based on publicly available Anthropic pricing and may drift over time.

---

## Contributing

Contributions are welcome. A few guidelines:

- **Bug fixes and tests** — open a PR directly.
- **New features** — open an issue first to discuss the approach.
- **Breaking changes** — document the migration path in the PR description.

### Local setup

```bash
git clone https://github.com/wassim-rekik/cc-track.git
cd claude-monitor
npm install       # installs workspaces
npm test          # must pass before opening a PR
```

### Commit style

Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.

---

## Roadmap

- [ ] Publish `claude-monitor` to npm
- [ ] Docker image on Docker Hub
- [ ] Alert thresholds (email / Slack webhook when burn rate exceeds limit)
- [ ] Export data as CSV
- [ ] Per-project cost breakdown in the dashboard

---

## License

MIT — see [LICENSE](LICENSE).
