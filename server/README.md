# claude-monitor server

The server is a self-hosted Next.js 16 application backed by PostgreSQL. It receives usage records from agent installations on developer machines, stores them, and serves a real-time team dashboard at `http://localhost:3000`.

---

## Requirements

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2
- An `API_KEY` value you distribute to your team (any string — you choose it)

No Anthropic account or API key needed. All data comes from local files on developer machines.

---

## Quick start

**1. Copy the env file and set your secrets:**

```bash
# From the repo root
cp .env.example .env
```

Edit `.env`:

```env
API_KEY=choose-a-strong-secret-key
DB_PASSWORD=choose-a-strong-db-password
```

**2. Start the stack:**

```bash
docker compose up --build
```

The first run builds the Next.js image and starts PostgreSQL. The database schema is created automatically on first request — no migration step needed.

**3. Open the dashboard:**

```
http://localhost:3000
```

The dashboard is empty until developers install the agent. Give them the `API_KEY` and your server's URL.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `API_KEY` | Yes | Secret key agents use to authenticate. Set once and distribute to your team. |
| `DB_PASSWORD` | Yes | PostgreSQL password for the `monitor` user. |
| `DATABASE_URL` | Set by Compose | Full connection string — automatically wired in `docker-compose.yml`. |
| `PORT` | No | HTTP port (default: `3000`). |

---

## Dashboard

The dashboard is a dark-themed React SPA served at `/`. It updates on demand — hit the refresh button or change the time range to fetch fresh data.

### Panels

| Panel | What it shows |
|---|---|
| **5-hour burn rate** | Tokens consumed in the rolling 5-hour window vs. your Claude plan limit. Color-coded green / yellow / red. |
| **Total tokens** | Aggregate input + output tokens for the selected period. |
| **Estimated cost** | Cost calculated locally from public API pricing — no Anthropic API call. |
| **Sessions** | Number of distinct Claude Code sessions. |
| **Cache hit rate** | Average daily ratio of `cache_read_tokens / (cache_read + input)`. Warns when below 30%. |
| **Tokens by model** | Stacked bar chart showing Opus / Sonnet / Haiku breakdown for the last 7 days. |
| **Token usage over time** | Area chart per model for the selected date range. |
| **Daily cost** | Cost trend over the selected period. |
| **Team breakdown** | Per-developer table showing tokens, cost, sessions, and cache rate. Only shown in "All Team" view. |

### Controls

- **User selector** — switch between "All Team" (aggregate) and individual developers
- **Range selector** — 7 days, 14 days, 30 days
- **Refresh** — re-fetches all data from the server

---

## API reference

All endpoints are served by the Next.js app. The dashboard uses them internally; you can also call them directly for integration or scripting.

### `POST /api/usage`

Receives usage records from agents. Called automatically by the agent — you do not need to call this manually.

**Auth:** `x-api-key: <your API_KEY>` header required.

**Request body:**

```json
{
  "user": "dev@example.com",
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

**Response:**

```json
{ "inserted": 1 }
```

---

### `GET /api/stats?user=<id>&range=<days>`

Returns aggregated daily data and summary for the dashboard.

**Query parameters:**

| Parameter | Default | Description |
|---|---|---|
| `user` | `all` | Developer ID (email) or `all` for the full team aggregate |
| `range` | `14` | Number of past days to include (`7`, `14`, or `30`) |

**Response:**

```json
{
  "daily": [
    {
      "date": "2026-07-01",
      "opus": 80000,
      "sonnet": 200000,
      "haiku": 50000,
      "total": 330000,
      "cost": 12.45,
      "cacheHit": 35,
      "sessions": 3
    }
  ],
  "summary": {
    "totalTokens": 4620000,
    "totalCost": 174.33,
    "totalSessions": 42,
    "avgCacheHit": 32,
    "burnRate5h": {
      "used": 250000,
      "limit": 800000,
      "pct": 31
    }
  }
}
```

Token counts are raw token numbers. Cost is in USD.

---

### `GET /api/users`

Returns the list of developers who have sent data to this server.

**Response:**

```json
[
  { "id": "alice@example.com", "label": "alice@example.com", "avatar": "AE" },
  { "id": "bob@example.com",   "label": "bob@example.com",   "avatar": "BE" }
]
```

---

## Database

The schema is created automatically on the first HTTP request. No manual migration needed.

```sql
CREATE TABLE usage_records (
  id             SERIAL PRIMARY KEY,
  user_id        TEXT        NOT NULL,
  session_id     TEXT        NOT NULL,
  model          TEXT        NOT NULL,
  input_tokens   BIGINT      DEFAULT 0,
  output_tokens  BIGINT      DEFAULT 0,
  cache_read     BIGINT      DEFAULT 0,
  cache_creation BIGINT      DEFAULT 0,
  project        TEXT,
  ts             TIMESTAMPTZ NOT NULL,
  received_at    TIMESTAMPTZ DEFAULT NOW()
);
```

Indexes on `(user_id, ts)` and `ts` keep aggregation queries fast even with millions of records.

Data is persisted in a named Docker volume (`pgdata`). It survives container restarts and `docker compose down`. To wipe all data:

```bash
docker compose down -v   # removes the pgdata volume
```

---

## Local development

Running outside Docker requires a local PostgreSQL instance.

```bash
# Install dependencies
npm install

# Set env vars
export DATABASE_URL=postgresql://monitor:password@localhost:5432/claude_monitor
export API_KEY=dev-key

# Start dev server with hot reload
npm run dev
```

The dev server runs at `http://localhost:3000`.

**Type checking:**

```bash
npx tsc --noEmit
```

**Build (production):**

```bash
npm run build
npm start
```

**Tests:**

```bash
npm test            # run once
npm run test:watch  # watch mode
```

Tests mock the database layer — no PostgreSQL instance required to run them.

---

## Deployment

The Docker image uses Next.js standalone output, keeping the image small.

**Expose on a custom port:**

```yaml
# docker-compose.yml
ports:
  - "8080:3000"
```

**Behind a reverse proxy (nginx/Caddy):**

Point your proxy at `localhost:3000`. The app has no HTTPS built in — terminate TLS at the proxy level.

**Persist data across deployments:**

The `pgdata` Docker volume is preserved across `docker compose up/down` by default. Only `docker compose down -v` removes it.

**Backup the database:**

```bash
docker compose exec db pg_dump -U monitor claude_monitor > backup.sql
```
