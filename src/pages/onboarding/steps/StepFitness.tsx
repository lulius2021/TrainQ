import React from 'react';
import { OnboardingStepLayout } from "../../../components/onboarding/OnboardingStepLayout";
import { useOnboarding } from "../../../context/OnboardingContext";

interface Props {
    onBack: () => void;
    onFinish: () => void;
}

export const StepFitness: React.FC<Props> = ({ onBack, onFinish }) => {
    const { data, updateData } = useOnboarding();
    const current = data.personal.fitnessLevel ?? 3;

    const handleSelect = (lvl: number) => {
        updateData({ personal: { fitnessLevel: lvl } });
    };

    return (
        <OnboardingStepLayout
            title="Dein Level"
            subtitle="Wie schätzt du deine aktuelle Fitness ein?"
            onContinue={onFinish}
            onBack={onBack}
            continueLabel="Training erstellen"
            canContinue={true}
        >
            <div className="flex flex-col items-center justify-center py-8">
                <div className="flex gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => {
                        const isActive = star <= current;
                        return (
                            <button
                                key={star}
                                onClick={() => handleSelect(star)}
                                className="transform transition-all active:scale-90 hover:scale-110 focus:outline-none"
                            >
                                <StarIcon filled={isActive} />
                            </button>
                        );
                    })}
                </div>

                <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300" key={current}>
                    <div className="text-3xl font-bold text-white mb-3">
                        {current === 1 && "Einsteiger"}
                        {current === 2 && "Gelegenheits-Sportler"}
                        {current === 3 && "Aktiv"}
                        {current === 4 && "Sehr fit"}
                        {current === 5 && "Athlet"}
                    </div>
                    <p className="text-[var(--muted)] max-w-xs mx-auto text-base leading-relaxed">
                        {current === 1 && "Wir starten sanft und bauen eine solide Basis auf."}
                        {current === 2 && "Wir bringen wieder mehr Regelmäßigkeit und Struktur rein."}
                        {current === 3 && "Perfekt. Wir bauen darauf auf und steigern die Intensität."}
                        {current === 4 && "Du bist bereit für fortgeschrittene Techniken und Challenges."}
                        {current === 5 && "High-Performance Training für maximale Leistung."}
                    </p>
                </div>
            </div>

        </OnboardingStepLayout>
    );
};

const StarIcon: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg
        width="44"
        height="44"
        viewBox="0 0 24 24"
        fill={filled ? "var(--primary)" : "none"}
        stroke={filled ? "var(--primary)" : "#64748B"}
        strokeWidth="1.5"
        className="transition-colors duration-300"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
);
