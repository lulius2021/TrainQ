import React, { useState } from "react";
import { X } from "lucide-react";
import type { DeloadPlan, DeloadRule } from "../../types/deload";
import { getWeekStartISO, addDaysISO } from "../../utils/deload/schedule";

interface DeloadPlanModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (plan: DeloadPlan) => void;
}

type PresetKey = "leicht" | "mittel" | "intensiv";

const PRESETS: Record<PresetKey, { label: string; desc: string; rules: DeloadRule }> = {
  leicht: {
    label: "Leicht",
    desc: "Gewicht -10%, Saetze bleiben",
    rules: { reduceWeightPct: 10, reduceSetsPct: 0 },
  },
  mittel: {
    label: "Mittel",
    desc: "Gewicht -15%, Saetze halbiert",
    rules: { reduceWeightPct: 15, reduceSetsPct: 50 },
  },
  intensiv: {
    label: "Intensiv",
    desc: "Gewicht -25%, Saetze halbiert, kein Failure",
    rules: { reduceWeightPct: 25, reduceSetsPct: 50, forceFailureToNormal: true },
  },
};

const PRESET_COLORS: Record<PresetKey, string> = {
  leicht: "border-green-500/40 bg-green-500/10 text-green-400",
  mittel: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  intensiv: "border-red-500/40 bg-red-500/10 text-red-400",
};

const PRESET_ACTIVE_COLORS: Record<PresetKey, string> = {
  leicht: "border-green-500 bg-green-500/20 text-green-300 ring-1 ring-green-500/50",
  mittel: "border-amber-500 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50",
  intensiv: "border-red-500 bg-red-500/20 text-red-300 ring-1 ring-red-500/50",
};

export default function DeloadPlanModal({ open, onClose, onSave }: DeloadPlanModalProps) {
  const [selected, setSelected] = useState<PresetKey>("mittel");

  if (!open) return null;

  const handleApply = () => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const startISO = getWeekStartISO(todayISO);
    const endISO = addDaysISO(startISO, 6);

    const plan: DeloadPlan = {
      id: crypto.randomUUID(),
      startISO,
      endISO,
      createdAtISO: new Date().toISOString(),
      rules: PRESETS[selected].rules,
    };

    onSave(plan);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-[24px] border border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-xl text-[var(--text)] p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">Deload planen</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-[var(--text-secondary)]">
          Waehle eine Intensitaet fuer deine Deload-Woche. Gewicht und Saetze werden automatisch angepasst.
        </p>

        {/* Preset Buttons */}
        <div className="space-y-2">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const preset = PRESETS[key];
            const isActive = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`w-full text-left rounded-2xl border p-4 transition-all active:scale-[0.98] ${
                  isActive ? PRESET_ACTIVE_COLORS[key] : PRESET_COLORS[key]
                }`}
              >
                <div className="text-sm font-bold">{preset.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{preset.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-3xl px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-3xl px-4 py-2 text-xs font-semibold text-white bg-[var(--accent-color)] hover:opacity-90 transition-colors"
          >
            Deload starten
          </button>
        </div>
      </div>
    </div>
  );
}
