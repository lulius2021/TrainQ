// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import AdaptivePlanCard from "./AdaptivePlanCard";
import type { TranslationKey } from "../../i18n/index";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions, profileAccent } from "../../utils/adaptiveScoring";
import { BottomSheet } from "../common/BottomSheet";
import { Clock, Zap, Brain, Dumbbell } from "lucide-react";

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
}

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { t } = useI18n();
  const { open, onClose, plannedWorkoutType, splitType, onSelect, onSaveToCalendar, isPro, adaptiveLeftBC, bcFreeLimit = 5 } = props;

  const [step, setStep] = useState<"questions" | "suggestions">("questions");
  const [answers, setAnswers] = useState<AdaptiveAnswers>({ timeToday: "20to40", dayForm: "mid", stress: "mid", yesterdayEffort: "mid" });
  const [showHelp, setShowHelp] = useState(false);

  const allowed = useMemo(() => splitType === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"], [splitType]);
  const plannedOk = allowed.includes(plannedWorkoutType);
  const suggestions = useMemo(() => buildAdaptiveSuggestions(answers), [answers]);

  useEffect(() => {
    if (open) {
      setStep("questions");
      setShowHelp(false);
      setAnswers({ timeToday: "20to40", dayForm: "mid", stress: "mid", yesterdayEffort: "mid" });
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
        <h2 className="text-[28px] font-bold tracking-tight" style={{ color: "var(--text-color)", letterSpacing: "-0.5px" }}>
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

            {step === "suggestions" && (
              <div className="space-y-4">
                <div
                  className="rounded-[20px] p-4 border"
                  style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                >
                  <h3 className="font-bold text-[17px]" style={{ color: "var(--text-color)" }}>
                    {t("adaptive.suggestionsTitle")}
                  </h3>
                  <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    Vorschläge für <strong>{typeName(plannedWorkoutType)}</strong> basierend auf deinen Antworten.
                  </p>
                </div>
                {suggestions.map(s => {
                  const accent = profileAccent(s.profile);
                  return (
                    <AdaptivePlanCard
                      key={s.profile}
                      suggestion={s}
                      accent={accent}
                      onSelect={() => onSelect(s, answers)}
                      onSaveToCalendar={onSaveToCalendar ? () => onSaveToCalendar(s, answers) : undefined}
                      disabled={!plannedOk}
                      isPro={isPro}
                    />
                  )
                })}
              </div>
            )}
      </div>
    </BottomSheet>
  );
}
