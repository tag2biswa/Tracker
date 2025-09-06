import React, { useState, useEffect } from "react";

function TrackedIdentifiersManager() {
  const [apps, setApps] = useState([]); // Initialize with an empty array
  const [input, setInput] = useState("");

  // Fetch tracked identifiers from the backend
  useEffect(() => {
    const fetchTrackedIdentifiers = async () => {
      try {
        const response = await fetch("/tracked-identifiers/"); // Proxy will forward to backend
        if (!response.ok) {
          throw new Error("Failed to fetch tracked identifiers");
        }
        const data = await response.json();
        setApps(data); // Update state with fetched data
      } catch (error) {
        console.error("Error fetching tracked identifiers:", error);
      }
    };

    fetchTrackedIdentifiers();
  }, []); // Empty dependency array ensures this runs only once

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (input.trim() !== "" && !apps.includes(input)) {
      try {
        const response = await fetch("/tracked-identifiers/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ identifier: input.trim() }),
        });

        if (!response.ok) {
          throw new Error("Failed to add identifier");
        }

        setApps([...apps, input.trim()]); // Update state with the new identifier
        setInput("");
      } catch (error) {
        console.error("Error adding identifier:", error);
      }
    }
  };

  return (
    <div className="tracked-manager">
      <form onSubmit={handleSubmit}>
        <label>Enter App name to be tracked</label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type app name"
        />
        <button type="submit">Submit</button>
      </form>

      <div className="app-list">
        {apps.map((app, idx) => (
          <p key={idx}>{app}</p>
        ))}
      </div>
    </div>
  );
}

export default TrackedIdentifiersManager;