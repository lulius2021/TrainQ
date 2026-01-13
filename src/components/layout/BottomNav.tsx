// src/components/layout/BottomNav.tsx
import type { ReactNode } from "react";
import type { TabKey } from "../../App";
import { useI18n } from "../../i18n/useI18n";

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
  const { t } = useI18n();
  const Item = (p: {
    keyTab: TabKey;
    label: string;
    icon?: string;
    renderIcon?: (active: boolean) => ReactNode;
    isPrimary?: boolean;
  }) => {
    const active = activeTab === p.keyTab;

    return (
      <button
        onClick={() => onChange(p.keyTab)}
        className="flex flex-col items-center gap-0.5 px-2 py-1 min-h-[44px]"
      >
        {p.isPrimary ? (
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            {p.renderIcon?.(active)}
          </div>
        ) : p.renderIcon ? (
          p.renderIcon(active)
        ) : (
          <img
            src={p.icon}
            alt={p.label}
            className="h-6 w-6"
            style={{ filter: active ? ACTIVE_ICON_FILTER : INACTIVE_ICON_FILTER }}
          />
        )}

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
            background: p.isPrimary ? "transparent" : active ? "var(--primarySoft)" : "transparent",
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
        <Item keyTab="dashboard" label={t("nav.dashboard")} icon={DashboardIcon} />
        <Item keyTab="calendar" label={t("nav.calendar")} icon={KalenderIcon} />
        <Item
          keyTab="today"
          label={t("nav.play")}
          isPrimary
          renderIcon={() => (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M8 6.5V17.5L18 12L8 6.5Z" fill="#061226" />
            </svg>
          )}
        />
        <Item keyTab="plan" label={t("nav.plan")} icon={TrainingsplanIcon} />
        <Item keyTab="profile" label={t("nav.profile")} icon={ProfilIcon} />
      </div>
    </nav>
  );
}
