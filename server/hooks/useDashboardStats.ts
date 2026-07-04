"use client";

import { useCallback, useEffect, useState } from "react";
import type { StatsResponse, DashboardUser, TeamMemberStats } from "@/lib/types";
import { ALL_USERS_ID, BURN_LIMIT_TOKENS } from "@/lib/config";

const EMPTY_STATS: StatsResponse = {
  daily: [],
  projects: [],
  summary: {
    totalTokens: 0,
    totalCost: 0,
    totalSessions: 0,
    avgCacheHit: 0,
    burnRate5h: { used: 0, limit: BURN_LIMIT_TOKENS, pct: 0 },
  },
};

async function fetchStatsFor(userId: string, rangeDays: number): Promise<StatsResponse> {
  const res = await fetch(`/api/stats?user=${encodeURIComponent(userId)}&range=${rangeDays}`);
  return res.json();
}

export function useDashboardStats(activeUser: string, rangeDays: number, users: DashboardUser[]) {
  const [stats, setStats] = useState<StatsResponse>(EMPTY_STATS);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStatsFor(activeUser, rangeDays);
      setStats(data);

      if (activeUser === ALL_USERS_ID && users.length > 1) {
        const members = await Promise.all(
          users
            .filter((u) => u.id !== ALL_USERS_ID)
            .map(async (u): Promise<TeamMemberStats> => {
              const d = await fetchStatsFor(u.id, rangeDays);
              return {
                ...u,
                totalTokens: d.summary.totalTokens,
                cost: d.summary.totalCost,
                sessions: d.summary.totalSessions,
                cacheHit: d.summary.avgCacheHit,
              };
            }),
        );
        setTeamStats(members.sort((a, b) => b.totalTokens - a.totalTokens));
      }
    } finally {
      setLoading(false);
      setRefreshedAt(new Date());
    }
  }, [activeUser, rangeDays, users]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, teamStats, loading, refreshedAt, refresh };
}
