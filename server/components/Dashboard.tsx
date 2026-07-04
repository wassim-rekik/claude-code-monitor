"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, Users, Cpu, DollarSign, Clock, ChevronDown, RefreshCw, FolderGit2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type DailyRow = {
  date: string; opus: number; sonnet: number; haiku: number;
  total: number; cost: number; cacheHit: number; sessions: number;
};
type ProjectRow = { project: string; tokens: number; cost: number; sessions: number };
type BurnRate   = { used: number; limit: number; pct: number };
type Summary    = {
  totalTokens: number; totalCost: number; totalSessions: number;
  avgCacheHit: number; burnRate5h: BurnRate;
};
type StatsResponse = { daily: DailyRow[]; projects: ProjectRow[]; summary: Summary };
type User = { id: string; label: string; avatar: string };

const ALL_TEAM: User = { id: "all", label: "All Team", avatar: "TM" };
const RANGES = [1, 7, 14, 30] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}
function fmtDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function rangeLabel(r: number) {
  return r === 1 ? "today" : `last ${r} days`;
}
function relTime(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return d.toLocaleTimeString();
}

// ─── Burn rate ────────────────────────────────────────────────────────────────
function BurnRateBar({ burn }: { burn: BurnRate }) {
  const color = burn.pct > 80 ? "#f87171" : burn.pct > 60 ? "#fbbf24" : "#34d399";
  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ color: "#8892a4", fontSize: 12, fontFamily: "monospace", letterSpacing: 1 }}>5H WINDOW</span>
        <span style={{ color: "#8892a4", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={11} /> rolling window
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color, fontFamily: "monospace", fontSize: 15, fontWeight: 700 }}>
          {fmt(burn.used)} <span style={{ color: "#4a5568", fontWeight: 400 }}>/ {fmt(burn.limit)} tokens</span>
        </span>
        <span style={{ color, fontSize: 13, fontWeight: 600 }}>{burn.pct}%</span>
      </div>
      <div style={{ background: "#0f1117", borderRadius: 4, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${burn.pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, height: "100%", borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent = "#34d399" }: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span style={{ color: "#8892a4", fontSize: 11, letterSpacing: 1, fontFamily: "monospace" }}>{label}</span>
        <Icon size={15} color={accent} />
      </div>
      <div style={{ color: "#e2e8f0", fontSize: 24, fontWeight: 700, fontFamily: "monospace", letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ color: "#4a5568", fontSize: 11 }}>{sub}</div>}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontFamily: "monospace" }}>
      <div style={{ color: "#8892a4", marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{
            p.dataKey === "cost"
              ? `$${p.value.toFixed(3)}`
              : p.value.toLocaleString()
          }</strong>
        </div>
      ))}
    </div>
  );
}

// ─── Empty chart state ────────────────────────────────────────────────────────
function EmptyChart({ height = 200, message = "No data for this period" }: { height?: number; message?: string }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "#4a5568" }}>
      <Activity size={24} color="#2a3040" />
      <span style={{ fontSize: 12, fontFamily: "monospace" }}>{message}</span>
    </div>
  );
}

