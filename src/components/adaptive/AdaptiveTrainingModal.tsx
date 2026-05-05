// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../../i18n/useI18n";
import AdaptivePlanCard, { GRADIENTS } from "./AdaptivePlanCard";
import type { TranslationKey } from "../../i18n/index";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions, profileAccent } from "../../utils/adaptiveScoring";
import { buildUserAdaptiveContext } from "../../utils/adaptivePersonalization";
import { BottomSheet } from "../common/BottomSheet";
import { Clock, Zap, Brain, CalendarPlus, Bike } from "lucide-react";
import { IconDumbbellFill } from "../../assets/icons/IconDumbbellFill";
import { IconFigureRun } from "../../assets/icons/IconFigureRun";

const MotionDiv = motion.div as unknown as React.ComponentType<any>;

const pageSlideVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0.3 }),
  center: { x: "0%", opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0.3 }),
};

function reasonKey(r: AdaptiveReason): TranslationKey {
  const map: Record<AdaptiveReason, TranslationKey> = {
    time_low:      "adaptive.reason.timeLow",
    time_high:     "adaptive.reason.timeHigh",
    form_low:      "adaptive.reason.formLow",
    form_high:     "adaptive.reason.formHigh",
    stress_low:    "adaptive.reason.stressLow",
    stress_high:   "adaptive.reason.stressHigh",
    effort_low:    "adaptive.reason.effortLow",
    effort_high:   "adaptive.reason.effortHigh",
    recovery_low:  "adaptive.reason.recoveryLow",
    recovery_good: "adaptive.reason.recoveryGood",
    volume_high:   "adaptive.reason.volumeHigh",
    rest_gap:      "adaptive.reason.restGap",
    last_too_hard: "adaptive.reason.lastTooHard",
    last_too_easy: "adaptive.reason.lastTooEasy",
    split_covered: "adaptive.reason.splitCovered",
  };
  return map[r] ?? ("adaptive.reason.default" as TranslationKey);
}

