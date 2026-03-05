// src/components/avatar/RobotDetailModal.tsx
// Detail modal for robot avatar — shows preview, XP progress, stage track, XP sources.

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "../common/BottomSheet";
import RobotAvatarSvg from "./RobotAvatarSvg";
import { useAvatarState } from "../../store/useAvatarStore";
import {
  STAGE_NAMES,
  STAGE_THRESHOLDS,
  stageProgress,
} from "../../utils/avatarProgression";
import { AppCard } from "../ui/AppCard";
import { useI18n } from "../../i18n/useI18n";
import { track } from "../../analytics/track";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function RobotDetailModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const { totalXp, stage, variant } = useAvatarState();
  const progress = stageProgress(totalXp, stage);
  const stageName = STAGE_NAMES[stage] ?? "Prototyp";
  const currentThreshold = STAGE_THRESHOLDS[stage] ?? 0;
  const nextThreshold = STAGE_THRESHOLDS[stage + 1] ?? currentThreshold;
  const isMaxStage = stage >= STAGE_THRESHOLDS.length - 1;
  const xpInStage = totalXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const xpToNext = nextThreshold - totalXp;

  const scrollRef = useRef<HTMLDivElement>(null);
  const currentCardRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current stage on mount
  useEffect(() => {
    if (open && currentCardRef.current) {
      setTimeout(() => {
        currentCardRef.current?.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }, 350);
    }
  }, [open]);

  // Lock background scroll when modal is open (iOS Safari/Capacitor)
  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.overflow = "";
      html.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const handleClose = () => {
    track("robot_detail_closed");
    onClose();
  };

  const gradient =
    variant === "bulk"
      ? "linear-gradient(90deg, #FF6B35, #E63946)"
      : "linear-gradient(90deg, #00B4D8, #0077B6)";

  return createPortal(
    <BottomSheet
      open={open}
      onClose={handleClose}
      height="100dvh"
      maxHeight="100dvh"
      variant="docked"
      showHandle={false}
      zIndex={10000}
      sheetStyle={{ background: "var(--card-bg)" }}
      header={
        <div className="flex justify-end px-4" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--border-color)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      }
    >
      <div className="px-4 pb-6 space-y-6">
        {/* ── 1. Large Robot Preview ── */}
        <div className="flex flex-col items-center pt-2 pb-4 -mx-4">
          <RobotAvatarSvg stage={stage} variant={variant} size={160} animate />
          <h2
            className="text-xl font-bold mt-3"
            style={{ color: "var(--text-color)" }}
          >
            {stageName}
          </h2>
          <span
            className="text-xs font-bold uppercase tracking-wider mt-1 px-3 py-1 rounded-full"
            style={{
              color: variant === "bulk" ? "#FF6B35" : "#00B4D8",
              background: variant === "bulk" ? "rgba(255,107,53,0.12)" : "rgba(0,180,216,0.12)",
            }}
          >
            {t("robot.detail.stage", { stage })}
          </span>
        </div>

        {/* ── 2. XP Progress ── */}
        <div>
          <div
            className="w-full h-3 rounded-full overflow-hidden"
            style={{ background: "var(--border-color)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: gradient,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span
              className="text-xs tabular-nums font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {isMaxStage
                ? `${totalXp} XP`
                : `${xpInStage} / ${xpNeeded} XP`}
            </span>
            <span
              className="text-xs tabular-nums"
              style={{ color: "var(--text-secondary)" }}
            >
              {isMaxStage
                ? t("robot.detail.maxStage")
                : t("robot.detail.xpToNext", { xp: xpToNext, next: stage + 1 })}
            </span>
          </div>
        </div>

        {/* ── 3. Stage Track (horizontal scroll) ── */}
        <div>
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-color)" }}
          >
            {t("robot.detail.stagesTitle")}
          </h3>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
            style={{ scrollSnapType: "x mandatory" }}
            onScroll={() => track("robot_stage_scrolled")}
          >
            {STAGE_THRESHOLDS.map((threshold, i) => {
              const isUnlocked = i <= stage;
              const isCurrent = i === stage;
              return (
                <div
                  key={i}
                  ref={isCurrent ? currentCardRef : undefined}
                  className="shrink-0 flex flex-col items-center rounded-2xl p-3 border transition-all"
                  style={{
                    scrollSnapAlign: "center",
                    width: 88,
                    background: isCurrent
                      ? variant === "bulk"
                        ? "rgba(255,107,53,0.08)"
                        : "rgba(0,180,216,0.08)"
                      : "var(--card-bg)",
                    borderColor: isCurrent
                      ? variant === "bulk"
                        ? "#FF6B35"
                        : "#00B4D8"
                      : "var(--border-color)",
                    borderWidth: isCurrent ? 2 : 1,
                  }}
                >
                  <div className="relative">
                    <div className={isUnlocked ? "" : "opacity-30 grayscale"}>
                      <RobotAvatarSvg
                        stage={i}
                        variant={variant}
                        size={48}
                      />
                    </div>
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex items-center justify-center text-lg">
                        🔒
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[10px] font-bold mt-1.5 text-center leading-tight"
                    style={{
                      color: isCurrent
                        ? variant === "bulk"
                          ? "#FF6B35"
                          : "#00B4D8"
                        : isUnlocked
                          ? "var(--text-color)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {STAGE_NAMES[i]}
                  </span>
                  <span
                    className="text-[9px] tabular-nums mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {threshold} XP
                  </span>
                  {isCurrent && (
                    <span
                      className="text-[8px] font-bold uppercase mt-1"
                      style={{
                        color: variant === "bulk" ? "#FF6B35" : "#00B4D8",
                      }}
                    >
                      {t("robot.detail.current")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. XP Sources ── */}
        <AppCard>
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-color)" }}
          >
            {t("robot.detail.xpSourcesTitle")}
          </h3>
          <div className="space-y-2.5">
            <XpRow
              label={t("robot.detail.xpGym")}
              detail={t("robot.detail.xpGymDetail")}
            />
            <XpRow
              label={t("robot.detail.xpCardio")}
              detail={t("robot.detail.xpCardioDetail")}
            />
            <XpRow
              label={t("robot.detail.xpCustom")}
            />
            <div
              className="h-px my-2"
              style={{ background: "var(--border-color)" }}
            />
            <XpRow label={t("robot.detail.xpDailyCap")} icon="📅" />
            <XpRow label={t("robot.detail.xpWeeklyCap")} icon="📆" />
            <p
              className="text-[11px] mt-2 italic"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("robot.detail.xpValidated")}
            </p>
          </div>
        </AppCard>

        {/* bottom padding for safe area */}
        <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }} />
      </div>
    </BottomSheet>,
    document.body,
  );
}

function XpRow({
  label,
  detail,
  icon,
}: {
  label: string;
  detail?: string;
  icon?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-sm mt-0.5">{icon ?? "⚡"}</span>
      <div>
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-color)" }}
        >
          {label}
        </span>
        {detail && (
          <p
            className="text-[11px] leading-tight"
            style={{ color: "var(--text-secondary)" }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}
