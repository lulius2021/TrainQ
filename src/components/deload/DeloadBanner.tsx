import React from "react";
import { AlertTriangle, CheckCircle, Settings } from "lucide-react";
import type { DeloadPlan } from "../../types/deload";

interface DeloadBannerProps {
  state: "recommended" | "active";
  plan?: DeloadPlan | null;
  onPlan: () => void;
  onDismiss: () => void;
  onAdjust?: () => void;
}

export default function DeloadBanner({
  state,
  plan,
  onPlan,
  onDismiss,
  onAdjust,
}: DeloadBannerProps) {
  if (state === "active" && plan) {
    return (
      <div className="rounded-[24px] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-emerald-500/30 bg-gradient-to-r from-emerald-600/20 to-green-500/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-400">
              Deload-Woche aktiv
            </div>
            <div className="text-xs text-emerald-300/70">
              {plan.startISO} &ndash; {plan.endISO}
            </div>
          </div>
        </div>
        {onAdjust && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAdjust}
              className="rounded-3xl px-4 py-2 text-xs font-semibold text-emerald-300 border border-emerald-500/30 active:scale-95 transition-transform flex items-center gap-1.5"
            >
              <Settings size={14} />
              Anpassen
            </button>
          </div>
        )}
      </div>
    );
  }

  // state === "recommended"
  return (
    <div className="rounded-[24px] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-amber-500/30 bg-gradient-to-r from-amber-600/20 to-orange-500/10 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 animate-pulse">
          <AlertTriangle size={20} />
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-400">
            Deload empfohlen
          </div>
          <div className="text-xs text-amber-300/70">
            Leichter machen, Ermuedung senken, stabil weitertrainieren.
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPlan}
          className="rounded-3xl px-4 py-2 text-xs font-semibold text-white bg-amber-500 active:scale-95 transition-transform"
        >
          Planen
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-3xl px-4 py-2 text-xs font-semibold text-amber-300 border border-amber-500/30 active:scale-95 transition-transform"
        >
          Spaeter
        </button>
      </div>
    </div>
  );
}
