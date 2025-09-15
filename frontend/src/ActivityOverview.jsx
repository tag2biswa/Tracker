// src/ActivityOverview.jsx
import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from "react";
import "./ActivityOverview.css";

/**
 * ActivityOverview — grouped by app, clickable header to expand/collapse,
 * - animated staggered subrow fade-in
 * - avatars for users (initials), collapsed user lists with "+N" and tooltip
 * - responsive table with no horizontal scroll (table-layout: fixed, truncation)
 *
 * Keep previous behaviors: debounced search, grouping, highlight, keyboard accessible.
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

function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ActivityOverview({ activities: propActivities }) {
  const [internalActivities, setInternalActivities] = useState(Array.isArray(propActivities) ? propActivities : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [selectedUser, setSelectedUser] = useState("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "desc" });

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // DEFAULT: collapsed
  const [expandedApps, setExpandedApps] = useState(new Set());

  // refs to measure content
  const contentRefs = useRef(new Map());
  const measuredHeights = useRef(new Map());

  // debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // responsive
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

  // load activities
  useEffect(() => {
    let aborted = false;
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
          const txt = await res.text();
          throw new Error(`${res.status} ${res.statusText} ${txt}`);
        }
        const data = await res.json();
        if (!aborted) setInternalActivities(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!aborted) { setError(String(err)); setInternalActivities([]); }
      } finally { if (!aborted) setLoading(false); }
    }
    load();
    return () => { aborted = true; };
  }, [propActivities]);

  // helpers
  const safeStr = (v) => (v === undefined || v === null) ? "" : String(v);

  const getActDate = (a) => {
    if (!a) return null;
    const candidates = [a.activity_date, a.date, a.timestamp, a.ts, a.created_at];
    for (const val of candidates) {
      if (val === undefined || val === null) continue;
      const s = String(val);
      const d = new Date(s);
      if (!isNaN(d)) return d;
    }
    return null;
  };

  const getDurationSeconds = (a) => {
    if (!a) return 0;
    const maybe = a.duration ?? a.seconds ?? a.time ?? 0;
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

  const highlightNodes = (text = "", q = "") => {
    const nq = (q || "").toLowerCase();
    if (!nq) return text;
    const s = String(text || "");
    const lc = s.toLowerCase();
    if (!lc.includes(nq)) return s;
    const nodes = [];
    let last = 0; let idx = lc.indexOf(nq, last); let k = 0;
    while (idx !== -1) {
      if (idx > last) nodes.push(s.slice(last, idx));
      nodes.push(<mark key={k++} className="highlight">{s.slice(idx, idx + nq.length)}</mark>);
      last = idx + nq.length;
      idx = lc.indexOf(nq, last);
    }
    if (last < s.length) nodes.push(s.slice(last));
    return nodes;
  };

  // filters pipeline
  const users = useMemo(() => {
    const s = new Set();
    for (const a of internalActivities) s.add(safeStr(a.user_id ?? a.user ?? "unknown"));
    return ["All", ...Array.from(s)];
  }, [internalActivities]);

  const now = new Date();
  const dateFiltered = useMemo(() => {
    let arr = Array.isArray(internalActivities) ? [...internalActivities] : [];
    if (dateFilter === "Today") {
      arr = arr.filter(a => { const d = getActDate(a); if (!d) return false; return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate(); });
    } else if (dateFilter === "LastMonth") {
      const start = new Date(now); start.setMonth(now.getMonth()-1);
      arr = arr.filter(a => { const d = getActDate(a); return d && d >= start && d <= now; });
    } else if (dateFilter === "Last6Months") {
      const start = new Date(now); start.setMonth(now.getMonth()-6);
      arr = arr.filter(a => { const d = getActDate(a); return d && d >= start && d <= now; });
    }
    return arr;
  }, [internalActivities, dateFilter]);

  const userFiltered = useMemo(() => {
    if (selectedUser === "All") return dateFiltered;
    return dateFiltered.filter(a => String(a.user_id ?? a.user ?? "") === String(selectedUser));
  }, [dateFiltered, selectedUser]);

  const q = (debouncedQuery || "").toLowerCase();
  const searched = useMemo(() => {
    if (!q) return userFiltered;
    return userFiltered.filter(a => {
      const app = (a.app_name ?? a.app ?? "").toLowerCase();
      const title = (a.window_title ?? a.windowTitle ?? "").toLowerCase();
      const extra = (a.extra?.notes ?? a.notes ?? "").toLowerCase();
      return app.includes(q) || title.includes(q) || extra.includes(q);
    });
  }, [userFiltered, q]);

  // sorting
  const sortedActivities = useMemo(() => {
    const arr = [...searched];
    if (!sortConfig.key) {
      arr.sort((a,b) => {
        const ta = getActDate(a)?.getTime() ?? 0;
        const tb = getActDate(b)?.getTime() ?? 0;
        if (tb !== ta) return tb - ta;
        return (b.duration ?? 0) - (a.duration ?? 0);
      });
      return arr;
    }
    const key = sortConfig.key; const dir = sortConfig.direction === "asc" ? 1 : -1;
    if (key === "activity_date" || key === "date" || key === "timestamp") {
      arr.sort((a,b) => ((getActDate(a)?.getTime() ?? 0) - (getActDate(b)?.getTime() ?? 0)) * dir);
      return arr;
    }
    arr.sort((a,b) => {
      const va = a[key] ?? ""; const vb = b[key] ?? "";
      if (typeof va === "string") return va.localeCompare(vb) * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [searched, sortConfig]);

  const requestSort = (key) => {
    setSortConfig(prev => prev.key === key ? { key, direction: prev.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  };
  const getSortIndicator = (k) => (sortConfig.key !== k ? "↕" : (sortConfig.direction === "asc" ? "↑" : "↓"));

  // grouping and collect users per window
  const groupedByApp = useMemo(() => {
    const map = new Map();
    for (const a of sortedActivities) {
      const app = safeStr(a.app_name ?? a.app ?? "Unknown");
      const window = safeStr(a.window_title ?? a.windowTitle ?? "—");
      const date = getActDate(a);
      const duration = getDurationSeconds(a);
      const user = safeStr(a.user_id ?? a.user ?? "unknown");

      if (!map.has(app)) map.set(app, { appName: app, totalDuration: 0, windows: new Map() });
      const appEntry = map.get(app);
      appEntry.totalDuration += duration;

      if (!appEntry.windows.has(window)) {
        appEntry.windows.set(window, { title: window, totalDuration: 0, lastSeen: date, users: new Set() });
      }
      const winEntry = appEntry.windows.get(window);
      winEntry.totalDuration += duration;
      if (!winEntry.lastSeen || (date && date > winEntry.lastSeen)) winEntry.lastSeen = date;
      if (user) winEntry.users.add(user);
    }

    const out = [];
    for (const [appName, data] of map.entries()) {
      const windows = Array.from(data.windows.values()).map(w => {
        const usersArr = Array.from(w.users || new Set()).filter(Boolean);
        return { title: w.title, totalDuration: w.totalDuration, lastSeen: w.lastSeen, users: usersArr };
      }).sort((x,y) => y.totalDuration - x.totalDuration);
      out.push({ appName: data.appName, totalDuration: data.totalDuration, windows });
    }
    out.sort((a,b) => b.totalDuration - a.totalDuration);
    return out;
  }, [sortedActivities]);

  const totalDurationAll = useMemo(() => groupedByApp.reduce((s, app) => s + (app.totalDuration || 0), 0), [groupedByApp]);

  const appList = useMemo(() => {
    const s = new Set();
    for (const a of internalActivities) s.add(safeStr(a.app_name ?? a.app ?? "Unknown"));
    return Array.from(s);
  }, [internalActivities]);

  const colorMap = useMemo(() => {
    const m = {};
    for (const app of appList) m[app] = COLOR_PALETTE[hashStringToIndex(app, COLOR_PALETTE.length)];
    return m;
  }, [appList]);

  // measure heights
  useLayoutEffect(() => {
    for (const g of groupedByApp) {
      const node = contentRefs.current.get(g.appName);
      if (node) measuredHeights.current.set(g.appName, node.scrollHeight);
      else measuredHeights.current.set(g.appName, 0);
    }
  }, [groupedByApp, isMobile]);

  // toggles
  const toggleApp = (appName) => {
    setExpandedApps(prev => {
      const next = new Set(prev);
      if (next.has(appName)) next.delete(appName);
      else next.add(appName);
      return next;
    });
  };
  const expandAll = () => setExpandedApps(new Set(groupedByApp.map(g => g.appName)));
  const collapseAll = () => setExpandedApps(new Set());

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE.replace(/\/+$/,'')}/activity-logs/`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setInternalActivities(Array.isArray(data) ? data : []);
    } catch (err) { setError(String(err)); } finally { setLoading(false); }
  };

  const clearSearch = () => setSearchQuery("");

  const onKeyToggle = (e, appName) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleApp(appName);
    }
  };

  // container style with padding/margin reduction when collapsed
  const getContainerStyle = (appName, expanded) => {
    const measured = measuredHeights.current.get(appName) || 0;
    const max = expanded ? measured + 12 : 0;
    return {
      maxHeight: `${max}px`,
      transition: "max-height 320ms cubic-bezier(.2,.9,.2,1), opacity 240ms ease, padding 220ms ease, margin 220ms ease",
      opacity: expanded ? 1 : 0,
      overflow: "hidden",
      padding: expanded ? "10px 14px" : "0 14px",
      margin: expanded ? "8px 12px 12px 12px" : "0"
    };
  };

  // helper to render avatars and collapsed list
  const renderUsersInline = (usersArr) => {
    const maxShow = 2;
    const shown = usersArr.slice(0, maxShow);
    const remaining = Math.max(0, usersArr.length - maxShow);
    const remainingNames = usersArr.slice(maxShow).join(", ");
    return (
      <div className="users-inline" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {shown.map((u, i) => (
            <div key={u + "_" + i} className="avatar" title={u} style={{ background: COLOR_PALETTE[hashStringToIndex(u, COLOR_PALETTE.length)] }}>
              {initials(u)}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {usersArr.length === 0 ? "" : (
            remaining > 0 ? (
              <span title={remainingNames}>{shown.join(", ")} +{remaining}</span>
            ) : (
              <span>{shown.join(", ")}</span>
            )
          )}
        </div>
      </div>
    );
  };

  // FilterBar same order as requested
  const FilterBar = () => (
    <div className="ao-filterbar" aria-label="Filters">
      <div className="ao-filter-item">
        <label className="ao-filter-label">User</label>
        <select className="ao-filter-select" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
          {users.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div className="ao-filter-item">
        <label className="ao-filter-label">Date</label>
        <select className="ao-filter-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="All">All</option>
          <option value="Today">Today</option>
          <option value="LastMonth">Last Month</option>
          <option value="Last6Months">Last 6 Months</option>
        </select>
      </div>

      <div className="ao-filter-item">
        <label className="ao-filter-label">App</label>
        <select className="ao-filter-select" onChange={(e) => {
          const v = e.target.value;
          if (v === "All") { refresh(); return; }
          const filtered = (internalActivities || []).filter(it => (it.app_name ?? it.app) === v);
          setInternalActivities(filtered);
        }}>
          <option value="All">All</option>
          {appList.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="ao-filter-item ao-filter-search" role="search" aria-label="Search activities">
        <label className="ao-filter-label" style={{ visibility: "hidden", height: 0 }}>Search</label>
        <input
          className="ao-search-input"
          placeholder="Search app, window title, notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") clearSearch(); }}
        />
        {searchQuery ? <button className="ao-clear" onClick={clearSearch} aria-label="Clear search">✕</button> : null}
      </div>

      <div className="ao-filter-actions" role="toolbar" aria-label="Actions">
        <button className="ao-action-btn" onClick={expandAll} title="Expand all">Expand all</button>
        <button className="ao-action-btn" onClick={collapseAll} title="Collapse all">Collapse all</button>
        <button className="ao-action-btn primary" onClick={refresh} title="Refresh">{loading ? "Refreshing..." : "Refresh"}</button>
      </div>
    </div>
  );

  return (
    <section className="ao-card" style={{ marginTop: 12 }}>
      <div className="ao-header" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div className="ao-top" style={{ alignItems: "center" }}>
            <div className="ao-pulse" style={{ background: groupedByApp.length ? colorMap[groupedByApp[0].appName] || COLOR_PALETTE[0] : "#9CA3AF" }}>
              {groupedByApp.length ? (groupedByApp[0].appName[0] || "A").toUpperCase() : "—"}
            </div>
            <div>
              <h3 className="ao-title">Activity Overview</h3>
              <div className="ao-sub" style={{ marginTop: 4 }}>
                <span style={{ marginRight: 12 }}>Apps: <strong>{groupedByApp.length}</strong></span>
                <span>Total duration: <strong>{formatDuration(totalDurationAll)}</strong></span>
              </div>
            </div>
          </div>

          <FilterBar />
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 12 }}>
        {isMobile ? (
          <div className="ao-card-list">
            {groupedByApp.length === 0 ? (
              <div className="ao-empty">{loading ? "Loading…" : (error ? `Error: ${error}` : "No activities")}</div>
            ) : groupedByApp.map((app, ai) => {
              const expanded = expandedApps.has(app.appName);
              return (
                <div key={app.appName + "_" + ai} className="ao-activity-card" style={{ flexDirection: "column", gap: 8 }}>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={expanded}
                    onClick={() => toggleApp(app.appName)}
                    onKeyDown={(e) => onKeyToggle(e, app.appName)}
                    className="app-header-clickable"
                  >
                    <div style={{ width: 44 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: colorMap[app.appName] || COLOR_PALETTE[0], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800 }}>
                        {app.appName[0] ? app.appName[0].toUpperCase() : "A"}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{highlightNodes(app.appName, q)}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontWeight: 800 }}>{formatDuration(app.totalDuration)}</div>
                          <div className={`caret ${expanded ? "rotated" : ""}`} aria-hidden>{expanded ? "▾" : "▸"}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, color: "#475569", fontSize: 13 }}>{app.windows.length} window(s)</div>
                    </div>
                  </div>

                  <div
                    ref={(node) => { if (node) contentRefs.current.set(app.appName, node); }}
                    className="subrows-container"
                    style={getContainerStyle(app.appName, expanded)}
                  >
                    <div className="subrows-inner">
                      {app.windows.map((w, wi) => {
                        const delayMs = wi * 50;
                        return (
                          <div
                            key={w.title + "_" + wi}
                            className={`subrow ${expanded ? "animated" : ""}`}
                            style={expanded ? { animationDelay: `${delayMs}ms` } : {}}
                          >
                            <div className="subrow-left">
                              <div className="subrow-title">{highlightNodes(w.title, q)}</div>
                              <div className="subrow-meta">
                                {w.lastSeen ? new Date(w.lastSeen).toLocaleString() : "-"}
                                {w.users && w.users.length ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    • {renderUsersInline(w.users)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="subrow-right">{formatDuration(w.totalDuration)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop table: responsive, no horizontal scroll
          <table className="activity-table" role="table">
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "48%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th onClick={() => requestSort("app_name")}>App {getSortIndicator("app_name")}</th>
                <th onClick={() => requestSort("window_title")}>Window / Title {getSortIndicator("window_title")}</th>
                <th onClick={() => requestSort("activity_date")}>Last Seen {getSortIndicator("activity_date")}</th>
                <th style={{ textAlign: "right" }} onClick={() => requestSort("duration")}>Duration {getSortIndicator("duration")}</th>
              </tr>
            </thead>
            <tbody>
              {groupedByApp.length === 0 ? (
                <tr><td colSpan="4" className="ao-empty">{loading ? "Loading…" : (error ? `Error: ${error}` : "No activities found")}</td></tr>
              ) : groupedByApp.map((app, ai) => {
                const expanded = expandedApps.has(app.appName);
                return (
                  <React.Fragment key={app.appName + "_" + ai}>
                    <tr
                      className="app-header-row"
                      onClick={() => toggleApp(app.appName)}
                      onKeyDown={(e) => onKeyToggle(e, app.appName)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expanded}
                    >
                      <td colSpan={2} style={{ padding: "12px 12px", fontWeight: 800, fontSize: 15 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: colorMap[app.appName] || COLOR_PALETTE[0], display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800 }}>
                            {app.appName[0] ? app.appName[0].toUpperCase() : "A"}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="app-name-trunc">{highlightNodes(app.appName, q)}</div>
                            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{app.windows.length} window(s)</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ verticalAlign: "middle", fontSize: 13, color: "#475569" }}>App Total</td>
                      <td style={{ verticalAlign: "middle", textAlign: "right", fontFamily: "monospace", fontWeight: 800 }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                          <div>{formatDuration(app.totalDuration)}</div>
                          <div className={`caret ${expanded ? "rotated" : ""}`} aria-hidden>{expanded ? "▾" : "▸"}</div>
                        </div>
                      </td>
                    </tr>

                    {/* subrows wrapper row */}
                    <tr className="subrows-row">
                      <td colSpan={4} style={{ padding: 0, border: 0 }}>
                        <div
                          ref={(node) => { if (node) contentRefs.current.set(app.appName, node); }}
                          className="subrows-container"
                          style={getContainerStyle(app.appName, expanded)}
                        >
                          <div className="subrows-inner">
                            {app.windows.map((w, wi) => {
                              const delayMs = wi * 50;
                              return (
                                <div
                                  key={app.appName + "__" + w.title + "_" + wi}
                                  className={`subrow ${expanded ? "animated" : ""}`}
                                  style={expanded ? { animationDelay: `${delayMs}ms` } : {}}
                                >
                                  <div className="subrow-left">
                                    <div className="subrow-title">{highlightNodes(w.title, q)}</div>
                                    <div className="subrow-meta">
                                      {w.lastSeen ? new Date(w.lastSeen).toLocaleString() : "-"}
                                      {w.users && w.users.length ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                          • {renderUsersInline(w.users)}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="subrow-right">{formatDuration(w.totalDuration)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
