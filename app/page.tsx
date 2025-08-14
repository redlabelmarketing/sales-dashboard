"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell

} from "recharts";

import { RefreshCw, Sun, Moon } from "lucide-react";

const DASHBOARD_API = "/api/dashboard";

type Theme = {
  bg: string; panel: string; border: string; text: string; subtext: string; chip: string;
  purple: string; sky: string; coral: string; mint: string; pink: string; lime: string; red: string;
  card: string;
  pillBg: string; pillText: string; // NEW: legible pills in light mode
};


const THEMES: Record<"dark" | "light", Theme> = {
  dark: {
    bg: "#0f172a", panel: "#0b1223", border: "#243244", text: "#e5e7eb", subtext: "#9ca3af", chip: "#e5e7eb",
    purple: "#b3a3ff", sky: "#9bd2ff", coral: "#ffb6a1", mint: "#a8f0d1", pink: "#ffc0cb", lime: "#c7f59f", red: "#f87171",
    card: "#111827",
    pillBg: "#1f2937", pillText: "#e5e7eb",
  },
  light: {
    bg: "#f7f8fb", panel: "#ffffff", border: "#e5e7eb", text: "#111827", subtext: "#6b7280", chip: "#111827",
    purple: "#7c6cf2", sky: "#3ba4f6", coral: "#ff8f70", mint: "#49d3a6", pink: "#ff7ea8", lime: "#8ddf4f", red: "#ef4444",
    card: "#ffffff",
    pillBg: "#eef2f7", pillText: "#111827", // light slate chip
  },
};

const PASTELS = { purple: "#b3a3ff", sky: "#9bd2ff", coral: "#ffb6a1", mint: "#a8f0d1", pink: "#ffc0cb", lime: "#c7f59f", red: "#f87171" };

// Helpers to convert date formats (TOP-LEVEL, not inside a component or JSX)
const toYmd = (mmddyyyy: string) => {
  const [mm, dd, yyyy] = mmddyyyy.split("-");
  return `${yyyy}-${mm}-${dd}`;
};
const fromYmd = (ymd: string) => {
  const [yyyy, mm, dd] = ymd.split("-");
  return `${mm}-${dd}-${yyyy}`;
};

