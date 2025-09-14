// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import HomeDashboard from "./HomeDashboard";
import "./App.css";
import "./HomeDashboard.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <HomeDashboard />
      </BrowserRouter>
    </React.StrictMode>
  );
}
