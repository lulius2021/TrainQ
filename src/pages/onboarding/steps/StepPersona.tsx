// src/pages/onboarding/steps/StepPersona.tsx
import React from 'react';
import { OnboardingStepLayout } from "../../../components/onboarding/OnboardingStepLayout";
import { useOnboarding } from "../../../context/OnboardingContext";
import type { Persona } from "../../../types/onboarding";

interface Props {
    onNext: () => void;
}

const PERSONAS: { id: Persona; label: string; desc: string; icon: string }[] = [
    { id: 'athlete', label: "Athlet", desc: "Leistungsorientiert & datengetrieben.", icon: "🏆" },
    { id: 'manager', label: "Manager", desc: "Effizient & zeitoptimiert.", icon: "💼" },
    { id: 'beginner', label: "Neustarter", desc: "Gesundheit & Wohlbefinden.", icon: "🌱" },
];

export const StepPersona: React.FC<Props> = ({ onNext }) => {
    const { data, updateData } = useOnboarding();

    const handleSelect = (p: Persona) => {
        updateData({ personal: { persona: p } });
    };

    return (
        <OnboardingStepLayout
            title="Wer bist du?"
            subtitle="Das hilft uns, den richtigen Ton zu treffen."
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
              relative w-full p-6 rounded-2xl text-left transition-all duration-300 border
              flex flex-col gap-3 group active:scale-98
              ${isSelected
                                ? 'bg-[var(--surface)] border-[var(--primary)] shadow-[0_8px_30px_rgba(59,130,246,0.15)] ring-1 ring-[var(--primary)]'
                                : 'bg-[var(--surface)] border-white/5 opacity-80 hover:opacity-100 hover:border-white/10'}
            `}
                    >
                        <span className="text-4xl mb-1 block transform transition-transform group-hover:scale-110">{p.icon}</span>
                        <div>
                            <div className={`text-xl font-bold mb-1 ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text)]'}`}>{p.label}</div>
                            <div className="text-base text-[var(--muted)] leading-snug">{p.desc}</div>
                        </div>
                    </button>
                );
            })}
        </OnboardingStepLayout>
    );
};
