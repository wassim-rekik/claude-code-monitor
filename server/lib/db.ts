import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let _migration: Promise<void> | null = null;

export function migrate(): Promise<void> {
  if (!_migration) {
    _migration = pool.query(`
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
    `).then(() => undefined);
  }
  return _migration;
}

export type UsageRecord = {
  sessionId:     string;
  model:         string;
  inputTokens:   number;
  outputTokens:  number;
  cacheRead:     number;
  cacheCreation: number;
  project?:      string;
  timestamp:     string;
};

export async function insertRecords(userId: string, records: UsageRecord[]) {
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
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`;
  });
  await pool.query(
    `INSERT INTO usage_records
       (user_id,session_id,model,input_tokens,output_tokens,cache_read,cache_creation,project,ts)
     VALUES ${placeholders.join(",")}
     ON CONFLICT DO NOTHING`,
    values,
  );
  return records.length;
}

const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-8":   { input: 5,  output: 25, cacheRead: 0.5,  cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3,  cacheWrite: 3.75 },
  "claude-haiku-4-5":  { input: 1,  output: 5,  cacheRead: 0.1,  cacheWrite: 1.25 },
};

function calcCost(model: string, inp: number, out: number, cr: number, cc: number) {
  const p = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  return (inp / 1e6) * p.input + (out / 1e6) * p.output +
         (cr  / 1e6) * p.cacheRead + (cc  / 1e6) * p.cacheWrite;
}

export type DailyRow = {
  date:      string;
  opus:      number;
  sonnet:    number;
  haiku:     number;
  total:     number;
  cost:      number;
  cacheHit:  number;
  sessions:  number;
};

export async function getStats(userId: string, rangeDays: number) {
  // Daily breakdown
  const { rows } = await pool.query<{
    day: Date; model: string;
    input_tokens: string; output_tokens: string;
    cache_read: string; cache_creation: string;
    sessions: string;
  }>(
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

  // Aggregate by day across models
  const byDay = new Map<string, DailyRow>();
  for (const r of rows) {
    const date = r.day.toISOString().slice(0, 10);
    if (!byDay.has(date)) {
      byDay.set(date, { date, opus: 0, sonnet: 0, haiku: 0, total: 0, cost: 0, cacheHit: 0, sessions: 0 });
    }
    const d = byDay.get(date)!;
    const inp = Number(r.input_tokens);
    const out = Number(r.output_tokens);
    const cr  = Number(r.cache_read);
    const cc  = Number(r.cache_creation);
    const tok = inp + out;

    if (r.model.includes("opus"))   d.opus   += tok;
    else if (r.model.includes("haiku")) d.haiku += tok;
    else                                d.sonnet += tok;

    d.total    += tok;
    d.cost     += calcCost(r.model, inp, out, cr, cc);
    d.sessions += Number(r.sessions);

    // Cache hit % = cacheRead / (cacheRead + inputTokens)
    const denominator = cr + inp;
    if (denominator > 0) d.cacheHit = Math.round((cr / denominator) * 100);
  }

  const daily = Array.from(byDay.values()).map(d => ({
    ...d,
    cost: parseFloat(d.cost.toFixed(4)),
  }));

  // Summary totals
  const totalTokens  = daily.reduce((a, d) => a + d.total, 0);
  const totalCost    = parseFloat(daily.reduce((a, d) => a + d.cost, 0).toFixed(4));
  const totalSessions = daily.reduce((a, d) => a + d.sessions, 0);
  const avgCacheHit  = daily.length ? Math.round(daily.reduce((a, d) => a + d.cacheHit, 0) / daily.length) : 0;

  // 5-hour burn rate
  const { rows: burnRows } = await pool.query<{ used: string }>(
    `SELECT SUM(input_tokens + output_tokens) AS used
     FROM usage_records
     WHERE ts >= NOW() - INTERVAL '5 hours'
       AND ($1::TEXT = 'all' OR user_id = $1)`,
    [userId],
  );
  const burnUsed = Number(burnRows[0]?.used ?? 0);

  return {
    daily,
    summary: {
      totalTokens,
      totalCost,
      totalSessions,
      avgCacheHit,
      burnRate5h: {
        used: burnUsed,
        limit: 800_000,
        pct: Math.min(100, Math.round((burnUsed / 800_000) * 100)),
      },
    },
  };
}

export async function getUsers() {
  const { rows } = await pool.query<{ user_id: string }>(
    `SELECT DISTINCT user_id FROM usage_records ORDER BY user_id`,
  );
  return rows.map(r => {
    const parts = r.user_id.split(/[@.\s]/);
    const avatar = (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
    return { id: r.user_id, label: r.user_id, avatar };
  });
}

export { pool };
