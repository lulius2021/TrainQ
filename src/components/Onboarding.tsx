import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSupabaseClient } from '../lib/supabaseClient';
import { AppButton } from './ui/AppButton';
import { Dumbbell } from 'lucide-react';

/**
 * Single-screen onboarding: Fokus + Zeit + Level
 * Nur beim ersten Login / neuen Account
 */
export const Onboarding: React.FC = () => {
    const { user, completeOnboarding } = useAuth();
    const [loading, setLoading] = useState(false);

    const [goal, setGoal] = useState<string>('beginner');
    const [timePerWorkout, setTimePerWorkout] = useState<number>(45);
    const [fitnessLevel, setFitnessLevel] = useState<number>(3);

    if (!user || user.onboardingCompleted) return null;

    const handleFinish = async () => {
        setLoading(true);
        try {
            const preferences = {
                persona: goal,
                fitness_level: fitnessLevel,
                time_budget: String(timePerWorkout * 3),
            };

            if (user?.provider === 'local') {
                localStorage.setItem('user_preferences', JSON.stringify(preferences));
            } else {
                const client = getSupabaseClient();
                if (client && user?.id) {
                    try { await client.from('profiles').update(preferences).eq('id', user.id); } catch { /* ignore */ }
                }
            }

            await completeOnboarding();
            window.history.replaceState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (e) {
            if (import.meta.env.DEV) console.error('Onboarding error:', e);
            setLoading(false);
        }
    };

    const personas = [
        { id: 'pro', label: 'Athlet', desc: 'Maximale Leistung' },
        { id: 'manager', label: 'Effizient', desc: 'Zeitsparend & fokussiert' },
        { id: 'beginner', label: 'Gesundheit', desc: 'Nachhaltiger Aufbau' },
    ];

    const times = [
        { min: 20, label: '20 min' },
        { min: 30, label: '30 min' },
        { min: 45, label: '45 min' },
        { min: 60, label: '60+ min' },
    ];

    const levels = [
        { lvl: 1, label: 'Einsteiger' },
        { lvl: 2, label: 'Anfaenger' },
        { lvl: 3, label: 'Fortgeschritten' },
        { lvl: 4, label: 'Erfahren' },
        { lvl: 5, label: 'Profi' },
    ];

    return (
        <div
            className="fixed inset-0 z-[100] flex flex-col overflow-hidden"
            style={{ backgroundColor: "var(--bg-color)", color: "var(--text-color)" }}
        >
            <div
                className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] z-50"
                style={{ backgroundColor: "var(--bg-color)" }}
            />

            <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+24px)] overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "rgba(0,122,255,0.1)" }}
                    >
                        <Dumbbell size={22} style={{ color: "var(--accent-color)" }} />
                    </div>
                    <div>
                        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: "var(--text-color)" }}>
                            Willkommen bei TrainQ
                        </h1>
                        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                            Richte dein Training ein.
                        </p>
                    </div>
                </div>

                {/* Fokus */}
                <div className="mb-6">
                    <h3
                        className="text-[11px] font-bold uppercase tracking-wider mb-2.5 pl-1"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Dein Fokus
                    </h3>
                    <div className="grid grid-cols-3 gap-2.5">
                        {personas.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setGoal(p.id)}
                                className={`rounded-2xl p-3.5 text-center transition-all border active:scale-[0.97] ${
                                    goal === p.id
                                        ? 'border-[var(--accent-color)]'
                                        : 'border-[var(--border-color)]'
                                }`}
                                style={{
                                    backgroundColor: goal === p.id
                                        ? "rgba(0,122,255,0.1)"
                                        : "var(--card-bg)",
                                    color: goal === p.id
                                        ? "var(--accent-color)"
                                        : "var(--text-color)",
                                }}
                            >
                                <div className="text-sm font-bold">{p.label}</div>
                                <div
                                    className="text-[10px] mt-0.5"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {p.desc}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Zeit */}
                <div className="mb-6">
                    <h3
                        className="text-[11px] font-bold uppercase tracking-wider mb-2.5 pl-1"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Zeit pro Einheit
                    </h3>
                    <div className="grid grid-cols-4 gap-2.5">
                        {times.map((t) => (
                            <button
                                key={t.min}
                                onClick={() => setTimePerWorkout(t.min)}
                                className={`rounded-2xl py-3.5 text-center transition-all border active:scale-[0.97] ${
                                    timePerWorkout === t.min
                                        ? 'border-[var(--accent-color)]'
                                        : 'border-[var(--border-color)]'
                                }`}
                                style={{
                                    backgroundColor: timePerWorkout === t.min
                                        ? "rgba(0,122,255,0.1)"
                                        : "var(--card-bg)",
                                    color: timePerWorkout === t.min
                                        ? "var(--accent-color)"
                                        : "var(--text-color)",
                                }}
                            >
                                <div className="text-sm font-bold">{t.label}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Fitness Level */}
                <div className="mb-10">
                    <h3
                        className="text-[11px] font-bold uppercase tracking-wider mb-2.5 pl-1"
                        style={{ color: "var(--text-secondary)" }}
                    >
                        Fitness-Level
                    </h3>
                    <div className="flex gap-2">
                        {levels.map((l) => (
                            <button
                                key={l.lvl}
                                onClick={() => setFitnessLevel(l.lvl)}
                                className={`flex-1 rounded-2xl py-3.5 text-center transition-all border active:scale-[0.97] ${
                                    fitnessLevel === l.lvl
                                        ? 'border-[var(--accent-color)]'
                                        : 'border-[var(--border-color)]'
                                }`}
                                style={{
                                    backgroundColor: fitnessLevel === l.lvl
                                        ? "rgba(0,122,255,0.1)"
                                        : "var(--card-bg)",
                                    color: fitnessLevel === l.lvl
                                        ? "var(--accent-color)"
                                        : "var(--text-color)",
                                }}
                            >
                                <div className="text-lg font-bold">{l.lvl}</div>
                                <div
                                    className="text-[9px] mt-0.5"
                                    style={{ color: "var(--text-secondary)" }}
                                >
                                    {l.label}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-auto">
                    <AppButton
                        onClick={handleFinish}
                        isLoading={loading}
                        fullWidth
                        size="lg"
                        className="shadow-lg !rounded-2xl !text-lg !font-black"
                    >
                        Los geht's
                    </AppButton>
                </div>
            </div>
        </div>
    );
};
