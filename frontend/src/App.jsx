import React, { useState, useEffect } from "react";
import "./App.css";
import AppTrackerDashboard from "./AppTrackerDashboard";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";
import { USE_DUMMY_DATA } from "./config";
import { buildDummyActivities } from "./dummyData";

function App() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (USE_DUMMY_DATA) {
      setActivities(buildDummyActivities());
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
