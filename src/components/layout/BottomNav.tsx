// src/components/layout/BottomNav.tsx
import type { TabKey } from "../../App";
import { useI18n } from "../../i18n/useI18n";
import { useModalStore } from "../../store/useModalStore";
import { hapticButton } from "../../native/haptics";

import DashboardIcon from "../../assets/icons/Dashboard.png";
import KalenderIcon from "../../assets/icons/Kalender.png";
import TrainIcon from "../../assets/icons/Train.png";
import TrainingsplanIcon from "../../assets/icons/Trainingsplan.png";
import ProfilIcon from "../../assets/icons/Profil.png";

type BottomNavProps = {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
  /** Called when the already-active tab is tapped — triggers scroll-to-top. */
  onActiveTap?: (t: TabKey) => void;
};

const TABS: { key: TabKey; icon: string }[] = [
  { key: "dashboard", icon: DashboardIcon },
  { key: "calendar",  icon: KalenderIcon },
  { key: "today",     icon: TrainIcon },
  { key: "plan",      icon: TrainingsplanIcon },
  { key: "profile",   icon: ProfilIcon },
];

export function BottomNav({ activeTab, onChange, onActiveTap }: BottomNavProps) {
  const { t } = useI18n();
  const modalOpen = useModalStore((s) => s.openCount > 0);
  const labels: Record<TabKey, string> = {
    dashboard: t("nav.dashboard"),
    calendar:  t("nav.calendar"),
    today:     t("nav.play"),
    plan:      t("nav.plan"),
    profile:   t("nav.profile"),
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: 16,
        paddingRight: 16,
        transform: modalOpen ? "translateY(120%)" : "translateY(0)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* ── Tab bar pill ── */}
      <div
        className="pointer-events-auto mx-auto"
        style={{
          maxWidth: 390,
          height: "var(--tab-bar-height)",
          borderRadius: 22,
          backgroundColor: "var(--card-bg)",
          border: "0.5px solid var(--border-color)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.07)",
          display: "flex",
          alignItems: "stretch",
          padding: "0 2px",
        }}
      >
        {TABS.map(({ key, icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => { hapticButton(); key === activeTab ? onActiveTap?.(key) : onChange(key); }}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                padding: "5px 2px",
                borderRadius: 14,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {/* Icon — color driven by CSS variable via backgroundColor on mask */}
              <div
                style={{
                  width: 23,
                  height: 23,
                  backgroundColor: active ? "var(--nav-item-active)" : "var(--nav-item-inactive)",
                  maskImage: `url(${icon})`,
                  WebkitMaskImage: `url(${icon})`,
                  maskSize: "contain",
                  WebkitMaskSize: "contain",
                  maskRepeat: "no-repeat",
                  WebkitMaskRepeat: "no-repeat",
                  maskPosition: "center",
                  WebkitMaskPosition: "center",
                  transition: "background-color 0.18s ease",
                  flexShrink: 0,
                }}
              />
              {/* Label */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  lineHeight: "12px",
                  color: active ? "var(--nav-item-active)" : "var(--nav-item-inactive)",
                  whiteSpace: "nowrap",
                  transition: "color 0.18s ease",
                  letterSpacing: "-0.1px",
                }}
              >
                {labels[key]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
