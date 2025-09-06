import React, { useState } from "react";

function TrackedIdentifiersManager() {
  const [apps, setApps] = useState(["App 1", "App 2", "App 3"]);
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() !== "" && !apps.includes(input)) {
      setApps([...apps, input.trim()]);
      setInput("");
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
