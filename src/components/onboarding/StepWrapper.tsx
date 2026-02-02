// src/components/onboarding/StepWrapper.tsx
import React from "react";
import type { ReactNode } from "react";
import { useI18n } from "../../i18n/useI18n";

interface StepWrapperProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  showBack?: boolean;
  nextLabel?: string;
  isNextDisabled?: boolean;
}

export const StepWrapper: React.FC<StepWrapperProps> = ({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  showBack = true,
  nextLabel,
  isNextDisabled = false,
}) => {
  const { t } = useI18n();
  const nextText = nextLabel ?? t("common.next");
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-white px-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold mb-2">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-400 leading-relaxed">{subtitle}</p>
          )}
        </div>

        <div className="bg-[var(--surface)] backdrop-blur-xl rounded-2xl p-4 space-y-4 shadow-lg border border-[var(--border)]">
          {children}
        </div>

        <div className="flex justify-between items-center gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 text-sm border border-gray-600 rounded-full py-2"
            >
              {t("common.back")}
            </button>
          ) : (
            <div className="flex-1" />
          )}

          {onNext && (
            <button
              type="button"
              onClick={onNext}
              disabled={isNextDisabled}
              className="flex-1 text-sm rounded-full py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-[var(--primary)]"
            >
              {nextText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
