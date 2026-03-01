// src/components/NavBar.tsx
import React from "react";
import type { TabKey } from "../App.tsx";
import { useI18n } from "../i18n/useI18n";

import iconDashboard from "../assets/icons/Dashboard.png";
import iconKalender from "../assets/icons/Kalender.png";
import iconPlan from "../assets/icons/Trainingsplan.png";
import iconProfil from "../assets/icons/Einstellungen.png";

interface NavBarProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

export const NavBar: React.FC<NavBarProps> = ({ activeTab, onChange }) => {
  const { t } = useI18n();

  const Item: React.FC<{
    tab: TabKey;
    label: string;
    icon?: string;
    renderIcon?: (active: boolean) => React.ReactNode;
    isPrimary?: boolean;
  }> = ({ tab, label, icon, renderIcon, isPrimary = false }) => {
    const isActive = activeTab === tab;

    return (
      <button
        type="button"
        onClick={() => onChange(tab)}
        className="flex w-full min-h-[44px] select-none flex-col items-center justify-center gap-1 py-1.5"
      >
        {isPrimary ? (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center bg-blue-600"
            style={{
              boxShadow: isActive ? "0 5px 15px rgba(59, 130, 246, 0.4)" : "0 4px 10px rgba(59, 130, 246, 0.3)",
            }}
          >
            {renderIcon?.(isActive)}
          </div>
        ) : renderIcon ? (
          renderIcon(isActive)
        ) : (
          <img
            src={icon}
            alt={label}
            draggable={false}
            className="h-6 w-6 transition-all duration-200"
            style={{
              opacity: isActive ? 1 : 0.6,
              filter: "var(--nav-icon-filter)"
            }}
          />
        )}

        <span
          className={`text-[9px] uppercase tracking-wide transition-colors duration-200 ${isActive ? "font-bold" : "font-medium"}`}
          style={{
            color: isActive ? "var(--nav-icon-active)" : "var(--nav-icon-inactive)"
          }}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-safe"
    >
      <footer
        className="w-full max-w-md rounded-3xl border shadow-2xl"
        style={{ backgroundColor: "var(--nav-bg)", borderColor: "var(--border-color)" }}
      >
        <div className="grid grid-cols-5 px-2 pb-2">
          <Item tab="dashboard" label={t("nav.dashboard")} icon={iconDashboard} />
          <Item tab="calendar" label={t("nav.calendar")} icon={iconKalender} />
          <Item
            tab="today"
            label={t("nav.play")}
            isPrimary
            renderIcon={() => (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M8 6.5V17.5L18 12L8 6.5Z" fill="white" />
              </svg>
            )}
          />
          <Item tab="plan" label={t("nav.plan")} icon={iconPlan} />
          <Item tab="profile" label={t("nav.profile")} icon={iconProfil} />
        </div>
      </footer>
    </div>
  );
};
