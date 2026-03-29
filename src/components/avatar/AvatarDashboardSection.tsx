// src/components/avatar/AvatarDashboardSection.tsx
// Dashboard widget: shows the human avatar with dominant pose + body-part summary.

import React, { useState } from "react";
import HumanAvatarSvg from "./HumanAvatarSvg";
import AvatarDetailModal from "./RobotDetailModal";
import { useAvatarState } from "../../store/useAvatarStore";
import {
  levelFromPoints,
  detectPose,
  overallLevel,
} from "../../utils/avatarProgression";
import { track } from "../../analytics/track";

const POSE_LABELS: Record<string, string> = {
  stand:     "Kraftsportler",
  run:       "Läufer",
  cycle:     "Radfahrer",
  handstand: "Calisthenics",
  rest:      "Erholt dich",
};

const POSE_ACCENTS: Record<string, string> = {
  stand:     "#FF6B35",
  run:       "#43E97B",
  cycle:     "#4CC9F0",
  handstand: "#A78BFA",
  rest:      "#94A3B8",
};

const BODY_PART_LABELS: Record<string, string> = {
  chest:     "Brust",
  back:      "Rücken",
  shoulders: "Schultern",
  arms:      "Arme",
  legs:      "Beine",
  core:      "Core",
  cardio:    "Ausdauer",
};

function todayISO() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function AvatarDashboardSection() {
  const state = useAvatarState();
  const [detailOpen, setDetailOpen] = useState(false);

  const pose      = detectPose(state, todayISO());
  const accent    = POSE_ACCENTS[pose] ?? "#FF6B35";
  const poseLabel = POSE_LABELS[pose] ?? "Trainierend";
  const level     = overallLevel(state);

  // Top-3 trained body parts by level
  const partEntries = Object.entries(state.bodyParts)
    .map(([key, stats]) => ({ key, level: levelFromPoints(stats.points) }))
    .sort((a, b) => b.level - a.level)
    .slice(0, 3);

  const handleOpen = () => {
    track("avatar_detail_opened");
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
        {/* Avatar */}
        <div className="shrink-0">
          <HumanAvatarSvg
            pose={pose}
            bodyLevels={{
              chest:     levelFromPoints(state.bodyParts.chest.points),
              back:      levelFromPoints(state.bodyParts.back.points),
              shoulders: levelFromPoints(state.bodyParts.shoulders.points),
              arms:      levelFromPoints(state.bodyParts.arms.points),
              legs:      levelFromPoints(state.bodyParts.legs.points),
              core:      levelFromPoints(state.bodyParts.core.points),
              cardio:    levelFromPoints(state.bodyParts.cardio.points),
            }}
            size={64}
            animate
            accentColor={accent}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Pose label + overall level */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-sm font-bold"
              style={{ color: accent }}
            >
              {poseLabel}
            </span>
            <span className="text-xs rounded-full px-2 py-0.5 font-semibold tabular-nums"
              style={{ background: `${accent}22`, color: accent }}>
              Lvl {level.toFixed(1)}
            </span>
          </div>

          {/* Top 3 body parts as small pill bars */}
          <div className="flex flex-col gap-1">
            {partEntries.map(({ key, level: lv }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] w-14 truncate" style={{ color: "var(--text-secondary)" }}>
                  {BODY_PART_LABELS[key] ?? key}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${lv * 10}%`, background: accent }}
                  />
                </div>
                <span className="text-[10px] tabular-nums w-5 text-right" style={{ color: "var(--text-secondary)" }}>
                  {Math.round(lv * 10)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chevron */}
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 opacity-40">
          <path d="M7.5 4.5L13 10L7.5 15.5" stroke="var(--text-secondary)" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <AvatarDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} />
    </>
  );
}