function StatCard({
  label,
  value,
  accent,
  T,
  isDark,
}: {
  label: string;
  value: string | number;
  accent: string;
  T: Theme;
  isDark: boolean;
}) {
  return (
    <div
  style={{
  background: T.panel,
  // No "border" or "borderColor" shorthand here:
  borderStyle: "solid",
  borderWidth: 1,
  // set non-top sides explicitly
  borderLeftColor: T.border,
  borderRightColor: T.border,
  borderBottomColor: T.border,
  // top side (accent)
  borderTopWidth: 4,
  borderTopStyle: "solid",
  borderTopColor: accent,
  borderRadius: 14,
  padding: "16px 18px",
  boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
  minWidth: 260,
  color: T.text,
}}
>
      <div style={{ color: T.subtext, fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

// soft shadow tuned for light/dark
function shadowSoft(T: Theme) {
  return T === THEMES.dark ? "0 10px 24px rgba(0,0,0,0.35)" : "0 8px 18px rgba(0,0,0,0.08)";
}

function hexWithAlpha(hex: string, a: number) {
  // accepts #rrggbb, returns rgba
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${a})`;
}

type RangeData = {
  totalSales: number;
  totalAgents: number;
  avgPerAgent: number;
  avgDailyAgents: number;
  salesPerDay: { date: string; sales: number }[];
  agentLeaderboard: { agent: string; sales: number }[];
};
type DayRow = { agent: string; sales: number; status?: "FT" | "PT"; target?: number; percent?: number };
type DayData = {
  totalKPI: number;
  perAgentKPI: DayRow[];
  dayGoal?: number;
  dayPercent?: number;
};

export default function DashboardPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const T = THEMES[theme];

  const [mode, setMode] = useState<"DAY" | "RANGE">("DAY");

  const [date, setDate] = useState<string>(() => {
    const d = new Date(); const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0"); const yyyy = d.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  });
  const [rangeDays, setRangeDays] = useState<number>(30);

  const [rangeData, setRangeData] = useState<RangeData | null>(null);
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function fetchRange(n: number) {
  setLoading(true); setErrorText(null);
  try {
    const res = await fetch(`${DASHBOARD_API}?days=${encodeURIComponent(n)}`, { cache: "no-store" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Upstream error");
    setRangeData(json);
  } catch (e: any) {
    setErrorText(String(e?.message || e));
  } finally {
    setLoading(false);
  }
}
  async function fetchDay(mmddyyyy: string) {
    setLoading(true); setErrorText(null);
    try {
      const url = `${DASHBOARD_API}?date=${encodeURIComponent(mmddyyyy)}`;
      const res = await fetch(url); const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Upstream error");
      setDayData(json as DayData);
    } catch (e: any) { setErrorText(String(e?.message || e)); } finally { setLoading(false); }
  }

  useEffect(() => { mode === "DAY" ? fetchDay(date) : fetchRange(rangeDays); }, []); // initial load
  useEffect(() => { if (mode === "DAY") fetchDay(date); }, [date, mode]);
  useEffect(() => { if (mode === "RANGE") fetchRange(rangeDays); }, [rangeDays, mode]);

  const headerStats = useMemo(() => {
    if (mode === "DAY") {
      const totalSales = dayData?.totalKPI ?? 0;
      const agentsDay = dayData?.perAgentKPI?.length ?? 0;
      const avg = agentsDay ? (totalSales / agentsDay) : 0;
      return {
        totalSales, totalAgents: agentsDay, avgPerAgent: avg.toFixed(2), avgDailyAgents: agentsDay,
      };
    }
    return {
      totalSales: rangeData?.totalSales ?? 0,
      totalAgents: rangeData?.totalAgents ?? 0,
      avgPerAgent: (rangeData?.avgPerAgent ?? 0).toFixed(2),
      avgDailyAgents: rangeData?.avgDailyAgents ?? 0,
    };
  }, [mode, dayData, rangeData]);

  // Leaderboard sort (Agent / Sales / KPI%)
  const [sortKey, setSortKey] = useState<"agent" | "sales" | "percent">("percent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const sortedDayRows = useMemo(() => {
    if (!dayData?.perAgentKPI) return [];
    const rows = [...dayData.perAgentKPI];
    rows.sort((a, b) => {
      const av = sortKey === "agent" ? a.agent.toLowerCase() :
        sortKey === "sales" ? (a.sales ?? 0) : (a.percent ?? 0);
      const bv = sortKey === "agent" ? b.agent.toLowerCase() :
        sortKey === "sales" ? (b.sales ?? 0) : (b.percent ?? 0);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [dayData, sortKey, sortDir]);

  const salesChartData = useMemo(() => {
  const rows = dayData?.perAgentKPI ?? [];
  return rows.map((r) => {
    const first = (r.agent || "").split(/\s+/)[0] || r.agent || "";
    const target = r.target ?? (r.status === "FT" ? 6.5 : 4);
    const percent = target ? ((r.sales ?? 0) / target) * 100 : 0;
    return {
      agent: r.agent,
      first,
      sales: r.sales ?? 0,
      percent: Number.isFinite(percent) ? percent : 0,
    };
  });
}, [dayData]);

  // KPI chart data: first name + percent (0–200 clamp)
const kpiChartData = useMemo(() => {
  const rows = dayData?.perAgentKPI ?? [];
  return rows.map((r) => {
    const first = (r.agent || "").split(/\s+/)[0] || r.agent || "";
    const target = r.target ?? (r.status === "FT" ? 6.5 : 4); // fallback targets
    const raw = typeof r.percent === "number"
      ? r.percent
      : target
        ? ((Number(r.sales || 0) / Number(target)) * 100)
        : 0;
    const percent = Number.isFinite(raw) ? Math.max(0, Math.min(200, raw)) : 0; // clamp 0–200
    return { first, percent };
  });
}, [dayData]);
  const SubtleButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
> = ({ active, style, ...props }) => (
  <button
    {...props}
    style={{
      padding: "8px 12px",
      border: `1px solid ${T.border}`,
      background: active
        ? (theme === "dark" ? "#1f2937" : "#ffffff")
        : (theme === "dark" ? "#0b1223" : "#f3f4f6"),
      color: T.text,
      borderRadius: 8,
      cursor: "pointer",
      ...(style || {}),
    }}
  />
);

  const Panel: React.FC<{ title?: string; T: Theme; children: React.ReactNode }> = ({ title, T, children }) => (
  <section
    style={{
      background: T.panel,
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: T.border,
      borderRadius: 12,
      boxShadow: shadowSoft(T),
      padding: 16,
      color: T.text,
      marginBottom: 16,
    }}
  >
    {title && <h3 style={{ margin: 0, marginBottom: 10, color: T.text }}>{title}</h3>}
    {children}
  </section>
);

  const Th: React.FC<{
    children: React.ReactNode; onClick?: () => void; active?: boolean;
  }> = ({ children, onClick, active }) => (
    <th
      onClick={onClick}
      title={onClick ? "Click to sort" : undefined}
      style={{
        padding: "8px 6px", cursor: onClick ? "pointer" : "default",
        color: active ? T.text : T.subtext, whiteSpace: "nowrap",
      }}
    >
      {children}{active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );

  return (
    <main style={{ background: T.bg, minHeight: "100vh", padding: 24, color: T.text }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <h1
          style={{
            margin: 0, fontSize: 28, fontWeight: 800,
            background: "linear-gradient(90deg,#ef4444,#8b5cf6,#22c55e)",
            WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}
        >
          Red Label Sales Dashboard
        </h1>
        <div style={{ flex: 1 }} />

        <SubtleButton
  onClick={() => setTheme(t => (t === "light" ? "dark" : "light"))}
  title="Toggle theme"
  aria-label="Toggle theme"
>
  {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
</SubtleButton>

<SubtleButton onClick={() => setMode("RANGE")} active={mode === "RANGE"}>Range</SubtleButton>
<SubtleButton onClick={() => setMode("DAY")} active={mode === "DAY"}>Day</SubtleButton>

{/* Range selector (shows only when in RANGE mode) */}
{mode === "RANGE" && (
  <select
    value={rangeDays}
    onChange={(e) => setRangeDays(Number(e.target.value))}
    aria-label="Select range"
    style={{
      padding: "8px 10px",
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "solid",
      borderColor: T.border,
      background: T.panel,
      color: T.text,
      cursor: "pointer",
    }}
  >
    <option value={7}>Last 7 days</option>
    <option value={14}>Last 14 days</option>
    <option value={30}>Last 30 days</option>
    <option value={60}>Last 60 days</option>
    <option value={90}>Last 90 days</option>
  </select>
)}
        
        <input
  type="date"
  lang="en-US"
  value={toYmd(date)}
  onChange={(e) => {
    setDate(fromYmd(e.target.value));
    setMode("DAY");
  }}
  style={{
    padding: "8px 10px",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: T.border,
    background: T.panel,
    color: T.text,
  }}
  aria-label="Pick a date"
/>

        <SubtleButton onClick={() => (mode === "DAY" ? fetchDay(date) : fetchRange(rangeDays))} title="Refresh">
          <RefreshCw size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Refresh
        </SubtleButton>
      </header>

      {/* Stat cards */}
      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
  <StatCard
    label={mode === "DAY" ? "Total Sales (Day)" : "Total Sales"}
    value={headerStats.totalSales ?? 0}
    accent={PASTELS.coral}
    T={T}
    isDark={theme === "dark"}
  />
  <StatCard
    label={mode === "DAY" ? "Agents (Day)" : "Total Agents"}
    value={headerStats.totalAgents ?? 0}
    accent={PASTELS.purple}
    T={T}
    isDark={theme === "dark"}
  />
  <StatCard
    label="Avg per Rep"
    value={headerStats.avgPerAgent ?? "0.00"}
    accent={PASTELS.mint}
    T={T}
    isDark={theme === "dark"}
  />
  <StatCard
    label={mode === "DAY" ? "Agents (Day)" : "Avg Daily Agents"}
    value={headerStats.avgDailyAgents ?? 0}
    accent={PASTELS.sky}
    T={T}
    isDark={theme === "dark"}
  />
</section>
      <div style={{ height: 14 }} />

      {/* KPI summary pills */}
      {mode === "DAY" && (
        <Panel title="KPI Summary — Selected Day" T={T}>
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
    <span style={{ padding: "6px 10px", borderRadius: 999, background: T.pillBg, color: T.pillText }}>
      Day KPI Goal: <b>{dayData?.dayGoal ?? 0}</b>
    </span>
    <span style={{ padding: "6px 10px", borderRadius: 999, background: T.pillBg, color: T.pillText }}>
      Sales so far: <b>{dayData?.totalKPI ?? 0}</b>
    </span>
    <span style={{ padding: "6px 10px", borderRadius: 999, background: T.pillBg, color: T.pillText }}>
  % of KPI: <b>
    {(() => {
      const goal = dayData?.dayGoal ?? 0;
      const total = dayData?.totalKPI ?? 0;
      const p = dayData?.dayPercent ?? (goal ? (total / goal) * 100 : 0);
      return `${(Number.isFinite(p) ? p : 0).toFixed(1)}%`;
    })()}
  </b>
</span>
  </div>
</Panel>
      )}

      <div style={{ height: 14 }} />

      {/* KPI % chart (DAY) */}
      {mode === "DAY" && (
  <Panel title="KPI Achievement by Agent (%)" T={T}>
  <div style={{ width: "100%", height: 420 }}>
    <ResponsiveContainer>
      <BarChart
        layout="vertical"                            // ✅ important
        data={kpiChartData}
        margin={{ left: 120, right: 24, top: 8, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
        <XAxis
          type="number"
          domain={[0, 150]}
          ticks={[0, 50, 100, 150]}
          stroke={T.subtext}
          tick={{ fill: T.subtext }}
        />
        <YAxis
          type="category"
          dataKey="first"
          width={120}
          tick={{ fill: T.subtext }}
          interval={0}
        />
        <Tooltip
  content={({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const name = label as string;                 // Y-axis category ("first")
      const val = Number(payload[0].value).toFixed(1);
      return (
        <div
          style={{
            background: T.panel,
            border: `1px solid ${T.border}`,
            padding: 8,
            borderRadius: 8,
            color: T.text,
          }}
        >
          {name} {val}%
        </div>
      );
    }
    return null;
  }}
/>
        <ReferenceLine x={100} stroke={T.subtext} strokeDasharray="4 4" />
        <Bar dataKey="percent" radius={[6, 6, 0, 0]}>
          {kpiChartData.map((d, i) => (
            <Cell key={i} fill={d.percent >= 100 ? "#bbf7d0" : "#fee2e2"} 
            stroke="#d1d5db" // light gray border
  strokeWidth={1}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
</Panel>
)}

      {/* Sales-by-agent chart (DAY) */}
      {mode === "DAY" && (
        <>
          <div style={{ height: 16 }} />
          <Panel title="Sales by Agent (Selected Day)" T={T}>
            <div style={{ width: "100%", height: 360 }}>
              <ResponsiveContainer>
                <BarChart data={salesChartData}>
  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
  <XAxis dataKey="first" stroke={T.subtext} tick={{ fill: T.subtext }} interval={0} />
  <YAxis stroke={T.subtext} />
  <Tooltip />
  <Legend />
  <Bar dataKey="sales" radius={[6, 6, 0, 0]}>
    {/* OPTIONAL: red/green by KPI% on the sales chart too */}
    {salesChartData.map((d, i) => (
      <Cell key={i} fill={d.percent >= 100 ? "#bbf7d0" : "#fee2e2"} 
      stroke="#d1d5db" // light gray border
  strokeWidth={1}
      />
    ))}
  </Bar>
</BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}

      {/* Leaderboard */}
      <div style={{ height: 16 }} />
      <Panel title="Agent Leaderboard" T={T}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
  <Th
    onClick={() => {
      setSortKey("agent");
      setSortDir(d => (sortKey === "agent" ? (d === "asc" ? "desc" : "asc") : "asc"));
    }}
    active={mode === "DAY" && sortKey === "agent"}
  >
    Agent
  </Th>
  <Th
    onClick={() => {
      setSortKey("sales");
      setSortDir(d => (sortKey === "sales" ? (d === "asc" ? "desc" : "asc") : "desc"));
    }}
    active={mode === "DAY" && sortKey === "sales"}
  >
    {mode === "DAY" ? "Sales (Day)" : "Sales"}
  </Th>
  {mode === "DAY" && (
    <Th
      onClick={() => {
        setSortKey("percent");
        setSortDir(d => (sortKey === "percent" ? (d === "asc" ? "desc" : "asc") : "desc"));
      }}
      active={sortKey === "percent"}
    >
      KPI %
    </Th>
  )}
</tr>
            </thead>
            <tbody>
              {mode === "DAY"
                ? sortedDayRows.map(r => (
                    <tr key={r.agent} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ padding: "10px 6px" }}>{r.agent}</td>
                      <td style={{ padding: "10px 6px" }}>{r.sales}</td>
                      <td style={{ padding: "10px 6px" }}>{(r.percent ?? 0).toFixed(1)}%</td>
                    </tr>
                  ))
                : (rangeData?.agentLeaderboard ?? []).map(r => (
                    <tr
  key={r.agent}
  style={{
    color: T.text,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: T.border,
  }}
>
                      <td style={{ padding: "10px 6px" }}>{r.agent}</td>
                      <td style={{ padding: "10px 6px" }}>{r.sales}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {errorText && (
        <div style={{ marginTop: 16, color: T.red, fontWeight: 600 }}>
          Failed to load: {errorText}
        </div>
      )}
    </main>
  );
}