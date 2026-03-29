import React, { useState } from "react";
import { AlertTriangle, CheckCircle, Settings, ChevronDown, ChevronUp } from "lucide-react";
import type { DeloadPlan } from "../../types/deload";
import type { DeloadScoreResult } from "../../types/wellness";

interface DeloadBannerProps {
  state: "recommended" | "active";
  plan?: DeloadPlan | null;
  onPlan: () => void;
  onDismiss: () => void;
  onAdjust?: () => void;
  scoreResult?: DeloadScoreResult | null;
}

export default function DeloadBanner({
  state,
  plan,
  onPlan,
  onDismiss,
  onAdjust,
  scoreResult,
}: DeloadBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (state === "active" && plan) {
    return (
      <div className="rounded-[24px] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 to-green-500/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-400">
              Leistungsboost-Woche aktiv
            </div>
            <div className="text-xs text-emerald-300/70">
              {plan.startISO} &ndash; {plan.endISO} · Weniger ist mehr!
            </div>
          </div>
        </div>
        {onAdjust && (
          <button
            type="button"
            onClick={onAdjust}
            className="rounded-3xl px-4 py-2 text-xs font-semibold text-emerald-300 border border-emerald-500/30 active:scale-95 transition-transform flex items-center gap-1.5"
          >
            <Settings size={14} />
            Anpassen
          </button>
        )}
      </div>
    );
  }

  // Recommended state
  const score   = scoreResult?.score ?? 0;
  const urgent  = scoreResult?.level === "urgent";
  const reasons = scoreResult?.factors.filter((f) => f.applies) ?? [];

  return (
    <div className={`rounded-[24px] p-4 flex flex-col gap-3 border backdrop-blur-md ${
      urgent
        ? "border-red-500/30 bg-gradient-to-r from-red-600/20 to-orange-500/10"
        : "border-amber-500/30 bg-gradient-to-r from-amber-600/20 to-orange-500/10"
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          urgent ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-amber-500/20 text-amber-400 animate-pulse"
        }`}>
          <AlertTriangle size={20} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${urgent ? "text-red-400" : "text-amber-400"}`}>
            {urgent ? "Leistungsboost-Woche dringend empfohlen" : "Leistungsboost-Woche empfohlen"}
          </div>
          <div className={`text-xs mt-0.5 ${urgent ? "text-red-300/70" : "text-amber-300/70"}`}>
            {urgent
              ? "Dein Körper zeigt mehrere Zeichen von Überbelastung."
              : "Strategische Erholung für mehr Leistung nach der Woche."}
          </div>

          {/* Score badge + expand toggle */}
          {score > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                urgent ? "bg-red-500/20 text-red-300" : "bg-amber-500/20 text-amber-300"
              }`}
            >
              Score {score}/100
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}

          {/* Reason breakdown */}
          {expanded && reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {reasons.map((f) => (
                <div key={f.key} className="flex items-start gap-1.5 text-[11px] text-amber-200/80">
                  <span className="mt-px shrink-0">•</span>
                  <span>
                    {f.label}
                    {f.detail && <span className="ml-1 text-red-300">({f.detail})</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlan}
          className={`rounded-3xl px-4 py-2 text-xs font-bold text-white active:scale-95 transition-transform ${
            urgent ? "bg-red-500" : "bg-amber-500"
          }`}
        >
          Jetzt planen
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={`rounded-3xl px-4 py-2 text-xs font-semibold border active:scale-95 transition-transform ${
            urgent ? "text-red-300 border-red-500/30" : "text-amber-300 border-amber-500/30"
          }`}
        >
          Später
        </button>
      </div>
    </div>
  );
}
