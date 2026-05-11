import React, { useMemo, useState, useCallback } from "react";
import { Zap, Target, Trophy, Flame, TrendingUp, Info } from "lucide-react";
import type { LiveWorkout, ExerciseHistoryEntry } from "../../types/training";
import { EXERCISES } from "../../data/exerciseLibrary";
import { BottomSheet } from "../common/BottomSheet";
import { useI18n } from "../../i18n/useI18n";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workout: LiveWorkout;
    historyMap: Map<string, ExerciseHistoryEntry | null>;
}

type InfoKey = "beastScore" | "grade" | "completion";

export const LiveStatsOverlay: React.FC<Props> = ({ isOpen, onClose, workout, historyMap }) => {
    const { t } = useI18n();
    const [infoKey, setInfoKey] = useState<InfoKey | null>(null);
    const openInfo = useCallback((key: InfoKey) => setInfoKey(key), []);

    const stats = useMemo(() => {
        let currentVolume = 0;
        let completedSets = 0;
        let totalSets = 0;
        const muscleVolume: Record<string, number> = {};
        let progressionScore = 0;
        let personalRecords = 0;
        const exerciseStats: Array<{ name: string; sets: number; volume: number; bestSet: string }> = [];

        workout.exercises.forEach((ex) => {
            const def = EXERCISES.find((e) => e.id === ex.exerciseId);
            const muscle = def?.primaryMuscles?.[0] || "full_body";
            const exName = def?.name || ex.name || t("training.liveStats.exercise");

            const history = historyMap.get(ex.id) || null;
            let maxWeightPrev = 0;
            if (history?.sets) {
                maxWeightPrev = Math.max(...history.sets.map((s) => s.weight || 0));
            }

            let exSets = 0;
            let exVolume = 0;
            let bestWeight = 0;
            let bestReps = 0;
            totalSets += ex.sets.length;

            ex.sets.forEach((set) => {
                if (set.completed) {
                    completedSets++;
                    exSets++;
                    const w = set.weight || 0;
                    const r = set.reps || 0;
                    currentVolume += w * r;
                    exVolume += w * r;
                    muscleVolume[muscle] = (muscleVolume[muscle] || 0) + w * r;
                    progressionScore += (w * r) / 100;
                    if (w > bestWeight) { bestWeight = w; bestReps = r; }
                    if (w > maxWeightPrev && maxWeightPrev > 0) personalRecords++;
                }
            });

            if (exSets > 0) {
                exerciseStats.push({
                    name: exName,
                    sets: exSets,
                    volume: exVolume,
                    bestSet: bestWeight > 0 ? `${bestWeight}kg x ${bestReps}` : `${bestReps} ${t("training.liveStats.reps")}`,
                });
            }
        });

        const maxMuscleVol = Math.max(...Object.values(muscleVolume), 1);
        const muscleBars = Object.entries(muscleVolume)
            .map(([m, vol]) => ({ label: t(`training.muscle.${m}`, { defaultValue: formatMuscle(m) }), pct: vol / maxMuscleVol, vol }))
            .sort((a, b) => b.vol - a.vol)
            .slice(0, 5);

        const beastScore = Math.min(100, Math.round(progressionScore * 2));
        const completionPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

        return { currentVolume, completedSets, totalSets, personalRecords, muscleBars, exerciseStats, beastScore, completionPct };
    }, [workout, historyMap, t]);

    const R = 42;
    const C = 2 * Math.PI * R;
    const beastDash = C * (stats.beastScore / 100);
    const completionDash = C * (stats.completionPct / 100);

    const grade = stats.beastScore >= 80 ? "S" : stats.beastScore >= 60 ? "A" : stats.beastScore >= 40 ? "B" : stats.beastScore >= 20 ? "C" : "D";
    const gradeColor = stats.beastScore >= 80 ? "#f59e0b" : stats.beastScore >= 60 ? "#10b981" : stats.beastScore >= 40 ? "#3b82f6" : "#8b5cf6";

    return (
        <BottomSheet open={isOpen} onClose={onClose} height="90dvh" maxHeight="90dvh">
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-5 pt-1 pb-4 flex-shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-0.5" style={{ color: "var(--accent-color)" }}>
                        {t("training.liveStats.liveSession")}
                    </p>
                    <h2 className="text-xl font-black tracking-tight" style={{ color: "var(--text-color)" }}>
                        {t("training.liveStats.performance")}
                    </h2>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 space-y-3" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}>

                    {/* Hero rings */}
                    <div className="flex items-center justify-around py-4">
                        {/* Beast Score */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative" style={{ width: 110, height: 110 }}>
                                <svg width={110} height={110} viewBox="0 0 110 110">
                                    <defs>
                                        <linearGradient id="beastGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx={55} cy={55} r={R} fill="none" stroke="var(--border-color)" strokeWidth={7} />
                                    {stats.beastScore > 0 && (
                                        <circle cx={55} cy={55} r={R} fill="none" stroke="url(#beastGrad)" strokeWidth={7}
                                            strokeDasharray={`${beastDash} ${C}`} strokeLinecap="round"
                                            transform="rotate(-90 55 55)" />
                                    )}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[28px] font-black tabular-nums leading-none" style={{ color: "var(--text-color)" }}>{stats.beastScore}</span>
                                    {stats.beastScore > 0 ? (
                                        <div className="mt-1 px-2 py-0.5 rounded-md" style={{ background: `${gradeColor}18` }}>
                                            <span className="text-[9px] font-black tracking-wide" style={{ color: gradeColor }}>{grade}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[8px] font-bold uppercase tracking-widest mt-1" style={{ color: "var(--text-secondary)" }}>Score</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Beast Score</p>
                                <InfoButton onTap={() => openInfo("beastScore")} />
                            </div>
                        </div>

                        {/* Completion */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative" style={{ width: 110, height: 110 }}>
                                <svg width={110} height={110} viewBox="0 0 110 110">
                                    <defs>
                                        <linearGradient id="doneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx={55} cy={55} r={R} fill="none" stroke="var(--border-color)" strokeWidth={7} />
                                    {stats.completionPct > 0 && (
                                        <circle cx={55} cy={55} r={R} fill="none" stroke="url(#doneGrad)" strokeWidth={7}
                                            strokeDasharray={`${completionDash} ${C}`} strokeLinecap="round"
                                            transform="rotate(-90 55 55)" />
                                    )}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-[28px] font-black tabular-nums leading-none" style={{ color: "var(--text-color)" }}>{stats.completionPct}%</span>
                                    {stats.totalSets > 0 && (
                                        <span className="text-[10px] font-semibold mt-0.5" style={{ color: "#10b981" }}>
                                            {stats.completedSets}/{stats.totalSets}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <p className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>{t("training.liveStats.completion")}</p>
                                <InfoButton onTap={() => openInfo("completion")} />
                            </div>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-3 gap-2">
                        <StatCard icon={<Zap size={16} />} value={formatVolume(stats.currentVolume)}
                            label={t("training.liveStats.volume")} accent="#3b82f6" />
                        <StatCard icon={<Target size={16} />} value={`${stats.completedSets}`}
                            label={t("training.liveStats.sets")} accent="#10b981" />
                        <StatCard icon={<Trophy size={16} />} value={`${stats.personalRecords}`}
                            label={t("training.liveStats.prs")} accent="#f59e0b" glow={stats.personalRecords > 0} />
                    </div>

                    {/* PR Banner */}
                    {stats.personalRecords > 0 && (
                        <div className="rounded-2xl p-4 flex items-center gap-3"
                            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: "rgba(251,191,36,0.15)" }}>
                                <Trophy size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-400">
                                    {t("training.liveStats.prBannerTitle", { count: stats.personalRecords })}
                                </p>
                                <p className="text-xs" style={{ color: "rgba(245,158,11,0.6)" }}>{t("training.liveStats.prBannerSubtitle")}</p>
                            </div>
                        </div>
                    )}

                    {/* Muscle Activation */}
                    {stats.muscleBars.length > 0 && (
                        <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                            <div className="flex items-center gap-2">
                                <Flame size={13} className="text-orange-400" />
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    {t("training.liveStats.muscleActivation")}
                                </p>
                            </div>
                            {stats.muscleBars.map((m, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs font-semibold" style={{ color: "var(--text-color)" }}>{m.label}</span>
                                        <span className="text-[10px] font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                                            {formatVolume(m.vol)}
                                        </span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                                        <div className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.round(m.pct * 100)}%`,
                                                background: i === 0 ? "linear-gradient(90deg, #3b82f6, #8b5cf6)"
                                                    : i === 1 ? "linear-gradient(90deg, #10b981, #06b6d4)"
                                                    : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                            }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Exercise Breakdown */}
                    {stats.exerciseStats.length > 0 && (
                        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                                <TrendingUp size={13} className="text-blue-400" />
                                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                                    {t("training.liveStats.exercises")}
                                </p>
                            </div>
                            {stats.exerciseStats.map((ex, i) => (
                                <div key={i} className="px-4 py-3 flex items-center justify-between"
                                    style={{ borderTop: `1px solid var(--border-color)` }}>
                                    <div className="min-w-0 flex-1 pr-3">
                                        <p className="text-[14px] font-semibold truncate" style={{ color: "var(--text-color)" }}>{ex.name}</p>
                                        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                            {t("training.liveStats.setsCount", { count: ex.sets })} · {ex.bestSet}
                                        </p>
                                    </div>
                                    <span className="text-[14px] font-black shrink-0" style={{ color: "#3b82f6" }}>
                                        {formatVolume(ex.volume)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {stats.completedSets === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                                style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)" }}>
                                <Zap size={24} style={{ color: "var(--text-secondary)" }} />
                            </div>
                            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("training.liveStats.emptyState")}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Info Sheet */}
            <BottomSheet open={!!infoKey} onClose={() => setInfoKey(null)} height="auto">
                {infoKey && (
                    <div className="px-5 pb-8 pt-2">
                        <h3 className="text-lg font-black mb-3" style={{ color: "var(--text-color)" }}>
                            {t(`training.liveStats.info.${infoKey}.title`)}
                        </h3>
                        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {t(`training.liveStats.info.${infoKey}.description`)}
                        </p>
                        {infoKey === "grade" && (
                            <div className="mt-4 space-y-2">
                                {(["S", "A", "B", "C", "D"] as const).map((g) => {
                                    const color = g === "S" ? "#f59e0b" : g === "A" ? "#10b981" : g === "B" ? "#3b82f6" : "#8b5cf6";
                                    const range = g === "S" ? "80-100" : g === "A" ? "60-79" : g === "B" ? "40-59" : g === "C" ? "20-39" : "0-19";
                                    return (
                                        <div key={g} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20`, border: `1.5px solid ${color}50` }}>
                                                <span className="text-sm font-black" style={{ color }}>{g}</span>
                                            </div>
                                            <span className="text-sm font-medium tabular-nums" style={{ color: "var(--text-secondary)" }}>{range}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </BottomSheet>
        </BottomSheet>
    );
};

// ── Subcomponents ──

const InfoButton: React.FC<{ onTap: () => void }> = ({ onTap }) => (
    <button type="button" onPointerUp={(e) => { e.stopPropagation(); onTap(); }}
        className="ml-0.5 flex items-center justify-center"
        style={{ width: 18, height: 18, minWidth: 18, touchAction: "manipulation" }}>
        <Info size={12} strokeWidth={2.5} style={{ color: "var(--text-secondary)", opacity: 0.4 }} />
    </button>
);

const StatCard = ({ icon, value, label, accent, glow }: {
    icon: React.ReactNode; value: string; label: string; accent: string; glow?: boolean;
}) => (
    <div className="rounded-2xl p-3.5 flex flex-col items-center gap-1.5 text-center"
        style={{ backgroundColor: "var(--card-bg)", border: `1px solid var(--border-color)`, boxShadow: glow ? `0 0 20px ${accent}20` : undefined }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${accent}15` }}>
            <div style={{ color: accent }}>{icon}</div>
        </div>
        <span className="text-[20px] font-black tabular-nums leading-none" style={{ color: "var(--text-color)" }}>{value}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{label}</span>
    </div>
);

// ── Helpers ──

function formatVolume(vol: number): string {
    return vol >= 1000 ? `${(vol / 1000).toFixed(1)}t` : `${vol}kg`;
}

function formatMuscle(m: string): string {
    const fallback: Record<string, string> = {
        chest: "Chest", back: "Back", lats: "Lats", traps: "Traps",
        rear_delts: "Rear Delts", front_delts: "Front Delts", side_delts: "Side Delts",
        biceps: "Biceps", triceps: "Triceps", forearms: "Forearms",
        quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes",
        calves: "Calves", core: "Core", obliques: "Obliques",
        lower_back: "Lower Back", hip_flexors: "Hip Flexors", full_body: "Full Body",
    };
    return fallback[m] || m;
}
