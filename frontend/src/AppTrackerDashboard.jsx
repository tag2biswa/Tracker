import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

/* Config */
const ALL_CHART_DAYS = 180;
const COLOR_PALETTE = [
  "#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f",
  "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"
];

function hashStringToIndex(s, mod) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % mod;
}

/* Custom legend */
const CustomLegend = ({ items = [], colorMap = {} }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8, fontSize: 13 }}>
    {items.map(app => (
      <div key={app} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 12, height: 12, display: "inline-block", backgroundColor: colorMap[app] || COLOR_PALETTE[0], borderRadius: 3 }} />
        <span style={{ whiteSpace: "nowrap" }}>{app}</span>
      </div>
    ))}
  </div>
);

function AppTrackerDashboard({ activities: propActivities = [] }) {
  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    if (Array.isArray(propActivities)) setLastUpdated(new Date());
  }, [propActivities]);

  // ---------- helpers
  const getActDate = (a) => {
    if (!a) return null;
    const candidates = [
      a.timestamp, a.activity_date, a.activityDate, a.date, a.time, a.ts, a.start_time, a.created_at
    ];
    for (const val of candidates) {
      if (val === undefined || val === null) continue;
      // numeric epoch
      if (typeof val === "number" || /^\d+$/.test(String(val))) {
        const n = Number(val);
        if (!Number.isNaN(n)) {
          const maybeMs = n > 1e11 ? n : n * 1000;
          const d = new Date(maybeMs);
          if (!isNaN(d)) return d;
        }
      }
      if (typeof val === "string") {
        const s = val.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
          const d = new Date(s + "T00:00:00");
          if (!isNaN(d)) return d;
        }
        const d2 = new Date(s);
        if (!isNaN(d2)) return d2;
      }
    }
    return null;
  };

  const getDurationSeconds = (a) => {
    if (!a) return 0;
    const maybe = a.duration !== undefined ? a.duration : a.seconds ?? a.time ?? 0;
    const n = Number(maybe);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
  };

  const dateFilterToDays = (f) => {
    if (f === "Today") return 1;
    if (f === "LastMonth") return 30;
    if (f === "Last6Months") return 180;
    return 30;
  };

  // ---------- compute users list (always from raw activities)
  const users = useMemo(() => {
    const set = new Set();
    for (const a of Array.isArray(propActivities) ? propActivities : []) {
      const u = a.user_id ?? a.user ?? "unknown";
      set.add(String(u));
    }
    return ["All", ...Array.from(set)];
  }, [propActivities]);

  // ---------- apply date filter semantics (table semantics)
  const now = new Date();
  let dateFilteredActivities = Array.isArray(propActivities) ? [...propActivities] : [];

  if (dateFilter === "Today") {
    dateFilteredActivities = dateFilteredActivities.filter(a => {
      const d = getActDate(a); if (!d) return false;
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
  } else if (dateFilter === "LastMonth") {
    const start = new Date(now); start.setMonth(now.getMonth() - 1);
    dateFilteredActivities = dateFilteredActivities.filter(a => {
      const d = getActDate(a); return d && d >= start && d <= now;
    });
  } else if (dateFilter === "Last6Months") {
    const start = new Date(now); start.setMonth(now.getMonth() - 6);
    dateFilteredActivities = dateFilteredActivities.filter(a => {
      const d = getActDate(a); return d && d >= start && d <= now;
    });
  }

  const filteredActivities = selectedUser === "All"
    ? dateFilteredActivities
    : dateFilteredActivities.filter(a => String(a.user_id ?? a.user ?? "unknown") === String(selectedUser));

  // sorting for table
  const sortedActivities = [...filteredActivities].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key] ?? "", vb = b[sortConfig.key] ?? "";
    if (typeof va === "string") return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortConfig.direction === "asc" ? (va - vb) : (vb - va);
  });

  const requestSort = (key) => {
    let dir = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") dir = "desc";
    setSortConfig({ key, direction: dir });
  };
  const getSortIndicator = (k) => (sortConfig.key !== k ? "↕" : (sortConfig.direction === "asc" ? "↑" : "↓"));

  const totalDuration = sortedActivities.reduce((s, a) => s + getDurationSeconds(a), 0);

  // ---------- color mapping based on applications in raw propActivities
  const appList = useMemo(() => {
    const s = new Set();
    for (const a of Array.isArray(propActivities) ? propActivities : []) {
      s.add(a.app_name ?? a.app ?? "Unknown");
    }
    return Array.from(s);
  }, [propActivities]);

  const colorMap = useMemo(() => {
    const m = {};
    for (const app of appList) {
      m[app] = COLOR_PALETTE[hashStringToIndex(app, COLOR_PALETTE.length)];
    }
    return m;
  }, [appList]);

  // ---------- top cards -- client-side aggregator fallback
  const mostUsedWithTopUsers = (days, activitiesList) => {
    if (!Array.isArray(activitiesList) || activitiesList.length === 0) return null;
    const end = new Date();
    const start = new Date(end); start.setDate(end.getDate() - (days - 1));
    const appTotals = {}, appUserTotals = {};
    for (const a of activitiesList) {
      const d = getActDate(a);
      if (!d) continue;
      if (d < start || d > end) continue;
      const app = a.app_name ?? a.app ?? "Unknown";
      const user = String(a.user_id ?? a.user ?? "unknown");
      const dur = getDurationSeconds(a);
      appTotals[app] = (appTotals[app] || 0) + dur;
      appUserTotals[app] = appUserTotals[app] || {};
      appUserTotals[app][user] = (appUserTotals[app][user] || 0) + dur;
    }
    let best = null, bestDur = 0;
    for (const [app, total] of Object.entries(appTotals)) {
      if (total > bestDur) { bestDur = total; best = app; }
    }
    if (!best) return null;
    const usersSorted = Object.entries(appUserTotals[best] || {}).map(([user, duration])=>({ user, duration })).sort((a,b)=>b.duration-a.duration);
    return { app: best, duration: bestDur, topUsers: usersSorted.slice(0, 10) };
  };

  const weekTop = mostUsedWithTopUsers(7, propActivities);
  const monthTop = mostUsedWithTopUsers(30, propActivities);
  const sixMonthTop = mostUsedWithTopUsers(180, propActivities);

  // ---------- charts data (bar uses filteredActivities; line uses window determined by dateFilter or ALL_CHART_DAYS)
  const appTotalsForChart = useMemo(() => {
    const totals = {};
    for (const a of filteredActivities) {
      const app = a.app_name ?? a.app ?? "Unknown";
      totals[app] = (totals[app] || 0) + getDurationSeconds(a);
    }
    return Object.entries(totals).map(([app, duration]) => ({ app, duration })).sort((a,b)=>b.duration-a.duration).slice(0, 10);
  }, [filteredActivities]);

  const dailyUsage = useMemo(() => {
    const daysWindow = dateFilter === "All" ? ALL_CHART_DAYS : dateFilterToDays(dateFilter);
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - (daysWindow - 1));
    const dayKeys = []; const daysMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key); daysMap[key] = {};
    }
    for (const a of Array.isArray(propActivities) ? propActivities : []) {
      const d = getActDate(a);
      if (!d || d < start || d > end) continue;
      if (selectedUser !== "All" && String(a.user_id ?? a.user ?? "unknown") !== String(selectedUser)) continue;
      const key = d.toISOString().slice(0, 10);
      const app = a.app_name ?? a.app ?? "Unknown";
      daysMap[key][app] = (daysMap[key][app] || 0) + getDurationSeconds(a);
    }
    const overall = {};
    for (const k of Object.keys(daysMap)) for (const [app, sec] of Object.entries(daysMap[k])) overall[app] = (overall[app]||0) + sec;
    const topApps = Object.entries(overall).sort((a,b)=>b[1]-a[1]).slice(0,5).map(r=>r[0]);
    return dayKeys.map(dateKey => {
      const r = { date: dateKey };
      for (const app of topApps) r[app] = daysMap[dateKey][app] || 0;
      return r;
    });
  }, [propActivities, selectedUser, dateFilter]);

  // ---------- small util
  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':');
  };

  // ---------- top-card renderer (with swatch + colored progress bars)
  const renderTopCard = (title, topData, label) => {
    if (!topData) {
      return (
        <div className="top-card">
          <div className="top-title">{title}</div>
          <div className="top-app muted">—</div>
        </div>
      );
    }
    const appColor = colorMap[topData.app] || COLOR_PALETTE[0];
    return (
      <div className="top-card">
        <div className="top-title">{title}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 14, height: 14, backgroundColor: appColor, display: "inline-block", borderRadius: 3 }} />
          <div className="top-app" style={{ fontWeight: 800 }}>{topData.app}</div>
          <div style={{ marginLeft: "auto" }} className="top-meta muted small">{label} • {formatDuration(topData.duration)}</div>
        </div>

        <hr className="top-divider" />
        <div className="top-users-heading">Top users</div>

        <div className="top-card-users">
          {topData.topUsers && topData.topUsers.length > 0 ? topData.topUsers.map((u,i) => {
            const pct = topData.duration > 0 ? Math.round((u.duration / topData.duration) * 100) : 0;
            const pctClamped = Math.max(0, Math.min(100, pct));
            return (
              <div key={u.user + i} className="user-row-wrapper">
                <div className="user-row">
                  <span className={`user-badge ${i===0?'crown-badge':''}`}>{i===0?'👑':(i+1)}</span>
                  <span className="user-name">{u.user}</span>
                  <span className="user-duration">{formatDuration(u.duration)}</span>
                </div>

                <div className="user-progress-row">
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${pctClamped}%`, background: appColor }} />
                  </div>
                  <div className="progress-percent">{pctClamped}%</div>
                </div>
              </div>
            );
          }) : <div className="muted small">No users</div>}
        </div>
      </div>
    );
  };

  // ---------- RENDER
  return (
    <div className="dashboard-wrapper">
      {/* Top cards */}
      <div className="top-cards-row">
        {renderTopCard("Most used — 7 days", weekTop, "7 days")}
        {renderTopCard("Most used — 30 days", monthTop, "30 days")}
        {renderTopCard("Most used — 180 days", sixMonthTop, "180 days")}
      </div>

      {/* COMMON FILTERS */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tiny">User</span>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="filter-select">
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tiny">Date</span>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="filter-select">
              <option value="All">All (charts: last {ALL_CHART_DAYS} days)</option>
              <option value="Today">Today</option>
              <option value="LastMonth">Last Month</option>
              <option value="Last6Months">Last 6 Months</option>
            </select>
          </label>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          <div className="sub-pill">Rows: <strong>{sortedActivities.length}</strong></div>
          <div className="sub-pill">Duration: <strong>{formatDuration(totalDuration)}</strong></div>
          {lastUpdated && <div className="muted small">Updated {lastUpdated.toLocaleTimeString()}</div>}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 520px", minWidth: 320 }}>
          <div className="dashboard-card" style={{ padding: 12 }}>
            <h3 className="dashboard-title" style={{ margin: 0, marginBottom: 8 }}>Usage by App (filtered)</h3>
            {appTotalsForChart.length === 0 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>No data for selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={appTotalsForChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="app" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => v >= 3600 ? `${Math.round(v/3600)}h` : `${Math.round(v/60)}m`} />
                  <Tooltip formatter={(v) => formatDuration(v)} />
                  <Bar dataKey="duration" name="Duration">
                    {appTotalsForChart.map(entry => <Cell key={entry.app} fill={colorMap[entry.app] || COLOR_PALETTE[0]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <CustomLegend items={appTotalsForChart.map(d => d.app)} colorMap={colorMap} />
          </div>
        </div>

        <div style={{ flex: "1 1 520px", minWidth: 320 }}>
          <div className="dashboard-card" style={{ padding: 12 }}>
            <h3 className="dashboard-title" style={{ margin: 0, marginBottom: 8 }}>Daily Usage Trend (Top 5 apps)</h3>
            {dailyUsage.length === 0 || Object.keys(dailyUsage[0] || {}).length <= 1 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>No daily trend data available for the selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => v >= 3600 ? `${Math.round(v/3600)}h` : `${Math.round(v/60)}m`} />
                  <Tooltip formatter={(v) => formatDuration(v)} />
                  {dailyUsage.length > 0 && Object.keys(dailyUsage[0]).filter(k => k !== "date").map((app, idx) => (
                    <Line key={app} type="monotone" dataKey={app} stroke={colorMap[app] || COLOR_PALETTE[idx % COLOR_PALETTE.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
            <CustomLegend items={dailyUsage.length > 0 ? Object.keys(dailyUsage[0]).filter(k => k !== "date") : []} colorMap={colorMap} />
          </div>
        </div>
      </div>

      {/* Activity Overview table (scrollable) */}
      
    </div>
  );
}

export default AppTrackerDashboard;