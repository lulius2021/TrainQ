import React from "react";
import { StepWrapper } from "../StepWrapper";
import { AppCard } from "../../../components/ui/AppCard";
import { AppButton } from "../../../components/ui/AppButton";

interface StepWelcomeProps {
    onNext: () => void;
    onSkip: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, onSkip }) => {

    return (
        <StepWrapper
            title="Willkommen bei TrainQ"
            subtitle="Dein intelligenter Trainingsbegleiter."
            onNext={onNext}
            nextLabel="Loslegen"
            showBack={false}
            hideProgress
        >
            <AppCard variant="soft" className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-[var(--text)]">
                    TrainQ hilft dir, dein Training basierend auf deinen Zielen und deiner Erholung zu optimieren.
                </p>

                <div className="text-xs space-y-2 text-[var(--muted)]">
                    <p>
                        Wir stellen dir ein paar kurze Fragen, um die App für dich einzurichten.
                        Das dauert weniger als eine Minute.
                    </p>
                </div>
            </AppCard>

            <div className="flex justify-center mt-4">
                <AppButton
                    onClick={onSkip}
                    variant="ghost"
                    className="text-xs text-[var(--muted)] hover:text-[var(--text)]"
                >
                    Überspringen & Standardwerte nutzen
                </AppButton>
            </div>
        </StepWrapper>
    );
};
