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
            title="Dein Zeitbudget"
            subtitle="Wie viel Zeit hast du realistisch für ein Training?"
            onContinue={onNext}
            onBack={onBack}
            canContinue={!!data.training.timeBudget}
        >
            <div className="flex flex-wrap gap-4 mt-4">
                {TIMES.map((t) => {
                    const isSelected = data.training.timeBudget === t;
                    return (
                        <button
                            key={t}
                            onClick={() => handleSelect(t)}
                            className={`
                        w-[47%] grow py-6 rounded-[24px] text-center font-bold text-lg transition-all border
                        ${isSelected
                                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-blue-500/30 scale-105'
                                    : 'bg-[var(--surface)] border-white/5 text-[var(--muted)] hover:bg-[var(--surface2)]'}
                    `}
                        >
                            {t}
                        </button>
                    )
                })}
            </div>

            {data.training.timeBudget && (
                <div className="mt-8 p-6 bg-[var(--surface)] rounded-[24px] border border-white/5 animate-pulse">
                    <h3 className="text-white font-medium mb-2">Perfekt!</h3>
                    <p className="text-[var(--muted)] text-sm leading-relaxed">
                        Mit <strong>{data.training.timeBudget}</strong> planen wir dir hocheffektive Einheiten, die auch in volle Tage passen.
                    </p>
                </div>
            )}
        </OnboardingStepLayout>
    );
};