// Standalone exercise preview component — avoids IIFE re-render issues
const ExercisePreviewAccordion: React.FC<{
  exercises: { name: string; avgWeight: number; avgReps: number; progressionReady: boolean; suggestedWeight: number; splitType: string }[];
  count: number;
  nextSplit: string;
  t: (key: string) => string;
  darkMode?: boolean;
}> = ({ exercises, count, nextSplit, t, darkMode }) => {
  const [open, setOpen] = useState(false);

  const splitFiltered = nextSplit !== "full"
    ? exercises.filter(ex => ex.splitType === nextSplit || ex.splitType === "full")
    : exercises;
  const actualSplit = splitFiltered.length >= 2 ? nextSplit : "full";
  const pool = splitFiltered.length >= 2 ? splitFiltered : exercises;
  const display = pool.slice(0, count);
  const remaining = Math.max(0, count - display.length);

  if (display.length === 0) return null;

  const bg = darkMode ? "rgba(255,255,255,0.08)" : "var(--card-bg)";
  const border = darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid var(--border-color)";
  const textColor = darkMode ? "#fff" : "var(--text-color)";
  const mutedColor = darkMode ? "rgba(255,255,255,0.5)" : "var(--text-muted)";
  const rowBg = darkMode ? "rgba(255,255,255,0.06)" : "var(--input-bg)";
  const badgeBg = darkMode ? "rgba(255,255,255,0.15)" : "var(--input-bg)";
  const badgeColor = darkMode ? "#fff" : "var(--text-secondary)";

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bg, border }}>
      <div
        role="button"
        tabIndex={0}
        onPointerUp={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between py-3.5 px-4 cursor-pointer select-none"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: textColor }}>
          {t("adaptive.exercisePreview")} ({count})
          {actualSplit !== "full" && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: badgeBg, color: badgeColor }}>
              {t(`adaptive.split.${actualSplit}`)}
            </span>
          )}
        </span>
        <span className="text-sm" style={{ color: mutedColor, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </div>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          {display.map((ex, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ backgroundColor: rowBg }}>
              <span className="text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 tabular-nums" style={{ background: "rgba(0,122,255,0.15)", color: "#3B9EFF" }}>
                {i + 1}
              </span>
              <span className="text-[13px] font-medium flex-1" style={{ color: textColor }}>{ex.name}</span>
              {ex.avgWeight > 0 && (
                <span className="text-[12px] font-bold shrink-0 tabular-nums" style={{ color: ex.progressionReady ? "#FF9500" : mutedColor }}>
                  {ex.progressionReady ? ex.suggestedWeight : ex.avgWeight} kg × {ex.avgReps}
                  {ex.progressionReady && " ↑"}
                </span>
              )}
            </div>
          ))}
          {remaining > 0 && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ backgroundColor: rowBg }}>
              <span className="text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 tabular-nums" style={{ background: "rgba(255,255,255,0.08)", color: mutedColor }}>
                +
              </span>
              <span className="text-[13px] font-medium flex-1" style={{ color: mutedColor }}>
                {remaining} {remaining === 1 ? t("adaptive.moreExercise") : t("adaptive.moreExercises")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface AdaptiveTrainingModalProps {
  open: boolean;
  onClose: () => void;
  plannedWorkoutType: WorkoutType;
  splitType: SplitType;
  onSelect: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
  onSaveToCalendar?: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
  previewExercises?: { name: string; muscleGroup?: string }[];
}

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { t } = useI18n();
  const { open, onClose, plannedWorkoutType, splitType, onSelect, onSaveToCalendar, previewExercises } = props;

  const [step, setStep] = useState<"questions" | "suggestions">("questions");
  const [answers, setAnswers] = useState<AdaptiveAnswers>({ sport: "gym", timeToday: "20to40", dayForm: "mid", stress: "mid", yesterdayEffort: "mid" });
  const [showHelp, setShowHelp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragDirection, setDragDirection] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const swipeTouchRef = useRef<{ x: number; y: number } | null>(null);

  const allowed = useMemo(() => splitType === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"], [splitType]);
  // For gym, check if planned workout type matches; for cardio sports, always OK
  const plannedOk = answers.sport !== "gym" || allowed.includes(plannedWorkoutType);

  // Build personalized context when moving to suggestions step
  const userContext = useMemo(
    () => buildUserAdaptiveContext(answers.sport, answers),
    // Recompute when sport or dayForm/stress changes (weight modifier depends on these)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [answers.sport, answers.dayForm, answers.stress]
  );

  const suggestions = useMemo(
    () => buildAdaptiveSuggestions(answers, userContext.avgDurationMin, userContext.lastFeedback, userContext.volumeContext),
    [answers, userContext.avgDurationMin, userContext.lastFeedback, userContext.volumeContext]
  );

  useEffect(() => {
    if (open) {
      setStep("questions");
      setShowHelp(false);
      setAnswers({ sport: "gym", timeToday: "20to40", dayForm: "mid", stress: "mid", yesterdayEffort: "mid" });
      setActiveIdx(0);
      setDragDirection(1);
      setPreviewOpen(false);
    }
  }, [open]);

  const typeName = (type: string) => {
    const map: Record<string, string> = {
      push: "Push (Drücken)",
      pull: "Pull (Ziehen)",
      legs: "Beine (Unterkörper)",
      upper: "Oberkörper",
      lower: "Unterkörper"
    };
    return map[type.toLowerCase()] || type;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="92dvh"
      sheetStyle={{ backgroundColor: "var(--modal-bg)" }}
      footer={
        <div className="px-4 pt-3 pb-2">
          {step === "questions" ? (
            <div className="flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] border"
                style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] text-white disabled:opacity-50"
                style={{ backgroundColor: "var(--accent-color)" }}
                onClick={() => setStep("suggestions")}
                disabled={!plannedOk}
              >
                {t("adaptive.showSuggestions")}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] border"
                style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                onClick={() => setStep("questions")}
              >
                {t("common.back")}
              </button>
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] border"
                style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)", color: "var(--text-color)" }}
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            </div>
          )}
        </div>
      }
    >

      <div className="px-4 space-y-2 pb-4">
        {!plannedOk && (
          <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: "rgba(255,59,48,0.1)" }}>
            <p className="text-sm font-medium" style={{ color: "#FF3B30" }}>
              Dieser Plan ist für <strong>{typeName(plannedWorkoutType)}</strong> gedacht.
            </p>
          </div>
        )}

        {step === "questions" && (() => {
          const questions: { id: string; icon: React.ReactNode; title: string; sub: string; key: keyof AdaptiveAnswers; options: [string, string][] }[] = [
            {
              id: "q0", icon: <IconDumbbellFill width={16} height={10} />, key: "sport" as keyof AdaptiveAnswers,
              title: t("adaptive.sport.question"),
              sub: t("adaptive.sport.sub"),
              options: [
                ["gym",       t("adaptive.sport.gym")],
                ["laufen",    t("adaptive.sport.laufen")],
                ["radfahren", t("adaptive.sport.radfahren")],
              ],
            },
            {
              id: "q1", icon: <Clock size={16} />, key: "timeToday",
              title: t("adaptive.survey.timeTitle"),
              sub: t("adaptive.survey.timeSub"),
              options: [
                ["lt20",   t("adaptive.q1.lt20")],
                ["20to40", t("adaptive.q1.min20to40")],
                ["40to60", t("adaptive.q1.min40to60")],
                ["gt60",   t("adaptive.q1.gt60")],
              ],
            },
            {
              id: "q2", icon: <Zap size={16} />, key: "dayForm",
              title: t("adaptive.survey.energyTitle"),
              sub: t("adaptive.survey.energySub"),
              options: [
                ["low",  t("adaptive.survey.energyLow")],
                ["mid",  t("adaptive.survey.energyMid")],
                ["high", t("adaptive.survey.energyHigh")],
              ],
            },
            {
              id: "q3", icon: <Brain size={16} />, key: "stress",
              title: t("adaptive.survey.stressTitle"),
              sub: t("adaptive.survey.stressSub"),
              options: [
                ["low",  t("adaptive.survey.stressLow")],
                ["mid",  t("adaptive.survey.stressMid")],
                ["high", t("adaptive.survey.stressHigh")],
              ],
            },
            {
              id: "q4", icon: <IconDumbbellFill width={16} height={10} />, key: "yesterdayEffort",
              title: t("adaptive.survey.effortTitle"),
              sub: t("adaptive.survey.effortSub"),
              options: [
                ["low",  t("adaptive.survey.effortLow")],
                ["mid",  t("adaptive.survey.effortMid")],
                ["high", t("adaptive.survey.effortHigh")],
              ],
            },
          ];

          return (
            <div className="space-y-4">
              {questions.map((q, _qi) => {
                const is4 = q.options.length === 4;
                return (
                  <div key={q.id} className="rounded-[22px] p-4" style={{ backgroundColor: "var(--card-bg)" }}>
                    {/* Question header */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--border-color)", color: "var(--text-secondary)" }}>
                        {q.icon}
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--text-color)" }}>
                          {q.title}
                        </p>
                      </div>
                    </div>
                    {/* Options */}
                    <div className={`grid gap-2 ${is4 ? "grid-cols-2" : "grid-cols-3"}`}>
                      {q.options.map(([value, label]) => {
                        const isSelected = answers[q.key] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAnswers(p => ({ ...p, [q.key]: value }))}
                            className="py-3 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.95]"
                            style={{
                              backgroundColor: isSelected ? "#007AFF" : "var(--border-color)",
                              color: isSelected ? "#fff" : "var(--text-color)",
                              boxShadow: isSelected ? "0 4px 12px rgba(0,122,255,0.35)" : "none",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

            {step === "suggestions" && (() => {
              const s = suggestions[activeIdx];
              if (!s) return <div>{t("adaptive.noSuggestions")}</div>;
              const accent = profileAccent(s.profile);
              const isBlocked = s.estimatedMinutes === 0;
              const reasons = s.reasons ?? [];

              const navigate = (dir: 1 | -1) => {
                const next = activeIdx + dir;
                if (next < 0 || next >= suggestions.length) return;
                setDragDirection(dir);
                setActiveIdx(next);
                setPreviewOpen(false);
              };

              return (
                <div>
                  {/* Dot indicators */}
                  <div className="flex justify-center items-center gap-2 mb-3">
                    {suggestions.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => { setDragDirection(i > activeIdx ? 1 : -1); setActiveIdx(i); setPreviewOpen(false); }}
                        style={{
                          width: i === activeIdx ? 20 : 8,
                          height: 8,
                          borderRadius: 4,
                          background: i === activeIdx ? accent.solid : "var(--border-color)",
                          transition: "all 0.25s ease",
                          border: "none",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>

                  {/* Full-page swipeable content */}
                  <div
                    className="overflow-hidden"
                    onTouchStart={(e) => {
                      // Don't start swipe on interactive elements
                      const target = e.target as HTMLElement;
                      if (target.closest("button, a, input, select, [role='button']")) {
                        swipeTouchRef.current = null;
                        return;
                      }
                      swipeTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    }}
                    onTouchEnd={(e) => {
                      const start = swipeTouchRef.current;
                      if (!start) return;
                      const dx = e.changedTouches[0].clientX - start.x;
                      const dy = e.changedTouches[0].clientY - start.y;
                      swipeTouchRef.current = null;
                      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.7) return;
                      if (dx < 0) navigate(1);
                      else navigate(-1);
                    }}
                  >
                    <AnimatePresence mode="popLayout" custom={dragDirection} initial={false}>
                      <MotionDiv
                        key={activeIdx}
                        custom={dragDirection}
                        variants={pageSlideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                        className="rounded-[28px] overflow-hidden relative"
                        style={{ background: (GRADIENTS[s.profile] ?? GRADIENTS.stabil).base }}
                      >
                        {/* Aurora blobs */}
                        <div className="absolute inset-0 pointer-events-none" style={{ background: (GRADIENTS[s.profile] ?? GRADIENTS.stabil).blob1 }} />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: (GRADIENTS[s.profile] ?? GRADIENTS.stabil).blob2 }} />
                        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%)" }} />

                        {/* Plan Card (inline, no separate border) */}
                        <div className="relative z-10">
                          <AdaptivePlanCard suggestion={s} />
                        </div>

                  {/* Active card details */}
                  <div
                    className="relative z-10 p-4"
                  >
                    {/* Stats row — sport-aware */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {(() => {
                        if (answers.sport !== "gym") {
                          const pace = userContext.typicalPaceSecPerKm;
                          const paceMin = Math.floor(pace / 60);
                          const paceSec = pace % 60;
                          const paceStr = pace > 0
                            ? `${paceMin}:${String(paceSec).padStart(2, "0")}/km`
                            : "—";
                          const cardioTypeLabel = isBlocked ? "—" : t(`adaptive.cardioType.${userContext.suggestedCardioType}` as TranslationKey);
                          return [
                            { label: t("adaptive.card.time"), value: isBlocked ? "—" : `${s.estimatedMinutes} min` },
                            { label: t("adaptive.pace"),      value: paceStr },
                            { label: t("adaptive.sessionType"), value: cardioTypeLabel },
                          ];
                        }
                        return [
                          { label: t("adaptive.card.time"),      value: isBlocked ? "—" : `${s.estimatedMinutes} min` },
                          { label: t("adaptive.card.exercises"),  value: isBlocked ? "—" : `${s.exercisesCount}` },
                          { label: t("adaptive.card.sets"),       value: isBlocked ? "—" : `${s.setsPerExercise}` },
                        ];
                      })().map(({ label, value }) => (
                        <div
                          key={label}
                          className="rounded-[14px] py-3 px-2 flex flex-col items-center gap-1"
                          style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <span className="text-[17px] font-bold tabular-nums leading-none" style={{ color: "#fff" }}>{value}</span>
                          <span className="text-[10px] font-medium text-center" style={{ color: "rgba(255,255,255,0.6)" }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Intensity hint */}
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                      {s.intensityHint}
                    </p>

                    {/* Reason badges */}
                    {reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {reasons.map(r => (
                          <span
                            key={r}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{
                              background: `${accent.solid}20`,
                              border: `1px solid ${accent.solid}35`,
                              color: accent.solid,
                            }}
                          >
                            {t(reasonKey(r))}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Exercise preview */}
                    {answers.sport === "gym" && userContext.topExercises.length > 0 && (
                      <div className="mb-4">
                        <ExercisePreviewAccordion
                          exercises={userContext.topExercises}
                          count={s.exercisesCount}
                          nextSplit={userContext.nextSplit}
                          t={t}
                          darkMode
                        />
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {onSaveToCalendar && !isBlocked && (
                        <button
                          onClick={() => onSaveToCalendar(s, answers)}
                          disabled={!plannedOk}
                          className="flex items-center gap-1.5 px-4 py-3.5 rounded-[16px] text-[13px] font-semibold transition-all active:scale-[0.96] disabled:opacity-40"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.12)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            color: "#fff",
                          }}
                        >
                          <CalendarPlus size={15} />
                          {t("adaptive.saveToCalendar")}
                        </button>
                      )}
                      <button
                        onClick={() => !isBlocked && onSelect(s, answers)}
                        disabled={!plannedOk || isBlocked}
                        className="flex-1 py-3.5 rounded-[16px] text-[15px] font-black text-white transition-all active:scale-[0.96] disabled:opacity-40"
                        style={{
                          backgroundColor: isBlocked ? "var(--button-bg)" : "var(--accent-color)",
                        }}
                      >
                        {isBlocked ? t("adaptive.disabledToday") : t("adaptive.startNow")}
                      </button>
                    </div>
                  </div>
                      </MotionDiv>
                    </AnimatePresence>
                  </div>

                </div>
              );
            })()}
      </div>
    </BottomSheet>
  );
}
