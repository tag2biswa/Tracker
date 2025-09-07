// /src/TrackedIdentifiersManager.jsx
import React, { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";

/**
 * Rich TrackedIdentifiersManager (right panel)
 * This component's root uses className="right-panel" so CSS can set it to 40% width.
 */
function TrackedIdentifiersManager() {
  const [apps, setApps] = useState([]);
  const [input, setInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { fetchTrackedIdentifiers(); }, []);

  const fetchTrackedIdentifiers = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/tracked-identifiers/");
      if (!res.ok) throw new Error("Failed to fetch tracked identifiers");
      const data = await res.json();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    const val = input.trim();
    if (val === "") return;
    if (apps.includes(val)) { setError("Already tracked"); return; }

    try {
      const response = await fetch("/tracked-identifiers/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: val }),
      });
      if (!response.ok) throw new Error("Failed to add identifier");
      setApps(prev => [val, ...prev]);
      setInput(""); setError(null);
    } catch (err) {
      setError(err.message || "Could not add");
    }
  };

  const confirmDelete = (appName) => { setAppToDelete(appName); setShowModal(true); };

  const handleDelete = async () => {
    if (!appToDelete) return;
    try {
      const res = await fetch(`/tracked-identifiers/${encodeURIComponent(appToDelete)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete identifier");
      setApps(prev => prev.filter(a => a !== appToDelete));
      setAppToDelete(null); setShowModal(false);
    } catch (err) {
      setError(err.message || "Could not delete"); setShowModal(false);
    }
  };

  const filtered = apps.filter(a => a.toLowerCase().includes(search.toLowerCase()));

  return (
    <aside className="right-panel">
      <div className="right-card">
        <h4 className="right-title">Enter App name to be tracked</h4>

        <form className="tracked-form" onSubmit={handleSubmit}>
          <div className="input-row">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Chrome, VSCode, Slack"
              aria-label="App name to track"
            />
            <button className="btn primary" type="submit">Add</button>
          </div>

          {error && <div className="error-msg" role="alert" style={{ marginTop: 8 }}>{error}</div>}
        </form>

        <div className="search-row" style={{ marginTop: 12 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracked apps..."
            aria-label="Search tracked apps"
          />
          <button className="btn ghost" onClick={fetchTrackedIdentifiers} type="button" title="Refresh">⟳</button>
        </div>

        <div className="list-scroll" style={{ marginTop: 12 }}>
          {loading && <div className="loader">Loading…</div>}
          {!loading && filtered.length === 0 && <div className="empty-state">No tracked apps. Add one above ✨</div>}

          {!loading && filtered.map((app, i) => (
            <div className="app-card" key={app + i}>
              <div>
                <div className="app-name">{app}</div>
                <div className="app-meta">Tracked</div>
              </div>

              <div className="app-actions">
                <button className="btn small" onClick={() => setInput(app)} title="Edit (prefill)">✎</button>
                <button className="btn danger small" onClick={() => confirmDelete(app)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <ConfirmModal
          title="Confirm Deletion"
          message={`Remove "${appToDelete}" from tracked apps?`}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
        />
      )}
    </aside>
  );
}

export default TrackedIdentifiersManager;
