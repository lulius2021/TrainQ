// src/components/adaptive/AdaptiveInfoBadge.tsx
/**
 * Adaptive Info Badge Component
 * 
 * Displays the "why" behind adaptive workout decisions
 * Shows recovery context and adjustment reasoning
 */

import React, { useState } from "react";

export interface AdaptiveInfoBadgeProps {
    /** Main reason for the adjustment */
    reason: string;

    /** Recovery score (0-100) */
    recoveryScore?: number;

    /** Whether this is a deload recommendation */
    isDeload?: boolean;

    /** Additional context */
    details?: string;
}

export function AdaptiveInfoBadge({
    reason,
    recoveryScore,
    isDeload = false,
    details
}: AdaptiveInfoBadgeProps) {
    const [showDetails, setShowDetails] = useState(false);

    // Determine badge color based on context
    const getBadgeColor = () => {
        if (isDeload) {
            return "bg-[var(--accent-color)]/20 border-[var(--accent-color)]/40 text-[var(--accent-color)]";
        }

        if (recoveryScore !== undefined) {
            if (recoveryScore < 40) {
                return "bg-red-500/20 border-red-500/40 text-red-300";
            } else if (recoveryScore < 60) {
                return "bg-yellow-500/20 border-yellow-500/40 text-yellow-300";
            } else if (recoveryScore < 80) {
                return "bg-blue-500/20 border-blue-500/40 text-blue-300";
            } else {
                return "bg-green-500/20 border-green-500/40 text-green-300";
            }
        }

        return "bg-white/10 border-white/20 text-white";
    };

    const getIcon = () => {
        if (isDeload) return "⚠️";
        if (recoveryScore !== undefined) {
            if (recoveryScore < 40) return "🔴";
            if (recoveryScore < 60) return "🟡";
            if (recoveryScore < 80) return "🔵";
            return "🟢";
        }
        return "ℹ️";
    };

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-medium transition-all ${getBadgeColor()} hover:opacity-80`}
                title="Click for details"
            >
                <span>{getIcon()}</span>
                <span>{reason}</span>
                {recoveryScore !== undefined && (
                    <span className="opacity-70">({recoveryScore}%)</span>
                )}
            </button>

            {showDetails && details && (
                <div className="absolute top-full left-0 mt-2 w-64 p-3 rounded-2xl border border-white/20 bg-black/90 backdrop-blur-sm shadow-xl z-50 text-xs text-gray-300">
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-semibold text-white">Strategy Details</span>
                        <button
                            type="button"
                            onClick={() => setShowDetails(false)}
                            className="text-gray-400 hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="leading-relaxed">{details}</p>
                </div>
            )}
        </div>
    );
}

/**
 * Compact version for set-level labels
 */
export function AdaptiveSetLabel({ label }: { label: string }) {
    return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-gray-400">
            <span className="opacity-60">💡</span>
            <span>{label}</span>
        </div>
    );
}
