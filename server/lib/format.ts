// Pure display-formatting helpers used by the dashboard components.

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

export function fmtDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function rangeLabel(rangeDays: number): string {
  return rangeDays === 1 ? "today" : `last ${rangeDays} days`;
}

export function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return date.toLocaleTimeString();
}
