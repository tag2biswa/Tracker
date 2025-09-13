import React, { useState } from "react";
import "./App.css";
import Login from "./Login";
import AppTrackerDashboard from "./AppTrackerDashboard";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";

function App() {
  const [token, setToken] = useState(null);

  const handleLogin = (accessToken) => {
    console.log("Token received in App:", accessToken);
    setToken(accessToken); // Update the token state on successful login
  };

  if (!token) {
    console.log("Rendering Login page");
    // Render the login page if the user is not logged in
    return <Login onLogin={handleLogin} />;
  }

  console.log("Rendering Dashboard");
  // Render the dashboard if the user is logged in
  return (
    <div className="App">
      <div className="dashboard-header">
        <h1 className="title">Tracker Dashboard</h1>
      </div>

      <div className="dashboard-content">
        <div className="container">
          <AppTrackerDashboard />
          <TrackedIdentifiersManager />
        </div>
      </div>
    </div>
  );
}

export default App;
