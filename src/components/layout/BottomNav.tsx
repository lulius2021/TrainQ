// src/components/layout/BottomNav.tsx
import type { TabKey } from "../../App";
import { useI18n } from "../../i18n/useI18n";
import { useModalStore } from "../../store/useModalStore";
import { hapticButton } from "../../native/haptics";

import { IconListDashHeaderRectangle } from "../../assets/icons/IconListDashHeaderRectangle";
import { IconCalendarBadgeCheckmark } from "../../assets/icons/IconCalendarBadgeCheckmark";
import { IconPerson } from "../../assets/icons/IconPerson";
import { IconFigureStrengthtraining } from "../../assets/icons/IconFigureStrengthtraining";
import { IconListClipboard } from "../../assets/icons/IconListClipboard";

type BottomNavProps = {
  activeTab: TabKey;
  onChange: (t: TabKey) => void;
  /** Called when the already-active tab is tapped — triggers scroll-to-top. */
  onActiveTap?: (t: TabKey) => void;
};

type TabDef = { key: TabKey; SvgIcon: React.FC<React.SVGProps<SVGSVGElement>>; w: number; h: number };

const TABS: TabDef[] = [
  { key: "dashboard", SvgIcon: IconListDashHeaderRectangle, w: 24, h: 18 },
  { key: "calendar",  SvgIcon: IconCalendarBadgeCheckmark,  w: 24, h: 20 },
  { key: "today",     SvgIcon: IconFigureStrengthtraining,  w: 22, h: 22 },
  { key: "plan",      SvgIcon: IconListClipboard,           w: 18, h: 22 },
  { key: "profile",   SvgIcon: IconPerson,                  w: 20, h: 21 },
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
          borderRadius: 24,
          backgroundColor: "var(--nav-bg)",
          backdropFilter: "blur(48px) saturate(2)",
          WebkitBackdropFilter: "blur(48px) saturate(2)",
          border: "0.5px solid var(--border-color)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.1)",
          display: "flex",
          alignItems: "stretch",
          padding: "0 4px",
        }}
      >
        {TABS.map(({ key, SvgIcon, w, h }) => {
          const active = activeTab === key;
          const iconColor = active ? "var(--nav-item-active)" : "var(--nav-item-inactive)";
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
              <SvgIcon
                width={w}
                height={h}
                fill={iconColor}
                style={{ transition: "fill 0.18s ease", flexShrink: 0 }}
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
