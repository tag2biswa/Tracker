// src/ChatBot.jsx
import React, { useState, useRef, useEffect } from "react";
import "./ChatBot.css"; // reuses existing styling; you can create a chatbot-specific css if preferred
import { useNavigate } from "react-router-dom";

/**
 * ChatBot page
 * - UI: message list, input box, send button
 * - Sends POST to /api/chatbot/query with { query: string }
 * - Expects response { answer: string } (status 200)
 *
 * NOTE: adapt endpoint path if your backend uses a different route (e.g. /chatbot/query)
 */

const API_ENDPOINT = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE)
  ? `${import.meta.env.VITE_API_BASE.replace(/\/+$/,'')}/api/chatbot/query`
  : "/api/chatbot/query";

export default function ChatBot() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { from: "bot", text: "Hi — ask me about activity data (e.g. \"show top apps yesterday\" or \"how many minutes spent on Chrome on Sep 1\")" }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const appendMessage = (msg) => setMessages(prev => [...prev, msg]);

  const sendQuery = async () => {
    const text = (query || "").trim();
    if (!text) return;
    appendMessage({ from: "user", text });
    setQuery("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text })
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${res.statusText} ${txt}`);
      }

      const data = await res.json();
      const answer = data?.answer ?? "No answer returned from server.";
      appendMessage({ from: "bot", text: answer });
    } catch (err) {
      console.error("chatbot error", err);
      setError(String(err));
      appendMessage({ from: "bot", text: `Error: ${String(err)}` });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendQuery();
    }
  };

  const clearChat = () => {
    setMessages([{ from: "bot", text: "Hi — ask me about activity data (e.g. \"show top apps yesterday\")" }]);
    setError(null);
  };

  return (
    <section className="ao-card" style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "linear-gradient(90deg,#6C5CE7,#0984E3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>CB</div>
          <div>
            <h3 style={{ margin: 0 }}>Activity Chat Bot</h3>
            <div style={{ color: "#64748b", fontSize: 13 }}>Ask the bot questions about activity data from the database.</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => navigate(-1)} className="ao-action-btn">Back</button>
          <button onClick={clearChat} className="ao-action-btn">Clear</button>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        <div ref={listRef} style={{ height: 420, overflow: "auto", borderRadius: 8, padding: 12, border: "1px solid #eef2f7", background: "#fbfdff" }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
              <div style={{ width: 36 }}>
                {m.from === "bot" ? (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>B</div>
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#e6eefc", color: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>U</div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: m.from === "bot" ? "#111827" : "#0f172a" }}>{m.from === "bot" ? "Bot" : "You"}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{/* timestamp could go here */}</div>
                </div>

                <div style={{ marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.45, color: "#0f172a" }}>
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Type your question (press Enter to send)..."
            style={{ flex: 1, padding: 10, minHeight: 48, borderRadius: 8, border: "1px solid #e6e9ef", resize: "vertical" }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={sendQuery} disabled={loading || !query.trim()} className="ao-action-btn primary" style={{ padding: "10px 14px" }}>
              {loading ? "Thinking..." : "Send"}
            </button>
            <button onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="ao-action-btn">Clear</button>
          </div>
        </div>

        {error ? <div style={{ color: "crimson" }}>Error: {error}</div> : null}
      </div>
    </section>
  );
}
