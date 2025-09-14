// src/ActivityOverview.jsx
import React, { useState, useMemo, useEffect } from "react";
import "./ActivityOverview.css";

/**
 * ActivityOverview
 * - Debounced search (300ms)
 * - Highlights matched text in table rows & mobile cards
 * - Styles moved to src/ActivityOverview.css
 *
 * Assumes backend at VITE_API_BASE or window.__API_BASE__ or http://localhost:8000
 */

const API_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : (window.__API_BASE__ || "http://localhost:8000");

const COLOR_PALETTE = [
  "#6C5CE7","#00B894","#0984E3","#FF7675","#FD79A8",
  "#F39C12","#00cec9","#e17055","#FAB1A0","#00bcd4"
];

function hashStringToIndex(s, mod) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < (s || "").length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return mod ? h % mod : 0;
}

export default function ActivityOverview({ activities: propActivities, initialUser = "All", initialDateFilter = "All" }) {
  // state
  const [internalActivities, setInternalActivities] = useState(Array.isArray(propActivities) ? propActivities : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState(initialUser);
  const [dateFilter, setDateFilter] = useState(initialDateFilter);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // search query state + debouncedQuery
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // debounce effect (300ms)
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // responsive mode (mobile -> card list)
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 720 : false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:720px)");
    const fn = (e) => setIsMobile(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", fn);
    else mq.addListener(fn);
    setIsMobile(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", fn);
      else mq.removeListener(fn);
    };
  }, []);

  // load data (use prop if provided; otherwise fetch)
  useEffect(() => {
    let abort = false;
    async function load() {
      if (Array.isArray(propActivities) && propActivities.length > 0) {
        setInternalActivities(propActivities);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE.replace(/\/+$/,'')}/activity-logs/`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`${res.status} ${res.statusText} - ${text}`);
        }
        const data = await res.json();
        if (!abort) setInternalActivities(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!abort) {
          setError(String(err));
          setInternalActivities([]);
        }
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, [propActivities]);

  // ---- helpers (date/duration/sorting/highlight) ----------
  const getActDate = (a) => {
    if (!a) return null;
    const candidates = [a.timestamp, a.activity_date, a.activityDate, a.date, a.time, a.ts, a.start_time, a.created_at];
    for (const val of candidates) {
      if (val === undefined || val === null) continue;
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

  const formatDuration = (seconds) => {
    const sec = Number(seconds) || 0;
    const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatDate = (a) => {
    const d = getActDate(a);
    if (!d) return "-";
    return d.toLocaleString();
  };

  // highlight matched substrings — returns string or array of nodes
  const highlightNodes = (text = "", q = "") => {
    const nq = (q || "").toLowerCase();
    if (!nq) return text;
    const s = String(text || "");
    const lc = s.toLowerCase();
    if (!lc.includes(nq)) return s;
    const nodes = [];
    let last = 0;
    let idx = lc.indexOf(nq, last);
    let key = 0;
    while (idx !== -1) {
      if (idx > last) nodes.push(s.slice(last, idx));
      nodes.push(<mark key={key++} className="highlight">{s.slice(idx, idx + nq.length)}</mark>);
      last = idx + nq.length;
      idx = lc.indexOf(nq, last);
    }
    if (last < s.length) nodes.push(s.slice(last));
    return nodes;
  };

  // ---- filters + sorting + search ----------
  const users = useMemo(() => {
    const set = new Set();
    for (const a of Array.isArray(internalActivities) ? internalActivities : []) {
      const u = a.user_id ?? a.user ?? "unknown";
      set.add(String(u));
    }
    return ["All", ...Array.from(set)];
  }, [internalActivities]);

  const now = new Date();
  let dateFilteredActivities = Array.isArray(internalActivities) ? [...internalActivities] : [];

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

  const userFiltered = selectedUser === "All"
    ? dateFilteredActivities
    : dateFilteredActivities.filter(a => String(a.user_id ?? a.user ?? "unknown") === String(selectedUser));

  // use debouncedQuery for searching
  const normalizedQuery = (debouncedQuery || "").trim().toLowerCase();
  const searched = useMemo(() => {
    if (!normalizedQuery) return userFiltered;
    return userFiltered.filter(a => {
      const app = String(a.app_name ?? a.app ?? "").toLowerCase();
      const title = String(a.window_title ?? a.windowTitle ?? "").toLowerCase();
      const extra = String(a.extra?.notes ?? a.notes ?? "").toLowerCase();
      return app.includes(normalizedQuery) || title.includes(normalizedQuery) || extra.includes(normalizedQuery);
    });
  }, [userFiltered, normalizedQuery]);

  // Sorting: support date sorting (uses parsed date)
  const sortedActivities = useMemo(() => {
    const arr = [...searched];
    if (!sortConfig.key) return arr;
    const key = sortConfig.key;
    const dir = sortConfig.direction === "asc" ? 1 : -1;
    if (key === "activity_date" || key === "date" || key === "timestamp") {
      arr.sort((a, b) => {
        const ta = getActDate(a)?.getTime() ?? 0;
        const tb = getActDate(b)?.getTime() ?? 0;
        return (ta - tb) * dir;
      });
      return arr;
    }
    arr.sort((a, b) => {
      const va = a[key] ?? "", vb = b[key] ?? "";
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [searched, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      return { key, direction: "asc" };
    });
  };
  const getSortIndicator = (k) => (sortConfig.key !== k ? "↕" : (sortConfig.direction === "asc" ? "↑" : "↓"));

  const totalDuration = useMemo(() => sortedActivities.reduce((s,a) => s + getDurationSeconds(a), 0), [sortedActivities]);

  // compute most-used app (for top badge)
  const mostUsed = useMemo(() => {
    const totals = {};
    for (const a of internalActivities) {
      const app = a.app_name ?? a.app ?? "Unknown";
      totals[app] = (totals[app] || 0) + getDurationSeconds(a);
    }
    const entries = Object.entries(totals).sort((x,y)=>y[1]-x[1]);
    if (entries.length === 0) return null;
    const [app, duration] = entries[0];
    return { app, duration, percent: Math.round((duration / Math.max(1, Object.values(totals).reduce((s,n)=>s+n,0))) * 100) };
  }, [internalActivities]);

  const appList = useMemo(() => {
    const s = new Set();
    for (const a of internalActivities) s.add(a.app_name ?? a.app ?? "Unknown");
    return Array.from(s);
  }, [internalActivities]);

  // color map
  const colorMap = useMemo(() => {
    const m = {};
    for (const app of appList) m[app] = COLOR_PALETTE[hashStringToIndex(app, COLOR_PALETTE.length)];
    return m;
  }, [appList]);

  // small refresh (manual)
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE.replace(/\/+$/,'')}/activity-logs/`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setInternalActivities(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  // clear search helper
  const clearSearch = () => setSearchQuery("");

  // ---- render ----
  return (
    <section className="ao-card" style={{ marginTop: 12 }}>
      <div className="ao-header">
        <div style={{ flex: 1 }}>
          <div className="ao-top">
            <div className="ao-pulse" style={{ background: mostUsed ? (colorMap[mostUsed.app] || COLOR_PALETTE[0]) : "#9CA3AF" }}>
              {mostUsed ? (mostUsed.app[0] || "A").toUpperCase() : "—"}
            </div>
            <div>
              <h3 className="ao-title">Activity Overview</h3>
              <div className="ao-sub" style={{ marginTop: 4 }}>
                <span style={{ marginRight: 12 }}>Rows: <strong>{sortedActivities.length}</strong></span>
                <span>Duration: <strong>{formatDuration(totalDuration)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginLeft: "auto" }}>
          <div className="ao-pill" title="Most used app">
            {mostUsed ? `${mostUsed.app} • ${mostUsed.percent}%` : "No usage"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={refresh} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "#111827", color: "white", cursor: "pointer" }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      {/* filters + search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 12, flexWrap: "wrap" }}>
        <div className="ao-filters">
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <small style={{ color: "#334155" }}>User</small>
            <select className="ao-filter-select" value={selectedUser} onChange={(e)=>setSelectedUser(e.target.value)}>
              {users.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <small style={{ color: "#334155" }}>Date</small>
            <select className="ao-filter-select" value={dateFilter} onChange={(e)=>setDateFilter(e.target.value)}>
              <option value="All">All</option>
              <option value="Today">Today</option>
              <option value="LastMonth">Last Month</option>
              <option value="Last6Months">Last 6 Months</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <small style={{ color: "#334155" }}>App</small>
            <select className="ao-filter-select" onChange={(e)=> {
              const v = e.target.value;
              if (v === "All") {
                refresh();
                return;
              }
              const filteredByApp = (internalActivities || []).filter(it => (it.app_name ?? it.app) === v);
              setInternalActivities(filteredByApp);
            }}>
              <option value="All">All</option>
              {appList.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="ao-search" role="search">
            <input
              placeholder="Search app, window title, notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") clearSearch(); }}
            />
            {searchQuery ? <button className="ao-clear" onClick={clearSearch} aria-label="Clear search">✕</button> : null}
          </div>

          <div style={{ marginLeft: 8, fontSize: 12, color: "#64748b" }}>{error ? <span style={{ color: "crimson" }}>{error}</span> : (loading ? "Loading…" : "Ready")}</div>
        </div>
      </div>

      {/* table or mobile cards */}
      <div className="table-wrap" style={{ marginTop: 12 }}>
        {isMobile ? (
          <div className="ao-card-list">
            {sortedActivities.length === 0 ? (
              <div className="ao-empty">{loading ? "Loading…" : (error ? `Error: ${error}` : "No activities")}</div>
            ) : sortedActivities.map((act, idx) => {
              const app = act.app_name ?? act.app ?? "Unknown";
              return (
                <div key={act.id ?? act.timestamp ?? idx} className="ao-activity-card">
                  <div style={{ width: 48 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: colorMap[app] || COLOR_PALETTE[0], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                      {app[0] ? app[0].toUpperCase() : "A"}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{/* highlight app */}{highlightNodes(app, normalizedQuery)}</div>
                      <div className="ao-duration">{formatDuration(getDurationSeconds(act))}</div>
                    </div>
                    <div style={{ marginTop: 6, color: "#475569" }}>{/* highlight window title */}{highlightNodes(act.window_title ?? act.windowTitle ?? "—", normalizedQuery)}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
                      { act.user_id ?? act.user ? `User: ${act.user_id ?? act.user}` : null }
                      { getActDate(act) ? ` • ${new Date(getActDate(act)).toLocaleString()}` : null }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="activity-table" role="table">
            <thead>
              <tr>
                <th style={{ width: "25%" }} onClick={() => requestSort("app_name")}>App {getSortIndicator("app_name")}</th>
                <th style={{ width: "40%" }} onClick={() => requestSort("window_title")}>Window / Title {getSortIndicator("window_title")}</th>
                <th style={{ width: "20%" }} onClick={() => requestSort("activity_date")}>Date {getSortIndicator("activity_date")}</th>
                <th style={{ width: "15%", textAlign: "right" }} onClick={() => requestSort("duration")}>Duration {getSortIndicator("duration")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedActivities.length === 0 ? (
                <tr><td colSpan="4" className="ao-empty">{loading ? "Loading…" : (error ? `Error: ${error}` : "No activities found")}</td></tr>
              ) : sortedActivities.map((act, idx) => {
                const app = act.app_name ?? act.app ?? "Unknown";
                return (
                  <tr key={act.id ?? act.timestamp ?? idx}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: colorMap[app] || COLOR_PALETTE[0], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700 }}>
                          {app[0] ? app[0].toUpperCase() : "A"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{/* highlight app */}{highlightNodes(app, normalizedQuery)}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{act.user_id ?? act.user ?? ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ color: "#0f172a", fontWeight: 600 }}>{/* highlight window/title */}{highlightNodes(act.window_title ?? act.windowTitle ?? "—", normalizedQuery)}</div>
                      <div style={{ fontSize: 12, color: "#475569", marginTop: 6, wordBreak: "break-word" }}>{/* highlight notes */}{highlightNodes((act.extra?.notes) ?? "", normalizedQuery)}</div>
                    </td>
                    <td style={{ verticalAlign: "middle" }}>{formatDate(act)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{formatDuration(getDurationSeconds(act))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
