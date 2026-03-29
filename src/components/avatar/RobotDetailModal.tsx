// src/components/avatar/RobotDetailModal.tsx
// Detail modal: body-composition breakdown + activity stats + atrophy warnings.

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "../common/BottomSheet";
import HumanAvatarSvg from "./HumanAvatarSvg";
import { useAvatarState } from "../../store/useAvatarStore";
import {
  levelFromPoints,
  levelLabel,
  detectPose,
  applyAtrophy,
} from "../../utils/avatarProgression";
import { track } from "../../analytics/track";

type Props = { open: boolean; onClose: () => void };

const PART_META: Record<string, { label: string; color: string }> = {
  chest:     { label: "Brust",     color: "#FF6B35" },
  back:      { label: "Rücken",    color: "#F59E0B" },
  shoulders: { label: "Schultern", color: "#3B82F6" },
  arms:      { label: "Arme",      color: "#EF4444" },
  legs:      { label: "Beine",     color: "#8B5CF6" },
  core:      { label: "Core",      color: "#10B981" },
  cardio:    { label: "Ausdauer",  color: "#EC4899" },
};

const POSE_META: Record<string, { label: string; desc: string; color: string }> = {
  stand:     { label: "Kraftsportler", desc: "Dein Fokus liegt auf Muskelaufbau im Gym.",          color: "#FF6B35" },
  run:       { label: "Läufer",        desc: "Du dominierst die Laufstrecke.",                     color: "#43E97B" },
  cycle:     { label: "Radfahrer",     desc: "Deine Ausdauer auf dem Rad ist beeindruckend.",       color: "#4CC9F0" },
  handstand: { label: "Calisthenics",  desc: "Körperkontrolle und Kraft ohne Geräte.",              color: "#A78BFA" },
  rest:      { label: "Ruhephase",     desc: "Mehr als 14 Tage ohne Training — dein Körper wartet.", color: "#94A3B8" },
};

function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

function daysSince(dateISO: string | null): number {
  if (!dateISO) return 999;
  return Math.floor((Date.now() - new Date(dateISO).getTime()) / (1000 * 60 * 60 * 24));
}

export default function AvatarDetailModal({ open, onClose }: Props) {
  const state   = useAvatarState();
  const today   = todayISO();
  const pose    = detectPose(state, today);
  const poseMeta = POSE_META[pose] ?? POSE_META.stand;

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const handleClose = () => {
    track("avatar_detail_closed");
    onClose();
  };

  // Compute effective levels (with atrophy for display)
  const effectiveLevels = Object.fromEntries(
    Object.entries(state.bodyParts).map(([key, stats]) => {
      const effective = applyAtrophy(stats, today);
      return [key, {
        level:       levelFromPoints(effective.points),
        rawLevel:    levelFromPoints(stats.points),       // before today's atrophy
        lastTrained: stats.lastTrainedDate,
        earned:      stats.earned,
      }];
    }),
  ) as Record<string, { level: number; rawLevel: number; lastTrained: string | null; earned: number }>;

  const bodyLevelsForSvg = {
    chest:     effectiveLevels.chest?.level ?? 0,
    back:      effectiveLevels.back?.level ?? 0,
    shoulders: effectiveLevels.shoulders?.level ?? 0,
    arms:      effectiveLevels.arms?.level ?? 0,
    legs:      effectiveLevels.legs?.level ?? 0,
    core:      effectiveLevels.core?.level ?? 0,
    cardio:    effectiveLevels.cardio?.level ?? 0,
  };

  // Last 30-day activity breakdown
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const recentActivity = state.activityLog.filter(e => e.date >= cutoffISO);

  const activitySummary = recentActivity.reduce<Record<string, number>>((acc, e) => {
    const key = e.workoutType ?? e.sport;
    acc[key] = (acc[key] ?? 0) + e.minutes;
    return acc;
  }, {});

  const totalMinutes = Object.values(activitySummary).reduce((s, v) => s + v, 0);

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
          <button type="button" onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "var(--border-color)" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      }
    >
      <div className="px-4 pb-10 space-y-6">

        {/* ── Avatar + Pose Identity ── */}
        <div className="flex flex-col items-center gap-3 pt-2">
          <HumanAvatarSvg
            pose={pose}
            bodyLevels={bodyLevelsForSvg}
            size={100}
            animate
            accentColor={poseMeta.color}
          />
          <div className="text-center">
            <div className="text-xl font-black" style={{ color: poseMeta.color }}>
              {poseMeta.label}
            </div>
            <div className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              {poseMeta.desc}
            </div>
          </div>
        </div>

        {/* ── Body Part Breakdown ── */}
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-secondary)" }}>
            Körperzusammensetzung
          </h3>
          <div className="space-y-3">
            {Object.entries(PART_META).map(([key, meta]) => {
              const data = effectiveLevels[key];
              if (!data) return null;
              const lv = data.level;
              const pct = lv * 10;
              const days = daysSince(data.lastTrained);
              const atrophying = days > 7;
              const atrophyWarn = atrophying && lv > 0;

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-color)" }}>
                        {meta.label}
                      </span>
                      {atrophyWarn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: "#F59E0B22", color: "#F59E0B" }}>
                          -{days - 7}d Atrophie
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tabular-nums" style={{ color: meta.color }}>
                        Lvl {lv.toFixed(1)}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {levelLabel(lv)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden"
                    style={{ background: "var(--border-color)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: atrophyWarn
                          ? `linear-gradient(90deg, ${meta.color}, #F59E0B)`
                          : meta.color,
                      }}
                    />
                  </div>
                  {data.lastTrained && (
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                      Zuletzt trainiert: vor {days === 0 ? "heute" : `${days} Tag${days !== 1 ? "en" : ""}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Last 30 Days Activity ── */}
        {totalMinutes > 0 && (
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-secondary)" }}>
              Letzte 30 Tage
            </h3>
            <div className="space-y-2">
              {Object.entries(activitySummary)
                .sort(([, a], [, b]) => b - a)
                .map(([key, mins]) => {
                  const pct = (mins / totalMinutes) * 100;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs w-20 truncate" style={{ color: "var(--text-secondary)" }}>
                        {key}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden"
                        style={{ background: "var(--border-color)" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: poseMeta.color }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-12 text-right"
                        style={{ color: "var(--text-secondary)" }}>
                        {mins} Min
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── How gains work ── */}
        <div className="rounded-xl p-4 space-y-2"
          style={{ background: "var(--border-color)", opacity: 0.9 }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: "var(--text-secondary)" }}>
            So wächst dein Körper
          </div>
          {[
            "Push-Training stärkt Brust, Schultern & Arme",
            "Pull-Training stärkt Rücken & Arme",
            "Bein-Training stärkt Beine & Core",
            "Laufen & Radfahren stärkt Ausdauer & Beine",
            "Calisthenics stärkt Core, Arme & Schultern",
            "Ohne Training verlierst du nach 7 Tagen langsam Fortschritt",
          ].map((text) => (
            <div key={text} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--text-secondary)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{text}</span>
            </div>
          ))}
        </div>

      </div>
    </BottomSheet>,
    document.body,
  );
}
