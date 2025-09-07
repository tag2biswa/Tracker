// /src/AppTrackerDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";

/**
 * Robust AppTrackerDashboard:
 *  - avoids crashes when fetch returns HTML (not JSON)
 *  - guards against non-array activities
 *  - friendly console diagnostics
 *
 * If your backend runs on a separate port, set window.API_BASE = "http://localhost:8000"
 * before this component mounts (or change API_BASE below).
 */

const API_BASE = (window && window.API_BASE) ? window.API_BASE.replace(/\/$/, "") : ""; // default: same origin

function AppTrackerDashboard({ activities: propActivities = [] }) {
  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // server stats
  const [weekStat, setWeekStat] = useState(null);
  const [monthStat, setMonthStat] = useState(null);
  const [sixMonthStat, setSixMonthStat] = useState(null);

  useEffect(() => {
    if (Array.isArray(propActivities)) setLastUpdated(new Date());
  }, [propActivities]);

  // -----------------------
  // Helpers (robust)
  // -----------------------
  const getActDate = (a) => {
    if (!a) return null;
    const candidates = [
      a.timestamp, a.start_time, a.created_at, a.activity_date, a.date, a.time, a.ts, a.time_ms, a.time_seconds
    ];
    for (const val of candidates) {
      if (val === undefined || val === null) continue;
      // numeric epoch
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

  // -----------------------
  // Defensive client aggregator
  // -----------------------
  const mostUsedWithTopUsers = (days, activitiesList) => {
    if (!Array.isArray(activitiesList) || activitiesList.length === 0) return null;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - days);

    const appTotals = {};
    const appUserTotals = {};

    for (const a of activitiesList) {
      const d = getActDate(a);
      if (!d) continue;
      if (d < start || d > now) continue;
      const app = a.app_name || a.app || a.appName || "Unknown";
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
      .sort((a, b) => b.duration - a.duration);

    return { app: maxApp, duration: maxDur, topUsers: usersSorted.slice(0, 10) };
  };

  // -----------------------
  // Safe fetch helper (avoid uncaught JSON parse errors)
  // -----------------------
  async function safeFetchJson(url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      // quick check: if response is JSON-like (starts with { or [), parse it; otherwise warn & return null
      const trimmed = text.trim();
      const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");
      if (!res.ok) {
        console.warn(`safeFetchJson: non-OK response ${res.status} from ${url} — body starts with:`, trimmed.slice(0, 100));
        return null;
      }
      if (!isJson) {
        console.warn(`safeFetchJson: response from ${url} not JSON (starts with '${trimmed[0] || ""}'). Body snippet:`, trimmed.slice(0, 200));
        return null;
      }
      return JSON.parse(trimmed);
    } catch (err) {
      console.warn("safeFetchJson: fetch/parsing error for", url, err);
      return null;
    }
  }

  // -----------------------
  // Fetch stats endpoint (server); fallback to client aggregator if null
  // -----------------------
  async function fetchStat(days, setter) {
    const url = `${API_BASE}/stats/most-used/?days=${days}`;
    const data = await safeFetchJson(url);
    if (!data) {
      console.debug(`fetchStat: server data not available for days=${days}, will use client-side aggregation as fallback.`);
      setter(null);
      return;
    }
    // expected server shape: { app_name, total_duration, top_users: [{user_id, duration}, ...] }
    const topUsers = (data.top_users || []).map(u => ({ user: u.user_id, duration: u.duration }));
    setter({ app: data.app_name || data.app, duration: data.total_duration || data.totalDuration || 0, topUsers });
  }

  useEffect(() => {
    // attempt to fetch server stats; it's okay if it fails (client fallback will be used)
    fetchStat(7, setWeekStat);
    fetchStat(30, setMonthStat);
    fetchStat(180, setSixMonthStat);
  }, []);

  // client-side fallbacks
  const clientWeek = useMemo(() => mostUsedWithTopUsers(7, propActivities), [propActivities]);
  const clientMonth = useMemo(() => mostUsedWithTopUsers(30, propActivities), [propActivities]);
  const clientSixMonth = useMemo(() => mostUsedWithTopUsers(180, propActivities), [propActivities]);

  const weekTop = weekStat || clientWeek;
  const monthTop = monthStat || clientMonth;
  const sixMonthTop = sixMonthStat || clientSixMonth;

  // -----------------------
  // Debug: expose activities in console for inspection
  // -----------------------
  useEffect(() => {
    try {
      window.__ACTIVITIES__ = Array.isArray(propActivities) ? propActivities : [];
      console.debug("Dashboard: activities count =", window.__ACTIVITIES__.length);
      if (window.__ACTIVITIES__.length > 0) {
        console.debug("Dashboard: sample rows:", window.__ACTIVITIES__.slice(0,6));
      }
    } catch (e) {
      console.warn("Dashboard: debug expose failed", e);
    }
  }, [propActivities]);

  // -----------------------
  // Table filtering / sorting (unchanged but defensive)
  // -----------------------
  const users = ["All", ...new Set((Array.isArray(propActivities) ? propActivities : []).map(a => a.user_id || a.user || "unknown"))];

  const now = new Date();
  let dateFilteredActivities = Array.isArray(propActivities) ? [...propActivities] : [];

  if (dateFilter === "Today") {
    dateFilteredActivities = dateFilteredActivities.filter(a => {
      const d = getActDate(a); if (!d) return false;
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (dateFilter === "LastMonth") {
    const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);
    dateFilteredActivities = dateFilteredActivities.filter(a => { const d = getActDate(a); return d && d >= lastMonth && d <= now; });
  } else if (dateFilter === "Last6Months") {
    const last6 = new Date(now); last6.setMonth(now.getMonth() - 6);
    dateFilteredActivities = dateFilteredActivities.filter(a => { const d = getActDate(a); return d && d >= last6 && d <= now; });
  }

  const filteredActivities = selectedUser === "All" ? dateFilteredActivities : dateFilteredActivities.filter(a => (a.user_id || a.user) === selectedUser);

  const sortedActivities = [...filteredActivities].sort((a,b) => {
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
  const totalDuration = sortedActivities.reduce((s,a) => s + getDurationSeconds(a), 0);

  // small format util
  const formatDuration = seconds => {
    const sec = Number(seconds) || 0;
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec % 60;
    return [h,m,s].map(v => String(v).padStart(2,'0')).join(':');
  };

  // top card renderer (same visual as before)
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
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
          <div className="top-app">{topData.app}</div>
          <div className="top-meta muted small">{label} • {formatDuration(Math.round(topData.duration || 0))}</div>
        </div>

        <hr className="top-divider" />
        <div className="top-users-heading">Top users</div>

        <div className="top-card-users">
          {topData.topUsers && topData.topUsers.length > 0 ? (
            topData.topUsers.map((u,i) => {
              const badgeText = i === 0 ? "👑" : `${i+1}`;
              let badgeClass = "user-badge";
              if (i === 0) badgeClass += " crown-badge";
              else if (i === 1) badgeClass += " silver-badge";
              else if (i === 2) badgeClass += " bronze-badge";

              const pct = topData.duration > 0 ? Math.round((u.duration / topData.duration) * 100) : 0;
              const pctClamped = Math.max(0, Math.min(100, pct));

              return (
                <div key={u.user + i} className={`user-row-wrapper ${i===0 ? 'top-user-highlight' : ''}`}>
                  <div className="user-row">
                    <span className={badgeClass}>{badgeText}</span>
                    <span className="user-name">{u.user}</span>
                    <span className="user-duration">{formatDuration(Math.round(u.duration || 0))}</span>
                  </div>
                  <div className="user-progress-row">
                    <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${pctClamped}%`}}/></div>
                    <div className="progress-percent">{pctClamped}%</div>
                  </div>
                </div>
              );
            })
          ) : <div className="muted small">No users</div>}
        </div>
      </div>
    );
  };

  // -----------------------
  // Render
  // -----------------------
  return (
    <div className="dashboard-wrapper">
      <div className="top-cards-row">
        {renderTopCard("Most used — 7 days", weekTop, "7 days")}
        {renderTopCard("Most used — 30 days", monthTop, "30 days")}
        {renderTopCard("Most used — 180 days", sixMonthTop, "180 days")}
      </div>

      <section className="dashboard-card" style={{marginTop:12}}>
        <div className="dashboard-header">
          <div>
            <h3 className="dashboard-title">Activity Overview</h3>
            <div className="dashboard-sub">
              <span className="sub-pill">Total: <strong>{sortedActivities.length}</strong></span>
              <span className="sub-pill muted">Duration: <strong>{formatDuration(totalDuration)}</strong></span>
              {lastUpdated && <span className="muted small">Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
          </div>

          <div className="filters-compact">
            <label className="filter-label">
              <span className="tiny">User</span>
              <select value={selectedUser} onChange={(e)=>setSelectedUser(e.target.value)} className="filter-select">
                {users.map((u,i)=> <option value={u} key={u+i}>{u}</option>)}
              </select>
            </label>

            <label className="filter-label">
              <span className="tiny">Date</span>
              <select value={dateFilter} onChange={(e)=>setDateFilter(e.target.value)} className="filter-select">
                <option value="All">All</option>
                <option value="Today">Today</option>
                <option value="LastMonth">Last Month</option>
                <option value="Last6Months">Last 6 Months</option>
              </select>
            </label>
          </div>
        </div>

        <div className="table-wrap">
          <table className="activity-table enhanced">
            <thead>
              <tr>
                <th onClick={()=>requestSort("app_name")}>App {getSortIndicator("app_name")}</th>
                <th onClick={()=>requestSort("window_title")}>Window Title {getSortIndicator("window_title")}</th>
                <th onClick={()=>requestSort("duration")}>Duration {getSortIndicator("duration")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length === 0 && (
                <tr className="empty-row"><td colSpan="3">No activities found — try different filters.</td></tr>
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
