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
    const color = active ? "var(--nav-icon-active)" : "var(--nav-icon-inactive)";
    const labelColor = active ? "var(--nav-icon-active)" : "var(--nav-label)";

    return (
      <button
        onClick={() => onChange(p.keyTab)}
        className="flex flex-col items-center gap-0.5 px-2 py-1 min-h-[44px] btn-haptic"
      >
        {p.isPrimary ? (
          <div
            className="h-12 w-12 rounded-3xl flex items-center justify-center shadow-lg"
            style={{ background: "var(--accent-color)" }}
          >
            {p.renderIcon?.(active)}
          </div>
        ) : p.renderIcon ? (
          p.renderIcon(active)
        ) : (
          <div
            className="h-6 w-6"
            style={{
              backgroundColor: color,
              maskImage: `url(${p.icon})`,
              WebkitMaskImage: `url(${p.icon})`,
              maskSize: "contain",
              WebkitMaskSize: "contain",
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskPosition: "center",
            }}
          />
        )}

        <span
          className="text-[10px] font-medium"
          style={{ color: labelColor }}
        >
          {p.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 transition-colors duration-300"
      style={{
        backgroundColor: "var(--nav-bg)",
        borderTop: "1px solid var(--border-color)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M8 6.5V17.5L18 12L8 6.5Z" fill="#FFFFFF" />
            </svg>
          )}
        />
        <Item keyTab="plan" label={t("nav.plan")} icon={TrainingsplanIcon} />
        <Item keyTab="profile" label={t("nav.profile")} icon={ProfilIcon} />
      </div>
    </nav>
  );
}
