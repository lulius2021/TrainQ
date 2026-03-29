import React, { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DeloadPlan } from "../../types/deload";
import {
  addDeloadHistoryEntry,
  markFeedbackGiven,
  readFeedbackGivenIds,
} from "../../utils/deload/storage";
import { getActiveUserId } from "../../utils/session";
import { getAvgPerformanceBefore, getAvgPerformanceAfter } from "../../services/TrainingLoadService";

interface PostDeloadFeedbackProps {
  plan: DeloadPlan;
  onClose: () => void;
}

export default function PostDeloadFeedback({ plan, onClose }: PostDeloadFeedbackProps) {
  const [feeling, setFeeling] = useState(7);
  const [submitted, setSubmitted] = useState(false);

  // Performance comparison
  const pre  = getAvgPerformanceBefore(plan.startISO, 3);
  const post = getAvgPerformanceAfter(plan.endISO, 3);
  const delta = pre > 0 && post > 0 ? ((post - pre) / pre) * 100 : null;

  const handleSave = () => {
    const userId = getActiveUserId();
    addDeloadHistoryEntry(userId, {
      id: plan.id,
      startDate: plan.startISO,
      endDate: plan.endISO,
      triggerScore: 0,
      triggerReasons: [],
      deloadType: "mittel",
      prePerformance: pre > 0 ? pre : undefined,
      postPerformance: post > 0 ? post : undefined,
      userFeedback: feeling,
      createdAt: new Date().toISOString(),
    });
    markFeedbackGiven(userId, plan.id);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 pb-8 px-4">
        <div className="w-full max-w-lg rounded-[28px] border border-[var(--border-color)] bg-[var(--card-bg)] p-6 text-center space-y-3">
          <div className="text-3xl">🚀</div>
          <div className="text-base font-bold text-[var(--text-color)]">Leistungsboost registriert!</div>
          <p className="text-sm text-[var(--text-secondary)]">
            Dein Feedback hilft, zukünftige Deload-Empfehlungen zu verbessern.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-3xl py-2.5 text-sm font-semibold bg-[var(--accent-color)] text-white"
          >
            Schließen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 pb-8 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--border-color)] bg-[var(--card-bg)] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-base font-bold text-[var(--text-color)]">Deload abgeschlossen</div>
          <button type="button" onClick={onClose}
            className="rounded-2xl p-1.5 text-white/50 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-[var(--text-secondary)]">
          Deine Leistungsboost-Woche ist vorbei. Wie fühlst du dich?
        </p>

        {/* Performance comparison */}
        {delta !== null && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-white/5 p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-2">Performance-Vergleich (Vor / Nach)</div>
            <div className="flex items-center gap-2">
              {delta > 2 ? (
                <TrendingUp size={18} className="text-green-400 shrink-0" />
              ) : delta < -2 ? (
                <TrendingDown size={18} className="text-red-400 shrink-0" />
              ) : (
                <Minus size={18} className="text-amber-400 shrink-0" />
              )}
              <span className={`text-base font-black ${delta > 2 ? "text-green-400" : delta < -2 ? "text-red-400" : "text-amber-400"}`}>
                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {delta > 2
                  ? "Leistung gestiegen — Deload hat gewirkt!"
                  : delta < -2
                  ? "Noch nicht vollständig erholt"
                  : "Stabile Leistung"}
              </span>
            </div>
          </div>
        )}

        {/* Feeling slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--text-secondary)]">Wie fühlst du dich?</span>
            <span className="font-bold text-[var(--text-color)]">{feeling}/10</span>
          </div>
          <input
            type="range" min={1} max={10}
            value={feeling}
            onChange={(e) => setFeeling(Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-0.5">
            <span>Erschöpft</span><span>Topfit</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-3xl py-2.5 text-sm font-semibold bg-white/10 text-[var(--text-color)]">
            Überspringen
          </button>
          <button type="button" onClick={handleSave}
            className="flex-1 rounded-3xl py-2.5 text-sm font-semibold bg-emerald-500 text-white">
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Checks whether a just-ended deload plan needs a feedback prompt.
 */
export function shouldShowPostDeloadFeedback(
  plan: DeloadPlan | null,
  userId?: string | null
): boolean {
  if (!plan) return false;
  const todayISO = new Date().toISOString().slice(0, 10);
  // Plan ended within the last 3 days
  if (todayISO <= plan.endISO) return false;
  const daysSinceEnd = Math.floor(
    (new Date(todayISO + "T00:00:00").getTime() -
      new Date(plan.endISO + "T00:00:00").getTime()) /
    86400000
  );
  if (daysSinceEnd > 3) return false;
  // Not already given feedback
  return !readFeedbackGivenIds(userId).includes(plan.id);
}
