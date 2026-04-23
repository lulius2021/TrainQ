// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from 'react-router-dom';
import App from "./App.tsx";
import "./index.css";
import "./i18n/config"; // Initialize i18n

import { applyTheme, loadTheme } from "./utils/theme";
// SplashScreen is hidden in App.tsx after React has mounted


// Theme initial anwenden (light/dark/system)
applyTheme(loadTheme());


// ----- Global: prevent zoom (iOS WebView hardening) -----
function setupGlobalNoZoom() {
  // Prevent pinch-zoom gestures
  document.addEventListener(
    "gesturestart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturechange",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener(
    "gestureend",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
}

setupGlobalNoZoom();
import { hasSupabaseEnv } from "./lib/supabaseClient";

if (!hasSupabaseEnv()) {
  const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
  root.render(
    <div style={{
      height: "100vh",
      width: "100vw",
      backgroundColor: "#111",
      color: "red",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      padding: "20px",
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>CRITICAL ERROR</h1>
      <p style={{ color: "white" }}>Missing Supabase Environment Variables.</p>
      <p style={{ color: "#888", fontSize: "12px", marginTop: "10px" }}>Please check .env file and rebuild.</p>
      <p style={{ color: "#666", fontSize: "10px", marginTop: "20px" }}>VITE_SUPABASE_URL not found.</p>
    </div>
  );
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <App />
  );
}
