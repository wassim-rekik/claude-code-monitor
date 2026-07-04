import { RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS } from "@/lib/config";

// Best-effort in-memory sliding-window limiter for the ingest endpoint.
// Scoped to a single Node process — fine for this app's single-instance
// Docker deployment, but does not coordinate across multiple instances.
const requestLog = new Map<string, number[]>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}
