// src/pages/onboarding/steps/StepTime.tsx
import React from 'react';
import { OnboardingStepLayout } from "../../../components/onboarding/OnboardingStepLayout";
import { useOnboarding } from "../../../context/OnboardingContext";

interface Props {
    onNext: () => void;
    onBack: () => void;
}

const TIMES = ["15 min", "30 min", "45 min", "60+ min"];

export const StepTime: React.FC<Props> = ({ onNext, onBack }) => {
    const { data, updateData } = useOnboarding();

    const handleSelect = (t: string) => {
        updateData({ training: { timeBudget: t } });
    };

    return (
        <OnboardingStepLayout
            title="Zeitbudget"
            subtitle="Wie viel Zeit hast du pro Workout?"
            onContinue={onNext}
            onBack={onBack}
            canContinue={!!data.training.timeBudget}
        >
            <div className="flex flex-wrap gap-4 mt-4">
                {TIMES.map((timeVal) => {
                    const isSelected = data.training.timeBudget === timeVal;
                    return (
                        <button
                            key={timeVal}
                            onClick={() => handleSelect(timeVal)}
                            className={`
                        w-[47%] grow py-6 rounded-2xl text-center font-bold text-lg transition-all border
                        ${isSelected
                                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-blue-500/30 scale-105'
                                    : 'bg-[var(--surface)] text-[var(--muted)] border-white/5 hover:bg-[var(--surface2)] hover:text-[var(--text)]'}
                    `}
                        >
                            {timeVal}
                        </button>
                    )
                })}
            </div>

            {data.training.timeBudget && (
                <div className="mt-8 p-6 bg-[var(--surface)] rounded-2xl border border-white/5 animate-pulse">
                    <h3 className="text-white font-medium mb-2">Perfekt!</h3>
                    <p className="text-[var(--muted)] text-sm leading-relaxed">
                        Mit {data.training.timeBudget} können wir bereits sehr effektive Reize setzen.
                    </p>
                </div>
            )}
        </OnboardingStepLayout>
    );
};
