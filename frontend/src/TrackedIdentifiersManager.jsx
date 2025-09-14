import React, { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import { USE_DUMMY_DATA } from "./config";

/**
 * TrackedIdentifiersManager
 * - Shows tracked apps (dummy or real backend)
 * - Only a prominent Delete button (no edit)
 */
function TrackedIdentifiersManager() {
  const [apps, setApps] = useState([]);
  const [input, setInput] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [appToDelete, setAppToDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const DUMMY_APPS = ["Chrome", "VSCode", "Slack", "Spotify"];

  useEffect(() => {
    if (USE_DUMMY_DATA) {
      setApps(DUMMY_APPS);
    } else {
      fetchTrackedIdentifiers();
    }
  }, []);

  const fetchTrackedIdentifiers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/tracked-identifiers/");
      if (!response.ok) throw new Error("Failed to fetch tracked identifiers");
      const data = await response.json();
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    const val = input.trim();
    if (!val) return;
    if (apps.includes(val)) {
      setError("Already tracked");
      return;
    }

    if (USE_DUMMY_DATA) {
      setApps((prev) => [val, ...prev]);
      setInput("");
      setError(null);
      return;
    }

    try {
      const response = await fetch("/tracked-identifiers/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: val }),
      });
      if (!response.ok) throw new Error("Failed to add identifier");
      setApps((prev) => [val, ...prev]);
      setInput("");
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not add");
    }
  };

  const confirmDelete = (appName) => {
    setAppToDelete(appName);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!appToDelete) return;

    if (USE_DUMMY_DATA) {
      setApps((prev) => prev.filter((a) => a !== appToDelete));
      setAppToDelete(null);
      setShowModal(false);
      return;
    }

    try {
      const response = await fetch(`/tracked-identifiers/${encodeURIComponent(appToDelete)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete identifier");
      setApps((prev) => prev.filter((a) => a !== appToDelete));
      setAppToDelete(null);
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Could not delete");
      setShowModal(false);
    }
  };

  const filtered = apps.filter((a) => a.toLowerCase().includes(search.toLowerCase()));

  /*return (
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
            <button className="btn primary" type="submit">
              Add
            </button>
          </div>

          {error && (
            <div className="error-msg" role="alert" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}
        </form>

        <div className="search-row" style={{ marginTop: 12 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracked apps..."
            aria-label="Search tracked apps"
          />
          <button
            className="btn ghost"
            onClick={() => {
              if (USE_DUMMY_DATA) {
                setApps(DUMMY_APPS);
                setError(null);
              } else {
                fetchTrackedIdentifiers();
              }
            }}
            type="button"
            title="Refresh"
          >
            ⟳
          </button>
        </div>

        <div className="list-scroll" style={{ marginTop: 12 }}>
          {loading && <div className="loader">Loading…</div>}
          {!loading && filtered.length === 0 && <div className="empty-state">No tracked apps. Add one above ✨</div>}

          {!loading &&
            filtered.map((app, i) => (
              <div className="app-card" key={app + i}>
                <div>
                  <div className="app-name">{app}</div>
                  <div className="app-meta">Tracked</div>
                </div>

                <div className="app-actions">
                  <button
                    className="btn danger"
                    onClick={() => confirmDelete(app)}
                    title={`Delete ${app}`}
                    aria-label={`Delete ${app}`}
                    type="button"
                  >
                    <span className="icon" aria-hidden>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        focusable="false"
                        role="img"
                      >
                        <path
                          d="M3 6h18"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 11v5M14 11v5"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"
                          stroke="white"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>

                    <span className="btn-label">Delete</span>
                  </button>
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
  );*/
}

export default TrackedIdentifiersManager;