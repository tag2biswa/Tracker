// /src/AppTrackerDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";

/**
 * AppTrackerDashboard.jsx
 * - Left panel (dashboard + top summary cards)
 * - Shows top app per window (7d, 30d, 180d) and top users for that app
 * - Adds progress bars showing each top user's share of the app's total duration
 */
function AppTrackerDashboard({ activities: propActivities = [] }) {
  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    if (propActivities && propActivities.length >= 0) setLastUpdated(new Date());
  }, [propActivities]);

  // --- Helper: parse date from common fields ---
  const getActDate = (a) => {
    if (!a) return null;
    const possible = ["timestamp", "start_time", "created_at", "date", "time"];
    for (const key of possible) {
      if (a[key]) {
        const d = new Date(a[key]);
        if (!isNaN(d)) return d;
      }
    }
    if (a.time_ms) {
      const d = new Date(Number(a.time_ms));
      if (!isNaN(d)) return d;
    }
    return null;
  };

  // --- Helper: format seconds -> HH:MM:SS ---
  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  };

  // --- Compute most-used app + top users for given days window ---
  const mostUsedWithTopUsers = (days, activitiesList) => {
    if (!activitiesList || activitiesList.length === 0) return null;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - days);

    const appTotals = {};
    const appUserTotals = {};

    for (const a of activitiesList) {
      const d = getActDate(a);
      if (!d) continue;
      if (d < start || d > now) continue;
      const app = a.app_name || "Unknown";
      const dur = Number(a.duration) || 0;
      appTotals[app] = (appTotals[app] || 0) + dur;
      if (!appUserTotals[app]) appUserTotals[app] = {};
      const user = a.user_id != null ? String(a.user_id) : "unknown";
      appUserTotals[app][user] = (appUserTotals[app][user] || 0) + dur;
    }

    let maxApp = null;
    let maxDur = 0;
    for (const [app, total] of Object.entries(appTotals)) {
      if (total > maxDur) {
        maxDur = total;
        maxApp = app;
      }
    }
    if (!maxApp) return null;

    const userTotals = appUserTotals[maxApp] || {};
    // create array sorted by duration desc
    const usersSorted = Object.entries(userTotals)
      .map(([user, dur]) => ({ user, duration: dur }))
      .sort((x, y) => y.duration - x.duration);

    // topUsers (we'll include up to 5 here; UI shows top 3 but having more is ok)
    const topUsers = usersSorted.slice(0, 5);

    return { app: maxApp, duration: maxDur, topUsers };
  };

  // memoize heavy calcs
  const { weekTop, monthTop, sixMonthTop } = useMemo(() => {
    return {
      weekTop: mostUsedWithTopUsers(7, propActivities),
      monthTop: mostUsedWithTopUsers(30, propActivities),
      sixMonthTop: mostUsedWithTopUsers(180, propActivities),
    };
  }, [propActivities]);

  // --- Filtering + sorting for table ---
  const users = ["All", ...new Set((propActivities || []).map((a) => a.user_id || "unknown"))];

  const now = new Date();
  let dateFilteredActivities = [...(propActivities || [])];

  if (dateFilter === "Today") {
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a);
      if (!d) return false;
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  } else if (dateFilter === "LastMonth") {
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a);
      if (!d) return false;
      return d >= lastMonth && d <= now;
    });
  } else if (dateFilter === "Last6Months") {
    const last6 = new Date(now);
    last6.setMonth(now.getMonth() - 6);
    dateFilteredActivities = dateFilteredActivities.filter((a) => {
      const d = getActDate(a);
      if (!d) return false;
      return d >= last6 && d <= now;
    });
  }

  const filteredActivities =
    selectedUser === "All" ? dateFilteredActivities : dateFilteredActivities.filter((a) => a.user_id === selectedUser);

  const sortedActivities = [...filteredActivities].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const va = a[sortConfig.key];
    const vb = b[sortConfig.key];
    if (typeof va === "string") return sortConfig.direction === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    return sortConfig.direction === "asc" ? va - vb : vb - va;
  });

  const requestSort = (key) => {
    let dir = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") dir = "desc";
    setSortConfig({ key, direction: dir });
  };

  const getSortIndicator = (key) => (sortConfig.key !== key ? "↕" : sortConfig.direction === "asc" ? "↑" : "↓");

  const totalDuration = sortedActivities.reduce((s, a) => s + (Number(a.duration) || 0), 0);

  // --- Top card renderer (with divider, heading, badges, podium, and progress bars) ---
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
          <div className="top-meta muted small">{label} • {formatDuration(Math.round(topData.duration))}</div>
        </div>

        <hr className="top-divider" />
        <div className="top-users-heading">Top users</div>

        <div className="top-card-users">
          {topData.topUsers && topData.topUsers.length > 0 ? (
            topData.topUsers.map((u, i) => {
              // badge and color classes
              const badgeText = i === 0 ? "👑" : `${i + 1}`;
              let badgeClass = "user-badge";
              if (i === 0) badgeClass += " crown-badge";
              else if (i === 1) badgeClass += " silver-badge";
              else if (i === 2) badgeClass += " bronze-badge";

              // percent share of app total
              const pct = topData.duration > 0 ? Math.round((u.duration / topData.duration) * 100) : 0;
              // small safety clamp
              const pctClamped = Math.max(0, Math.min(100, pct));

              return (
                <div key={u.user + i} className={`user-row-wrapper ${i === 0 ? "top-user-highlight" : ""}`}>
                  <div className="user-row">
                    <span className={badgeClass}>{badgeText}</span>
                    <span className="user-name">{u.user}</span>
                    <span className="user-duration">{formatDuration(Math.round(u.duration))}</span>
                  </div>

                  {/* progress bar + percent */}
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

  return (
    <div className="dashboard-wrapper">
      <div className="top-cards-row">
        {renderTopCard("Most used — 7 days", weekTop, "7 days")}
        {renderTopCard("Most used — 30 days", monthTop, "30 days")}
        {renderTopCard("Most used — 180 days", sixMonthTop, "180 days")}
      </div>

      <section className="dashboard-card" style={{ marginTop: 12 }}>
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
              <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="filter-select">
                {users.map((u, i) => <option value={u} key={u + i}>{u}</option>)}
              </select>
            </label>

            <label className="filter-label">
              <span className="tiny">Date</span>
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="filter-select">
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
                  <td className="mono">{act.app_name}</td>
                  <td>{act.window_title}</td>
                  <td className="mono">{formatDuration(act.duration)}</td>
                </tr>
              ))}

              {sortedActivities.length > 0 && (
                <tr className="total-row">
                  <td colSpan="2" style={{ textAlign: "right" }}>Total</td>
                  <td className="mono">{formatDuration(totalDuration)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AppTrackerDashboard;
