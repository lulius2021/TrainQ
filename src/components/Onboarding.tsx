import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSupabaseClient } from '../lib/supabaseClient';

/**
 * ------------------------------------------------------------
 * Internal UI Components for consistent design
 * ------------------------------------------------------------
 */

const OnboardingLayout: React.FC<{ children: React.ReactNode; progress: number }> = ({ children, progress }) => (
    <div className="fixed inset-0 z-[100] bg-[var(--bg)] text-[var(--text)] flex flex-col font-sans overflow-hidden">
        {/* Safe Area Background Fix (Top) */}
        <div className="absolute top-0 left-0 right-0 h-[env(safe-area-inset-top)] bg-[var(--bg)] z-50" />

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
        <div className="flex-1 flex flex-col w-full max-w-md mx-auto px-6 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-8 overflow-y-auto overflow-x-hidden no-scrollbar">
            {children}
        </div>
    </div>
);

const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
    <div className="space-y-3 mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
            {title}
        </h1>
        {subtitle && <p className="text-lg text-gray-400 font-medium leading-relaxed">{subtitle}</p>}
    </div>
);

const OptionCard: React.FC<{
    selected: boolean;
    onClick: () => void;
    label: string;
    description: string;
    icon?: React.ReactNode
}> = ({ selected, onClick, label, description, icon }) => (
    <button
        onClick={onClick}
        className={`w-full text-left p-6 rounded-2xl border transition-all duration-200 group active:scale-[0.98]
            ${selected
                ? 'bg-[var(--primary)] border-[var(--primary)] shadow-lg shadow-blue-900/20'
                : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface2)]'
            }`}
    >
        <div className="flex items-center justify-between">
            <div className={`font-bold text-lg mb-1 ${selected ? 'text-white' : 'text-gray-100'}`}>
                {label}
            </div>
            {icon && <div className={selected ? 'text-white' : 'text-gray-400'}>{icon}</div>}
        </div>
        <div className={`text-sm font-medium ${selected ? 'text-blue-100' : 'text-gray-500'}`}>
            {description}
        </div>
    </button>
);

const PrimaryButton: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    label: React.ReactNode;
    loading?: boolean;
}> = ({ onClick, disabled, label, loading }) => (
    <button
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full py-4 rounded-xl bg-[var(--primary)] font-bold text-white shadow-lg shadow-blue-500/20 
                   active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
    >
        {loading ? (
            <div className="flex items-center justify-center gap-2">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Wird eingerichtet...</span>
            </div>
        ) : label}
    </button>
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
        const client = getSupabaseClient();
        if (!client || !user.id) return;

        try {
            const weeklyMinutes = timePerWorkout * 3;
            // 1. Save preferences
            const { error } = await client.from('profiles').update({
                persona: goal,
                fitness_level: fitnessLevel,
                time_budget: String(weeklyMinutes),
                // Note: onboarding_completed is handled by completeOnboarding() context method
            }).eq('id', user.id);

            if (error) {
                console.error('Onboarding preference update failed:', error);
                // We continue to complete onboarding even if preferences fail, or should we stop?
                // Better to stop to ensure data integrity, but let's try to proceed to avoid loops.
            }

            // 2. Complete Onboarding (Persist & Cache)
            await completeOnboarding();

            // 3. Force Navigation State to Dashboard
            // Ensure we are logically at root
            window.history.replaceState({}, "", "/");
            window.dispatchEvent(new PopStateEvent("popstate"));

            // Reload optional to ensure all start-up checks run? No, React state update should handle it.

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
                    <Header
                        title="Dein Fokus?"
                        subtitle="Wir passen den Algorithmus an dein Leben an."
                    />

                    <div className="space-y-4 flex-1">
                        {[
                            { id: 'pro', label: 'Profi-Athlet', desc: 'Maximale Leistung & Volumen' },
                            { id: 'manager', label: 'High Performer', desc: 'Effizient, Zeitsparend, Fokus' },
                            { id: 'beginner', label: 'Gesundheit', desc: 'Nachhaltiger Aufbau & Balance' },
                        ].map((opt) => (
                            <OptionCard
                                key={opt.id}
                                selected={goal === opt.id}
                                label={opt.label}
                                description={opt.desc}
                                onClick={() => { setGoal(opt.id); handleNext(); }}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* STEP 1: Time */}
            {step === 1 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                    <Header
                        title="Dein Zeitbudget"
                        subtitle="Wie viel Zeit hast du realistisch pro Einheit?"
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
                                className="w-full h-2 bg-[var(--surface2)] rounded-lg appearance-none cursor-pointer accent-[var(--primary)] outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]"
                            />
                            <div className="w-full flex justify-between text-xs text-gray-500 font-mono uppercase mt-4 tracking-widest font-bold">
                                <span>Quick (15m)</span>
                                <span>Endurance (120+)</span>
                            </div>
                        </div>
                    </div>

                    <PrimaryButton
                        onClick={handleNext}
                        label="Weiter"
                    />
                </div>
            )}

            {/* STEP 2: Fitness Level */}
            {step === 2 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out fill-mode-both">
                    <Header
                        title="Dein Level"
                        subtitle="Wie schätzt du deine aktuelle Fitness ein?"
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

                        <div className="bg-[var(--surface)] p-6 rounded-2xl border border-[var(--border)] text-center transition-all duration-300">
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
                        </div>
                    </div>

                    <PrimaryButton
                        onClick={handleFinish}
                        loading={loading}
                        label="Training starten"
                    />
                </div>
            )}

        </OnboardingLayout>
    );
};
