// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from 'react-router-dom';
import App from "./App.tsx";
import "./index.css";
import "./i18n/config"; // Initialize i18n

import { applyTheme, loadTheme } from "./utils/theme";
import { SplashScreen } from "@capacitor/splash-screen";
import { hasSupabaseEnv } from "./lib/supabaseClient";

// Hide Capacitor splash immediately — native LaunchScreen.storyboard is enough
SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => {});


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

// ----- Global: scroll focused input into view when keyboard opens -----
// Capacitor Keyboard resize is set to 'none', so we handle it manually.
function setupKeyboardScrollFix() {
  let scrollTimer: ReturnType<typeof setTimeout> | null = null;
  let paddingTarget: HTMLElement | null = null;
  let originalPadding = "";

  document.addEventListener("focusin", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || !("tagName" in target)) return;
    const tag = target.tagName.toLowerCase();
    if (tag !== "input" && tag !== "textarea" && tag !== "select") return;

    // Only add extra padding in Live Training context (prevents issues on other screens)
    const isLiveTraining = !!document.querySelector('[data-live-training]');
    if (isLiveTraining) {
      const scrollParent = findScrollParent(target);
      if (scrollParent && !paddingTarget) {
        paddingTarget = scrollParent;
        originalPadding = scrollParent.style.paddingBottom;
        const currentPad = getComputedStyle(scrollParent).paddingBottom;
        const KEYBOARD_PADDING = 320;
        scrollParent.style.paddingBottom = `calc(${currentPad} + ${KEYBOARD_PADDING}px)`;
      }
    }

    // Scroll focused input into view (all screens, but only for inputs at bottom of view)
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
  });

  document.addEventListener("focusout", () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body) {
        if (paddingTarget) {
          // Restore original padding and scroll back so content isn't stuck up high
          const el = paddingTarget;
          el.style.paddingBottom = originalPadding;

          // Clamp scroll so the last content item sits above the footer
          const maxScroll = el.scrollHeight - el.clientHeight;
          if (el.scrollTop > maxScroll) {
            el.scrollTo({ top: maxScroll, behavior: "smooth" });
          }

          paddingTarget = null;
          originalPadding = "";
        }
      }
    }, 200);
  });
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement;
  while (current) {
    const overflow = getComputedStyle(current).overflowY;
    if (overflow === "auto" || overflow === "scroll") return current;
    current = current.parentElement;
  }
  return null;
}

setupKeyboardScrollFix();

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
