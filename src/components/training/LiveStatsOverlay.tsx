import React, { useMemo } from "react";
import { Zap, Target, Trophy, Flame, TrendingUp } from "lucide-react";
import type { LiveWorkout, ExerciseHistoryEntry } from "../../types/training";
import { EXERCISES } from "../../data/exerciseLibrary";
import { BottomSheet } from "../common/BottomSheet";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    workout: LiveWorkout;
    historyMap: Map<string, ExerciseHistoryEntry | null>;
}

export const LiveStatsOverlay: React.FC<Props> = ({ isOpen, onClose, workout, historyMap }) => {
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
            const muscle = def?.primaryMuscles?.[0] || "Ganzkörper";
            const exName = def?.name || ex.name || "Übung";

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
                    bestSet: bestWeight > 0 ? `${bestWeight} kg × ${bestReps}` : `${bestReps} Wdh.`,
                });
            }
        });

        const maxMuscleVol = Math.max(...Object.values(muscleVolume), 1);
        const muscleBars = Object.entries(muscleVolume)
            .map(([m, vol]) => ({ label: formatMuscle(m), pct: vol / maxMuscleVol, vol }))
            .sort((a, b) => b.vol - a.vol)
            .slice(0, 5);

        const beastScore = Math.min(100, Math.round(progressionScore * 2));
        const completionPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

        return { currentVolume, completedSets, totalSets, personalRecords, muscleBars, exerciseStats, beastScore, completionPct };
    }, [workout, historyMap]);

    // SVG ring math
    const R = 46;
    const C = 2 * Math.PI * R;
    const beastDash = C * (stats.beastScore / 100);
    const completionDash = C * (stats.completionPct / 100);

    // Letter grade
    const grade = stats.beastScore >= 80 ? "S" : stats.beastScore >= 60 ? "A" : stats.beastScore >= 40 ? "B" : stats.beastScore >= 20 ? "C" : "D";
    const gradeColor = stats.beastScore >= 80 ? "#f59e0b" : stats.beastScore >= 60 ? "#10b981" : stats.beastScore >= 40 ? "#3b82f6" : "#8b5cf6";

    // Theme-adaptive surface colors using CSS variables
    const cardBg = "var(--button-bg)";
    const cardBorder = "var(--border-color)";
    const dividerColor = "var(--border-color)";
    const textPrimary = "var(--text-color)";
    const textSecondary = "var(--text-secondary)";
    const textMuted = "var(--text-secondary)";

    return (
        <BottomSheet
            open={isOpen}
            onClose={onClose}
            height="90dvh"
            maxHeight="90dvh"
        >
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-5 pt-1 pb-4 flex-shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-0.5" style={{ color: "#007AFF", opacity: 0.85 }}>
                        Live Session
                    </p>
                    <h2 className="text-xl font-black tracking-tight" style={{ color: textPrimary }}>Performance</h2>
                </div>

                {/* Scrollable body */}
                <div
                    className="flex-1 overflow-y-auto px-4 space-y-3"
                    style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}
                >
                    {/* Hero: Two Rings */}
                    <div
                        className="rounded-3xl p-5 flex items-center justify-around"
                        style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                    >
                        {/* Beast Score ring */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative" style={{ width: 112, height: 112 }}>
                                <svg width={112} height={112} viewBox="0 0 112 112">
                                    <defs>
                                        <linearGradient id="beastGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#8b5cf6" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx={56} cy={56} r={R} fill="none" stroke="rgba(59,130,246,0.12)" strokeWidth={9} />
                                    <circle cx={56} cy={56} r={R} fill="none" stroke="url(#beastGrad)" strokeWidth={9}
                                        strokeDasharray={`${beastDash} ${C}`} strokeLinecap="round"
                                        transform="rotate(-90 56 56)" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black tabular-nums leading-none" style={{ color: textPrimary }}>{stats.beastScore}</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#8b5cf6" }}>Score</span>
                                </div>
                            </div>
                            <p className="text-[11px] font-semibold" style={{ color: textMuted }}>Beast Score</p>
                        </div>

                        {/* Center: Grade */}
                        <div className="flex flex-col items-center gap-1">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: `${gradeColor}18`, border: `1.5px solid ${gradeColor}40` }}>
                                <span className="text-2xl font-black" style={{ color: gradeColor }}>{grade}</span>
                            </div>
                            <p className="text-[10px] font-medium" style={{ color: textMuted }}>Grade</p>
                        </div>

                        {/* Completion ring */}
                        <div className="flex flex-col items-center gap-2">
                            <div className="relative" style={{ width: 112, height: 112 }}>
                                <svg width={112} height={112} viewBox="0 0 112 112">
                                    <defs>
                                        <linearGradient id="doneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                    <circle cx={56} cy={56} r={R} fill="none" stroke="rgba(16,185,129,0.12)" strokeWidth={9} />
                                    <circle cx={56} cy={56} r={R} fill="none" stroke="url(#doneGrad)" strokeWidth={9}
                                        strokeDasharray={`${completionDash} ${C}`} strokeLinecap="round"
                                        transform="rotate(-90 56 56)" />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black tabular-nums leading-none" style={{ color: textPrimary }}>{stats.completionPct}%</span>
                                    <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "#10b981" }}>Done</span>
                                </div>
                            </div>
                            <p className="text-[11px] font-semibold" style={{ color: textMuted }}>Abschluss</p>
                        </div>
                    </div>

                    {/* Stat Pills */}
                    <div className="grid grid-cols-3 gap-2">
                        <StatPill icon={<Zap size={15} />}
                            value={stats.currentVolume >= 1000 ? `${(stats.currentVolume / 1000).toFixed(2)}t` : `${stats.currentVolume}kg`}
                            label="Volumen" accent="#3b82f6"
                            textPrimary={textPrimary} textSecondary={textMuted} />
                        <StatPill icon={<Target size={15} />}
                            value={`${stats.completedSets}`}
                            label="Sätze" accent="#10b981"
                            textPrimary={textPrimary} textSecondary={textMuted} />
                        <StatPill icon={<Trophy size={15} />}
                            value={`${stats.personalRecords}`}
                            label="PRs" accent="#f59e0b" glow={stats.personalRecords > 0}
                            textPrimary={textPrimary} textSecondary={textMuted} />
                    </div>

                    {/* PR Banner */}
                    {stats.personalRecords > 0 && (
                        <div className="rounded-2xl p-4 flex items-center gap-3"
                            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))", border: "1px solid rgba(251,191,36,0.2)" }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: "rgba(251,191,36,0.15)" }}>
                                <Trophy size={20} className="text-amber-400" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-amber-400">
                                    {stats.personalRecords} neuer Rekord{stats.personalRecords !== 1 ? "e" : ""}! 🏆
                                </p>
                                <p className="text-xs text-amber-500/60">Du hast heute deine Bestleistung gebrochen</p>
                            </div>
                        </div>
                    )}

                    {/* Muscle Activation Bars */}
                    {stats.muscleBars.length > 0 && (
                        <div className="rounded-2xl p-4 space-y-3"
                            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                            <div className="flex items-center gap-2 mb-1">
                                <Flame size={13} className="text-orange-400" />
                                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Muskel Aktivierung</p>
                            </div>
                            {stats.muscleBars.map((m, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-semibold" style={{ color: textSecondary }}>{m.label}</span>
                                        <span className="text-[10px] font-mono" style={{ color: textMuted }}>
                                            {m.vol >= 1000 ? `${(m.vol / 1000).toFixed(2)}t` : `${m.vol}kg`}
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border-color)" }}>
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.round(m.pct * 100)}%`,
                                                background: i === 0
                                                    ? "linear-gradient(90deg, #3b82f6, #8b5cf6)"
                                                    : i === 1
                                                        ? "linear-gradient(90deg, #10b981, #06b6d4)"
                                                        : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Exercise Breakdown */}
                    {stats.exerciseStats.length > 0 && (
                        <div className="rounded-2xl overflow-hidden"
                            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                                <TrendingUp size={13} className="text-blue-400" />
                                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: textMuted }}>Übungen</p>
                            </div>
                            {stats.exerciseStats.map((ex, i) => (
                                <div
                                    key={i}
                                    className="px-4 py-3 flex items-center justify-between"
                                    style={{ borderTop: i === 0 ? undefined : `1px solid ${dividerColor}` }}
                                >
                                    <div className="min-w-0 flex-1 pr-3">
                                        <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>{ex.name}</p>
                                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>{ex.sets} Sätze · Best: {ex.bestSet}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm font-black" style={{ color: "#3b82f6" }}>
                                            {ex.volume >= 1000 ? `${(ex.volume / 1000).toFixed(2)}t` : `${ex.volume} kg`}
                                        </p>
                                        <p className="text-[10px]" style={{ color: textMuted }}>Volumen</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Empty state */}
                    {stats.completedSets === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                style={{ background: cardBg }}>
                                <Zap size={28} style={{ color: textMuted }} />
                            </div>
                            <p className="text-sm" style={{ color: textMuted }}>Starte dein erstes Set um Stats zu sehen</p>
                        </div>
                    )}
                </div>
            </div>
        </BottomSheet>
    );
};

// ── Subcomponents ──────────────────────────────────────────────────────────────

const StatPill = ({ icon, value, label, accent, glow, textPrimary, textSecondary }: {
    icon: React.ReactNode;
    value: string;
    label: string;
    accent: string;
    glow?: boolean;
    textPrimary: string;
    textSecondary: string;
}) => (
    <div
        className="rounded-2xl p-3 flex flex-col items-center gap-1 text-center"
        style={{
            background: `${accent}12`,
            border: `1px solid ${accent}${glow ? "40" : "20"}`,
            boxShadow: glow ? `0 0 16px ${accent}25` : undefined,
        }}
    >
        <div style={{ color: accent }}>{icon}</div>
        <span className="text-xl font-black tabular-nums leading-none" style={{ color: textPrimary }}>{value}</span>
        <span className="text-[10px] font-medium" style={{ color: textSecondary }}>{label}</span>
    </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMuscle(m: string): string {
    const map: Record<string, string> = {
        chest: "Brust", back: "Rücken", lats: "Lat", traps: "Nacken",
        rear_delts: "Rück. Schulter", front_delts: "Vord. Schulter", side_delts: "Seitl. Schulter",
        biceps: "Bizeps", triceps: "Trizeps", forearms: "Unterarme",
        quads: "Quads", hamstrings: "Hamstrings", glutes: "Gesäß",
        calves: "Waden", core: "Core", obliques: "Obliques",
        lower_back: "Unt. Rücken", hip_flexors: "Hüftbeuger", Ganzkörper: "Ganzkörper",
    };
    return map[m] || m;
}
