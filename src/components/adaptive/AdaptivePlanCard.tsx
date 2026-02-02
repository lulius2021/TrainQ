// src/components/adaptive/AdaptivePlanCard.tsx
import React from "react";
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
            className={`rounded-2xl border transition-all ${isBlocked ? "opacity-50" : "hover:shadow-xl hover:scale-[1.01]"
                }`}
            style={{
                borderColor: accent.border,
                borderWidth: '1.5px',
                background: `linear-gradient(135deg, ${accent.bg}, rgba(255,255,255,0.03))`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            }}
        >
            <div className="p-5">
                {/* Header with Profile Badge */}
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2.5">
                            <span
                                className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider"
                                style={{
                                    background: accent.badgeBg,
                                    color: accent.border,
                                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
                                    letterSpacing: '0.5px',
                                }}
                            >
                                {profileLabel}
                            </span>
                            {!isPro && suggestion.profile !== "stabil" && (
                                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30">
                                    Pro
                                </span>
                            )}
                            {isPro && (
                                <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-white/10 text-white/70">
                                    {t("adaptive.alwaysFree")}
                                </span>
                            )}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1.5" style={{ letterSpacing: '-0.3px' }}>
                            {suggestion.title}
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed" style={{ letterSpacing: '-0.1px' }}>
                            {suggestion.subtitle}
                        </p>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    {/* Duration */}
                    <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <svg
                                className="w-4 h-4 text-white/70"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                                Time
                            </span>
                        </div>
                        <p className="text-lg font-bold text-white">
                            {isBlocked ? "—" : `${suggestion.estimatedMinutes} min`}
                        </p>
                    </div>

                    {/* Exercises */}
                    <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <svg
                                className="w-4 h-4 text-white/70"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                                />
                            </svg>
                            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                                Exercises
                            </span>
                        </div>
                        <p className="text-lg font-bold text-white">
                            {isBlocked ? "—" : suggestion.exercisesCount}
                        </p>
                    </div>

                    {/* Sets */}
                    <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-3 border border-white/10">
                        <div className="flex items-center gap-2 mb-1">
                            <svg
                                className="w-4 h-4 text-white/70"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                                Sets
                            </span>
                        </div>
                        <p className="text-lg font-bold text-white">
                            {isBlocked ? "—" : `${suggestion.setsPerExercise}/ex`}
                        </p>
                    </div>
                </div>

                {/* Intensity Hint */}
                <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-3 border border-white/10 mb-4">
                    <div className="flex items-start gap-2">
                        <svg
                            className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-1">
                                Intensity
                            </p>
                            <p className="text-sm text-white font-medium">
                                {suggestion.intensityHint}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reasons (Why this plan?) */}
                {suggestion.reasons && suggestion.reasons.length > 0 && (
                    <div className="rounded-3xl bg-white/5 backdrop-blur-sm p-3 border border-white/10 mb-4">
                        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">
                            {t("adaptive.why")}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {suggestion.reasons.slice(0, 3).map((reason) => (
                                <span
                                    key={reason}
                                    className="px-2 py-1 rounded-md text-xs font-medium bg-white/10 text-white/80"
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
                    className={`w-full py-3.5 rounded-3xl text-base font-bold text-white transition-all ${disabled || isBlocked
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:scale-[1.02] active:scale-[0.98] shadow-lg"
                        }`}
                    style={{
                        background: isBlocked
                            ? "rgba(255,255,255,0.1)"
                            : `linear-gradient(135deg, ${accent.badgeBg.replace("0.2", "0.4")}, ${accent.border})`,
                    }}
                >
                    {isBlocked ? t("adaptive.disabledToday") : t("adaptive.select")}
                </button>

                {/* Disabled Message */}
                {isBlocked && (
                    <p className="text-xs text-center text-white/50 mt-2">
                        {t("adaptive.disabledMessage")}
                    </p>
                )}
            </div>
        </div>
    );
}
