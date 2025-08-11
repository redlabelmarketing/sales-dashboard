"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";

/* ───────────────── CONFIG / THEME ───────────────── */
const DASHBOARD_API = "/api/dashboard";

// Brand + pastel palette (soft)
const BRAND_RED = "#b91c1c";
const BRAND_RED_SOFT = "#fee2e2";
const PASTELS = {
  blue: "#9ec5fe",
  green: "#b6f0c3",
  amber: "#ffd59e",
  red: "#ffb3b3",
  purple: "#e3c6ff",
  sky: "#bde0fe",
  coral: "#ffc9b9",
  mint: "#d3f9d8",
  pink: "#ffd6e7",
  lime: "#e9f5c9",
};

/* ───────────────── HELPERS ───────────────── */
type Mode = "RANGE" | "DAY";
const fmtNum = (n: number) => Intl.NumberFormat().format(n);

function normalizePayload(json: any) {
  return {
    ...json,
    ok: json?.ok ?? true,
    updatedAt: json?.updatedAt ?? new Date().toISOString(),
    salesPerDay: Array.isArray(json?.salesPerDay) ? json.salesPerDay : [],
    agentDaily: Array.isArray(json?.agentDaily) ? json.agentDaily : [],
    agentLeaderboard: Array.isArray(json?.agentLeaderboard) ? json.agentLeaderboard : [],
    perAgentKPI: Array.isArray(json?.perAgentKPI) ? json.perAgentKPI : [],
    totalSales: Number(json?.totalSales ?? 0),
    totalAgents: Number(json?.totalAgents ?? 0),
    avgPerAgent: Number(json?.avgPerAgent ?? 0),
    avgDailyAgents: Number(json?.avgDailyAgents ?? 0),
    totalKPI: Number(json?.totalKPI ?? 0),
    date: json?.date ?? undefined,
  };
}

function buildStacked(
  agentDaily: { date: string; byAgent: { agent: string; sales: number }[] }[],
  topN = 6
) {
  if (!agentDaily || agentDaily.length === 0) return { data: [] as any[], keys: [] as string[] };

  const totals: Record<string, number> = {};
  for (const d of agentDaily) {
    for (const a of d.byAgent || []) {
      totals[a.agent] = (totals[a.agent] || 0) + (a.sales || 0);
    }
  }
  const ranked = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);

  const data = agentDaily.map((d) => {
    const row: Record<string, any> = { date: d.date };
    for (const a of d.byAgent || []) {
      if (ranked.includes(a.agent)) row[a.agent] = (row[a.agent] || 0) + (a.sales || 0);
    }
    return row;
  });

  return { data, keys: ranked };
}

