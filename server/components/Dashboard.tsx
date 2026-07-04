"use client";

import { useState } from "react";
import { Cpu, DollarSign, Activity, Users, FolderGit2 } from "lucide-react";
import { useUsers, ALL_TEAM } from "@/hooks/useUsers";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { fmtDate, fmtTokens, rangeLabel } from "@/lib/format";
import { ALL_USERS_ID } from "@/lib/config";
import { Header, type RangeDays } from "./dashboard/Header";
import { BurnRateBar } from "./dashboard/BurnRateBar";
import { StatCard } from "./dashboard/StatCard";
import { CacheHitCard } from "./dashboard/CacheHitCard";
import { ModelBreakdownChart } from "./dashboard/ModelBreakdownChart";
import { TokenUsageChart } from "./dashboard/TokenUsageChart";
import { DailyCostChart } from "./dashboard/DailyCostChart";
import { ProjectTable } from "./dashboard/ProjectTable";
import { TeamTable } from "./dashboard/TeamTable";
import { Panel } from "./dashboard/Panel";
import { Footer } from "./dashboard/Footer";
import styles from "./Dashboard.module.css";

const MAX_MODEL_CHART_DAYS = 14;

export default function Dashboard() {
  const [activeUser, setActiveUser] = useState(ALL_USERS_ID);
  const [range, setRange] = useState<RangeDays>(14);

  const users = useUsers();
  const { stats, teamStats, loading, refreshedAt, refresh } = useDashboardStats(activeUser, range, users);

  const { summary, projects } = stats;
  const daily = stats.daily.map((d) => ({ ...d, date: fmtDate(d.date) }));
  const activeUserRecord = users.find((u) => u.id === activeUser) ?? ALL_TEAM;
  const modelChartData = daily.slice(-Math.min(range, MAX_MODEL_CHART_DAYS));

  return (
    <div className={styles.page}>
      <Header
        range={range}
        onRangeChange={setRange}
        users={users}
        activeUser={activeUserRecord}
        onUserChange={setActiveUser}
        loading={loading}
        onRefresh={refresh}
      />

      <div className={styles.content}>
        <BurnRateBar burn={summary.burnRate5h} />

        <div className={styles.statGrid}>
          <StatCard icon={Cpu} label="TOTAL TOKENS" value={fmtTokens(summary.totalTokens)} sub={rangeLabel(range)} accent="var(--color-model-opus)" />
          <StatCard icon={DollarSign} label="ESTIMATED COST" value={`$${summary.totalCost.toFixed(2)}`} sub="API pricing" accent="var(--color-success)" />
          <StatCard icon={Activity} label="SESSIONS" value={summary.totalSessions} sub={rangeLabel(range)} accent="var(--color-model-haiku)" />
        </div>

        <div className={styles.twoColGrid}>
          <CacheHitCard avgCacheHit={summary.avgCacheHit} />
          <ModelBreakdownChart data={modelChartData} rangeDays={range} />
        </div>

        <TokenUsageChart data={daily} />
        <DailyCostChart data={daily} />

        {projects.length > 0 && (
          <Panel label="PROJECT BREAKDOWN" meta={<><FolderGit2 size={12} /> {projects.length} projects</>}>
            <ProjectTable data={projects} />
          </Panel>
        )}

        {activeUser === ALL_USERS_ID && teamStats.length > 0 && (
          <Panel label="TEAM BREAKDOWN" meta={<><Users size={12} /> {teamStats.length} developers</>}>
            <TeamTable data={teamStats} />
          </Panel>
        )}

        <Footer refreshedAt={refreshedAt} />
      </div>
    </div>
  );
}
