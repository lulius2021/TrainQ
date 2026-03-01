// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";
import AdaptivePlanCard from "./AdaptivePlanCard";
import type { TranslationKey } from "../../i18n/index";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions, profileAccent } from "../../utils/adaptiveScoring";

export interface AdaptiveTrainingModalProps {
  open: boolean;
  onClose: () => void;
  plannedWorkoutType: WorkoutType;
  splitType: SplitType;
  onSelect: (suggestion: AdaptiveSuggestion, answers: AdaptiveAnswers) => void;
  isPro?: boolean;
  adaptiveLeftBC?: number;
  bcFreeLimit?: number;
}

export default function AdaptiveTrainingModal(props: AdaptiveTrainingModalProps) {
  const { t } = useI18n();
  const { open, onClose, plannedWorkoutType, splitType, onSelect, isPro, adaptiveLeftBC, bcFreeLimit = 5 } = props;

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

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      style={{
        touchAction: 'none',
        padding: "12px",
      }}
    >
      <div
        className="w-full max-w-md flex flex-col overflow-hidden rounded-[28px] border shadow-2xl"
        style={{
          backgroundColor: "var(--modal-bg)",
          borderColor: "var(--border-color)",
          maxHeight: "calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 140px)",
          marginBottom: "60px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b rounded-t-[28px]"
          style={{ borderColor: "var(--border-color)", backgroundColor: "var(--modal-header)" }}
        >
          <div className="flex items-center gap-2.5">
            <h2
              className="text-xl font-bold"
              style={{ color: "var(--text-color)", letterSpacing: '-0.3px' }}
            >
              {t("adaptive.title")}
            </h2>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all"
              style={{
                borderColor: showHelp ? "var(--accent-color)" : "var(--text-secondary)",
                color: showHelp ? "var(--accent-color)" : "var(--text-secondary)",
                backgroundColor: showHelp ? "rgba(0,122,255,0.1)" : "transparent",
              }}
            >
              ?
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full active:scale-95 transition-transform"
            style={{ backgroundColor: "var(--button-bg)" }}
          >
            <X size={18} style={{ color: "var(--text-secondary)" }} />
          </button>
        </header>

        {/* Scrollable Content */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="px-4 py-4 space-y-4">
            {showHelp && (
              <div
                className="rounded-[20px] border p-4"
                style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
              >
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-color)" }}>
                  <strong>Wie funktioniert es?</strong><br />
                  Wähle deine heutige Tagesform aus. Basierend darauf passen wir Volumen und Intensität deines Trainings optimal an.
                </p>
              </div>
            )}

            {!plannedOk && (
              <div
                className="rounded-[20px] border p-4"
                style={{ backgroundColor: "rgba(255,59,48,0.1)", borderColor: "rgba(255,59,48,0.3)" }}
              >
                <h3 className="font-bold" style={{ color: "var(--danger)" }}>Plan passt nicht</h3>
                <p className="text-sm" style={{ color: "var(--danger)", opacity: 0.8 }}>
                  Dieser adaptive Plan ist für <strong>{typeName(plannedWorkoutType)}</strong> gedacht.
                </p>
              </div>
            )}

            {step === "questions" && (
              <div className="space-y-4">
                {[
                  { id: "q1", title: t("adaptive.q1"), key: "timeToday", options: [["lt20", t("adaptive.q1.lt20")], ["20to40", t("adaptive.q1.min20to40")], ["40to60", t("adaptive.q1.min40to60")], ["gt60", t("adaptive.q1.gt60")]] },
                  { id: "q2", title: t("adaptive.q2"), key: "dayForm", options: [["low", t("adaptive.q2.low")], ["mid", t("adaptive.q2.mid")], ["high", t("adaptive.q2.high")]] },
                  { id: "q3", title: t("adaptive.q3"), key: "stress", options: [["low", t("adaptive.q3.low")], ["mid", t("adaptive.q3.mid")], ["high", t("adaptive.q3.high")]] },
                  { id: "q4", title: t("adaptive.q4"), key: "yesterdayEffort", options: [["low", t("adaptive.q4.low")], ["mid", t("adaptive.q4.mid")], ["high", t("adaptive.q4.high")]] },
                ].map(q => (
                  <div
                    key={q.id}
                    className="rounded-[20px] p-4 border"
                    style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
                  >
                    <h3 className="text-[15px] font-semibold mb-3" style={{ color: "var(--text-color)" }}>
                      {q.title}
                    </h3>
                    <div className={`grid gap-2.5 ${q.options.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                      {q.options.map(([value, label]) => {
                        const isSelected = answers[q.key as keyof AdaptiveAnswers] === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAnswers(p => ({ ...p, [q.key]: value }))}
                            className="py-3 px-2 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97] border"
                            style={{
                              backgroundColor: isSelected ? "rgba(0,122,255,0.15)" : "var(--button-bg)",
                              color: isSelected ? "var(--accent-color)" : "var(--text-color)",
                              borderColor: isSelected ? "var(--accent-color)" : "var(--border-color)",
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                      disabled={!plannedOk}
                      isPro={isPro}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer (Pinned) */}
        <div
          className="flex-shrink-0 px-4 py-3 border-t rounded-b-[28px]"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--modal-header)",
          }}
        >
          {step === "questions" ? (
            <div className="flex gap-3">
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] border"
                style={{
                  backgroundColor: "var(--button-bg)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                }}
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
                style={{
                  backgroundColor: "var(--button-bg)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                }}
                onClick={() => setStep("questions")}
              >
                {t("common.back")}
              </button>
              <button
                className="flex-1 py-3.5 rounded-2xl text-[15px] font-bold transition-all active:scale-[0.97] border"
                style={{
                  backgroundColor: "var(--button-bg)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-color)",
                }}
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
