import React from 'react';
import { OnboardingStepLayout } from "../../../components/onboarding/OnboardingStepLayout";
import { useOnboarding } from "../../../context/OnboardingContext";
import type { Persona } from "../../../types/onboarding";

interface Props {
    onNext: () => void;
}

const PERSONAS: { id: Persona; label: string; desc: string; icon: string }[] = [
    { id: 'athlete', label: "Athlet", desc: "Maximale Performance & Progression.", icon: "🏆" },
    { id: 'manager', label: "Manager", desc: "Wenig Zeit, hohe Effizienz.", icon: "💼" },
    { id: 'beginner', label: "Einsteiger", desc: "Gesunder Start ohne Überforderung.", icon: "🌱" },
];

export const StepPersona: React.FC<Props> = ({ onNext }) => {
    const { data, updateData } = useOnboarding();

    const handleSelect = (p: Persona) => {
        updateData({ personal: { persona: p } });
    };

    return (
        <OnboardingStepLayout
            title="Dein Profil"
            subtitle="Was beschreibt dich am besten?"
            onContinue={onNext}
            canContinue={!!data.personal.persona}
        >
            {PERSONAS.map((p) => {
                const isSelected = data.personal.persona === p.id;
                return (
                    <button
                        key={p.id}
                        onClick={() => handleSelect(p.id)}
                        className={`
              relative w-full p-6 rounded-[28px] text-left transition-all duration-300 border
              flex flex-col gap-3 group active:scale-98
              ${isSelected
                                ? 'bg-[var(--surface)] border-[var(--primary)] shadow-[0_8px_30px_rgba(59,130,246,0.15)]'
                                : 'bg-[var(--surface)] border-transparent opacity-60 grayscale-[0.5] hover:opacity-100 hover:grayscale-0'}
            `}
                    >
                        <span className="text-4xl mb-1 block transform transition-transform group-hover:scale-110">{p.icon}</span>
                        <div>
                            <div className={`text-xl font-bold mb-1 ${isSelected ? 'text-white' : 'text-gray-200'}`}>{p.label}</div>
                            <div className="text-base text-[var(--muted)] leading-snug">{p.desc}</div>
                        </div>
                    </button>
                );
            })}
        </OnboardingStepLayout>
    );
};
