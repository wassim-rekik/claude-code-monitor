import { Pool } from "pg";
import { calcCost, modelFamily } from "@/lib/pricing";
import { makeAvatar } from "@/lib/avatar";
import { BURN_WINDOW_HOURS, BURN_LIMIT_TOKENS, MAX_PROJECTS_RETURNED } from "@/lib/config";
import type {
  UsageRecord,
  DailyUsageRow,
  ProjectUsageRow,
  StatsResponse,
  DashboardUser,
} from "@/lib/types";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let _migration: Promise<void> | null = null;

export function migrate(): Promise<void> {
  if (!_migration) {
    _migration = pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS usage_records (
        id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
      CREATE INDEX IF NOT EXISTS idx_user_ts ON usage_records(user_id, ts);
      CREATE INDEX IF NOT EXISTS idx_ts      ON usage_records(ts);

      -- Added after the initial release: a unique key on the natural identity of a
      -- record so that re-shipping the same record (agent retry, at-least-once
      -- delivery) is a no-op instead of a duplicate row. Appended as a new
      -- statement rather than editing the CREATE TABLE above.
      --
      -- Data predating this migration may already contain duplicates of that
      -- identity, so they're collapsed (keeping the earliest row) before the
      -- unique index is created; this DELETE is a no-op on every later run.
      DELETE FROM usage_records a
        USING usage_records b
        WHERE a.id > b.id
          AND a.session_id = b.session_id
          AND a.model = b.model
          AND a.ts = b.ts;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_identity
        ON usage_records(session_id, model, ts);
    `,
      )
      .then(() => undefined);
  }
  return _migration;
}

export async function insertRecords(userId: string, records: UsageRecord[]): Promise<number> {
  if (!records.length) return 0;
  const values: unknown[] = [];
  const placeholders = records.map((r, i) => {
    const base = i * 9;
    values.push(
      userId, r.sessionId, r.model,
      r.inputTokens, r.outputTokens,
      r.cacheRead, r.cacheCreation,
      r.project ?? null, r.timestamp,
    );
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
  });
  await pool.query(
    `INSERT INTO usage_records
       (user_id,session_id,model,input_tokens,output_tokens,cache_read,cache_creation,project,ts)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (session_id, model, ts) DO NOTHING`,
    values,
  );
  return records.length;
}

interface ModelDayRow {
  day: Date;
  model: string;
  input_tokens: string;
  output_tokens: string;
  cache_read: string;
  cache_creation: string;
  sessions: string;
}

async function getDailyBreakdown(userId: string, rangeDays: number): Promise<DailyUsageRow[]> {
  const { rows } = await pool.query<ModelDayRow>(
    `SELECT
       DATE_TRUNC('day', ts AT TIME ZONE 'UTC') AS day,
       model,
       SUM(input_tokens)   AS input_tokens,
       SUM(output_tokens)  AS output_tokens,
       SUM(cache_read)     AS cache_read,
       SUM(cache_creation) AS cache_creation,
       COUNT(DISTINCT session_id) AS sessions
     FROM usage_records
     WHERE ts >= NOW() - ($1 || ' days')::INTERVAL
       AND ($2::TEXT = 'all' OR user_id = $2)
     GROUP BY day, model
     ORDER BY day`,
    [rangeDays, userId],
  );

  const byDay = new Map<string, DailyUsageRow>();
  for (const r of rows) {
    const date = r.day.toISOString().slice(0, 10);
    if (!byDay.has(date)) {
      byDay.set(date, { date, opus: 0, sonnet: 0, haiku: 0, total: 0, cost: 0, cacheHit: 0, sessions: 0 });
    }
    const d = byDay.get(date)!;
    const inp = Number(r.input_tokens);
    const out = Number(r.output_tokens);
    const cacheRead = Number(r.cache_read);
    const cacheCreation = Number(r.cache_creation);
    const tokens = inp + out;

    d[modelFamily(r.model)] += tokens;
    d.total += tokens;
    d.cost += calcCost(r.model, inp, out, cacheRead, cacheCreation);
    d.sessions += Number(r.sessions);

    const cacheDenominator = cacheRead + inp;
    if (cacheDenominator > 0) d.cacheHit = Math.round((cacheRead / cacheDenominator) * 100);
  }

  return Array.from(byDay.values()).map((d) => ({ ...d, cost: parseFloat(d.cost.toFixed(4)) }));
}

async function getBurnRate5h(userId: string) {
  const { rows } = await pool.query<{ used: string }>(
    `SELECT SUM(input_tokens + output_tokens) AS used
     FROM usage_records
     WHERE ts >= NOW() - ($2 || ' hours')::INTERVAL
       AND ($1::TEXT = 'all' OR user_id = $1)`,
    [userId, BURN_WINDOW_HOURS],
  );
  const used = Number(rows[0]?.used ?? 0);
  return {
    used,
    limit: BURN_LIMIT_TOKENS,
    pct: Math.min(100, Math.round((used / BURN_LIMIT_TOKENS) * 100)),
  };
}

interface ModelProjectRow {
  project: string;
  model: string;
  input_tokens: string;
  output_tokens: string;
  cache_read: string;
  cache_creation: string;
  sessions: string;
}

async function getProjectBreakdown(userId: string, rangeDays: number): Promise<ProjectUsageRow[]> {
  const { rows } = await pool.query<ModelProjectRow>(
    `SELECT
       COALESCE(project, 'unknown') AS project,
       model,
       SUM(input_tokens)   AS input_tokens,
       SUM(output_tokens)  AS output_tokens,
       SUM(cache_read)     AS cache_read,
       SUM(cache_creation) AS cache_creation,
       COUNT(DISTINCT session_id) AS sessions
     FROM usage_records
     WHERE ts >= NOW() - ($1 || ' days')::INTERVAL
       AND ($2::TEXT = 'all' OR user_id = $2)
     GROUP BY project, model
     ORDER BY project, SUM(input_tokens + output_tokens) DESC
     LIMIT $3`,
    [rangeDays, userId, MAX_PROJECTS_RETURNED],
  );

  const byProject = new Map<string, ProjectUsageRow>();
  for (const r of rows) {
    if (!byProject.has(r.project)) {
      byProject.set(r.project, { project: r.project, tokens: 0, cost: 0, sessions: 0 });
    }
    const p = byProject.get(r.project)!;
    const inp = Number(r.input_tokens);
    const out = Number(r.output_tokens);
    const cacheRead = Number(r.cache_read);
    const cacheCreation = Number(r.cache_creation);
    p.tokens += inp + out;
    p.cost += calcCost(r.model, inp, out, cacheRead, cacheCreation);
    p.sessions = Math.max(p.sessions, Number(r.sessions));
  }

  return Array.from(byProject.values())
    .sort((a, b) => b.tokens - a.tokens)
    .map((p) => ({ ...p, cost: parseFloat(p.cost.toFixed(4)) }));
}

function summarize(daily: DailyUsageRow[], burnRate5h: StatsResponse["summary"]["burnRate5h"]) {
  const totalTokens = daily.reduce((a, d) => a + d.total, 0);
  const totalCost = parseFloat(daily.reduce((a, d) => a + d.cost, 0).toFixed(4));
  const totalSessions = daily.reduce((a, d) => a + d.sessions, 0);
  const avgCacheHit = daily.length
    ? Math.round(daily.reduce((a, d) => a + d.cacheHit, 0) / daily.length)
    : 0;

  return { totalTokens, totalCost, totalSessions, avgCacheHit, burnRate5h };
}

export async function getStats(userId: string, rangeDays: number): Promise<StatsResponse> {
  const [daily, burnRate5h, projects] = await Promise.all([
    getDailyBreakdown(userId, rangeDays),
    getBurnRate5h(userId),
    getProjectBreakdown(userId, rangeDays),
  ]);

  return { daily, projects, summary: summarize(daily, burnRate5h) };
}

export async function getUsers(): Promise<DashboardUser[]> {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM usage_records ORDER BY user_id`,
  );
  return rows.map((r) => ({ id: r.user_id, label: r.user_id, avatar: makeAvatar(r.user_id) }));
}
