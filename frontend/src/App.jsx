import React, { useState, useEffect } from "react";
import "./App.css";
import AppTrackerDashboard from "./AppTrackerDashboard";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";
import { USE_DUMMY_DATA } from "./config";

function App() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (USE_DUMMY_DATA) {
      setActivities([
        { id: 1, user_id: "Alice", app_name: "Chrome", window_title: "YouTube", duration: 3600, timestamp: "2025-09-01T10:00:00Z" },
        { id: 2, user_id: "Bob", app_name: "Slack", window_title: "Team Chat", duration: 5400, timestamp: "2025-09-02T12:00:00Z" },
        { id: 3, user_id: "Alice", app_name: "VSCode", window_title: "Project Code", duration: 7200, timestamp: "2025-08-28T09:30:00Z" }
      ]);
    } else {
      fetch("/activities/")
        .then(res => res.json())
        .then(data => setActivities(data))
        .catch(err => console.error(err));
    }
  }, []);

  return (
    <div className="App">
      <h1 className="title">Tracker Dashboard</h1>
      <div className="container">
        <AppTrackerDashboard activities={activities} />
        <TrackedIdentifiersManager />
      </div>
    </div>
  );
}

export default App;
