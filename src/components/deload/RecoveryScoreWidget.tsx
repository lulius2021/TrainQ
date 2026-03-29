import React from "react";
import type { DeloadScoreResult, TrainingStatus } from "../../types/wellness";

const STATUS_LABELS: Record<TrainingStatus, string> = {
  Productive:   "Produktiv",
  Peaking:      "Peak-Phase",
  Recovery:     "Erholung nötig",
  Overreaching: "Übertraining",
  Detraining:   "Detraining",
  Unknown:      "–",
};

const STATUS_COLORS: Record<TrainingStatus, string> = {
  Productive:   "text-green-400",
  Peaking:      "text-blue-400",
  Recovery:     "text-amber-400",
  Overreaching: "text-red-400",
  Detraining:   "text-gray-400",
  Unknown:      "text-[var(--text-secondary)]",
};

interface RecoveryScoreWidgetProps {
  result: DeloadScoreResult;
}

export default function RecoveryScoreWidget({ result }: RecoveryScoreWidgetProps) {
  const { score, snapshot, wellbeing } = result;

  // Recovery = inverse of deload score, clamped 0–100
  const recoveryScore = Math.max(0, Math.min(100, 100 - score));

  const config =
    recoveryScore > 60
      ? { stroke: "#34C759", text: "text-green-400", label: "Voll belastbar" }
      : recoveryScore > 39
      ? { stroke: "#FF9500", text: "text-amber-400", label: "Moderat belasten" }
      : { stroke: "#FF3B30", text: "text-red-400",   label: result.level === "urgent" ? "Deload dringend" : "Deload empfohlen" };

  const R  = 26;
  const circumference = 2 * Math.PI * R;
  const dashOffset    = circumference * (1 - recoveryScore / 100);

  return (
    <div className="rounded-[24px] p-4 border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="flex items-center gap-4">
        {/* Circular progress ring */}
        <div className="relative w-[60px] h-[60px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r={R} fill="none" stroke="currentColor"
              strokeWidth="5" className="text-white/10" />
            <circle
              cx="30" cy="30" r={R}
              fill="none"
              stroke={config.stroke}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-[15px] font-black ${config.text}`}>
            {recoveryScore}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[var(--text-color)] mb-0.5">Recovery Score</div>
          <div className={`text-xs font-semibold ${config.text} mb-1`}>{config.label}</div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--text-secondary)]">
            {snapshot.hasEnoughData && (
              <span>
                ACWR{" "}
                <span className={snapshot.acwr > 1.3 ? "text-amber-400 font-semibold" : "font-medium"}>
                  {snapshot.acwr.toFixed(2)}
                </span>
              </span>
            )}
            {snapshot.status !== "Unknown" && (
              <span className={STATUS_COLORS[snapshot.status]}>
                {STATUS_LABELS[snapshot.status]}
              </span>
            )}
            {wellbeing != null && (
              <span>Wohlbefinden <span className="font-medium text-[var(--text-color)]">{wellbeing}/10</span></span>
            )}
          </div>
        </div>
      </div>

      {/* ACWR warning bar */}
      {snapshot.hasEnoughData && snapshot.acwr > 1.3 && (
        <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
          ⚠️ ACWR {snapshot.acwr.toFixed(2)} — {snapshot.acwr > 1.5 ? "Verletzungsrisiko erhöht. Volumen reduzieren!" : "Belastungsspitze. Erholung priorisieren."}
        </div>
      )}
    </div>
  );
}
