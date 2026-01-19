import React from "react";
import { StepWrapper } from "../StepWrapper";

interface StepWelcomeProps {
    onNext: () => void;
    onSkip: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, onSkip }) => {
    const card: React.CSSProperties = {
        background: "var(--surface2)",
        border: "1px solid var(--border)",
    };

    const muted: React.CSSProperties = { color: "var(--muted)" };

    return (
        <StepWrapper
            title="Willkommen bei TrainQ"
            subtitle="Dein intelligenter Trainingsbegleiter."
            onNext={onNext}
            nextLabel="Loslegen"
            showBack={false}
            hideProgress
        >
            <div className="rounded-2xl p-5 space-y-4" style={card}>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                    TrainQ hilft dir, dein Training basierend auf deinen Zielen und deiner Erholung zu optimieren.
                </p>

                <div className="text-xs space-y-2" style={muted}>
                    <p>
                        Wir stellen dir ein paar kurze Fragen, um die App für dich einzurichten.
                        Das dauert weniger als eine Minute.
                    </p>
                </div>
            </div>

            <div className="flex justify-center mt-4">
                <button
                    onClick={onSkip}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                    Überspringen & Standardwerte nutzen
                </button>
            </div>
        </StepWrapper>
    );
};
