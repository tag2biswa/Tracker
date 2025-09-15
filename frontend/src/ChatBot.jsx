// src/ChatBot.jsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ChatBot.css"; // adjust path if you placed CSS elsewhere

// Build API endpoint with multiple fallbacks:
// 1) VITE_API_BASE (recommended) -> `${VITE_API_BASE}/api/chatbot/query`
// 2) window.__API_BASE__ (optional global injected value)
// 3) try same host at port 8000 (http://host:8000/api/chatbot/query)
// 4) relative fallback '/api/chatbot/query' (last resort)
function resolveApiEndpoint() {
  try {
    const envBase = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE)
      ? import.meta.env.VITE_API_BASE.replace(/\/+$/, "")
      : null;
    if (envBase) return `${envBase}/api/chatbot/query`;

    if (typeof window !== "undefined" && window.__API_BASE__) {
      return `${window.__API_BASE__.replace(/\/+$/, "")}/api/chatbot/query`;
    }

    if (typeof window !== "undefined" && window.location) {
      const host = window.location.hostname;
      // prefer http for localhost; use same protocol otherwise
      const proto = host === "localhost" ? "http:" : window.location.protocol;
      const port = 8000;
      return `${proto}//${host}:${port}/api/chatbot/query`;
    }
  } catch (e) {
    // fallthrough
  }
  // last resort -> relative path (may hit Vite dev server and 404 if not proxied)
  return "/api/chatbot/query";
}

const API_ENDPOINT = resolveApiEndpoint();

export default function ChatBot() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text:
        "Hi — ask me about activity data! Examples:\n" +
        "• \"top apps last 7 days\"\n" +
        "• \"how many minutes on Chrome today\"\n" +
        "• \"top users for Slack last 14 days\""
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const appendMessage = (m) => setMessages((prev) => [...prev, m]);

  const sendQuery = async () => {
    const text = (query || "").trim();
    if (!text) return;

    appendMessage({ from: "user", text });
    setQuery("");
    setLoading(true);
    setError(null);

    // Build headers and include VITE_CHATBOT_KEY if present
    const headers = { "Content-Type": "application/json" };
    const frontendKey = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_CHATBOT_KEY)
      ? import.meta.env.VITE_CHATBOT_KEY
      : (window.__VITE_CHATBOT_KEY__ || "");
    if (frontendKey) headers["Authorization"] = `Bearer ${frontendKey}`;

    // Do the fetch and log raw response for debugging
    try {
      console.debug("[ChatBot] Sending request to:", API_ENDPOINT);
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: text })
      });

      const raw = await res.text();
      console.debug("[ChatBot] Response status:", res.status, res.statusText);
      console.debug("[ChatBot] Response body (raw):", raw);

      if (!res.ok) {
        // provide helpful messages for common failures
        if (res.status === 404) {
          const hint = `404 Not Found: frontend attempted ${API_ENDPOINT}. Set VITE_API_BASE to your backend (e.g. http://localhost:8000) or ensure backend is running and exposes /api/chatbot/query.`;
          setError(hint);
          appendMessage({ from: "bot", text: `Error: ${res.status} ${res.statusText}. ${hint}` });
          setLoading(false);
          return;
        }
        // other status codes
        const body = raw || res.statusText;
        setError(`${res.status} ${res.statusText}`);
        appendMessage({ from: "bot", text: `Error: ${res.status} ${res.statusText} — ${body}` });
        setLoading(false);
        return;
      }

      // parse JSON safely
      let data;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        // backend returned non-json but with 200: show raw
        appendMessage({ from: "bot", text: raw || "Received empty response from server." });
        setLoading(false);
        return;
      }

      appendMessage({ from: "bot", text: data?.answer ?? "No answer returned." });
    } catch (err) {
      // network error / connection refused
      console.error("[ChatBot] Network error:", err);
      const msg = `Network error contacting ${API_ENDPOINT}: ${err.message || err}`;
      setError(msg);
      appendMessage({ from: "bot", text: `Error: ${err.message || String(err)}. ${API_ENDPOINT}` });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        from: "bot",
        text:
          "Hi — ask me about activity data! Examples:\n" +
          "• \"top apps last 7 days\"\n" +
          "• \"how many minutes on Chrome today\"\n" +
          "• \"top users for Slack last 14 days\""
      }
    ]);
    setError(null);
  };

  return (
    <section className="cb-card">
      <div className="cb-header">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: "linear-gradient(90deg,#6C5CE7,#0984E3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 800
            }}
          >
            CB
          </div>
          <div>
            <h3 className="cb-title">Activity Chat Bot</h3>
            <div className="cb-sub">Ask questions about activity data stored in the database.</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>
              Endpoint: <code style={{ fontSize: 11 }}>{API_ENDPOINT}</code>
            </div>
          </div>
        </div>

        <div className="cb-actions">
          <button onClick={() => navigate(-1)} className="cb-btn">Back</button>
          <button onClick={clearChat} className="cb-btn">Clear</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div ref={listRef} className="cb-messages">
          {messages.map((m, i) => (
            <div key={i} className="cb-message">
              <div className={`cb-avatar ${m.from}`}>{m.from === "bot" ? "B" : "U"}</div>
              <div className="cb-message-body">
                <div className="cb-message-author">{m.from === "bot" ? "Bot" : "You"}</div>
                <div className="cb-message-text">{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="cb-input-area">
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question (press Enter to send)..."
            className="cb-input"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={sendQuery} disabled={loading || !query.trim()} className="cb-btn primary">
              {loading ? "Thinking..." : "Send"}
            </button>
            <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="cb-btn">Clear</button>
          </div>
        </div>

        {error && (
          <div style={{ color: "crimson", fontSize: 13 }}>
            {error}
            <div style={{ fontSize: 12, color: "#9aa4b2", marginTop: 6 }}>
              Tip: If you see a 404, set <code>VITE_API_BASE</code> in your frontend .env to your backend base URL
              (e.g. <code>http://localhost:8000</code>) and restart the dev server.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
