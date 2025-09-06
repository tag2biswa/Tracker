import React, { useEffect, useState } from 'react';
import './App.css';
import TrackedIdentifiersManager from './TrackedIdentifiersManager.jsx';
import AppTrackerDashboard from './AppTrackerDashboard.jsx';

function App() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch('/activities/')
      .then(res => res.json())
      .then(data => setActivities(data))
      .catch(err => console.error("Error fetching activities:", err));
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
