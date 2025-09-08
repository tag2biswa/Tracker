// /src/AppTrackerDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

/**
 * Enhanced AppTrackerDashboard
 * - Distinct color per app (used in both bar & line charts)
 * - When Date = "All", charts span a longer window (ALL_CHART_DAYS)
 *
 * Props:
 *   - activities: array of { user_id, app_name, window_title, duration, timestamp?, activity_date? }
 */

// tweak this to change how long "All" charts span
const ALL_CHART_DAYS = 180;

// a pleasant color palette to cycle through
const COLOR_PALETTE = [
  "#2563eb", "#06b6d4", "#f97316", "#10b981", "#8b5cf6",
  "#ef4444", "#f59e0b", "#3b82f6", "#0ea5a4", "#a78bfa"
];

// stable string hashing to pick consistent color index for app names
function hashStringToIndex(s, mod) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % mod;
}

function AppTrackerDashboard({ activities: propActivities = [] }) {
  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("All"); // All / Today / LastMonth / Last6Months
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    if (Array.isArray(propActivities)) setLastUpdated(new Date());
  }, [propActivities]);

  // -----------------------
  // Helpers
  // -----------------------
  const getActDate = (a) => {
    if (!a) return null;
    const candidates = [
      a.timestamp, a.start_time, a.created_at, a.activity_date,
      a.date, a.time, a.ts, a.time_ms, a.time_seconds
    ];
    for (const val of candidates) {
      if (val === undefined || val === null) continue;
      if (typeof val === "number" || (/^\d+$/.test(String(val)))) {
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

  // date filter -> days
  const dateFilterToDays = (filter) => {
    if (filter === "Today") return 1;
    if (filter === "LastMonth") return 30;
    if (filter === "Last6Months") return 180;
    return 30; // default for charts when "All"
  };

  // -----------------------
  // Filtering (table semantics remain same)
  // -----------------------
  const now = new Date();
  let dateFilteredActivities = Array.isArray(propActivities) ? [...propActivities] : [];

  if (dateFilter === "Today") {
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a); if (!d) return false;
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (dateFilter === "LastMonth") {
    const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a); if (!d) return false;
      return d >= lastMonth && d <= now;
    });
  } else if (dateFilter === "Last6Months") {
    const last6 = new Date(now); last6.setMonth(now.getMonth() - 6);
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a); if (!d) return false;
      return d >= last6 && d <= now;
    });
  } // else "All" => keep full list for table (charts will use ALL_CHART_DAYS window)

  // user filter
  const filteredActivities = selectedUser === "All"
    ? dateFilteredActivities
    : dateFilteredActivities.filter((a) => (a.user_id || a.user) === selectedUser);

  // sorting
  const sortedActivities = [...filteredActivities].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key], vb = b[sortConfig.key];
    if (typeof va === "string") return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortConfig.direction === "asc" ? (va - vb) : (vb - va);
  });

  const requestSort = (key) => {
    let dir = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") dir = "desc";
    setSortConfig({ key, direction: dir });
  };
  const getSortIndicator = (key) => (sortConfig.key !== key ? "↕" : (sortConfig.direction === "asc" ? "↑" : "↓"));
  const totalDuration = sortedActivities.reduce((s, a) => s + getDurationSeconds(a), 0);

  // users list for filter
  const users = ["All", ...Array.from(new Set((Array.isArray(propActivities) ? propActivities : []).map(a => a.user_id || a.user || "unknown")))];

  // -----------------------
  // Color mapping for apps (stable mapping via hash)
  // -----------------------
  // build unique app list from propActivities (to ensure colors consistent across charts)
  const appList = useMemo(() => {
    const s = new Set();
    for (const a of Array.isArray(propActivities) ? propActivities : []) {
      const app = a.app_name || a.app || "Unknown";
      s.add(app);
    }
    return Array.from(s);
  }, [propActivities]);

  const colorMap = useMemo(() => {
    const map = {};
    const paletteLen = COLOR_PALETTE.length;
    for (const app of appList) {
      const idx = hashStringToIndex(app, paletteLen);
      map[app] = COLOR_PALETTE[idx];
    }
    return map;
  }, [appList]);

  // -----------------------
  // Charts data generation (responsive to selectedUser + dateFilter)
  // -----------------------

  // Bar chart: uses filteredActivities (already applies selectedUser + dateFilter)
  const appTotalsForChart = useMemo(() => {
    const totals = {};
    for (const a of filteredActivities) {
      const app = a.app_name || "Unknown";
      totals[app] = (totals[app] || 0) + getDurationSeconds(a);
    }
    return Object.entries(totals)
      .map(([app, duration]) => ({ app, duration }))
      .sort((x, y) => y.duration - x.duration)
      .slice(0, 10);
  }, [filteredActivities]);

  // Line chart: daily usage for a window determined by dateFilter.
  // If dateFilter === "All" we use ALL_CHART_DAYS; otherwise use the selected window.
  const dailyUsage = useMemo(() => {
    const daysWindow = dateFilter === "All" ? ALL_CHART_DAYS : dateFilterToDays(dateFilter);
    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - (daysWindow - 1));

    // create day keys
    const dayKeys = [];
    const daysMap = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      dayKeys.push(key);
      daysMap[key] = {};
    }

    // accumulate filtered by selectedUser and by window
    for (const a of Array.isArray(propActivities) ? propActivities : []) {
      const dateObj = getActDate(a);
      if (!dateObj) continue;
      if (dateObj < start || dateObj > end) continue;
      if (selectedUser !== "All" && (a.user_id || a.user) !== selectedUser) continue;
      const key = dateObj.toISOString().slice(0, 10);
      if (!(key in daysMap)) continue;
      const app = a.app_name || "Unknown";
      daysMap[key][app] = (daysMap[key][app] || 0) + getDurationSeconds(a);
    }

    // pick top 5 apps across this window
    const overallTotals = {};
    for (const key of Object.keys(daysMap)) {
      for (const [app, sec] of Object.entries(daysMap[key])) {
        overallTotals[app] = (overallTotals[app] || 0) + sec;
      }
    }
    const topApps = Object.entries(overallTotals).sort((a,b)=>b[1]-a[1]).slice(0,5).map(r=>r[0]);

    // build series rows
    return dayKeys.map(dateKey => {
      const row = { date: dateKey };
      for (const app of topApps) row[app] = daysMap[dateKey][app] || 0;
      return row;
    });
  }, [propActivities, selectedUser, dateFilter]);

  // -----------------------
  // Top cards (client fallback aggregator)
  // -----------------------
  const mostUsedWithTopUsers = (days, activitiesList) => {
    if (!Array.isArray(activitiesList) || activitiesList.length === 0) return null;
    const nowLocal = new Date();
    const startLocal = new Date(nowLocal);
    startLocal.setDate(nowLocal.getDate() - days);

    const appTotals = {};
    const appUserTotals = {};

    for (const a of activitiesList) {
      const d = getActDate(a);
      if (!d) continue;
      if (d < startLocal || d > nowLocal) continue;
      const app = a.app_name || a.app || "Unknown";
      const user = a.user_id != null ? String(a.user_id) : String(a.user || "unknown");
      const dur = getDurationSeconds(a);
      appTotals[app] = (appTotals[app] || 0) + dur;
      appUserTotals[app] = appUserTotals[app] || {};
      appUserTotals[app][user] = (appUserTotals[app][user] || 0) + dur;
    }

    let maxApp = null, maxDur = 0;
    for (const [app, total] of Object.entries(appTotals)) {
      if (total > maxDur) { maxDur = total; maxApp = app; }
    }
    if (!maxApp) return null;

    const usersSorted = Object.entries(appUserTotals[maxApp] || {})
      .map(([user, duration]) => ({ user, duration }))
      .sort((a,b)=>b.duration - a.duration);

    return { app: maxApp, duration: maxDur, topUsers: usersSorted.slice(0,10) };
  };

  // attempt server stats if available (non-blocking)
  const [weekStat, setWeekStat] = useState(null);
  const [monthStat, setMonthStat] = useState(null);
  const [sixMonthStat, setSixMonthStat] = useState(null);
  useEffect(() => {
    (async () => {
      const base = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, "") : "";
      if (!base) return;
      try {
        const wres = await fetch(`${base}/stats/most-used/?days=7`).catch(()=>null);
        const wt = wres ? await wres.text().catch(()=>"") : "";
        if (wres && wres.ok && wt.trim().startsWith("{")) {
          const w = JSON.parse(wt);
          if (w && w.app_name) setWeekStat({ app: w.app_name, duration: w.total_duration, topUsers: (w.top_users||[]).map(u=>({ user: u.user_id, duration: u.duration })) });
        }
        const mres = await fetch(`${base}/stats/most-used/?days=30`).catch(()=>null);
        const mt = mres ? await mres.text().catch(()=>"") : "";
        if (mres && mres.ok && mt.trim().startsWith("{")) {
          const m = JSON.parse(mt);
          if (m && m.app_name) setMonthStat({ app: m.app_name, duration: m.total_duration, topUsers: (m.top_users||[]).map(u=>({ user: u.user_id, duration: u.duration })) });
        }
        const sres = await fetch(`${base}/stats/most-used/?days=180`).catch(()=>null);
        const st = sres ? await sres.text().catch(()=>"") : "";
        if (sres && sres.ok && st.trim().startsWith("{")) {
          const s = JSON.parse(st);
          if (s && s.app_name) setSixMonthStat({ app: s.app_name, duration: s.total_duration, topUsers: (s.top_users||[]).map(u=>({ user: u.user_id, duration: u.duration })) });
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const weekTop = weekStat || mostUsedWithTopUsers(7, propActivities);
  const monthTop = monthStat || mostUsedWithTopUsers(30, propActivities);
  const sixMonthTop = sixMonthStat || mostUsedWithTopUsers(180, propActivities);

  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map(v => String(v).padStart(2, "0")).join(":");
  };

  // -----------------------
  // Rendering helpers
  // -----------------------
  const renderTopCard = (title, topData, label) => {
    if (!topData) {
      return (
        <div className="top-card">
          <div className="top-title">{title}</div>
          <div className="top-app muted">—</div>
          <div className="top-meta muted small">No data</div>
        </div>
      );
    }

    return (
      <div className="top-card">
        <div className="top-title">{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div className="top-app">{topData.app}</div>
          <div className="top-meta muted small">{label} • {formatDuration(Math.round(topData.duration || 0))}</div>
        </div>

        <hr className="top-divider" />
        <div className="top-users-heading">Top users</div>

        <div className="top-card-users">
          {topData.topUsers && topData.topUsers.length > 0 ? (
            topData.topUsers.map((u, i) => {
              const badgeText = i === 0 ? "👑" : `${i + 1}`;
              let badgeClass = "user-badge";
              if (i === 0) badgeClass += " crown-badge";
              else if (i === 1) badgeClass += " silver-badge";
              else if (i === 2) badgeClass += " bronze-badge";

              const pct = topData.duration > 0 ? Math.round((u.duration / topData.duration) * 100) : 0;
              const pctClamped = Math.max(0, Math.min(100, pct));

              return (
                <div key={u.user + i} className={`user-row-wrapper ${i === 0 ? "top-user-highlight" : ""}`}>
                  <div className="user-row">
                    <span className={badgeClass}>{badgeText}</span>
                    <span className="user-name">{u.user}</span>
                    <span className="user-duration">{formatDuration(Math.round(u.duration || 0))}</span>
                  </div>

                  <div className="user-progress-row">
                    <div className="progress-bar" aria-hidden>
                      <div className="progress-bar-fill" style={{ width: `${pctClamped}%` }} />
                    </div>
                    <div className="progress-percent">{pctClamped}%</div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="muted small">No users</div>
          )}
        </div>
      </div>
    );
  };

  // -----------------------
  // Render
  // -----------------------
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
              {users.map((u, i) => <option value={u} key={u + i}>{u}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tiny">Date</span>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="filter-select">
              <option value="All">All (charts show last {ALL_CHART_DAYS} days)</option>
              <option value="Today">Today</option>
              <option value="LastMonth">Last Month</option>
              <option value="Last6Months">Last 6 Months</option>
            </select>
          </label>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div className="sub-pill">Rows: <strong>{sortedActivities.length}</strong></div>
          <div className="sub-pill">Duration: <strong>{formatDuration(totalDuration)}</strong></div>
          {lastUpdated && <div className="muted small">Updated {lastUpdated.toLocaleTimeString()}</div>}
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Bar chart */}
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
                  <Legend />
                  <Bar dataKey="duration" name="Duration (s)">
                    {appTotalsForChart.map((entry) => (
                      <Cell key={entry.app} fill={colorMap[entry.app] || COLOR_PALETTE[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Line chart */}
        <div style={{ flex: "1 1 520px", minWidth: 320 }}>
          <div className="dashboard-card" style={{ padding: 12 }}>
            <h3 className="dashboard-title" style={{ margin: 0, marginBottom: 8 }}>Daily Usage Trend</h3>
            {dailyUsage.length === 0 || Object.keys(dailyUsage[0] || {}).length <= 1 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>No daily trend data available for the selected filters.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => v >= 3600 ? `${Math.round(v/3600)}h` : `${Math.round(v/60)}m`} />
                  <Tooltip formatter={(v) => formatDuration(v)} />
                  <Legend />
                  {dailyUsage.length > 0 && Object.keys(dailyUsage[0]).filter(k => k !== "date").map((app, idx) => (
                    <Line key={app} type="monotone" dataKey={app} stroke={colorMap[app] || COLOR_PALETTE[idx % COLOR_PALETTE.length]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Activity Overview table */}
      <section className="dashboard-card" style={{ marginTop: 12 }}>
        <div className="table-wrap" style={{ marginTop: 6 }}>
          <table className="activity-table enhanced">
            <thead>
              <tr>
                <th onClick={() => requestSort("app_name")}>App {getSortIndicator("app_name")}</th>
                <th onClick={() => requestSort("window_title")}>Window Title {getSortIndicator("window_title")}</th>
                <th onClick={() => requestSort("duration")}>Duration {getSortIndicator("duration")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length === 0 && (
                <tr className="empty-row"><td colSpan="3" className="empty-cell">No activities found — try different filters.</td></tr>
              )}

              {sortedActivities.map((act, idx) => (
                <tr key={act.id || act.timestamp || idx}>
                  <td className="mono">{act.app_name || act.app || act.appName}</td>
                  <td>{act.window_title}</td>
                  <td className="mono">{formatDuration(getDurationSeconds(act))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AppTrackerDashboard;
