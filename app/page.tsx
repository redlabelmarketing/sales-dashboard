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
import { RefreshCw } from "lucide-react";

/** ---------- Pastel palette ---------- */
const PASTELS = {
  bg: "#0f172a", // page bg for dark feel
  panel: "#0b1223",
  border: "#243244",
  text: "#e5e7eb",
  subtext: "#9ca3af",
  chip: "#e5e7eb",
  // series
  purple: "#b3a3ff",
  sky: "#a4d1ff",
  coral: "#ffb3b3",
  mint: "#b6f0cf",
  pink: "#ffc3e1",
  lime: "#d8ff9a",
  red: "#ffb4a8",
  green: "#b7f3b0",
};

const DASHBOARD_API = "/api/dashboard";

/** ---------- Types from API ---------- */
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

/** ---------- Small UI helpers ---------- */
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: PASTELS.panel,
        border: `1px solid ${PASTELS.border}`,
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 12, color: PASTELS.text, fontWeight: 600 }}>{title}</h3>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#111827",
        border: `1px solid ${PASTELS.border}`,
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ color: PASTELS.subtext, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ color: PASTELS.text, fontSize: 22, fontWeight: 700 }}>{value}</div>
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
  const [mode, setMode] = useState<"RANGE" | "DAY">("RANGE");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [selectedDate, setSelectedDate] = useState<string>(""); // MM-DD-YYYY
  const [rangeData, setRangeData] = useState<RangePayload | null>(null);
  const [dayData, setDayData] = useState<DayPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string>("");

  // Initial load & when controls change
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

  /** Build stacked series for RANGE mode from top agents across days */
  const stacked = useMemo<{ data: any[]; keys: string[] }>(() => {
    if (mode !== "RANGE") return { data: [], keys: [] };
    const daily = rangeData?.agentDaily ?? [];
    // collect top 6 agents overall
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

    // build rows
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

  // Handy computed stats for header cards
  const headerStats = useMemo(() => {
    if (mode === "DAY") {
      const totalAgents = dayData?.perAgentKPI?.length ?? 0;
      const totalSales = dayData?.totalKPI ?? 0;
      const avgPerAgent = totalAgents ? (totalSales / totalAgents).toFixed(2) : "0.00";
      const avgDailyAgents = totalAgents; // for a single day
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
    <main style={{ padding: 24, background: PASTELS.bg, minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: PASTELS.pink,
              color: "#1f2937",
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
            }}
          >
            RL
          </div>
          <h1 style={{ margin: 0, color: PASTELS.text, fontWeight: 800 }}>Red Label Sales Dashboard</h1>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mode toggle */}
          <div style={{ display: "inline-flex", borderRadius: 10, overflow: "hidden", border: `1px solid ${PASTELS.border}` }}>
            <button
              onClick={() => setMode("RANGE")}
              style={{
                padding: "8px 12px",
                background: mode === "RANGE" ? "#ffffff" : "#0b1223",
                color: "#111827",
                borderRight: `1px solid ${PASTELS.border}`,
              }}
              title="Show a rolling range (7/14/30/90 days)"
            >
              Range
            </button>
            <button
              onClick={() => setMode("DAY")}
              style={{
                padding: "8px 12px",
                background: mode === "DAY" ? "#f3f4f6" : "#0b1223",
                color: "#111827",
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
                border: `1px solid ${PASTELS.border}`,
                background: "#0b1223",
                color: PASTELS.text,
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
                // convert YYYY-MM-DD to MM-DD-YYYY
                const v = e.target.value; // YYYY-MM-DD
                if (!v) {
                  setSelectedDate("");
                } else {
                  const [yyyy, mm, dd] = v.split("-");
                  setSelectedDate(`${mm}-${dd}-${yyyy}`);
                }
              }}
              aria-label="Pick a date"
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${PASTELS.border}`,
                background: "#ffffff",
                color: "#111827",
              }}
            />
          )}

          {/* Refresh */}
          <button
            onClick={() => {
              if (mode === "RANGE") setRangeDays((d) => d); else setSelectedDate((d) => d);
            }}
            aria-label="Refresh"
            title="Refresh"
            style={{
              background: "#0b1223",
              border: `1px solid ${PASTELS.border}`,
              color: PASTELS.text,
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
      {err && (
        <div style={{ marginBottom: 12, color: "#fecaca" }}>
          Failed to load: {err}
        </div>
      )}
      {loading && (
        <div style={{ marginBottom: 12, color: PASTELS.subtext }}>Loading…</div>
      )}

      {/* Header stats */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <StatCard label={mode === "DAY" ? "Total Sales (Day)" : "Total Sales"} value={headerStats.totalSales ?? 0} />
        <StatCard label={mode === "DAY" ? "Agents (Day)" : "Total Agents"} value={headerStats.totalAgents ?? 0} />
        <StatCard label="Avg per Rep" value={headerStats.avgPerAgent ?? "0.00"} />
        <StatCard label={mode === "DAY" ? "Agents (Day)" : "Avg Daily Agents"} value={headerStats.avgDailyAgents ?? 0} />
      </section>

      {/* Sales per day (Range only) */}
      {mode === "RANGE" && (
        <Panel title="Sales Per Day">
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={rangeData?.salesPerDay ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={PASTELS.border} />
                <XAxis dataKey="date" stroke={PASTELS.subtext} />
                <YAxis stroke={PASTELS.subtext} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales" fill={PASTELS.red} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* KPI % per Agent (Day)  OR  Stacked Share (Range) */}
      <div style={{ height: 16 }} />
      <Panel
        title={mode === "DAY" ? "KPI Achievement by Agent (%) — Selected Day" : "Top Agents — Share per Day (stacked)"}
      >
        {mode === "DAY" && (dayData?.perAgentKPI?.length ?? 0) > 0 ? (
          <>
            {/* Day KPI badges */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: PASTELS.chip, color: "#111827" }}>
                Day KPI Goal: <b>{dayData?.dayGoal ?? 0}</b>
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: PASTELS.chip, color: "#111827" }}>
                Sales so far: <b>{dayData?.totalKPI ?? 0}</b>
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: PASTELS.chip, color: "#111827" }}>
                % of KPI: <b>{Math.round((dayData?.dayPercent ?? 0) * 10) / 10}%</b>
              </span>
            </div>

            {/* KPI bar chart */}
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
                  <CartesianGrid strokeDasharray="3 3" stroke={PASTELS.border} />
                  <XAxis
                    type="number"
                    domain={[0, 150]}
                    tick={{ fill: PASTELS.subtext }}
                    stroke={PASTELS.subtext}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="agent"
                    tick={{ fill: PASTELS.subtext }}
                    stroke={PASTELS.subtext}
                    width={160}
                  />
                  <ReferenceLine x={100} stroke="#9ca3af" strokeDasharray="4 4" />
                  <Tooltip
                    formatter={(value: any, _name: any, props: any) => {
                      const d = props?.payload || {};
                      return [
                        `${value}%  •  Sales: ${d.sales} / Goal: ${d.goal} (${d.status || "PT"})`,
                        "KPI",
                      ];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="percent"
                    fill={PASTELS.coral}
                    radius={[6, 6, 6, 6]}
                    isAnimationActive={false}
                  >
                    <LabelList dataKey="percent" position="right" formatter={(v: any) => `${v}%`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          // RANGE fallback: stacked share of top agents
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <BarChart data={stacked.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={PASTELS.border} />
                <XAxis dataKey="date" stroke={PASTELS.subtext} />
                <YAxis stroke={PASTELS.subtext} />
                <Tooltip />
                <Legend />
                {(stacked.keys as string[]).map((k: string, i: number) => {
                  const colors = [PASTELS.purple, PASTELS.sky, PASTELS.coral, PASTELS.mint, PASTELS.pink, PASTELS.lime];
                  return (
                    <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} />
                  );
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Leaderboard (simple) */}
      <div style={{ height: 16 }} />
      <Panel title="Agent Leaderboard">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", color: PASTELS.subtext }}>
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
                      <tr key={r.agent} style={{ color: PASTELS.text, borderTop: `1px solid ${PASTELS.border}` }}>
                        <td style={{ padding: "10px 6px" }}>{r.agent}</td>
                        <td style={{ padding: "10px 6px" }}>{r.sales}</td>
                        <td style={{ padding: "10px 6px" }}>{Math.round((r.percent ?? 0) * 10) / 10}%</td>
                      </tr>
                    ))
                : (rangeData?.agentLeaderboard ?? []).map((r) => (
                    <tr key={r.agent} style={{ color: PASTELS.text, borderTop: `1px solid ${PASTELS.border}` }}>
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