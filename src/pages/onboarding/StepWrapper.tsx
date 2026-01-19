// src/pages/onboarding/StepWrapper.tsx
import React from "react";
import { useI18n } from "../../i18n/useI18n";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";

export type StepWrapperProps = {
  children: React.ReactNode;

  // Header (optional)
  title?: string;
  subtitle?: string;

  // Navigation
  onNext: () => void;
  onBack?: () => void;
  showBack?: boolean;

  // Labels / State
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;

  // ✅ UI toggles
  hideHeader?: boolean;   // Title + Subtitle ausblenden
  hideProgress?: boolean; // "Schritt x von y" + Progress ausblenden

  // Optional: falls du Progress vom Parent reinreichst
  progressLabel?: string; // z.B. "Schritt 1 von 5"
  progressValue?: number; // 0..1
};

export const StepWrapper: React.FC<StepWrapperProps> = ({
  children,
  title,
  subtitle,
  onNext,
  onBack,
  showBack = true,
  nextLabel,
  backLabel,
  nextDisabled = false,
  hideHeader = false,
  hideProgress = false,
  progressLabel,
  progressValue,
}) => {
  const { t } = useI18n();
  const resolvedNextLabel = nextLabel ?? t("common.next");
  const resolvedBackLabel = backLabel ?? t("common.back");

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{
        background: "var(--bg)",
        // Padding top handled by content spacing mostly, but safe area needed
        paddingTop: "calc(env(safe-area-inset-top) + 12px)",
        paddingBottom: "120px", // space for fixed footer
      }}
    >
      <div className="mx-auto w-full max-w-xl px-4 flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="mb-6 shrink-0">
          <div className="flex items-center justify-between h-12">
            {showBack ? (
              <AppButton
                onClick={onBack}
                variant="secondary"
                className="h-10 w-10 !p-0 rounded-full flex items-center justify-center"
                aria-label={resolvedBackLabel}
              >
                <span>{"<"}</span>
              </AppButton>
            ) : (
              <div />
            )}
            <div />
          </div>

          {/* Progress (optional) */}
          {!hideProgress && (progressLabel || typeof progressValue === "number") && (
            <div className="mt-4">
              {progressLabel && (
                <div className="text-xs font-medium text-[var(--muted)] mb-2">
                  {progressLabel}
                </div>
              )}
              {typeof progressValue === "number" && (
                <div className="h-1.5 w-full rounded-full bg-[var(--surface2)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--primary)] transition-all duration-300 ease-out"
                    style={{
                      width: `${Math.round(Math.min(1, Math.max(0, progressValue)) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Header (optional) */}
          {!hideHeader && (title || subtitle) && (
            <div className="mt-6 space-y-2">
              {title && (
                <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-base text-[var(--muted)] leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-4 pb-4">
          {children}
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="fixed inset-x-0 bottom-0 z-50 p-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <div className="mx-auto w-full max-w-xl">
          <AppCard variant="glass" noPadding className="p-3">
            <div className="flex gap-3">
              {showBack && (
                <AppButton
                  onClick={onBack}
                  variant="secondary"
                  className="flex-1"
                >
                  {resolvedBackLabel}
                </AppButton>
              )}
              <AppButton
                onClick={onNext}
                disabled={nextDisabled}
                variant="primary"
                className="flex-1"
                fullWidth
              >
                {resolvedNextLabel}
              </AppButton>
            </div>
          </AppCard>
        </div>
      </div>
    </div>
  );
};