/* ───────────────── PAGE ───────────────── */
export default function DashboardPage() {
  const [mode, setMode] = useState<Mode>("RANGE");
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [pickedDate, setPickedDate] = useState<string>(""); // YYYY-MM-DD
  const [loading, setLoading] = useState<boolean>(false);
  const [dark, setDark] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [sortKey, setSortKey] = useState<"agent" | "sales">("sales");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Theme tokens
  const bg = dark ? "#0b1020" : "#f7f8fb";
  const bgAccent = dark ? "linear-gradient(180deg, #0b1020, #0f1530)" : "linear-gradient(180deg, #f7f8fb, #eef2f7)";
  const panel = dark ? "#111827" : "#ffffff";
  const text = dark ? "#e5e7eb" : "#0f172a";
  const subtext = dark ? "#9ca3af" : "#475569";
  const border = dark ? "#1f2937" : "#e5e7eb";
  const shadow = dark ? "0 10px 24px rgba(0,0,0,0.25)" : "0 10px 24px rgba(17,24,39,0.07)";

  // Fetchers
  async function fetchRange(n: number) {
    setLoading(true); setErrorMsg("");
    try {
      const url = `${DASHBOARD_API}?days=${encodeURIComponent(n)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setData(normalizePayload(json));
    } catch {
      setErrorMsg("Failed to load range");
    } finally {
      setLoading(false);
    }
  }
  async function fetchDay(yyyyMmDd: string) {
    if (!yyyyMmDd) return;
    setLoading(true); setErrorMsg("");
    try {
      const [yyyy, mm, dd] = yyyyMmDd.split("-");
      const mmddyyyy = `${mm}-${dd}-${yyyy}`;
      const url = `${DASHBOARD_API}?date=${encodeURIComponent(mmddyyyy)}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setData(normalizePayload(json));
    } catch {
      setErrorMsg("Failed to load day");
    } finally {
      setLoading(false);
    }
  }

  // Load on switches
  useEffect(() => { if (mode === "RANGE") fetchRange(rangeDays); }, [mode, rangeDays]);
  useEffect(() => { if (mode === "DAY" && pickedDate) fetchDay(pickedDate); }, [mode, pickedDate]);

  // Leaderboard source: Day => perAgentKPI ; Range => agentLeaderboard
  const leaderboard = useMemo(() => {
    const source =
      mode === "DAY" && (data?.perAgentKPI?.length ?? 0) > 0
        ? data.perAgentKPI
        : data?.agentLeaderboard || [];
    const arr = Array.isArray(source) ? [...source] : [];
    arr.sort((a: any, b: any) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "agent") return a.agent.localeCompare(b.agent) * dir;
      return ((a.sales || 0) - (b.sales || 0)) * dir;
    });
    return arr;
  }, [data, sortKey, sortDir, mode]);

  // Stacked bar
  const stacked = useMemo(() => {
    if (mode === "DAY" && (data?.perAgentKPI?.length ?? 0) > 0) {
      const iso = data?.date || "Selected";
      return {
        data: [{ date: iso, ...Object.fromEntries(data.perAgentKPI.map((r: any) => [r.agent, r.sales])) }],
        keys: data.perAgentKPI.slice(0, 6).map((r: any) => r.agent),
      };
    }
    return buildStacked(data?.agentDaily || [], 6);
  }, [data?.agentDaily, data?.perAgentKPI, data?.date, mode]);

  // ✅ KPIs by mode
  const kpis = useMemo(() => {
    if (mode === "DAY") {
      const totalKPI = Number(data?.totalKPI || 0);
      const agents = Array.isArray(data?.perAgentKPI) ? data.perAgentKPI.length : 0;
      const apr = agents ? +(totalKPI / agents).toFixed(2) : 0;
      return {
        totalSales: totalKPI,
        totalAgents: agents,
        avgPerAgent: apr,
        avgDailyAgents: agents,
        labelSuffix: " (day)",
      };
    }
    return {
      totalSales: Number(data?.totalSales || 0),
      totalAgents: Number(data?.totalAgents || 0),
      avgPerAgent: Number(data?.avgPerAgent || 0),
      avgDailyAgents: Number(data?.avgDailyAgents || 0),
      labelSuffix: "",
    };
  }, [mode, data]);

  return (
    <main style={{ padding: 24, minHeight: "100vh", color: text, background: bgAccent }}>
      {/* ── Header (no RL box; stronger brand pill) ── */}
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, lineHeight: 1.15 }}>
          <span
            style={{
              padding: "6px 12px",
              background: dark ? "rgba(239, 68, 68, 0.18)" : BRAND_RED_SOFT,
              color: dark ? "#fecaca" : BRAND_RED,
              borderRadius: 12,
              border: `1px solid ${dark ? "#7f1d1d" : "#fecaca"}`,
              boxShadow: shadow,
              marginRight: 10,
            }}
          >
            Red Label
          </span>
          <span style={{ letterSpacing: 0.2 }}>Sales Dashboard</span>
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: subtext }}>
            Updated: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString() : "—"}
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            style={{
              padding: "8px 12px", borderRadius: 10,
              border: `1px solid ${border}`, background: panel, color: text,
              cursor: "pointer", boxShadow: shadow,
            }}
            title="Toggle dark mode"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* ── Controls ── */}
      <section
        style={{
          background: panel, border: `1px solid ${border}`, borderRadius: 16, padding: 12,
          display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap", boxShadow: shadow,
        }}
      >
        <div style={{ display: "inline-flex", border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden" }}>
          <Tab label="Range" active={mode === "RANGE"} onClick={() => setMode("RANGE")} panel={panel} border={border} text={text} dark={dark} />
          <Tab label="Day" active={mode === "DAY"} onClick={() => setMode("DAY")} panel={panel} border={border} text={text} dark={dark} />
        </div>

        {mode === "RANGE" ? (
          <div style={{ display: "inline-flex", gap: 8 }}>
            {[7, 14, 30, 90].map((n) => (
              <button
                key={n}
                onClick={() => setRangeDays(n)}
                style={{
                  padding: "9px 13px", borderRadius: 12, border: `1px solid ${border}`,
                  background: rangeDays === n ? (dark ? "#1f2937" : "#eef2ff") : panel,
                  color: text, cursor: "pointer", boxShadow: shadow, fontWeight: 700,
                }}
                title={`Last ${n} days`}
              >
                {n}d
              </button>
            ))}
          </div>
        ) : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: subtext, fontSize: 12 }}>Pick date</span>
            <input
              type="date"
              value={pickedDate}
              onChange={(e) => setPickedDate(e.target.value)}
              style={{
                padding: "9px 12px", borderRadius: 12, border: `1px solid ${border}`,
                background: panel, color: text, outline: "none", boxShadow: shadow,
              }}
            />
          </label>
        )}

        {loading && <span style={{ marginLeft: 8, fontSize: 12, color: subtext }}>Loading…</span>}
        {!!errorMsg && <span style={{ marginLeft: 8, fontSize: 12, color: dark ? "#fca5a5" : "#b91c1c" }}>{errorMsg}</span>}
      </section>

      {/* ── KPI cards (tinted pastels) ── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14, marginBottom: 18 }}>
        <TintStat title={`Total Sales${kpis.labelSuffix}`} value={fmtNum(kpis.totalSales)} tint={PASTELS.red} dark={dark} />
        <TintStat title={`Total Agents${kpis.labelSuffix}`} value={fmtNum(kpis.totalAgents)} tint={PASTELS.green} dark={dark} />
        <TintStat title={`Avg per Rep${kpis.labelSuffix ? " (mean)" : " (daily mean)"}`} value={String(kpis.avgPerAgent)} tint={PASTELS.blue} dark={dark} />
        <TintStat title={`Avg Daily Agents${kpis.labelSuffix}`} value={String(kpis.avgDailyAgents)} tint={PASTELS.amber} dark={dark} />
      </section>

      {/* ── Charts ── */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginBottom: 18 }}>
        {mode === "RANGE" ? (
          <Panel title="Sales Per Day" panel={panel} border={border} sub={subtext} shadow={shadow}>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <AreaChart data={(data?.salesPerDay ?? []).map((d: any) => ({ ...d, sales: Number(d.sales || 0) }))}>
                  <defs>
                    <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PASTELS.blue} stopOpacity={0.5} />
                      <stop offset="95%" stopColor={PASTELS.blue} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} />
                  <XAxis dataKey="date" stroke={subtext} />
                  <YAxis stroke={subtext} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="sales" stroke={PASTELS.blue} fillOpacity={1} fill="url(#gradSales)" strokeWidth={3} />
                  <Line type="monotone" dataKey="sales" stroke={PASTELS.blue} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        ) : (
          <Panel title={`Sales by Agent — ${data?.date || "Selected Day"}`} panel={panel} border={border} sub={subtext} shadow={shadow}>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={(data?.perAgentKPI ?? []).map((r: any) => ({ agent: r.agent, sales: Number(r.sales || 0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={border} />
                  <XAxis dataKey="agent" stroke={subtext} />
                  <YAxis stroke={subtext} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sales" fill={PASTELS.red} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        )}

        {/* Stacked bar */}
        <Panel title={mode === "DAY" ? "Agent Share (Selected Day)" : "Top Agents — Share per Day (stacked)"} panel={panel} border={border} sub={subtext} shadow={shadow}>
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer>
              <BarChart data={stacked.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={border} />
                <XAxis dataKey="date" stroke={subtext} />
                <YAxis stroke={subtext} />
                <Tooltip />
                <Legend />
                {stacked.keys.map((k, i) => {
                  const colors = [PASTELS.purple, PASTELS.sky, PASTELS.coral, PASTELS.mint, PASTELS.pink, PASTELS.lime];
                  return <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} radius={[6, 6, 0, 0]} />;
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </section>

      {/* ── Leaderboard ── */}
      <section>
        <Panel title="Agent Leaderboard" panel={panel} border={border} sub={subtext} shadow={shadow}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: subtext }}>
                  <Th
                    onClick={() => {
                      setSortKey("agent");
                      setSortDir((d) => (sortKey === "agent" ? (d === "asc" ? "desc" : "asc") : "asc"));
                    }}
                    active={sortKey === "agent"}
                    border={border}
                  >
                    Agent {sortKey === "agent" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                  <Th
                    onClick={() => {
                      setSortKey("sales");
                      setSortDir((d) => (sortKey === "sales" ? (d === "asc" ? "desc" : "asc") : "desc"));
                    }}
                    active={sortKey === "sales"}
                    border={border}
                  >
                    Sales {sortKey === "sales" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                  </Th>
                </tr>
              </thead>
              <tbody>
                {(leaderboard ?? []).map((row: any, idx: number) => (
                  <tr key={row.agent + idx} style={{ borderTop: `1px solid ${border}` }}>
                    <td style={{ padding: "10px 8px", fontWeight: 600 }}>{row.agent}</td>
                    <td style={{ padding: "10px 8px", fontWeight: 800 }}>{fmtNum(Number(row.sales || 0))}</td>
                  </tr>
                ))}
                {(!leaderboard || leaderboard.length === 0) && (
                  <tr>
                    <td colSpan={2} style={{ padding: 12, color: subtext }}>No data</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </main>
  );
}

/* ───────────────── UI PIECES ───────────────── */

// KPI with tinted pastel background
function TintStat({ title, value, tint, dark }: { title: string; value: string; tint: string; dark: boolean }) {
  const bg = dark ? "rgba(255,255,255,0.03)" : "#ffffff";
  const tintBg = `linear-gradient(180deg, ${tint}33, ${tint}14)`; // soft overlay
  const border = dark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
  const text = dark ? "#e5e7eb" : "#0f172a";
  const sub = dark ? "#9ca3af" : "#475569";
  const shadow = dark ? "0 10px 24px rgba(0,0,0,0.25)" : "0 10px 24px rgba(17,24,39,0.07)";
  return (
    <div
      style={{
        background: `${tintBg}, ${bg}`,
        border: `1px solid ${border}`,
        borderRadius: 18,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        boxShadow: shadow,
      }}
    >
      <div style={{ fontSize: 12, color: sub }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: text }}>{value}</div>
    </div>
  );
}

function Panel({ title, children, panel, border, sub, shadow }: any) {
  return (
    <div style={{ background: panel, border: `1px solid ${border}`, borderRadius: 18, padding: 16, boxShadow: shadow }}>
      <div style={{ fontWeight: 900, marginBottom: 10, color: sub }}>{title}</div>
      {children}
    </div>
  );
}
function Th({ children, onClick, active, border }: any) {
  return (
    <th
      onClick={onClick}
      style={{
        padding: "10px 8px",
        borderBottom: `1px solid ${border}`,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
        fontWeight: active ? 900 : 700,
      }}
    >
      {children}
    </th>
  );
}
function Tab({ active, onClick, label, panel, border, text, dark }: any) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "9px 13px",
        background: active ? (dark ? "#1f2937" : "#eef2ff") : panel,
        color: text,
        borderRight: `1px solid ${border}`,
        cursor: "pointer",
        fontWeight: 800,
      }}
      title={label}
    >
      {label}
    </button>
  );
}