"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  LabelList,
} from "recharts";
import { RefreshCw, Moon, Sun } from "lucide-react";

/** ---------- Themes ---------- */
const THEMES = {
  dark: {
    bg: "#0f172a",
    panel: "#0b1223",
    border: "#243244",
    text: "#e5e7eb",
    subtext: "#9ca3af",
    chip: "#e5e7eb",
    purple: "#b3a3ff",
    sky: "#a4d1ff",
    coral: "#ffb3b3",
    mint: "#b6f0cf",
    pink: "#ffc3e1",
    lime: "#d8ff9a",
    red: "#ffb4a8",
    green: "#b7f3b0",
    card: "#111827",
  },
  light: {
    bg: "#f7f8fb",
    panel: "#ffffff",
    border: "#e5e7eb",
    text: "#111827",
    subtext: "#6b7280",
    chip: "#111827",
    purple: "#7c6cf2",
    sky: "#3ba5f6",
    coral: "#ff7a7a",
    mint: "#2dd4bf",
    pink: "#ec4899",
    lime: "#84cc16",
    red: "#fb7185",
    green: "#22c55e",
    card: "#ffffff",
  },
} as const;

const DASHBOARD_API = "/api/dashboard";

/** ---------- Types ---------- */
type AgentKPI = { agent: string; sales: number; status?: "FT" | "PT"; goal?: number; percent?: number };
type SalesPerDay = { date: string; sales: number };
type AgentDaily = { date: string; byAgent: AgentKPI[] };

type RangePayload = {
  ok: boolean;
  updatedAt?: string;
  salesPerDay?: SalesPerDay[];
  agentDaily?: AgentDaily[];
  agentLeaderboard?: AgentKPI[];
  totalSales?: number;
  totalAgents?: number;
  avgPerAgent?: number;
  avgDailyAgents?: number;
};

type DayPayload = {
  ok: boolean;
  date?: string; // YYYY-MM-DD
  perAgentKPI?: AgentKPI[];
  totalKPI?: number;
  dayGoal?: number;
  dayPercent?: number;
  note?: string;
};

/** ---------- UI helpers ---------- */
function Panel({
  title,
  children,
  T,
}: {
  title: string;
  children: React.ReactNode;
  T: typeof THEMES.dark;
}) {
  return (
    <section
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 12, color: T.text, fontWeight: 700 }}>{title}</h3>
      {children}
    </section>
  );
}

