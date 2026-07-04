// Shared types for the persistence layer, API routes, and dashboard components.

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

export interface DailyUsageRow {
  date:     string;
  opus:     number;
  sonnet:   number;
  haiku:    number;
  total:    number;
  cost:     number;
  cacheHit: number;
  sessions: number;
}

export interface ProjectUsageRow {
  project:  string;
  tokens:   number;
  cost:     number;
  sessions: number;
}

export interface BurnWindow {
  used:  number;
  limit: number;
  pct:   number;
}

export interface UsageSummary {
  totalTokens:   number;
  totalCost:     number;
  totalSessions: number;
  avgCacheHit:   number;
  burnRate5h:    BurnWindow;
}

export interface StatsResponse {
  daily:    DailyUsageRow[];
  projects: ProjectUsageRow[];
  summary:  UsageSummary;
}

export interface DashboardUser {
  id:     string;
  label:  string;
  avatar: string;
}

export interface TeamMemberStats extends DashboardUser {
  totalTokens: number;
  cost:        number;
  sessions:    number;
  cacheHit:    number;
}
