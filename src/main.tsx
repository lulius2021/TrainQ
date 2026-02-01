// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config"; // Initialize i18n

import { applyTheme, loadTheme } from "./utils/theme";


// Theme initial anwenden (light/dark/system)
applyTheme(loadTheme());

// ✅ ENV Debug (läuft im App-/Vite-Module-Context, nicht in der DevTools-REPL)
// Wenn hier undefined/leer steht, wird .env nicht geladen oder Dev-Server braucht Restart.
console.log("ENV CHECK", {
  VITE_APPLE_CLIENT_ID: import.meta.env.VITE_APPLE_CLIENT_ID,
  VITE_APPLE_REDIRECT_URI: import.meta.env.VITE_APPLE_REDIRECT_URI,
  MODE: import.meta.env.MODE,
});

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

  // Prevent double-tap to zoom (common on iOS)
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
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
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
