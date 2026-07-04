// Named configuration values — no magic numbers/strings inline in business logic.

export const DEFAULT_RANGE_DAYS = 14;
export const MAX_RANGE_DAYS = 365;
export const MIN_RANGE_DAYS = 1;

export const BURN_WINDOW_HOURS = 5;
export const BURN_LIMIT_TOKENS = 800_000;

export const CACHE_HIT_GOOD_THRESHOLD_PCT = 30;

// Safety caps so a single query can't return unbounded rows.
export const MAX_PROJECTS_RETURNED = 100;

// Ingest rate limiting (best-effort, single-instance in-memory limiter).
export const RATE_LIMIT_MAX_REQUESTS = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;

export const ALL_USERS_ID = "all";
