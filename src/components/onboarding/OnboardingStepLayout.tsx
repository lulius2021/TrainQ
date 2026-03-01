import React from 'react';
import { useI18n } from "../../i18n/useI18n";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";

interface Props {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    onContinue: () => void;
    onBack?: () => void;
    canContinue?: boolean;
    continueLabel?: string;
}

export const OnboardingStepLayout: React.FC<Props> = ({
    title,
    subtitle,
    children,
    onContinue,
    onBack,
    canContinue = true,
    continueLabel
}) => {
    const { t } = useI18n();
    return (


        <div className="flex flex-col h-full w-full pt-[calc(var(--safe-top)+20px)] pb-[calc(var(--safe-bottom)+100px)] px-6 relative">
            <div className="flex-none mt-4 mb-6">
                <h1 className="text-3xl font-bold text-[var(--text)] mb-2 tracking-tight">{title}</h1>
                {subtitle && <p className="text-lg text-[var(--text-muted)] leading-relaxed">{subtitle}</p>}
            </div>

            <div className="flex-1 w-full flex flex-col gap-4 overflow-y-auto no-scrollbar">
                {children}
            </div>

            <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[max(env(safe-area-inset-bottom),20px)]">
                <div className="mx-auto w-full max-w-xl">
                    <AppCard variant="glass" noPadding className="p-3">
                        <div className="flex flex-col gap-2">
                            <AppButton
                                onClick={onContinue}
                                disabled={!canContinue}
                                variant="primary"
                                fullWidth
                                className="h-14 text-lg"
                            >
                                {continueLabel || t("common.continue")}
                            </AppButton>

                            {onBack && (
                                <AppButton
                                    onClick={onBack}
                                    variant="ghost"
                                    fullWidth
                                    className="text-[var(--text-muted)]"
                                >
                                    {t("common.back")}
                                </AppButton>
                            )}
                        </div>
                    </AppCard>
                </div>
            </div>
        </div>
    );
};