function StatCard({ label, value, T }: { label: string; value: React.ReactNode; T: typeof THEMES.dark }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ color: T.subtext, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ color: T.text, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

/** ---------- Data fetchers ---------- */
async function fetchRange(n: number): Promise<RangePayload> {
  const res = await fetch(`${DASHBOARD_API}?days=${encodeURIComponent(n)}`);
  return res.json();
}
async function fetchDay(mmddyyyy: string): Promise<DayPayload> {
  const res = await fetch(`${DASHBOARD_API}?date=${encodeURIComponent(mmddyyyy)}`);
  return res.json();
}

/** ---------- Page ---------- */
export default function DashboardPage() {
  // Theme
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("theme", theme);
  }, [theme]);
  const T = THEMES[theme];

  // Data mode
  const [mode, setMode] = useState<"RANGE" | "DAY">("RANGE");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [selectedDate, setSelectedDate] = useState<string>(""); // MM-DD-YYYY
  const [rangeData, setRangeData] = useState<RangePayload | null>(null);
  const [dayData, setDayData] = useState<DayPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  // Fetch
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        if (mode === "RANGE") {
          const json = await fetchRange(rangeDays);
          if (!cancel) setRangeData(json);
        } else if (mode === "DAY" && selectedDate) {
          const json = await fetchDay(selectedDate);
          if (!cancel) setDayData(json);
        }
      } catch (e: any) {
        if (!cancel) setErr(String(e?.message || e));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [mode, rangeDays, selectedDate]);

  /** Stacked series for RANGE */
  const stacked = useMemo<{ data: any[]; keys: string[] }>(() => {
    if (mode !== "RANGE") return { data: [], keys: [] };
    const daily = rangeData?.agentDaily ?? [];
    // top 6 agents overall
    const counts: Record<string, number> = {};
    daily.forEach((d) =>
      (d.byAgent || []).forEach((r) => {
        counts[r.agent] = (counts[r.agent] || 0) + r.sales;
      })
    );
    const top = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
    const rows = daily.map((d) => {
      const row: any = { date: d.date };
      top.forEach((name) => {
        const found = d.byAgent.find((x) => x.agent === name);
        row[name] = found ? found.sales : 0;
      });
      return row;
    });
    return { data: rows, keys: top };
  }, [mode, rangeData?.agentDaily]);

  // Header stats
  const headerStats = useMemo(() => {
    if (mode === "DAY") {
      const totalAgents = dayData?.perAgentKPI?.length ?? 0;
      const totalSales = dayData?.totalKPI ?? 0;
      const avgPerAgent = totalAgents ? (totalSales / totalAgents).toFixed(2) : "0.00";
      const avgDailyAgents = totalAgents;
      return { totalSales, totalAgents, avgPerAgent, avgDailyAgents };
    } else {
      return {
        totalSales: rangeData?.totalSales ?? 0,
        totalAgents: rangeData?.totalAgents ?? 0,
        avgPerAgent: (rangeData?.avgPerAgent ?? 0).toFixed(2),
        avgDailyAgents: rangeData?.avgDailyAgents ?? 0,
      };
    }
  }, [mode, dayData, rangeData]);

  return (
    <main style={{ padding: 24, background: T.bg, minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontWeight: 900,
              fontSize: 26,
              letterSpacing: 0.2,
              backgroundImage:
                theme === "dark"
                  ? "linear-gradient(90deg,#ffc3e1,#b3a3ff,#a4d1ff)"
                  : "linear-gradient(90deg,#ec4899,#7c6cf2,#3ba5f6)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Red Label Sales Dashboard
          </h1>
          <div style={{ color: T.subtext, marginTop: 4, fontSize: 12 }}>
            {mode === "DAY" ? "Single‑day KPI view" : "Rolling range view"}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: T.panel,
              border: `1px solid ${T.border}`,
              color: T.text,
              borderRadius: 10,
              padding: "8px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} Theme
          </button>

          {/* Mode toggle */}
          <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}` }}>
            <button
              onClick={() => setMode("RANGE")}
              style={{
                padding: "8px 12px",
                background: mode === "RANGE" ? "#ffffff" : T.panel,
                color: mode === "RANGE" ? "#111827" : T.text,
                borderRight: `1px solid ${T.border}`,
              }}
              title="Show a rolling range (7/14/30/90 days)"
            >
              Range
            </button>
            <button
              onClick={() => setMode("DAY")}
              style={{
                padding: "8px 12px",
                background: mode === "DAY" ? (theme === "dark" ? "#f3f4f6" : "#eef2ff") : T.panel,
                color: mode === "DAY" ? "#111827" : T.text,
              }}
              title="Show a single day"
            >
              Day
            </button>
          </div>

          {/* Range selector */}
          {mode === "RANGE" && (
            <select
              aria-label="Select days"
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.panel,
                color: T.text,
              }}
            >
              {[7, 14, 30, 90].map((n) => (
                <option key={n} value={n}>
                  Last {n} days
                </option>
              ))}
            </select>
          )}

          {/* Day picker */}
          {mode === "DAY" && (
            <input
              type="date"
              value={
                selectedDate
                  ? `${selectedDate.slice(6, 10)}-${selectedDate.slice(0, 2)}-${selectedDate.slice(3, 5)}`
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (!v) setSelectedDate("");
                else {
                  const [yyyy, mm, dd] = v.split("-");
                  setSelectedDate(`${mm}-${dd}-${yyyy}`);
                }
              }}
              aria-label="Pick a date"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: "#ffffff",
                color: "#111827",
              }}
            />
          )}

          {/* Refresh */}
          <button
            onClick={() => {
              if (mode === "RANGE") setRangeDays((d) => d);
              else setSelectedDate((d) => d);
            }}
            aria-label="Refresh"
            title="Refresh"
            style={{
              background: T.panel,
              border: `1px solid ${T.border}`,
              color: T.text,
              borderRadius: 10,
              padding: "8px 10px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {/* Error / loading */}
      {err && <div style={{ marginBottom: 12, color: theme === "dark" ? "#fecaca" : "#b91c1c" }}>Failed to load: {err}</div>}
      {loading && <div style={{ marginBottom: 12, color: T.subtext }}>Loading…</div>}

      {/* Header stats */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <StatCard label={mode === "DAY" ? "Total Sales (Day)" : "Total Sales"} value={headerStats.totalSales ?? 0} T={T} />
        <StatCard label={mode === "DAY" ? "Agents (Day)" : "Total Agents"} value={headerStats.totalAgents ?? 0} T={T} />
        <StatCard label="Avg per Rep" value={headerStats.avgPerAgent ?? "0.00"} T={T} />
        <StatCard label={mode === "DAY" ? "Agents (Day)" : "Avg Daily Agents"} value={headerStats.avgDailyAgents ?? 0} T={T} />
      </section>

      {/* RANGE: Sales per day */}
      {mode === "RANGE" && (
        <Panel title="Sales Per Day" T={T}>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={rangeData?.salesPerDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" stroke={T.subtext} />
                <YAxis stroke={T.subtext} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill={T.red} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* DAY: KPI % + Sales by Agent  OR  RANGE: Stacked share */}
      <div style={{ height: 16 }} />

      {mode === "DAY" ? (
        <>
          {/* KPI badges */}
          <Panel title="KPI Summary — Selected Day" T={T}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: T.chip, color: "#111827" }}>
                Day KPI Goal: <b>{dayData?.dayGoal ?? 0}</b>
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: T.chip, color: "#111827" }}>
                Sales so far: <b>{dayData?.totalKPI ?? 0}</b>
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: T.chip, color: "#111827" }}>
                % of KPI: <b>{Math.round((dayData?.dayPercent ?? 0) * 10) / 10}%</b>
              </span>
            </div>
          </Panel>

          <div style={{ height: 16 }} />

          {/* KPI % per Agent */}
          <Panel title="KPI Achievement by Agent (%)" T={T}>
            <div style={{ width: "100%", height: 440 }}>
              <ResponsiveContainer>
                <BarChart
                  data={[...(dayData?.perAgentKPI ?? [])]
                    .map((r) => ({
                      agent: r.agent,
                      percent: Math.round((r.percent ?? 0) * 10) / 10,
                      sales: r.sales,
                      goal: r.goal,
                      status: r.status,
                    }))
                    .sort((a, b) => b.percent - a.percent)}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 120, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis type="number" domain={[0, 150]} tick={{ fill: T.subtext }} stroke={T.subtext} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="agent" tick={{ fill: T.subtext }} stroke={T.subtext} width={160} />
                  <ReferenceLine x={100} stroke={T.subtext} strokeDasharray="4 4" />
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => {
                      const d = props?.payload || {};
                      return [`${value}%  •  Sales: ${d.sales} / Goal: ${d.goal} (${d.status || "PT"})`, "KPI"];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="percent" fill={T.coral} radius={[6, 6, 6, 6]} isAnimationActive={false}>
                    <LabelList dataKey="percent" position="right" formatter={(v: any) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div style={{ height: 16 }} />

          {/* Sales by Agent (raw) */}
          <Panel title="Sales by Agent (Selected Day)" T={T}>
            <div style={{ width: "100%", height: 380 }}>
              <ResponsiveContainer>
                <BarChart
                  data={[...(dayData?.perAgentKPI ?? [])]
                    .map((r) => ({ agent: r.agent, sales: r.sales }))
                    .sort((a, b) => b.sales - a.sales)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="agent" stroke={T.subtext} />
                  <YAxis stroke={T.subtext} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill={T.purple} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      ) : (
        // RANGE: Stacked share
        <Panel title="Top Agents — Share per Day (stacked)" T={T}>
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <BarChart data={stacked.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                <XAxis dataKey="date" stroke={T.subtext} />
                <YAxis stroke={T.subtext} />
                <Tooltip />
                <Legend />
                {(stacked.keys as string[]).map((k: string, i: number) => {
                  const colors = [T.purple, T.sky, T.coral, T.mint, T.pink, T.lime];
                  return <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} />;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* Leaderboard */}
      <div style={{ height: 16 }} />
      <Panel title="Agent Leaderboard" T={T}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: T.subtext }}>
                <th style={{ padding: "8px 6px" }}>Agent</th>
                <th style={{ padding: "8px 6px" }}>{mode === "DAY" ? "Sales (Day)" : "Sales"}</th>
                {mode === "DAY" && <th style={{ padding: "8px 6px" }}>KPI %</th>}
              </tr>
            </thead>
            <tbody>
              {mode === "DAY"
                ? (dayData?.perAgentKPI ?? [])
                    .slice()
                    .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
                    .map((r) => (
                      <tr key={r.agent} style={{ color: T.text, borderTop: `1px solid ${T.border}` }}>
                        <td style={{ padding: "10px 6px" }}>{r.agent}</td>
                        <td style={{ padding: "10px 6px" }}>{r.sales}</td>
                        <td style={{ padding: "10px 6px" }}>{Math.round((r.percent ?? 0) * 10) / 10}%</td>
                      </tr>
                    ))
                : (rangeData?.agentLeaderboard ?? []).map((r) => (
                    <tr key={r.agent} style={{ color: T.text, borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 6px" }}>{r.agent}</td>
                      <td style={{ padding: "10px 6px" }}>{r.sales}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </main>
  );
}