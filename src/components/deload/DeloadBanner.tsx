import React from "react";

type Props = {
  onPlan: () => void;
  onDismiss: () => void;
};

export default function DeloadBanner({ onPlan, onDismiss }: Props) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border"
      style={{ background: "rgba(251,146,60,0.08)", borderColor: "rgba(251,146,60,0.4)" }}
    >
      <div>
        <div className="text-sm font-semibold text-orange-300">Deload empfohlen</div>
        <div className="text-xs text-orange-100/80">Leichter machen, Ermüdung senken, stabil weitertrainieren.</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlan}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-black"
          style={{ background: "rgb(251,146,60)" }}
        >
          Train
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl px-4 py-2 text-xs font-semibold text-orange-200 border border-orange-400/40"
        >
          Verpassen
        </button>
      </div>
    </div>
  );
}
