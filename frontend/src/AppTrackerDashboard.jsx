import React from "react";

function AppTrackerDashboard({ activities }) {
  return (
    <div className="dashboard">
      <h2>Tracker Statistics</h2>
      <div className="stats">
        <div className="stat-card blue">Most Used App of the Week</div>
        <div className="stat-card pink">Most Used App Last Month</div>
        <div className="stat-card purple">Most Used App in Last 6 Months</div>
      </div>

      <h3>All Activities</h3>
      <table className="activity-table">
        <thead>
          <tr>
            <th>User Name</th>
            <th>App Name</th>
            <th>Window Title</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((activity, idx) => (
            <tr key={idx}>
              <td>{activity.user_id}</td>
              <td>{activity.app_name}</td>
              <td>{activity.window_title}</td>
              <td>{activity.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AppTrackerDashboard;
