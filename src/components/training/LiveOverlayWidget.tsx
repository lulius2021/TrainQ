import React from "react";
import { useI18n } from "../../i18n/useI18n";

type LiveOverlayMode = "run" | "gym" | "bike" | "other";

export type LiveOverlayWidgetProps = {
  mode: LiveOverlayMode;
  title: string;
  subtitle?: string;
  primaryText: string;
  rightTopText?: string;
  onPrimaryAction?: () => void;
  onTap?: () => void;
  visible: boolean;
  position?: "bottom" | "top";
  bottomOffsetPx?: number;
  topOffsetPx?: number;
};

export default function LiveOverlayWidget({
  mode,
  title,
  subtitle,
  primaryText,
  rightTopText,
  onPrimaryAction,
  onTap,
  visible,
  position = "bottom",
  bottomOffsetPx = 12,
  topOffsetPx = 12,
}: LiveOverlayWidgetProps) {
  const { t } = useI18n();
  if (!visible) return null;

  const avatarLetter = title?.trim()?.[0]?.toUpperCase() || t("live.overlay.avatarFallback");
  const modeLabel = t(`live.overlay.mode.${mode}`);

  const rootStyle: React.CSSProperties =
    position === "top"
      ? { top: `calc(env(safe-area-inset-top) + ${topOffsetPx}px)` }
      : { bottom: `calc(env(safe-area-inset-bottom) + ${bottomOffsetPx}px)` };

  return (
    <div
      className="fixed left-1/2 z-50 w-[92vw] max-w-[420px] -translate-x-1/2"
      style={rootStyle}
      onClick={onTap}
      role="button"
      aria-label={t("live.overlay.aria")}
    >
      <div className="grid gap-3 rounded-[28px] border border-white/10 bg-black/65 px-4 py-4 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-white/70">
          <span>{modeLabel}</span>
          {rightTopText ? <span className="text-white/80">{rightTopText}</span> : <span />}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/90">
            {avatarLetter}
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-white">{title}</div>
            {subtitle ? <div className="truncate text-[12px] text-white/70">{subtitle}</div> : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="text-xl font-semibold text-white">{primaryText}</div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrimaryAction?.();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20"
            aria-label={t("live.overlay.primaryAction")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l5 5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
