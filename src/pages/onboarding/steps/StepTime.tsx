// src/pages/onboarding/steps/StepTime.tsx
import React from 'react';
import { OnboardingStepLayout } from "../../../components/onboarding/OnboardingStepLayout";
import { useOnboarding } from "../../../context/OnboardingContext";
import { useI18n } from "../../../i18n/useI18n";

interface Props {
    onNext: () => void;
    onBack: () => void;
}

const TIMES = ["15 min", "30 min", "45 min", "60+ min"];

export const StepTime: React.FC<Props> = ({ onNext, onBack }) => {
    const { data, updateData } = useOnboarding();
    const { t } = useI18n();

    const handleSelect = (val: string) => {
        updateData({ training: { timeBudget: val } });
    };

    return (
        <OnboardingStepLayout
            title={t("onboarding.time.title")}
            subtitle={t("onboarding.time.subtitle")}
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
                                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white shadow-lg shadow-blue-500/30 scale-105'
                                    : 'bg-[var(--card-bg)] text-[var(--text-muted)] border-white/5 hover:bg-[var(--button-bg)] hover:text-[var(--text)]'}
                    `}
                        >
                            {timeVal}
                        </button>
                    )
                })}
            </div>

            {data.training.timeBudget && (
                <div className="mt-8 p-6 bg-[var(--card-bg)] rounded-2xl border border-white/5 animate-pulse">
                    <h3 className="text-white font-medium mb-2">{t("onboarding.time.perfect")}</h3>
                    <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                        {t("onboarding.time.message", { time: data.training.timeBudget })}
                    </p>
                </div>
            )}
        </OnboardingStepLayout>
    );
};
