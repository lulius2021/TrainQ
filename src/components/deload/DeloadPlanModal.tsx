import React, { useState, useMemo } from "react";
import { X, Dumbbell, Footprints, Bike } from "lucide-react";
import type { DeloadPlan, DeloadRule } from "../../types/deload";
import { getWeekStartISO, addDaysISO } from "../../utils/deload/schedule";
import { loadWorkoutHistory } from "../../utils/workoutHistory";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface DeloadPlanModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (plan: DeloadPlan) => void;
}

type PresetKey = "leicht" | "mittel" | "intensiv";

const PRESETS: Record<PresetKey, { label: string; desc: string; rules: DeloadRule }> = {
  leicht: {
    label: "Leicht",
    desc: "Gewicht −10%, Sätze bleiben",
    rules: { reduceWeightPct: 10, reduceSetsPct: 0 },
  },
  mittel: {
    label: "Mittel",
    desc: "Gewicht −15%, Sätze halbiert",
    rules: { reduceWeightPct: 15, reduceSetsPct: 50 },
  },
  intensiv: {
    label: "Intensiv",
    desc: "Gewicht −25%, Sätze halbiert, kein Failure",
    rules: { reduceWeightPct: 25, reduceSetsPct: 50, forceFailureToNormal: true },
  },
};

const PRESET_COLORS: Record<PresetKey, string> = {
  leicht:   "border-green-500/40 bg-green-500/10 text-green-400",
  mittel:   "border-amber-500/40 bg-amber-500/10 text-amber-400",
  intensiv: "border-red-500/40 bg-red-500/10 text-red-400",
};

const PRESET_ACTIVE_COLORS: Record<PresetKey, string> = {
  leicht:   "border-green-500 bg-green-500/20 text-green-300 ring-1 ring-green-500/50",
  mittel:   "border-amber-500 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50",
  intensiv: "border-red-500 bg-red-500/20 text-red-300 ring-1 ring-red-500/50",
};

/** Detect which sport(s) the user trains most based on history */
function detectPrimarySports(): { gym: boolean; run: boolean; bike: boolean } {
  const history = loadWorkoutHistory().slice(0, 20);
  let gym = 0, run = 0, bike = 0;
  for (const w of history) {
    const s = (w.sport ?? "").toLowerCase();
    if (s === "gym")       gym++;
    else if (s === "laufen")    run++;
    else if (s === "radfahren") bike++;
  }
  // Show sport block if at least 1 recent session
  return { gym: gym > 0 || (run === 0 && bike === 0), run: run > 0, bike: bike > 0 };
}

function SportBlock({
  icon, title, lines,
}: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-white/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--text-secondary)]">{icon}</span>
        <span className="text-xs font-bold text-[var(--text-color)]">{title}</span>
      </div>
      <ul className="space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className="text-[11px] text-[var(--text-secondary)] flex gap-1.5">
            <span className="shrink-0 mt-px">•</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DeloadPlanModal({ open, onClose, onSave }: DeloadPlanModalProps) {
  useBodyScrollLock(open);
  const [selected, setSelected] = useState<PresetKey>("mittel");
  const sports = useMemo(() => detectPrimarySports(), []);

  if (!open) return null;

  const handleApply = () => {
    const todayISO  = new Date().toISOString().slice(0, 10);
    const startISO  = getWeekStartISO(todayISO);
    const endISO    = addDaysISO(startISO, 6);
    const plan: DeloadPlan = {
      id: crypto.randomUUID(),
      startISO,
      endISO,
      createdAtISO: new Date().toISOString(),
      rules: PRESETS[selected].rules,
    };
    onSave(plan);
  };

  const weightCut = PRESETS[selected].rules.reduceWeightPct ?? 0;
  const setsCut   = PRESETS[selected].rules.reduceSetsPct   ?? 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-[28px] border border-[var(--border-color)] bg-[var(--card-bg)] backdrop-blur-xl text-[var(--text)] p-6 space-y-4 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-base font-bold">⚡ Leistungsboost-Woche</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">Strategische Erholung für mehr Gains</div>
          </div>
          <button type="button" onClick={onClose}
            className="rounded-2xl p-1.5 text-white/60 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Intensity presets */}
        <div className="space-y-2">
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Intensität wählen</div>
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const p = PRESETS[key];
            const isActive = selected === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`w-full text-left rounded-2xl border p-3.5 transition-all active:scale-[0.98] ${
                  isActive ? PRESET_ACTIVE_COLORS[key] : PRESET_COLORS[key]
                }`}
              >
                <div className="text-sm font-bold">{p.label}</div>
                <div className="text-xs opacity-70 mt-0.5">{p.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Sport-specific auto-plan */}
        <div>
          <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold mb-2">Auto-Plan diese Woche</div>
          <div className="space-y-2">
            {sports.gym && (
              <SportBlock
                icon={<Dumbbell size={14} />}
                title="Gym"
                lines={[
                  `Gewicht: −${weightCut}%`,
                  setsCut > 0 ? `Sätze: −${setsCut}% (auf ~${Math.ceil(100 - setsCut)}% gekürzt)` : "Sätze: unverändert",
                  "RPE-Cap: 7 · kein Versagen-Training",
                  "10–15 Min Mobility-Block dazu",
                ]}
              />
            )}
            {sports.run && (
              <SportBlock
                icon={<Footprints size={14} />}
                title="Laufen"
                lines={[
                  "Wochenkilometer: −35% (×0.65)",
                  "Intervall/Tempo → Easy Runs (Zone 1–2)",
                  "Long Run auf 60% der normalen Länge",
                  "2× Strides beibehalten (4–6 × 80–100m)",
                ]}
              />
            )}
            {sports.bike && (
              <SportBlock
                icon={<Bike size={14} />}
                title="Radfahren"
                lines={[
                  "Wochenstunden: ×0.55 · TSS: ×0.5",
                  "Intervalle → Zone 1–2",
                  "1× Openers: 6×10s Sprints in Easy Ride",
                ]}
              />
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3">
          <div className="text-xs font-semibold text-emerald-400 mb-1">Warum wirkt das?</div>
          <p className="text-[11px] text-emerald-300/80 leading-relaxed">
            Superkompensation: Nach strategischer Erholung steigt die Leistung über das Ausgangsniveau.
            Studien zeigen 3–8% Kraft- und Konditionsgewinn in der Woche nach einem Deload.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="rounded-3xl px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20">
            Abbrechen
          </button>
          <button type="button" onClick={handleApply}
            className="rounded-3xl px-4 py-2 text-xs font-bold text-white bg-[var(--accent-color)] hover:opacity-90">
            Leistungsboost starten
          </button>
        </div>
      </div>
    </div>
  );
}
