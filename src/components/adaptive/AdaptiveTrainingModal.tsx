// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import AdaptivePlanCard from "./AdaptivePlanCard";
import type { TranslationKey } from "../../i18n/index";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions, profileAccent } from "../../utils/adaptiveScoring";

// ... (Helper functions remain unchanged)

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden"
      onClick={onClose}
      style={{ touchAction: 'none' }}
    >
      <div
        className="w-full max-w-2xl h-[90vh] rounded-2xl border-[1.5px] border-white/10 bg-white/10 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100vh - 2rem)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <header className="flex-shrink-0 flex items-center justify-between gap-4 p-6 bg-transparent" style={{ zIndex: 10 }}>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white" style={{ letterSpacing: '-0.4px' }}>{t("adaptive.title")}</h2>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${showHelp ? 'bg-white text-black border-white' : 'border-white/30 text-white/50 hover:text-white hover:border-white'}`}
            >
              ?
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-white/50 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            ✕
          </button>
        </header>

        <div
          className="flex-1 overflow-y-auto p-5 space-y-4 overscroll-contain pb-32"
          style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}
        >
          {showHelp && (
            <div className="mb-4 rounded-2xl bg-white/10 border border-white/20 p-4 backdrop-blur-md animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-white/90 leading-relaxed">
                <strong>Wie funktioniert es?</strong><br />
                Wähle deine heutige Tagesform aus. Basierend darauf passen wir Volumen und Intensität deines Trainings optimal an, um Überlastung zu vermeiden und langfristige Fortschritte zu sichern.
              </p>
            </div>
          )}

          {!plannedOk && (
            <div className="rounded-3xl border border-red-500/50 bg-red-500/10 p-4">
              <h3 className="font-bold text-red-300">Plan passt nicht</h3>
              <p className="text-sm text-red-300/80">
                Dieser adaptive Plan ist für <strong>{typeName(plannedWorkoutType)}</strong> gedacht.
              </p>
            </div>
          )}

          {step === "questions" && (
            <div className="space-y-5">
              {[
                { id: "q1", title: t("adaptive.q1"), key: "timeToday", options: [["lt20", t("adaptive.q1.lt20")], ["20to40", t("adaptive.q1.min20to40")], ["40to60", t("adaptive.q1.min40to60")], ["gt60", t("adaptive.q1.gt60")]] },
                { id: "q2", title: t("adaptive.q2"), key: "dayForm", options: [["low", t("adaptive.q2.low")], ["mid", t("adaptive.q2.mid")], ["high", t("adaptive.q2.high")]] },
                { id: "q3", title: t("adaptive.q3"), key: "stress", options: [["low", t("adaptive.q3.low")], ["mid", t("adaptive.q3.mid")], ["high", t("adaptive.q3.high")]] },
                { id: "q4", title: t("adaptive.q4"), key: "yesterdayEffort", options: [["low", t("adaptive.q4.low")], ["mid", t("adaptive.q4.mid")], ["high", t("adaptive.q4.high")]] },
              ].map(q => (
                <div key={q.id} className="rounded-3xl p-4 bg-white/5 border border-white/10">
                  <h3 className="text-base font-semibold mb-3 text-white">{q.title}</h3>
                  <div className={`grid gap-3 grid-cols-2 ${q.options.length > 2 ? 'sm:grid-cols-' + q.options.length : ''}`}>
                    {q.options.map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setAnswers(p => ({ ...p, [q.key]: value }))} className={`w-full p-3 rounded-2xl text-sm font-semibold transition active:scale-[0.98] ${answers[q.key as keyof AdaptiveAnswers] === value ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/20' : 'bg-white/5 text-white/70 hover:bg-white/15 border border-white/10'}`}>{label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 rounded-3xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20 text-white" onClick={onClose}>{t("common.cancel")}</button>
                <button className="flex-1 py-3 rounded-3xl bg-[#007AFF] text-white text-base font-semibold hover:bg-[#007AFF]/90 shadow-lg shadow-[#007AFF]/20 disabled:opacity-50" onClick={() => setStep("suggestions")} disabled={!plannedOk} title={!plannedOk ? t("adaptive.planMismatchShort") : t("adaptive.showSuggestions")}>
                  {t("adaptive.showSuggestions")}
                </button>
              </div>
            </div>
          )}

          {step === "suggestions" && (
            <div className="space-y-4">
              <div className="rounded-3xl p-4 bg-white/5 border border-white/10">
                <h3 className="font-bold text-lg text-white">{t("adaptive.suggestionsTitle")}</h3>
                <p className="text-sm text-white/70">
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
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 rounded-3xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20 text-white" onClick={() => setStep("questions")}>{t("common.back")}</button>
                <button className="flex-1 py-3 rounded-3xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20 text-white" onClick={onClose}>{t("common.close")}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
