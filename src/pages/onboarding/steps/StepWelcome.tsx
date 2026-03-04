import React from "react";
import { StepWrapper } from "../StepWrapper";
import { AppCard } from "../../../components/ui/AppCard";
import { AppButton } from "../../../components/ui/AppButton";
import { useI18n } from "../../../i18n/useI18n";

interface StepWelcomeProps {
    onNext: () => void;
    onSkip: () => void;
}

export const StepWelcome: React.FC<StepWelcomeProps> = ({ onNext, onSkip }) => {
    const { t } = useI18n();

    return (
        <StepWrapper
            title={t("onboarding.welcome.title")}
            subtitle={t("onboarding.welcome.subtitle")}
            onNext={onNext}
            nextLabel={t("onboarding.welcome.start")}
            showBack={false}
            hideProgress
        >
            <AppCard variant="soft" className="space-y-4 p-5">
                <p className="text-sm leading-relaxed text-[var(--text)]">
                    {t("onboarding.welcome.description")}
                </p>

                <div className="text-xs space-y-2 text-[var(--text-muted)]">
                    <p>
                        {t("onboarding.welcome.setupNote")}
                    </p>
                </div>
            </AppCard>

            <div className="flex justify-center mt-4">
                <AppButton
                    onClick={onSkip}
                    variant="ghost"
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                    {t("onboarding.welcome.skip")}
                </AppButton>
            </div>
        </StepWrapper>
    );
};
