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
            className="h-6 w-6"
            style={{
              opacity: 1,
              filter: "brightness(0) invert(1)"
            }}
          />
        )}

        <span
          className={`text-[11px] text-white ${isActive ? "font-semibold" : "font-medium"}`}
        >
          {label}
        </span>

        <div
          className={`mt-0.5 h-[3px] w-4 rounded-full ${!isPrimary && isActive ? "bg-blue-600" : "bg-transparent"
            }`}
        />
      </button>
    );
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <footer
        className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10
                   p-0 backdrop-blur-xl shadow-2xl"
      >
        <div className="grid grid-cols-5">
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
