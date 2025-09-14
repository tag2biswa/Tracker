import React, { useState, useEffect } from "react";
import "./App.css";
import AppTrackerDashboard from "./AppTrackerDashboard";
import TrackedIdentifiersManager from "./TrackedIdentifiersManager";

const API_BASE =
  window && window.API_BASE ? window.API_BASE.replace(/\/$/, "") : "";

function safeParseJsonOrNull(text) {
  const t = (text || "").trim();
  if (!t) return null;
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t);
    } catch (e) {
      console.warn("safeParseJsonOrNull: JSON.parse failed", e);
      return null;
    }
  }
  return null;
}

function App() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFromUrl(url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const text = await res.text();
        const json = safeParseJsonOrNull(text);
        if (!res.ok) {
          console.warn(
            `fetchFromUrl: ${url} returned status ${res.status}, body snippet:`,
            text.slice(0, 200)
          );
          return null;
        }
        if (!json) {
          console.warn(
            `fetchFromUrl: ${url} returned non-JSON (starts with '${(
              text || ""
            ).slice(0, 1)}')`
          );
          return null;
        }
        return json;
      } catch (err) {
        console.warn("fetchFromUrl: network/error for", url, err);
        return null;
      }
    }

    async function loadActivities() {
      setLoading(true);
      const candidateUrls = [
        `${API_BASE}/activities/`,
        `${API_BASE}/activity-logs/`,
      ];

      let got = null;
      for (const u of candidateUrls) {
        console.debug("Trying endpoint:", u);
        const data = await fetchFromUrl(u);
        if (data && Array.isArray(data)) {
          const normalized = data.map((row) => ({
            id: row.id || `${row.app_id || ""}-${row.activity_date || ""}`,
            user_id: row.user_id || row.user || "unknown",
            app_name: row.app_name || row.app || "Unknown",
            window_title: row.window_title || "",
            duration: Number(row.duration || 0),
            timestamp:
              row.timestamp ||
              (row.activity_date
                ? `${row.activity_date}T09:00:00Z`
                : undefined),
          }));
          got = normalized.filter(Boolean);
          console.info("Loaded activities from", u, "-> count:", got.length);
          break;
        }
      }

      if (!got) {
        console.warn(
          "App: no activities loaded. Ensure backend is running and endpoints exist (/activity-logs, /activities)."
        );
        setActivities([]);
      } else {
        setActivities(got);
      }

      setLoading(false);
    }

    loadActivities();
  }, []);

  return (
    <div className="App">
      <div className="dashboard-header">
      </div>

      <div className="container">
        <AppTrackerDashboard activities={activities} />
        <TrackedIdentifiersManager />
      </div>
    </div>
  );
}

export default App;