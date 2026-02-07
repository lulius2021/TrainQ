import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSupabaseClient } from '../lib/supabaseClient';
import { AppCard } from './ui/AppCard';
import { AppButton } from './ui/AppButton';
import { PageHeader } from './ui/PageHeader';

/**
 * ------------------------------------------------------------
 * Internal UI Components for consistent design
 * ------------------------------------------------------------
 */

const OnboardingLayout: React.FC<{ children: React.ReactNode; progress: number }> = ({ children, progress }) => (
    <div className="fixed inset-0 z-[100] bg-gradient-to-b from-[#0f172a] via-[#0a0e17] to-black text-white flex flex-col font-sans overflow-hidden">
        {/* Safe Area Background Fix (Top) */}
        <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-[#0f172a] z-50" />

        {/* Progress Bar */}
        <div className="relative pt-[calc(env(safe-area-inset-top)+20px)] px-6 z-40">
            <div className="h-1 w-full bg-[var(--surface2)] rounded-full overflow-hidden">
                <div
                    className="h-full bg-[var(--primary)] transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </div>

        {/* content */}
        <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-4 overflow-y-auto overflow-x-hidden no-scrollbar">
            {children}
        </div>
    </div>
);

/**
 * 3-Step Strategic Onboarding Flow
 */
export const Onboarding: React.FC = () => {
    const { user, completeOnboarding } = useAuth();
    const [step, setStep] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    // Form Data
    const [goal, setGoal] = useState<string>('');
    const [timePerWorkout, setTimePerWorkout] = useState<number>(45);
    const [fitnessLevel, setFitnessLevel] = useState<number>(3);

    if (!user || user.onboardingCompleted) {
        return null;
    }

    const handleNext = () => {
        setStep((p) => p + 1);
    };

    const handleFinish = async () => {
        setLoading(true);

        try {
            const weeklyMinutes = timePerWorkout * 3;
            const preferences = {
                persona: goal,
                fitness_level: fitnessLevel,
                time_budget: String(weeklyMinutes),
            };

            // 1. Save preferences
            if (user?.provider === 'local') {
                // Local-first: Save to localStorage
                localStorage.setItem('user_preferences', JSON.stringify(preferences));
                // Also update user object if we want to store it there (optional, but good for display)
                // For now, we rely on the fact that the app doesn't heavily use these outside of generation
            } else {
                // Supabase: Save to Profile
                const client = getSupabaseClient();
                if (client && user?.id) {
                    const { error } = await client.from('profiles').update(preferences).eq('id', user.id);
                    if (error) {
                        console.error('Onboarding preference update failed:', error);
                    }
                }
            }

            // 2. Complete Onboarding (Persist & Cache)
            await completeOnboarding();

            // 3. Force Navigation State to Dashboard
            // Ensure we are logically at root
            window.history.replaceState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));

        } catch (e) {
            console.error('Onboarding error:', e);
            setLoading(false);
        }
    };

    // Derived Progress (33%, 66%, 100%)
    const progress = ((step + 1) / 3) * 100;

    return (
        <OnboardingLayout progress={progress}>

            {/* STEP 0: Persona */}
            {step === 0 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                    <PageHeader
                        title="Dein Fokus?"
                        subtitle="Wir passen den Algorithmus an dein Leben an."
                        className="px-0"
                    />

                    <div className="space-y-4 flex-1">
                        {[
                            { id: 'pro', label: 'Profi-Athlet', desc: 'Maximale Leistung & Volumen' },
                            { id: 'manager', label: 'High Performer', desc: 'Effizient, Zeitsparend, Fokus' },
                            { id: 'beginner', label: 'Gesundheit', desc: 'Nachhaltiger Aufbau & Balance' },
                        ].map((opt) => {
                            const selected = goal === opt.id;
                            return (
                                <AppCard
                                    key={opt.id}
                                    variant={selected ? "solid" : "glass"}
                                    onClick={() => { setGoal(opt.id); handleNext(); }}
                                    className={`p-6 cursor-pointer text-left border-transition ${selected ? '!border-[var(--primary)] !bg-[var(--primary)]/10' : ''}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className={`font-bold text-lg mb-1 ${selected ? 'text-white' : 'text-white'}`}>
                                            {opt.label}
                                        </div>
                                    </div>
                                    <div className={`text-sm font-medium ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {opt.desc}
                                    </div>
                                </AppCard>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* STEP 1: Time */}
            {step === 1 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                    <PageHeader
                        title="Dein Zeitbudget"
                        subtitle="Wie viel Zeit hast du realistisch pro Einheit?"
                        className="px-0"
                    />

                    <div className="flex-1 flex flex-col justify-center space-y-12">
                        <div className="text-center">
                            <div className="text-6xl font-extrabold text-[var(--primary)] tabular-nums tracking-tighter">
                                {timePerWorkout >= 120 ? '120+' : timePerWorkout}
                                <span className="text-2xl text-gray-500 font-medium ml-2">min</span>
                            </div>
                        </div>

                        <div className="px-2">
                            <input
                                type="range"
                                min="15"
                                max="120"
                                step="5"
                                value={timePerWorkout}
                                onChange={(e) => setTimePerWorkout(Number(e.target.value))}
                                className="w-full h-2 bg-[var(--surface2)] rounded-2xl appearance-none cursor-pointer accent-[var(--primary)] outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
                            />
                            <div className="w-full flex justify-between text-xs text-gray-500 font-mono uppercase mt-4 tracking-widest font-bold">
                                <span>Quick (15m)</span>
                                <span>Endurance (120+)</span>
                            </div>
                        </div>
                    </div>

                    <AppButton
                        onClick={handleNext}
                        fullWidth
                        size="lg"
                        className="mt-auto shadow-lg"
                    >
                        Weiter
                    </AppButton>
                </div>
            )}

            {/* STEP 2: Fitness Level */}
            {step === 2 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                    <PageHeader
                        title="Dein Level"
                        subtitle="Wie schätzt du deine aktuelle Fitness ein?"
                        className="px-0"
                    />

                    <div className="flex-1 flex flex-col justify-center">
                        <div className="flex justify-between gap-2 mb-8 px-2">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                                <button
                                    key={lvl}
                                    onClick={() => setFitnessLevel(lvl)}
                                    className={`
                                        h-16 flex-1 rounded-2xl flex items-center justify-center text-xl font-bold transition-all duration-300
                                        ${fitnessLevel === lvl
                                            ? 'bg-[var(--primary)] text-white scale-110 shadow-lg shadow-blue-500/30 ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--bg)]'
                                            : 'bg-[var(--surface)] text-gray-500 hover:bg-[var(--surface2)]'
                                        }
                                    `}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>

                        <AppCard variant="glass" className="p-6 text-center">
                            <div className="text-[var(--primary)] font-bold mb-2 uppercase tracking-wide text-sm">
                                Level {fitnessLevel}
                            </div>
                            <div className="text-white font-medium text-lg">
                                {fitnessLevel === 1 && "Einsteiger – Aller Anfang ist schwer."}
                                {fitnessLevel === 2 && "Gelegenheits-Sportler."}
                                {fitnessLevel === 3 && "Fortgeschritten – Du hast Routine."}
                                {fitnessLevel === 4 && "Sehr Fit – Sport ist dein Lifestyle."}
                                {fitnessLevel === 5 && "Elite – Du lebst für Höchstleistung."}
                            </div>
                        </AppCard>
                    </div>

                    <AppButton
                        onClick={handleFinish}
                        isLoading={loading}
                        fullWidth
                        size="lg"
                        className="mt-auto shadow-lg"
                    >
                        Training starten
                    </AppButton>
                </div>
            )}

        </OnboardingLayout>
    );
};
