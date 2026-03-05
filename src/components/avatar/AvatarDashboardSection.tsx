// src/components/avatar/AvatarDashboardSection.tsx
// Dashboard widget showing the robot avatar, stage, and XP progress bar.

import React, { useState } from "react";
import RobotAvatarSvg from "./RobotAvatarSvg";
import RobotDetailModal from "./RobotDetailModal";
import { useAvatarState } from "../../store/useAvatarStore";
import { STAGE_NAMES, stageProgress, STAGE_THRESHOLDS } from "../../utils/avatarProgression";
import { track } from "../../analytics/track";

export default function AvatarDashboardSection() {
  const { totalXp, stage, variant } = useAvatarState();
  const progress = stageProgress(totalXp, stage);
  const stageName = STAGE_NAMES[stage] ?? "Prototyp";
  const currentThreshold = STAGE_THRESHOLDS[stage] ?? 0;
  const nextThreshold = STAGE_THRESHOLDS[stage + 1] ?? currentThreshold;
  const isMaxStage = stage >= STAGE_THRESHOLDS.length - 1;

  const [detailOpen, setDetailOpen] = useState(false);

  const handleOpen = () => {
    track("robot_detail_opened");
    setDetailOpen(true);
  };

  return (
    <>
      <button
        type="button"
        className="w-full rounded-2xl p-4 flex items-center gap-4 text-left"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border-color)" }}
        onClick={handleOpen}
      >
        {/* Robot Avatar */}
        <div className="shrink-0">
          <RobotAvatarSvg stage={stage} variant={variant} size={80} animate />
        </div>

        {/* Info + Progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Stufe {stage}
            </span>
            <span className="text-sm font-semibold" style={{ color: "var(--text-color)" }}>
              {stageName}
            </span>
          </div>

          {/* XP Progress Bar */}
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round(progress * 100)}%`,
                background: variant === "bulk"
                  ? "linear-gradient(90deg, #FF6B35, #E63946)"
                  : "linear-gradient(90deg, #00B4D8, #0077B6)",
              }}
            />
          </div>

          {/* XP text */}
          <div className="flex justify-between mt-1">
            <span className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {totalXp} XP
            </span>
            {!isMaxStage && (
              <span className="text-[11px] tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {nextThreshold} XP
              </span>
            )}
          </div>
        </div>

        {/* Chevron hint */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="shrink-0 opacity-40"
        >
          <path
            d="M7.5 4.5L13 10L7.5 15.5"
            stroke="var(--text-secondary)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <RobotDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}
