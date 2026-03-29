// src/components/adaptive/AdaptivePlanCard.tsx
import React from "react";
import { Clock, ClipboardList, Layers, Zap, CalendarPlus, Play } from "lucide-react";
import type { AdaptiveSuggestion, AdaptiveReason } from "../../types/adaptive";

interface AdaptivePlanCardProps {
  suggestion: AdaptiveSuggestion;
  accent: { solid: string; bg: string; border: string; badgeBg: string };
  onSelect: () => void;
  onSaveToCalendar?: () => void;
  disabled?: boolean;
  isPro?: boolean;
}

const REASON_LABELS: Record<AdaptiveReason, string> = {
  time_low:      "Wenig Zeit",
  time_high:     "Viel Zeit",
  form_low:      "Niedrige Energie",
  form_high:     "Top-Form",
  stress_low:    "Entspannt",
  stress_high:   "Gestresst",
  effort_low:    "Leichtes Training gestern",
  effort_high:   "Intensiv gestern",
  recovery_low:  "Erholung nötig",
  recovery_good: "Gut erholt",
};

const PROFILE_META: Record<string, { letter: string; label: string }> = {
  stabil:  { letter: "A", label: "Stabil" },
  kompakt: { letter: "B", label: "Kompakt" },
  fokus:   { letter: "C", label: "Fokus" },
};

export default function AdaptivePlanCard({
  suggestion,
  accent,
  onSelect,
  onSaveToCalendar,
  disabled = false,
  isPro = false,
}: AdaptivePlanCardProps) {
  const isBlocked = suggestion.estimatedMinutes === 0;
  const meta = PROFILE_META[suggestion.profile] ?? { letter: "?", label: suggestion.profile };

  return (
    <div
      className={`rounded-[22px] overflow-hidden transition-all ${isBlocked ? "opacity-55" : ""}`}
      style={{ backgroundColor: "var(--card-bg)", border: `1.5px solid ${accent.border}` }}
    >
      {/* ── Colored Header Strip ── */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Letter badge */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-[18px] font-black text-white"
            style={{ background: accent.solid, boxShadow: `0 4px 16px ${accent.solid}55` }}
          >
            {meta.letter}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: accent.solid }}>
                {meta.label}
              </span>
              {!isPro && suggestion.profile !== "stabil" && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold"
                  style={{ backgroundColor: accent.badgeBg, color: accent.solid }}
                >
                  Pro
                </span>
              )}
            </div>
            <h3 className="text-[17px] font-black leading-tight" style={{ color: "var(--text-color)", letterSpacing: "-0.3px" }}>
              {suggestion.title}
            </h3>
            <p className="text-[13px] mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>
              {suggestion.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* ── Stats Row ── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <Clock size={14} />, label: "Zeit", value: isBlocked ? "—" : `${suggestion.estimatedMinutes}m` },
            { icon: <ClipboardList size={14} />, label: "Übungen", value: isBlocked ? "—" : String(suggestion.exercisesCount) },
            { icon: <Layers size={14} />, label: "Sätze/Ü", value: isBlocked ? "—" : String(suggestion.setsPerExercise) },
          ].map(({ icon, label, value }) => (
            <div
              key={label}
              className="rounded-2xl p-3 flex flex-col gap-1"
              style={{ backgroundColor: accent.bg }}
            >
              <div className="flex items-center gap-1.5" style={{ color: accent.solid }}>
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-[16px] font-black" style={{ color: "var(--text-color)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Intensity ── */}
        <div
          className="rounded-2xl p-3 flex items-start gap-2.5"
          style={{ backgroundColor: "var(--button-bg)", borderLeft: `3px solid ${accent.solid}` }}
        >
          <Zap size={15} className="shrink-0 mt-0.5" style={{ color: accent.solid }} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: accent.solid }}>
              Intensität
            </p>
            <p className="text-[13px] font-medium" style={{ color: "var(--text-color)" }}>
              {suggestion.intensityHint}
            </p>
          </div>
        </div>

        {/* ── Reasons ── */}
        {suggestion.reasons && suggestion.reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestion.reasons.slice(0, 4).map((r) => (
              <span
                key={r}
                className="px-2.5 py-1 rounded-full text-[12px] font-semibold"
                style={{ backgroundColor: accent.badgeBg, color: accent.solid }}
              >
                {REASON_LABELS[r] ?? r}
              </span>
            ))}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="flex flex-col gap-2 pt-1">
          {onSaveToCalendar && !isBlocked && (
            <button
              onClick={onSaveToCalendar}
              disabled={disabled}
              className={`w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition-all border ${
                disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"
              }`}
              style={{ borderColor: accent.solid, color: accent.solid, backgroundColor: accent.bg }}
            >
              <CalendarPlus size={16} />
              Im Kalender speichern
            </button>
          )}
          {!isBlocked ? (
            <button
              onClick={() => { onSaveToCalendar?.(); onSelect(); }}
              disabled={disabled}
              className={`w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition-all text-white ${
                disabled ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"
              }`}
              style={{ backgroundColor: accent.solid, boxShadow: `0 4px 16px ${accent.solid}44` }}
            >
              <Play size={16} />
              Jetzt starten
            </button>
          ) : (
            <div
              className="w-full py-3.5 flex items-center justify-center rounded-2xl text-[14px] font-semibold"
              style={{ backgroundColor: "var(--button-bg)", color: "var(--text-secondary)" }}
            >
              Heute nicht empfohlen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
