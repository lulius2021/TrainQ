// src/pages/onboarding/StepWrapper.tsx
import React from "react";

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
  nextLabel = "Weiter",
  backLabel = "Zurück",
  nextDisabled = false,
  hideHeader = false,
  hideProgress = false,
  progressLabel,
  progressValue,
}) => {
  const safeTop = "env(safe-area-inset-top, 0px)";
  const safeBottom = "env(safe-area-inset-bottom, 0px)";

  // Styling basiert auf deinen Theme-Variablen
  const surface: React.CSSProperties = {
    background: "var(--surface2)",
    border: "1px solid var(--border)",
  };

  const surfaceInner: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
  };

  const primaryBtn: React.CSSProperties = {
    background: "var(--primary)",
    color: "#061226",
    border: "1px solid var(--border)",
  };

  const ghostBtn: React.CSSProperties = {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border)",
  };

  return (
    <div
      className="h-full w-full"
      style={{
        // ✅ kein eigener harter Hintergrund -> nutzt den App-Hintergrund
        background: "transparent",
        paddingTop: `calc(12px + ${safeTop})`,
        paddingBottom: `calc(120px + ${safeBottom})`,
      }}
    >
      <div className="mx-auto w-full max-w-xl px-4">
        {/* Top */}
        <div className="mb-4">
          <div className="flex items-center justify-between">
            {showBack ? (
              <button
                type="button"
                onClick={onBack}
                className="h-10 w-10 rounded-full flex items-center justify-center hover:opacity-95"
                style={surface}
                aria-label="Zurück"
              >
                <span style={{ color: "var(--text)" }}>{"<"}</span>
              </button>
            ) : (
              <div />
            )}
            <div />
          </div>

          {/* Progress (optional) */}
          {!hideProgress && (progressLabel || typeof progressValue === "number") && (
            <div className="mt-3">
              {progressLabel && (
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {progressLabel}
                </div>
              )}
              {typeof progressValue === "number" && (
                <div className="mt-2 h-2 w-full rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.round(Math.min(1, Math.max(0, progressValue)) * 100)}%`,
                      background: "var(--primary)",
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Header (optional) */}
          {!hideHeader && (title || subtitle) && (
            <div className="mt-5 space-y-1">
              {title && (
                <div className="text-xl font-semibold" style={{ color: "var(--text)" }}>
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-sm" style={{ color: "var(--muted)" }}>
                  {subtitle}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">{children}</div>
      </div>

      {/* Footer Buttons (besser formatiert) */}
      <div
        className="fixed left-0 right-0 bottom-0"
        style={{
          paddingBottom: `calc(12px + ${safeBottom})`,
          // leichter Fade nach unten – sieht wertiger aus, aber übernimmt App-Background
          background: "linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0))",
        }}
      >
        <div className="mx-auto w-full max-w-xl px-4">
          <div className="rounded-2xl p-3 flex gap-2" style={surface}>
            {showBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95"
                style={ghostBtn}
              >
                {backLabel}
              </button>
            )}

            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold hover:opacity-95 disabled:opacity-50"
              style={primaryBtn}
            >
              {nextLabel}
            </button>
          </div>

          {/* optional: kleiner Spacer, falls du innen noch was brauchst */}
          <div className="h-1" style={surfaceInner} />
        </div>
      </div>
    </div>
  );
};