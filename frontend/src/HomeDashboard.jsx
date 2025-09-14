// src/HomeDashboard.jsx
import React, { useState } from "react";
import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import "./HomeDashboard.css";
import App from "./App"; // <-- use App for the dashboard route
import ActivityOverview from "./ActivityOverview";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";

export default function HomeDashboard() {
  const [refreshCounter, setRefreshCounter] = useState(0);

  const activeStyle = { fontWeight: 700, textDecoration: "underline" };

  const onTrackingAppsClick = () => setRefreshCounter(c => c + 1);

  return (
    <div className="home-dashboard">
      <header className="top-banner"><h1>Tracker Dashboard</h1></header>

      <aside className="drawer" aria-label="Main navigation">
        <nav className="drawer-nav">
          <ul>
            <li><NavLink to="/dashboard" style={({isActive}) => isActive ? activeStyle : undefined}>Dashboard</NavLink></li>
            <li><NavLink to="/activities" style={({isActive}) => isActive ? activeStyle : undefined}>Activities</NavLink></li>
            <li><NavLink to="/tracking-apps" onClick={onTrackingAppsClick} style={({isActive}) => isActive ? activeStyle : undefined}>Tracking Apps</NavLink></li>
            <li><NavLink to="/logout" style={({isActive}) => isActive ? activeStyle : undefined}>Logout</NavLink></li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Important: render App here so sequence is HomeDashboard -> App -> AppTrackerDashboard */}
          <Route path="/dashboard" element={<App />} />

          <Route path="/activities" element={<ActivityOverview activities={window.__TRACKER_ACTIVITIES__ ?? []} />} />
          <Route path="/tracking-apps" element={<TrackedIdentifiersManager refreshKey={refreshCounter} />} />
          <Route path="/logout" element={<section><h2>Logged out</h2></section>} />
          <Route path="*" element={<section><h2>Welcome</h2><p>Use the nav.</p></section>} />
        </Routes>
      </main>
    </div>
  );
}
