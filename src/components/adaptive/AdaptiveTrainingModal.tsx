// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "../../i18n/useI18n";
import AdaptivePlanCard from "./AdaptivePlanCard";
import type { TranslationKey } from "../../i18n/index";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions, profileAccent } from "../../utils/adaptiveScoring";
import { buildUserAdaptiveContext } from "../../utils/adaptivePersonalization";
import { BottomSheet } from "../common/BottomSheet";
import { Clock, Zap, Brain, Dumbbell, CalendarPlus, Footprints, Bike } from "lucide-react";

const carouselVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? "100%" : "-100%", opacity: 0, scale: 0.92 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? "-100%" : "100%", opacity: 0, scale: 0.92 }),
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
  };
  return map[r] ?? ("adaptive.reason.default" as TranslationKey);
}

export interface AdaptiveTrainingModalProps {
  open: boolean;
  onClose: () => void;
  plannedWorkoutType: WorkoutType;
  splitType: SplitType;
  onSelect: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
  onSaveToCalendar?: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
  isPro?: boolean;
  adaptiveLeftBC?: number;
  bcFreeLimit?: number;
  previewExercises?: { name: string; muscleGroup?: string }[];
}

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { t } = useI18n();
  const { open, onClose, plannedWorkoutType, splitType, onSelect, onSaveToCalendar, isPro, adaptiveLeftBC, bcFreeLimit = 5, previewExercises } = props;

  const [step, setStep] = useState<"questions" | "suggestions">("questions");
  const [answers, setAnswers] = useState<AdaptiveAnswers>({ sport: "gym", timeToday: "20to40", dayForm: "mid", stress: "mid", yesterdayEffort: "mid" });
  const [showHelp, setShowHelp] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragDirection, setDragDirection] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    () => buildAdaptiveSuggestions(answers, userContext.avgDurationMin),
    [answers, userContext.avgDurationMin]
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
      height="88dvh"
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
      {/* Header */}
      <div className="px-5 pb-2 pt-1">
        <h2
          className="text-[22px] font-bold"
          style={{ color: "var(--text-color)" }}
        >
          {t("adaptive.title")}
        </h2>
        <p className="text-[14px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
          Passe dein Training an deine Tagesform an
        </p>
      </div>

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
              id: "q0", icon: <Dumbbell size={16} />, key: "sport" as keyof AdaptiveAnswers,
              title: t("adaptive.sport.question"),
              sub: t("adaptive.sport.sub"),
              options: [
                ["gym",       `🏋️ ${t("adaptive.sport.gym")}`],
                ["laufen",    `🏃 ${t("adaptive.sport.laufen")}`],
                ["radfahren", `🚴 ${t("adaptive.sport.radfahren")}`],
              ],
            },
            {
              id: "q1", icon: <Clock size={16} />, key: "timeToday",
              title: "Wie viel Zeit hast du heute?",
              sub: "Wir passen Umfang und Übungsanzahl an",
              options: [
                ["lt20",   "< 20 Min"],
                ["20to40", "20–40 Min"],
                ["40to60", "40–60 Min"],
                ["gt60",   "60+ Min"],
              ],
            },
            {
              id: "q2", icon: <Zap size={16} />, key: "dayForm",
              title: "Wie ist deine Energie gerade?",
              sub: "Beeinflusst Intensität und Gewichte",
              options: [
                ["low",  "Niedrig"],
                ["mid",  "Mittel"],
                ["high", "Top"],
              ],
            },
            {
              id: "q3", icon: <Brain size={16} />, key: "stress",
              title: "Wie gestresst bist du heute?",
              sub: "Hoher Stress = mehr Regenerationsfokus",
              options: [
                ["low",  "Entspannt"],
                ["mid",  "Etwas"],
                ["high", "Viel"],
              ],
            },
            {
              id: "q4", icon: <Dumbbell size={16} />, key: "yesterdayEffort",
              title: "Wie war das letzte Training?",
              sub: "Wir berücksichtigen deine Erholung",
              options: [
                ["low",  "Leicht"],
                ["mid",  "Normal"],
                ["high", "Intensiv"],
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
                        <p className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                          {q.sub}
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
                  {/* Subtitle */}
                  <p className="text-[13px] mb-3 px-1" style={{ color: "var(--text-secondary)" }}>
                    {t("adaptive.suggestionsFor")}{" "}
                    <strong style={{ color: "var(--text-color)" }}>
                      {answers.sport === "gym"
                        ? typeName(plannedWorkoutType)
                        : answers.sport === "laufen"
                        ? t("adaptive.sport.laufen")
                        : t("adaptive.sport.radfahren")}
                    </strong>
                    {" "}– {t("adaptive.swipeHint")}
                  </p>

                  {/* Carousel */}
                  <div className="relative overflow-hidden" style={{ height: 220, borderRadius: 28 }}>
                    <AnimatePresence custom={dragDirection} mode="wait">
                      <motion.div
                        key={activeIdx}
                        custom={dragDirection}
                        variants={carouselVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.15}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -60) navigate(1);
                          else if (info.offset.x > 60) navigate(-1);
                        }}
                        className="absolute inset-0 cursor-grab active:cursor-grabbing"
                      >
                        <AdaptivePlanCard suggestion={s} isPro={isPro} />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Dot indicators */}
                  <div className="flex justify-center items-center gap-2 mt-3">
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

                  {/* Active card details */}
                  <div
                    className="mt-4 rounded-[22px] p-4"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      border: "1px solid var(--border-color)",
                    }}
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
                            background: "var(--card-bg)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <span className="text-[17px] font-bold tabular-nums leading-none" style={{ color: "var(--text-color)" }}>{value}</span>
                          <span className="text-[10px] font-medium text-center" style={{ color: "var(--text-secondary)" }}>{label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Intensity hint */}
                    <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
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

                    {/* Exercise preview accordion — gym only, uses personal history when available */}
                    {answers.sport === "gym" && (() => {
                      const hasHistory = userContext.topExercises.length >= 2;
                      const personalExercises = hasHistory
                        ? (() => {
                            const splitFiltered = userContext.nextSplit !== "full"
                              ? userContext.topExercises.filter(
                                  ex => ex.splitType === userContext.nextSplit || ex.splitType === "full"
                                )
                              : userContext.topExercises;
                            const pool = splitFiltered.length >= 2 ? splitFiltered : userContext.topExercises;
                            return pool.map(ex => ({
                              name: ex.name,
                              weight: ex.progressionReady ? ex.suggestedWeight : ex.avgWeight,
                              reps: ex.avgReps,
                              progressionReady: ex.progressionReady,
                            }));
                          })()
                        : null;
                      const displayExercises = personalExercises ?? (previewExercises ?? []);
                      if (displayExercises.length === 0) return null;

                      return (
                        <div className="mb-4">
                          <button
                            onClick={() => setPreviewOpen(p => !p)}
                            className="w-full flex items-center justify-between py-2.5 px-3 rounded-[12px] transition-all active:scale-[0.98]"
                            style={{
                              backgroundColor: "var(--button-bg)",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            <span className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: "var(--text-color)" }}>
                              {t("adaptive.exercisePreview")} ({Math.min(s.exercisesCount, displayExercises.length)})
                              {hasHistory && userContext.nextSplit !== "full" && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(0,122,255,0.18)", color: "#3B9EFF" }}>
                                  {t(`adaptive.split.${userContext.nextSplit}` as TranslationKey)}
                                </span>
                              )}
                              {hasHistory && (
                                <span className="text-[11px] font-medium" style={{ color: accent.solid }}>
                                  {t("adaptive.exercisePreview.personal")}
                                </span>
                              )}
                            </span>
                            <motion.span
                              animate={{ rotate: previewOpen ? 180 : 0 }}
                              transition={{ type: "spring", stiffness: 300, damping: 25 }}
                              style={{ display: "flex", color: "var(--text-secondary)" }}
                            >
                              ▾
                            </motion.span>
                          </button>
                          <AnimatePresence>
                            {previewOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                style={{ overflow: "hidden" }}
                              >
                                <div className="pt-2 flex flex-col gap-1.5">
                                  {displayExercises.slice(0, s.exercisesCount).map((ex, i) => {
                                    const isReady = "progressionReady" in ex && (ex as any).progressionReady;
                                    return (
                                      <div
                                        key={i}
                                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px]"
                                        style={{
                                          backgroundColor: "var(--card-bg)",
                                          border: "1px solid var(--border-color)",
                                        }}
                                      >
                                        <span
                                          className="text-[11px] font-black w-5 h-5 rounded-full flex items-center justify-center shrink-0 tabular-nums"
                                          style={{ background: `${accent.solid}25`, color: accent.solid }}
                                        >
                                          {i + 1}
                                        </span>
                                        <span className="text-[13px] font-medium flex-1" style={{ color: "var(--text-color)" }}>
                                          {ex.name}
                                        </span>
                                        {"weight" in ex && (ex as any).weight > 0 && (
                                          <span
                                            className="text-[12px] font-bold shrink-0 tabular-nums"
                                            style={{ color: isReady ? "#FF9500" : accent.solid }}
                                          >
                                            {(ex as any).weight} kg × {(ex as any).reps}
                                            {isReady && " ↑"}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })()}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      {onSaveToCalendar && !isBlocked && (
                        <button
                          onClick={() => onSaveToCalendar(s, answers)}
                          disabled={!plannedOk}
                          className="flex items-center gap-1.5 px-4 py-3.5 rounded-[16px] text-[13px] font-semibold transition-all active:scale-[0.96] disabled:opacity-40"
                          style={{
                            backgroundColor: "var(--button-bg)",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-color)",
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
                </div>
              );
            })()}
      </div>
    </BottomSheet>
  );
}
