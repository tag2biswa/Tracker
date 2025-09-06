import React, { useEffect, useState } from 'react';
import './App.css';
import TrackedIdentifiersManager from './TrackedIdentifiersManager'; 

function App() {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/activities/')
      .then(res => res.json())
      .then(data => setActivities(data));
  }, []);

  return (
    <div className="App">
      <h1>Time Tracker Dashboard</h1>
      <table>
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

export default App;
