// src/components/NavBar.tsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { TabKey } from "../App.tsx";

import iconDashboard from "../assets/icons/Dashboard.png";
import iconKalender from "../assets/icons/Kalender.png";
import iconPlan from "../assets/icons/Trainingsplan.png";
import iconProfil from "../assets/icons/Einstellungen.png";

interface NavBarProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Liest ein Theme aus mehreren gängigen Keys (ohne Risiko, wenn es nicht existiert)
function readStoredTheme(): "dark" | "light" | "system" | null {
  if (typeof window === "undefined") return null;

  const keys = [
    "theme",
    "color-theme",
    "colorTheme",
    "color_scheme",
    "colorScheme",
    "trainq_theme",
    "trainq_theme_mode",
    "trainq_color_scheme",
  ];

  for (const k of keys) {
    try {
      const v = (window.localStorage.getItem(k) || "").trim().toLowerCase();
      if (v === "dark" || v === "light" || v === "system") return v as any;
    } catch {
      // ignore
    }
  }
  return null;
}

function getIsDarkNow(): boolean {
  if (typeof window === "undefined") return false;

  const root = document.documentElement;
  const body = document.body;

  // 1) Class (Tailwind darkMode: 'class') – oft auf html ODER body
  const byClass = root.classList.contains("dark") || (body?.classList?.contains("dark") ?? false);
  if (byClass) return true;

  // 2) data-theme (häufig in Theme-Toggles)
  const dataTheme = (root.getAttribute("data-theme") || body?.getAttribute?.("data-theme") || "").toLowerCase();
  if (dataTheme === "dark") return true;
  if (dataTheme === "light") return false;

  // 3) LocalStorage (wenn dein Theme persistiert wird)
  const stored = readStoredTheme();
  if (stored === "dark") return true;
  if (stored === "light") return false;

  // 4) System-Fallback
  const mql = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mql ? mql.matches : false;
}

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() => getIsDarkNow());

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const mql = window.matchMedia?.("(prefers-color-scheme: dark)");

    const update = () => {
      const next = getIsDarkNow();
      setIsDark(next);

      // Hilft auch bei nativen UI-Elementen / Scrollbars / iOS
      root.style.colorScheme = next ? "dark" : "light";
    };

    update();

    const onMedia = () => update();
    if (mql?.addEventListener) mql.addEventListener("change", onMedia);
    else mql?.addListener?.(onMedia);

    // Beobachte html und body: viele Apps toggeln "dark" auf body statt html
    const obs = new MutationObserver(() => update());
    obs.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    if (document.body) obs.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme"] });

    return () => {
      obs.disconnect();
      if (mql?.removeEventListener) mql.removeEventListener("change", onMedia);
      else mql?.removeListener?.(onMedia);
    };
  }, []);

  return isDark;
}

export const NavBar: React.FC<NavBarProps> = ({ activeTab, onChange }) => {
  const isDark = useIsDarkMode();

  const theme = useMemo(() => {
    return isDark
      ? {
          bg: "rgba(16, 16, 22, 0.62)",
          border: "rgba(255, 255, 255, 0.10)",
          ring: "rgba(255, 255, 255, 0.08)",
          shadow: "rgba(0, 0, 0, 0.70)",
          textActive: "rgba(255, 255, 255, 0.95)",
          textIdle: "rgba(255, 255, 255, 0.55)",
          indicator: "rgba(255, 255, 255, 0.90)",
          iconFilter: "invert(1) brightness(1.6)",
        }
      : {
          bg: "rgba(255, 255, 255, 0.70)",
          border: "rgba(0, 0, 0, 0.10)",
          ring: "rgba(0, 0, 0, 0.06)",
          shadow: "rgba(0, 0, 0, 0.20)",
          textActive: "rgba(0, 0, 0, 0.92)",
          textIdle: "rgba(0, 0, 0, 0.55)",
          indicator: "rgba(0, 0, 0, 0.85)",
          iconFilter: "none",
        };
  }, [isDark]);

  const Item: React.FC<{ tab: TabKey; label: string; icon: string }> = ({ tab, label, icon }) => {
    const isActive = activeTab === tab;

    return (
      <button
        type="button"
        onClick={() => onChange(tab)}
        className="flex w-full select-none flex-col items-center justify-center gap-1 py-1.5"
      >
        <img
          src={icon}
          alt={label}
          draggable={false}
          className="h-6 w-6"
          style={{
            opacity: isActive ? 1 : 0.5,
            filter: theme.iconFilter,
          }}
        />

        <span
          className="text-[11px]"
          style={{
            fontWeight: isActive ? 600 : 400,
            color: isActive ? theme.textActive : theme.textIdle,
          }}
        >
          {label}
        </span>

        <div
          className="mt-0.5 h-[2px] w-6 rounded-full"
          style={{
            background: isActive ? theme.indicator : "transparent",
          }}
        />
      </button>
    );
  };

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <footer
        className="w-full max-w-md rounded-[28px] backdrop-blur-2xl"
        style={{
          background: theme.bg,
          border: `1px solid ${theme.border}`,
          boxShadow: `0 12px 30px ${theme.shadow}`,
        }}
      >
        <div
          className="rounded-[28px]"
          style={{
            boxShadow: `inset 0 0 0 1px ${theme.ring}`,
          }}
        >
          <div className="grid grid-cols-4 px-4 py-3">
            <Item tab="dashboard" label="Dashboard" icon={iconDashboard} />
            <Item tab="calendar" label="Kalender" icon={iconKalender} />
            <Item tab="plan" label="Plan" icon={iconPlan} />
            <Item tab="profile" label="Profil" icon={iconProfil} />
          </div>
        </div>
      </footer>
    </div>
  );
};
