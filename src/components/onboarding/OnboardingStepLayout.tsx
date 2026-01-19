import React from 'react';
import { useI18n } from "../../i18n/useI18n";

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
        <div className="flex flex-col h-full w-full pt-[var(--safe-top)] pb-[var(--safe-bottom)] px-6 relative">
            <div className="flex-none mt-8 mb-6">
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{title}</h1>
                {subtitle && <p className="text-lg text-[var(--muted)] leading-relaxed">{subtitle}</p>}
            </div>

            <div className="flex-1 w-full flex flex-col gap-4 overflow-y-auto no-scrollbar pb-24">
                {children}
            </div>

            <div className="absolute bottom-[var(--safe-bottom)] left-0 right-0 px-6 pb-4 pt-12 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent z-10 pointer-events-none flex flex-col gap-3">
                <div className="pointer-events-auto w-full flex flex-col gap-3">
                    <button
                        onClick={onContinue}
                        disabled={!canContinue}
                        className={`
                w-full h-14 rounded-full font-bold text-lg text-white shadow-xl transition-all active:scale-95
                ${canContinue ? 'bg-[var(--primary)] shadow-blue-500/20' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
            `}
                    >
                        {continueLabel || t("common.continue")}
                    </button>
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="w-full py-3 text-[var(--muted)] font-medium text-base active:opacity-70"
                        >
                            {t("common.back")}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
