import React from "react";

type Props = {
  onPlan: () => void;
  onDismiss: () => void;
};

export default function DeloadBanner({ onPlan, onDismiss }: Props) {
  return (
    <div
      className="rounded-[24px] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-[var(--primary)]/30 bg-[var(--primary)]/10 backdrop-blur-md"
    >
      <div>
        <div className="text-sm font-semibold text-[#007AFF]">Deload empfohlen</div>
        <div className="text-xs text-blue-200/80">Leichter machen, Ermüdung senken, stabil weitertrainieren.</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlan}
          className="rounded-3xl px-4 py-2 text-xs font-semibold text-white bg-[var(--primary)] active:scale-95 transition-transform"
        >
          Train
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-3xl px-4 py-2 text-xs font-semibold text-[#007AFF] border border-[#007AFF]/30 active:scale-95 transition-transform"
        >
          Später
        </button>
      </div>
    </div>
  );
}
