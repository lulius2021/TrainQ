import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSupabaseClient } from '../lib/supabaseClient';

/**
 * 3-Step Strategic Onboarding Flow
 * Checks for user.onboardingCompleted to decide visibility.
 */
export const Onboarding: React.FC = () => {
    const { user, completeOnboardingLocal } = useAuth();
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
            // Logic: Map form data to profile columns
            const weeklyMinutes = timePerWorkout * 3;

            const { error } = await client.from('profiles').update({
                goal: goal,
                fitness_level: fitnessLevel,
                available_time_per_week: weeklyMinutes,
                onboarding_completed: true,
            }).eq('id', user.id);

            if (error) {
                console.error('Onboarding update failed:', error);
                setLoading(false);
                return;
            }

            // Success: Instant local update
            completeOnboardingLocal();

            // Force Hard Redirect to Dashboard
            window.location.href = '/dashboard';

        } catch (e) {
            console.error('Onboarding error:', e);
            setLoading(false);
        }
    };

    // UI Components
    const Progress = () => (
        <div className="w-full h-1 bg-white/10 mb-8">
            <div
                className="h-full bg-blue-500 transition-all duration-500 ease-out"
                style={{ width: `${((step + 1) / 3) * 100}%` }}
            />
        </div>
    );

    return (
        <div className="fixed inset-0 z-[100] bg-[#0A0A0A] text-white flex flex-col font-sans">
            {/* Safe Area Top */}
            <div className="h-[env(safe-area-inset-top)] w-full bg-[#0A0A0A]" />

            <Progress />

            <div className="flex-1 flex flex-col px-6 pb-[env(safe-area-inset-bottom)] max-w-md mx-auto w-full justify-center">

                {step === 0 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-3xl font-bold tracking-tight">Wer bist du?</h1>
                        <div className="space-y-4">
                            {[
                                { id: 'pro', label: 'Profi-Athlet', desc: 'Leistungsorientiertes Training' },
                                { id: 'manager', label: 'Busy Manager', desc: 'Effizient & Zeitsparend' },
                                { id: 'beginner', label: 'Anfänger', desc: 'Gesundheit & Einstieg' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => { setGoal(opt.id); handleNext(); }}
                                    className="w-full text-left p-5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 active:scale-95 transition-all"
                                >
                                    <div className="font-semibold text-lg">{opt.label}</div>
                                    <div className="text-sm text-gray-400">{opt.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight">Zeitbudget</h1>
                            <p className="text-gray-400">Wie viele Minuten hast du pro Workout?</p>
                        </div>

                        <div className="flex flex-col items-center space-y-6">
                            <div className="text-5xl font-bold text-blue-500 tabular-nums">
                                {timePerWorkout >= 120 ? '120+' : timePerWorkout}<span className="text-xl text-gray-500 font-medium ml-1">min</span>
                            </div>

                            <input
                                type="range"
                                min="15"
                                max="120"
                                step="5"
                                value={timePerWorkout}
                                onChange={(e) => setTimePerWorkout(Number(e.target.value))}
                                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                            <div className="w-full flex justify-between text-xs text-gray-500 font-mono uppercase">
                                <span>15 min</span>
                                <span>120+ min</span>
                            </div>
                        </div>

                        <button
                            onClick={handleNext}
                            className="w-full py-4 rounded-xl bg-blue-600 font-bold text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                        >
                            Weiter
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold tracking-tight">Fitness Level</h1>
                            <p className="text-gray-400">Wie schätzt du deine Erfahrung ein?</p>
                        </div>

                        <div className="flex justify-center gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    onClick={() => setFitnessLevel(star)}
                                    className={`text-4xl transition-transform hover:scale-110 ${star <= fitnessLevel ? 'text-yellow-400' : 'text-gray-700'}`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                        <div className="text-center text-sm text-gray-400 font-medium">
                            {fitnessLevel === 1 && "Startpunkt"}
                            {fitnessLevel === 3 && "Fortgeschritten"}
                            {fitnessLevel === 5 && "Elite"}
                        </div>

                        <button
                            onClick={handleFinish}
                            disabled={loading}
                            className="w-full py-4 rounded-xl bg-white text-black font-bold shadow-lg active:scale-95 transition-transform mt-8 disabled:opacity-70 flex justify-center items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                    <span>Speichere...</span>
                                </>
                            ) : (
                                'Los geht\'s'
                            )}
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};
