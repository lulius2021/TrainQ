// src/components/adaptive/AdaptiveTrainingModal.tsx
import React, { useMemo, useState, useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { TranslationKey } from "../../i18n";
import type { SplitType, WorkoutType } from "../../types";
import type { AdaptiveAnswers, AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";
import { buildAdaptiveSuggestions } from "../../utils/adaptiveScoring";

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

  const allowed = useMemo(() => splitType === "push_pull" ? ["Push", "Pull"] : ["Upper", "Lower"], [splitType]);
  const plannedOk = allowed.includes(plannedWorkoutType);
  const suggestions = useMemo(() => buildAdaptiveSuggestions(answers), [answers]);

  useEffect(() => {
    if (open) {
      setStep("questions");
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

  const entitlementLine = isPro ? t("adaptive.entitlement.pro") : (typeof adaptiveLeftBC === 'number' ? t("adaptive.entitlement.freeRemaining", { remaining: Math.max(0, adaptiveLeftBC), limit: bcFreeLimit }) : t("adaptive.entitlement.freeLimited", { limit: bcFreeLimit }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] rounded-[24px] border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 p-5 border-b border-white/10">
          <div>
            <p className="text-sm font-semibold text-gray-300">{t("adaptive.title")}</p>
            <h2 className="text-2xl font-bold text-white mt-1">{t("adaptive.today", { value: plannedWorkoutType })}</h2>
            <p className="text-sm text-gray-400 mt-2">{t("adaptive.subtitle")}</p>
            <p className="text-sm text-gray-400 mt-1">{entitlementLine}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full px-3 py-1 text-sm font-semibold bg-white/10 text-white">{step === "questions" ? t("adaptive.step.questions") : t("adaptive.step.suggestions")}</span>
            <button type="button" onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full text-2xl text-gray-400 hover:bg-white/10 hover:text-white">✕</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!plannedOk && (
            <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
              <h3 className="font-bold text-red-300">{t("adaptive.notice")}</h3>
              <p className="text-sm text-red-300/80">{t("adaptive.planMismatch", { value: plannedWorkoutType })}</p>
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
                <div key={q.id} className="rounded-xl p-4 bg-white/5 border border-white/10">
                  <h3 className="text-base font-semibold mb-3">{q.title}</h3>
                  <div className={`grid gap-3 grid-cols-2 ${q.options.length > 2 ? 'sm:grid-cols-' + q.options.length : ''}`}>
                    {q.options.map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setAnswers(p => ({ ...p, [q.key]: value }))} className={`w-full p-3 rounded-lg text-sm font-semibold transition ${answers[q.key as keyof AdaptiveAnswers] === value ? 'bg-[#2563EB] text-white' : 'bg-white/5 hover:bg-white/10'}`}>{label}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 rounded-xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20" onClick={onClose}>{t("common.cancel")}</button>
                <button className="flex-1 py-3 rounded-xl bg-[#2563EB] text-base font-semibold hover:bg-sky-500 disabled:opacity-50" onClick={() => setStep("suggestions")} disabled={!plannedOk} title={!plannedOk ? t("adaptive.planMismatchShort") : t("adaptive.showSuggestions")}>
                  {t("adaptive.showSuggestions")}
                </button>
              </div>
            </div>
          )}

          {step === "suggestions" && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 bg-white/5 border border-white/10">
                <h3 className="font-bold text-lg">{t("adaptive.suggestionsTitle")}</h3>
                <p className="text-sm text-gray-300">{t("adaptive.suggestionsSubtitle", { value: plannedWorkoutType })}</p>
              </div>
              {suggestions.map(s => {
                const accent = profileAccent(s.profile);
                return (
                  <div key={s.profile} className="rounded-xl p-4" style={{ borderColor: accent.border, background: accent.bg }}>
                    {/* ... Suggestion card content ... */}
                    <button className="w-full mt-4 py-3 rounded-xl text-base font-semibold text-white hover:opacity-90" style={{ background: accent.badgeBg.replace('0.18', '0.3') }} onClick={() => onSelect(s, answers)}>{t("adaptive.select")}</button>
                  </div>
                )
              })}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 rounded-xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20" onClick={() => setStep("questions")}>{t("common.back")}</button>
                <button className="flex-1 py-3 rounded-xl bg-white/10 border border-white/10 text-base font-semibold hover:bg-white/20" onClick={onClose}>{t("common.close")}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
