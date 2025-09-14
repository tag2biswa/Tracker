// src/HomeDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { NavLink, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./HomeDashboard.css";
import App from "./App";
import ActivityOverview from "./ActivityOverview";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";

const NAV_ITEMS = [
  { id: "dashboard", to: "/dashboard", label: "Home Dashboard", icon: "home" },
  { id: "activities", to: "/activities", label: "Activity Overview", icon: "chart" },
  { id: "tracking-apps", to: "/tracking-apps", label: "Tracking Apps", icon: "apps" },
  { id: "settings", to: "/settings", label: "Settings", icon: "settings" },
  { id: "logout", to: "/logout", label: "Logout", icon: "logout" },
];

export default function HomeDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [refreshCounter, setRefreshCounter] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "d" && (e.ctrlKey || e.metaKey)) setCollapsed((s) => !s);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredItems = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter(i => i.label.toLowerCase().includes(q));
  }, [search]);

  const onNavClick = (id) => {
    if (id === "tracking-apps") setRefreshCounter(c => c + 1);
  };

  return (
    <div className={`home-dashboard theme-vibrant ${collapsed ? "collapsed" : ""}`}>
      <header className="top-banner" role="banner">
        <div className="banner-left" onClick={() => navigate("/dashboard")} tabIndex={0} role="link" aria-label="Go to Home Dashboard">
          <h1 className="banner-title">Home Dashboard</h1>
          <p className="banner-sub">Insights • Activity • Tracking</p>
        </div>

        <div className="banner-controls">
          <div className="search-mini" title="Search navigation">
            <svg viewBox="0 0 24 24" className="icon-search" aria-hidden><path d="M21 21l-4.35-4.35"></path><circle cx="11" cy="11" r="6"></circle></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search nav..."
              aria-label="Search navigation"
              className="banner-search"
            />
            {search && <button className="clear" onClick={() => setSearch("")} aria-label="Clear search">✕</button>}
          </div>

          <button
            className="toggle-drawer"
            onClick={() => setCollapsed(s => !s)}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "☰" : "▾"}
          </button>
        </div>
      </header>

      <aside className="drawer" aria-label="Primary navigation">
        <nav className="drawer-nav" role="navigation" aria-label="Main">
          <ul>
            {filteredItems.map(item => (
              <li key={item.id} className="nav-item">
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                  onClick={() => onNavClick(item.id)}
                  tabIndex={0}
                >
                  <span className="nav-icon" aria-hidden>{renderIcon(item.icon)}</span>
                  <span className="nav-text">{item.label}</span>
                  <span className="nav-indicator" aria-hidden />
                </NavLink>

                {/* collapsed-only tooltip: appears on hover/focus when the layout has .collapsed */}
                <span className="nav-tooltip" role="tooltip" aria-hidden="true">{item.label}</span>
              </li>
            ))}
          </ul>
        </nav>

        <div className="drawer-footer">
          <div className="drawer-meta">
            <div className="meta-item">
              <small>Theme</small>
              <div className="theme-dot" title="Vibrant" aria-hidden />
            </div>
            <div className="meta-item">
              <small>Profile</small>
              <div className="avatar">BM</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content" role="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<App />} />
          <Route path="/activities" element={<ActivityOverview activities={window.__TRACKER_ACTIVITIES__ ?? []} />} />
          <Route path="/tracking-apps" element={<TrackedIdentifiersManager refreshKey={refreshCounter} />} />
          <Route path="/settings" element={<section className="page"><h2>Settings</h2><p>Settings go here.</p></section>} />
          <Route path="/logout" element={<section className="page"><h2>Logged out</h2></section>} />
          <Route path="*" element={<section className="page"><h2>Not found</h2></section>} />
        </Routes>
      </main>
    </div>
  );
}

function renderIcon(name) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":
      return (<svg {...common}><path d="M3 11.5L12 4l9 7.5"/><path d="M5 21V11h14v10"/></svg>);
    case "chart":
      return (<svg {...common}><path d="M3 3v18h18"/><path d="M7 14v-7"/><path d="M12 14v-4"/><path d="M17 14v-10"/></svg>);
    case "apps":
      return (<svg {...common}><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>);
    case "settings":
      return (<svg {...common}><path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a1 1 0 01-.1 1.4 12 12 0 01-2.2 1.6"/></svg>);
    case "logout":
      return (<svg {...common}><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/><path d="M13 19H6a2 2 0 01-2-2V7a2 2 0 012-2h7"/></svg>);
    default:
      return null;
  }
}
