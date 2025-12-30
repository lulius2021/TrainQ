// src/components/layout/BottomNav.tsx
import type { TabKey } from "../../App";

import DashboardIcon from "../../assets/icons/Dashboard.png";
import KalenderIcon from "../../assets/icons/Kalender.png";
import TrainingsplanIcon from "../../assets/icons/Trainingsplan.png";
import ProfilIcon from "../../assets/icons/Profil.png";

const ACTIVE_ICON_FILTER =
  "invert(47%) sepia(94%) saturate(1820%) hue-rotate(188deg) brightness(97%) contrast(101%)";
const INACTIVE_ICON_FILTER = "invert(60%) opacity(0.55)";

type BottomNavProps = {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
};

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  const Item = (p: { keyTab: TabKey; label: string; icon: string }) => {
    const active = activeTab === p.keyTab;

    return (
      <button
        onClick={() => onChange(p.keyTab)}
        className="flex flex-col items-center gap-0.5 px-2 py-1"
      >
        <img
          src={p.icon}
          alt={p.label}
          className="h-6 w-6"
          style={{ filter: active ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
        />

        <span
          className="text-[10px] font-medium"
          style={{
            color: active ? "var(--primarySoft)" : "var(--muted)",
          }}
        >
          {p.label}
        </span>

        <div
          className="mt-0.5 h-0.5 w-5 rounded-full transition"
          style={{
            background: active ? "var(--primarySoft)" : "transparent",
          }}
        />
      </button>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        /* 👇 schwebt über dem blau → schwarz Verlauf */
        background:
          "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0.25), transparent)",
        borderTop: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2">
        <Item keyTab="dashboard" label="Dashboard" icon={DashboardIcon} />
        <Item keyTab="calendar" label="Kalender" icon={KalenderIcon} />
        <Item keyTab="plan" label="Plan" icon={TrainingsplanIcon} />
        <Item keyTab="profile" label="Profil" icon={ProfilIcon} />
      </div>
    </nav>
  );
}