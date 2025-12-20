import React from "react";
import type { TabKey } from "../App";

interface NavBarProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

export const NavBar: React.FC<NavBarProps> = ({ activeTab, onChange }) => {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/25 backdrop-blur-md border-t border-white/20">
      <div className="max-w-5xl mx-auto px-4 py-2 grid grid-cols-4">

        {/* Dashboard */}
        <button
          onClick={() => onChange("dashboard")}
          className="flex flex-col items-center gap-1 text-xs w-full"
        >
          <img
            src="/src/assets/icons/Dashboard.png"
            alt="Dashboard"
            className={
              activeTab === "dashboard"
                ? "h-6 w-6 invert brightness-200"
                : "h-6 w-6 opacity-50"
            }
          />
          <span
            className={
              activeTab === "dashboard"
                ? "text-white font-semibold"
                : "text-white/50"
            }
          >
            Dashboard
          </span>
        </button>

        {/* Kalender */}
        <button
          onClick={() => onChange("calendar")}
          className="flex flex-col items-center gap-1 text-xs w-full"
        >
          <img
            src="/src/assets/icons/Kalender.png"
            alt="Kalender"
            className={
              activeTab === "calendar"
                ? "h-6 w-6 invert brightness-200"
                : "h-6 w-6 opacity-50"
            }
          />
          <span
            className={
              activeTab === "calendar"
                ? "text-white font-semibold"
                : "text-white/50"
            }
          >
            Kalender
          </span>
        </button>

        {/* Trainingsplan */}
        <button
          onClick={() => onChange("plan")}
          className="flex flex-col items-center gap-1 text-xs w-full"
        >
          <img
            src="/src/assets/icons/Trainingsplan.png"
            alt="Trainingsplan"
            className={
              activeTab === "plan"
                ? "h-6 w-6 invert brightness-200"
                : "h-6 w-6 opacity-50"
            }
          />
          <span
            className={
              activeTab === "plan"
                ? "text-white font-semibold"
                : "text-white/50"
            }
          >
            Plan
          </span>
        </button>

        {/* Profil (Settings sind hier integriert) */}
        <button
          onClick={() => onChange("profile")}
          className="flex flex-col items-center gap-1 text-xs w-full"
        >
          <img
            src="/src/assets/icons/Einstellungen.png"
            alt="Profil"
            className={
              activeTab === "profile"
                ? "h-6 w-6 invert brightness-200"
                : "h-6 w-6 opacity-50"
            }
          />
          <span
            className={
              activeTab === "profile"
                ? "text-white font-semibold"
                : "text-white/50"
            }
          >
            Profil
          </span>
        </button>

      </div>
    </footer>
  );
};
