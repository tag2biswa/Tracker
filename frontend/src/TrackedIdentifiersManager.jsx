// src/TrackedIdentifiersManager.jsx
import React, { useState, useEffect } from "react";
import ConfirmModal from "./ConfirmModal";
import { USE_DUMMY_DATA } from "./config";
import "./TrackedIdentifiersManager.css"; // optional: create or adapt styles

/**
 * TrackedIdentifiersManager
 *
 * Props:
 *  - showHeader (boolean) default true: when false, hides the "Enter App name to be tracked" heading + input area.
 *  - compact (boolean) default false: when true, uses a compact card style suitable for sidebars.
 *  - refreshKey (any) optional: when changed, triggers a refresh from the server.
 */
function TrackedIdentifiersManager({ showHeader = true, compact = false, refreshKey }) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-fetch when external refreshKey changes
  useEffect(() => {
    if (!USE_DUMMY_DATA) fetchTrackedIdentifiers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

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
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to add identifier");
      }
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
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to delete identifier");
      }
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

  // small helpers for UI
  const containerClass = compact ? "tim-ids compact" : "tim-ids";
  const emptyStateText = USE_DUMMY_DATA ? "No tracked apps (dummy). Add one above." : "No tracked apps. Add one above ✨";

  return (
    <div className={containerClass} role="region" aria-label="Tracked apps manager">
      <div className="tim-card">
        {/* Header and Add form (can be hidden by showHeader) */}
        {showHeader && (
          <>
            <div className="tim-header">
              <h4 className="tim-title">Enter App name to be tracked</h4>
              <div className="tim-sub">Track apps/windows so they appear in activity summaries.</div>
            </div>

            <form className="tim-form" onSubmit={handleSubmit} aria-label="Add tracked app">
              <div className="tim-input-row">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g., Chrome, VSCode, Slack"
                  aria-label="App name to track"
                />
                <button className="tim-btn primary" type="submit" aria-label="Add tracked app">
                  Add
                </button>
              </div>

              {error && (
                <div className="tim-error" role="alert" style={{ marginTop: 8 }}>
                  {error}
                </div>
              )}
            </form>
          </>
        )}

        {/* Search + refresh */}
        <div className="tim-controls" style={{ marginTop: showHeader ? 12 : 0 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tracked apps..."
            aria-label="Search tracked apps"
            className="tim-search"
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="tim-btn ghost"
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
              aria-label="Refresh tracked apps"
            >
              ⟳
            </button>
          </div>
        </div>

        {/* List */}
        <div className="tim-list" style={{ marginTop: 12 }}>
          {loading && <div className="tim-loader">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="tim-empty">{emptyStateText}</div>
          )}

          {!loading &&
            filtered.map((app, i) => (
              <div className="tim-app-row" key={app + i}>
                <div className="tim-app-info">
                  <div className="tim-app-name">{app}</div>
                  <div className="tim-app-meta">Tracked</div>
                </div>

                <div className="tim-app-actions">
                  <button
                    className="tim-btn danger"
                    onClick={() => confirmDelete(app)}
                    title={`Delete ${app}`}
                    aria-label={`Delete ${app}`}
                    type="button"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M3 6h18" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M10 11v5M14 11v5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="sr-only">Delete</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Confirm modal */}
      {showModal && (
        <ConfirmModal
          title="Confirm Deletion"
          message={`Remove "${appToDelete}" from tracked apps?`}
          onConfirm={handleDelete}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default TrackedIdentifiersManager;
