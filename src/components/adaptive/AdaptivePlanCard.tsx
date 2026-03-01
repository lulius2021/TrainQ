// src/components/adaptive/AdaptivePlanCard.tsx
import React from "react";
import { Clock, ClipboardList, Layers, Zap } from "lucide-react";
import type { AdaptiveSuggestion } from "../../types/adaptive";
import { useI18n } from "../../i18n/useI18n";

interface AdaptivePlanCardProps {
    suggestion: AdaptiveSuggestion;
    accent: {
        bg: string;
        border: string;
        badgeBg: string;
    };
    onSelect: () => void;
    disabled?: boolean;
    isPro?: boolean;
}

export default function AdaptivePlanCard({
    suggestion,
    accent,
    onSelect,
    disabled = false,
    isPro = false,
}: AdaptivePlanCardProps) {
    const { t } = useI18n();

    const isBlocked = suggestion.estimatedMinutes === 0;
    const profileLabel = {
        stabil: "A · Stable",
        kompakt: "B · Compact",
        fokus: "C · Focus",
    }[suggestion.profile] || suggestion.profile;

    return (
        <div
            className={`rounded-[20px] border transition-all overflow-hidden ${isBlocked ? "opacity-50" : ""}`}
            style={{
                borderColor: accent.border,
                borderWidth: '1.5px',
                backgroundColor: "var(--card-bg)",
            }}
        >
            <div className="p-4">
                {/* Header with Profile Badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                                style={{
                                    background: accent.badgeBg,
                                    color: accent.border,
                                }}
                            >
                                {profileLabel}
                            </span>
                            {!isPro && suggestion.profile !== "stabil" && (
                                <span
                                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold border"
                                    style={{
                                        backgroundColor: "rgba(0,122,255,0.1)",
                                        color: "var(--accent-color)",
                                        borderColor: "rgba(0,122,255,0.2)",
                                    }}
                                >
                                    Pro
                                </span>
                            )}
                        </div>
                        <h3
                            className="text-[17px] font-bold mb-1"
                            style={{ color: "var(--text-color)", letterSpacing: '-0.2px' }}
                        >
                            {suggestion.title}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {suggestion.subtitle}
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                    <div
                        className="rounded-2xl p-3 border"
                        style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <Clock size={13} style={{ color: "var(--text-secondary)" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                                Zeit
                            </span>
                        </div>
                        <p className="text-base font-bold" style={{ color: "var(--text-color)" }}>
                            {isBlocked ? "—" : `${suggestion.estimatedMinutes}m`}
                        </p>
                    </div>

                    <div
                        className="rounded-2xl p-3 border"
                        style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <ClipboardList size={13} style={{ color: "var(--text-secondary)" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                                Übungen
                            </span>
                        </div>
                        <p className="text-base font-bold" style={{ color: "var(--text-color)" }}>
                            {isBlocked ? "—" : suggestion.exercisesCount}
                        </p>
                    </div>

                    <div
                        className="rounded-2xl p-3 border"
                        style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}
                    >
                        <div className="flex items-center gap-1.5 mb-1">
                            <Layers size={13} style={{ color: "var(--text-secondary)" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                                Sätze
                            </span>
                        </div>
                        <p className="text-base font-bold" style={{ color: "var(--text-color)" }}>
                            {isBlocked ? "—" : `${suggestion.setsPerExercise}/ex`}
                        </p>
                    </div>
                </div>

                {/* Intensity Hint */}
                <div
                    className="rounded-2xl p-3 border mb-3"
                    style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}
                >
                    <div className="flex items-start gap-2">
                        <Zap size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-secondary)" }} />
                        <div className="flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-secondary)" }}>
                                Intensität
                            </p>
                            <p className="text-sm font-medium" style={{ color: "var(--text-color)" }}>
                                {suggestion.intensityHint}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reasons */}
                {suggestion.reasons && suggestion.reasons.length > 0 && (
                    <div
                        className="rounded-2xl p-3 border mb-3"
                        style={{ backgroundColor: "var(--button-bg)", borderColor: "var(--border-color)" }}
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-secondary)" }}>
                            {t("adaptive.why")}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {suggestion.reasons.slice(0, 3).map((reason) => (
                                <span
                                    key={reason}
                                    className="px-2 py-1 rounded-lg text-xs font-medium"
                                    style={{ backgroundColor: "var(--input-bg)", color: "var(--text-secondary)" }}
                                >
                                    {t(`adaptive.reason.${reason}` as any) || reason}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={onSelect}
                    disabled={disabled || isBlocked}
                    className={`w-full py-3.5 flex items-center justify-center rounded-2xl text-[15px] font-bold transition-all ${
                        disabled || isBlocked
                            ? "opacity-40 cursor-not-allowed"
                            : "active:scale-[0.97]"
                    }`}
                    style={{
                        color: isBlocked ? "var(--text-secondary)" : "#FFFFFF",
                        backgroundColor: isBlocked ? "var(--button-bg)" : accent.border,
                    }}
                >
                    {isBlocked ? t("adaptive.disabledToday") : t("adaptive.select")}
                </button>

                {isBlocked && (
                    <p className="text-xs text-center mt-2" style={{ color: "var(--text-secondary)" }}>
                        {t("adaptive.disabledMessage")}
                    </p>
                )}
            </div>
        </div>
    );
}
