// /src/App.jsx
import React, { useState, useEffect } from "react";
import "./App.css";
import AppTrackerDashboard from "./AppTrackerDashboard";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";
import { USE_DUMMY_DATA } from "./config";

function App() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (USE_DUMMY_DATA) {
      // Dummy data for testing UI
      const dummy = [
        { id: 1, user_id: "Alice", app_name: "Chrome", window_title: "YouTube", duration: 3600, timestamp: "2025-09-01T10:00:00Z" },
        { id: 2, user_id: "Bob", app_name: "Slack", window_title: "Team Chat", duration: 5400, timestamp: "2025-09-02T12:00:00Z" },
        { id: 3, user_id: "Alice", app_name: "VSCode", window_title: "Project Code", duration: 7200, timestamp: "2025-08-28T09:30:00Z" },
        { id: 4, user_id: "Charlie", app_name: "Chrome", window_title: "Docs", duration: 1800, timestamp: "2025-09-03T14:00:00Z" },
        { id: 5, user_id: "Alice", app_name: "Chrome", window_title: "Gmail", duration: 2400, timestamp: "2025-09-04T15:00:00Z" },
        { id: 6, user_id: "Bob", app_name: "VSCode", window_title: "Code Review", duration: 3000, timestamp: "2025-08-15T11:00:00Z" },
        { id: 7, user_id: "Charlie", app_name: "Slack", window_title: "Daily Standup", duration: 2000, timestamp: "2025-09-06T09:00:00Z" },
        { id: 8, user_id: "Alice", app_name: "Slack", window_title: "1:1 Chat", duration: 2500, timestamp: "2025-09-05T16:00:00Z" }
      ];
      setActivities(dummy);
    } else {
      const fetchActivities = async () => {
        try {
          const res = await fetch("/activities/");
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setActivities(data);
        } catch (err) {
          console.error("Error fetching activities:", err);
        }
      };
      fetchActivities();
    }
  }, []);

  return (
    <div className="App">
      <h1 className="title">Time Tracker Dashboard</h1>
      <div className="container">
        <AppTrackerDashboard activities={activities} />
        <TrackedIdentifiersManager />
      </div>
    </div>
  );
}

export default App;
