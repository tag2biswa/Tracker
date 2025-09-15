import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./ChatBot.css";   // ✅ dedicated CSS for chatbot

// Build endpoint from Vite env (fallback to relative path)
const API_ENDPOINT =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_API_BASE)
    ? `${import.meta.env.VITE_API_BASE.replace(/\/+$/, "")}/api/chatbot/query`
    : "/api/chatbot/query";

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

  // Scroll chat window to bottom on new message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const appendMessage = (msg) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendQuery = async () => {
    const text = (query || "").trim();
    if (!text) return;

    // Push user message
    appendMessage({ from: "user", text });
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      // Build headers
      const headers = { "Content-Type": "application/json" };
      const frontendKey = import.meta.env.VITE_CHATBOT_KEY || "";
      if (frontendKey) {
        headers["Authorization"] = `Bearer ${frontendKey}`;
      }

      // Call backend
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: text })
      });

      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();

      appendMessage({
        from: "bot",
        text: data?.answer ?? "No answer returned."
      });
    } catch (err) {
      const msg = `Error: ${String(err)}`;
      appendMessage({ from: "bot", text: msg });
      setError(msg);
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

  const clearChat = () =>
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

  return (
    <section className="cb-card">
      {/* Header */}
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
            <div className="cb-sub">
              Ask questions about activity data stored in the database.
            </div>
          </div>
        </div>
        <div className="cb-actions">
          <button onClick={() => navigate(-1)} className="cb-btn">
            Back
          </button>
          <button onClick={clearChat} className="cb-btn">
            Clear
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div ref={listRef} className="cb-messages">
          {messages.map((m, i) => (
            <div key={i} className="cb-message">
              <div className={`cb-avatar ${m.from}`}>
                {m.from === "bot" ? "B" : "U"}
              </div>
              <div className="cb-message-body">
                <div className="cb-message-author">
                  {m.from === "bot" ? "Bot" : "You"}
                </div>
                <div className="cb-message-text">{m.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
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
            <button
              onClick={sendQuery}
              disabled={loading || !query.trim()}
              className="cb-btn primary"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="cb-btn"
            >
              Clear
            </button>
          </div>
        </div>

        {error && <div style={{ color: "crimson" }}>Error: {error}</div>}
      </div>
    </section>
  );
}
