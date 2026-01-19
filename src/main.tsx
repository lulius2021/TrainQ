// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