// ─── Team table ───────────────────────────────────────────────────────────────
type TeamMember = User & { totalTokens: number; cost: number; sessions: number; cacheHit: number };
function TeamTable({ data }: { data: TeamMember[] }) {
  const max = data[0]?.totalTokens || 1;
  const AVATARCOLORS = ["#6366f1", "#34d399", "#f59e0b", "#f87171"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #2a3040" }}>
            {["Developer", "Tokens", "Cost", "Sessions", "Cache hit"].map(h => (
              <th key={h} style={{ padding: "8px 12px", color: "#4a5568", fontWeight: 500, textAlign: h === "Developer" ? "left" : "right", fontFamily: "monospace", fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((u, i) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #1a2030" }}>
              <td style={{ padding: "12px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: AVATARCOLORS[i % 4], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#0f1117" }}>{u.avatar}</div>
                  <span style={{ color: "#e2e8f0", fontWeight: 500 }}>{u.label}</span>
                </div>
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                  <div style={{ width: 60, height: 4, background: "#0f1117", borderRadius: 2 }}>
                    <div style={{ width: `${(u.totalTokens / max) * 100}%`, height: "100%", background: "#6366f1", borderRadius: 2 }} />
                  </div>
                  <span style={{ color: "#a5b4fc", fontFamily: "monospace" }}>{fmt(u.totalTokens)}</span>
                </div>
              </td>
              <td style={{ padding: "12px 12px", color: "#34d399", fontFamily: "monospace", textAlign: "right" }}>${u.cost.toFixed(2)}</td>
              <td style={{ padding: "12px 12px", color: "#e2e8f0", fontFamily: "monospace", textAlign: "right" }}>{u.sessions}</td>
              <td style={{ padding: "12px 12px", textAlign: "right" }}>
                <span style={{ color: u.cacheHit > 30 ? "#34d399" : "#fbbf24", fontFamily: "monospace" }}>{u.cacheHit}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Project table ────────────────────────────────────────────────────────────
function ProjectTable({ data }: { data: ProjectRow[] }) {
  const max = data[0]?.tokens || 1;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #2a3040" }}>
            {["Project", "Tokens", "Cost", "Sessions"].map(h => (
              <th key={h} style={{ padding: "8px 12px", color: "#4a5568", fontWeight: 500, textAlign: h === "Project" ? "left" : "right", fontFamily: "monospace", fontSize: 11, letterSpacing: 0.5 }}>{h.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.project} style={{ borderBottom: "1px solid #1a2030" }}>
              <td style={{ padding: "12px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FolderGit2 size={13} color="#4a5568" />
                  <span style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 12 }}>{p.project}</span>
                </div>
              </td>
              <td style={{ padding: "12px 12px", textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                  <div style={{ width: 60, height: 4, background: "#0f1117", borderRadius: 2 }}>
                    <div style={{ width: `${(p.tokens / max) * 100}%`, height: "100%", background: "#34d399", borderRadius: 2 }} />
                  </div>
                  <span style={{ color: "#a5b4fc", fontFamily: "monospace" }}>{fmt(p.tokens)}</span>
                </div>
              </td>
              <td style={{ padding: "12px 12px", color: "#34d399", fontFamily: "monospace", textAlign: "right" }}>${p.cost.toFixed(2)}</td>
              <td style={{ padding: "12px 12px", color: "#e2e8f0", fontFamily: "monospace", textAlign: "right" }}>{p.sessions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [activeUser, setActiveUser] = useState("all");
  const [range, setRange]           = useState<typeof RANGES[number]>(14);
  const [users, setUsers]           = useState<User[]>([ALL_TEAM]);
  const [stats, setStats]           = useState<StatsResponse | null>(null);
  const [teamStats, setTeamStats]   = useState<TeamMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshed, setRefreshed]   = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [, tick]                    = useState(0);

  // Tick every 30s to update "last synced" relative time
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Fetch user list once
  useEffect(() => {
    fetch("/api/users")
      .then(r => r.json())
      .then((u: User[]) => setUsers([ALL_TEAM, ...u]))
      .catch(() => {});
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/stats?user=${activeUser}&range=${range}`);
      const data: StatsResponse = await res.json();
      setStats(data);

      if (activeUser === "all" && users.length > 1) {
        const memberStats = await Promise.all(
          users.filter(u => u.id !== "all").map(async u => {
            const r = await fetch(`/api/stats?user=${u.id}&range=${range}`);
            const d: StatsResponse = await r.json();
            return {
              ...u,
              totalTokens: d.summary.totalTokens,
              cost:        d.summary.totalCost,
              sessions:    d.summary.totalSessions,
              cacheHit:    d.summary.avgCacheHit,
            } satisfies TeamMember;
          }),
        );
        setTeamStats(memberStats.sort((a, b) => b.totalTokens - a.totalTokens));
      }
    } finally {
      setLoading(false);
      setRefreshed(new Date());
    }
  }, [activeUser, range, users]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const summary  = stats?.summary  ?? { totalTokens: 0, totalCost: 0, totalSessions: 0, avgCacheHit: 0, burnRate5h: { used: 0, limit: 800_000, pct: 0 } };
  const daily    = (stats?.daily   ?? []).map(d => ({ ...d, date: fmtDate(d.date) }));
  const projects = stats?.projects ?? [];
  const user     = users.find(u => u.id === activeUser) ?? ALL_TEAM;
  const barData  = daily.slice(-Math.min(range, 14));

  const btnBase = { padding: "5px 14px", borderRadius: 6, fontSize: 12, fontFamily: "monospace", cursor: "pointer", border: "none", transition: "all 0.15s" } as const;
  const activeBtn  = { ...btnBase, background: "#6366f1", color: "#fff", fontWeight: 700 } as const;
  const inactiveBtn = { ...btnBase, background: "transparent", color: "#4a5568" } as const;

  return (
    <div style={{ background: "#0f1117", minHeight: "100vh", color: "#e2e8f0", fontFamily: "system-ui, sans-serif", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ background: "#1a1f2e", borderBottom: "1px solid #2a3040", padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Activity size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: -0.3 }}>Claude Monitor</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} style={range === r ? activeBtn : inactiveBtn}>
              {r === 1 ? "Today" : `${r}d`}
            </button>
          ))}

          <div style={{ width: 1, height: 20, background: "#2a3040", margin: "0 4px" }} />

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowUserMenu(v => !v)} style={{ ...btnBase, background: "#2a3040", color: "#e2e8f0", display: "flex", alignItems: "center", gap: 6, padding: "5px 12px" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: activeUser === "all" ? "#6366f1" : "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#0f1117" }}>
                {user.avatar}
              </div>
              {user.label}
              <ChevronDown size={12} />
            </button>
            {showUserMenu && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 8, padding: 6, zIndex: 100, minWidth: 220 }}>
                {users.map(u => (
                  <button key={u.id} onClick={() => { setActiveUser(u.id); setShowUserMenu(false); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", background: activeUser === u.id ? "#2a3040" : "transparent", border: "none", color: "#e2e8f0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: u.id === "all" ? "#6366f1" : "#34d399", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: "#0f1117" }}>{u.avatar}</div>
                    {u.label}
                    {activeUser === u.id && <span style={{ marginLeft: "auto", color: "#6366f1", fontSize: 10 }}>✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => fetchStats()} style={{ ...btnBase, background: "transparent", color: loading ? "#6366f1" : "#4a5568", padding: 6 }}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Burn rate */}
        <BurnRateBar burn={summary.burnRate5h} />

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <StatCard icon={Cpu}        label="TOTAL TOKENS"   value={fmt(summary.totalTokens)}            sub={rangeLabel(range)} accent="#a78bfa" />
          <StatCard icon={DollarSign} label="ESTIMATED COST" value={`$${summary.totalCost.toFixed(2)}`}  sub="API pricing"       accent="#34d399" />
          <StatCard icon={Activity}   label="SESSIONS"       value={summary.totalSessions}               sub={rangeLabel(range)} accent="#60a5fa" />
        </div>

        {/* Cache hit + model breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
          <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>CACHE HIT RATE</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 36, fontWeight: 800, fontFamily: "monospace", color: summary.avgCacheHit > 30 ? "#34d399" : "#fbbf24", letterSpacing: -2 }}>{summary.avgCacheHit}%</span>
              <span style={{ color: "#4a5568", fontSize: 12, marginBottom: 6 }}>avg / day</span>
            </div>
            <div style={{ color: "#4a5568", fontSize: 11 }}>
              {summary.avgCacheHit > 30 ? "✓ Good — prompt caching is working" : "⚠ Low — consider longer system prompts"}
            </div>
          </div>

          <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 16 }}>
              TOKENS BY MODEL ({rangeLabel(range)})
            </div>
            {barData.length === 0 ? <EmptyChart height={100} /> : (
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={barData} barGap={2}>
                  <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="opus"   name="Opus 4.8"   stackId="a" fill="#a78bfa" />
                  <Bar dataKey="sonnet" name="Sonnet 4.6" stackId="a" fill="#34d399" />
                  <Bar dataKey="haiku"  name="Haiku 4.5"  stackId="a" fill="#60a5fa" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {([["#a78bfa","Opus 4.8"],["#34d399","Sonnet 4.6"],["#60a5fa","Haiku 4.5"]] as const).map(([c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                  <span style={{ color: "#4a5568", fontSize: 11 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Token usage over time */}
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 20 }}>TOKEN USAGE OVER TIME</div>
          {daily.length < 2 ? <EmptyChart height={200} message="Not enough data yet — more will appear as you use Claude Code" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={daily}>
                <defs>
                  {([["opus","#a78bfa"],["sonnet","#34d399"],["haiku","#60a5fa"]] as const).map(([k,c]) => (
                    <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={c} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={c} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3040" />
                <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={fmt} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="opus"   name="Opus 4.8"   stroke="#a78bfa" fill="url(#g-opus)"   strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="sonnet" name="Sonnet 4.6" stroke="#34d399" fill="url(#g-sonnet)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="haiku"  name="Haiku 4.5"  stroke="#60a5fa" fill="url(#g-haiku)"  strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Daily cost */}
        <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 20 }}>DAILY COST ($)</div>
          {daily.length < 2 ? <EmptyChart height={140} /> : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="g-cost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3040" />
                <XAxis dataKey="date" tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#4a5568", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="cost" name="cost" stroke="#34d399" fill="url(#g-cost)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Project breakdown */}
        {projects.length > 0 && (
          <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>PROJECT BREAKDOWN</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4a5568", fontSize: 11 }}>
                <FolderGit2 size={12} /> {projects.length} projects
              </div>
            </div>
            <ProjectTable data={projects} />
          </div>
        )}

        {/* Team breakdown — all-team view only */}
        {activeUser === "all" && teamStats.length > 0 && (
          <div style={{ background: "#1a1f2e", border: "1px solid #2a3040", borderRadius: 12, padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ color: "#4a5568", fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>TEAM BREAKDOWN</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4a5568", fontSize: 11 }}>
                <Users size={12} /> {teamStats.length} developers
              </div>
            </div>
            <TeamTable data={teamStats} />
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", color: "#2a3040", fontSize: 11, fontFamily: "monospace" }}>
          <span>last synced: {relTime(refreshed)}</span>
          <span>source: ~/.claude/projects/*.jsonl → POST /api/usage</span>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
