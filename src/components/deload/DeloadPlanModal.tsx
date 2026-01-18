import React, { useEffect, useMemo, useState } from "react";
import type { DeloadRule } from "../../types/deload";
import { addDaysISO, addWeeksISO, getWeekStartISO } from "../../utils/deload/schedule";

type Props = {
  open: boolean;
  todayISO: string;
  onClose: () => void;
  onConfirm: (startISO: string, endISO: string, rules: DeloadRule) => void;
  onDiscard?: () => void;
  defaultWeekChoice?: "current" | "next";
  initialRules?: DeloadRule | null;
  initialStartISO?: string | null;
};

const DEFAULT_RULES: DeloadRule = {
  reduceSetsPct: 50,
  reduceWeightPct: 15,
  forceFailureToNormal: true,
  applyWeightToDropsets: true,
};

export default function DeloadPlanModal({
  open,
  todayISO,
  onClose,
  onConfirm,
  onDiscard,
  defaultWeekChoice = "current",
  initialRules,
  initialStartISO,
}: Props) {
  const [weekChoice, setWeekChoice] = useState<"current" | "next">(defaultWeekChoice);
  const [rules, setRules] = useState<DeloadRule>(DEFAULT_RULES);

  useEffect(() => {
    if (!open) return;
    const base = getWeekStartISO(todayISO);
    const next = addWeeksISO(base, 1);
    if (initialStartISO) {
      const start = getWeekStartISO(initialStartISO);
      setWeekChoice(start === next ? "next" : "current");
    } else {
      setWeekChoice(defaultWeekChoice);
    }
    setRules(initialRules ?? DEFAULT_RULES);
  }, [open, todayISO, defaultWeekChoice, initialRules, initialStartISO]);

  const startISO = useMemo(() => {
    const base = getWeekStartISO(todayISO);
    return weekChoice === "next" ? addWeeksISO(base, 1) : base;
  }, [todayISO, weekChoice]);
  const endISO = useMemo(() => addDaysISO(startISO, 6), [startISO]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1120] text-white p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">{onDiscard ? "Deload anpassen" : "Deload planen"}</div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-white/60 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWeekChoice("current")}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              background: weekChoice === "current" ? "rgba(251,146,60,0.9)" : "rgba(255,255,255,0.08)",
              color: weekChoice === "current" ? "#111827" : "white",
            }}
          >
            Diese Woche
          </button>
          <button
            type="button"
            onClick={() => setWeekChoice("next")}
            className="rounded-xl px-4 py-2 text-xs font-semibold"
            style={{
              background: weekChoice === "next" ? "rgba(251,146,60,0.9)" : "rgba(255,255,255,0.08)",
              color: weekChoice === "next" ? "#111827" : "white",
            }}
          >
            Nächste Woche
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={typeof rules.reduceSetsPct === "number"}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  reduceSetsPct: e.target.checked ? prev.reduceSetsPct ?? 50 : undefined,
                }))
              }
            />
            Sätze halbieren (50%)
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rules.forceFailureToNormal !== false}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  forceFailureToNormal: e.target.checked,
                }))
              }
            />
            Failure-Sätze deaktivieren
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={typeof rules.reduceWeightPct === "number"}
              onChange={(e) =>
                setRules((prev) => ({
                  ...prev,
                  reduceWeightPct: e.target.checked ? prev.reduceWeightPct ?? 15 : undefined,
                }))
              }
            />
            Gewicht reduzieren ({rules.reduceWeightPct ?? 15}%)
          </label>

          {typeof rules.reduceWeightPct === "number" && (
            <div className="pl-6 space-y-2">
              <input
                type="range"
                min={10}
                max={30}
                value={rules.reduceWeightPct ?? 15}
                onChange={(e) => setRules((prev) => ({ ...prev, reduceWeightPct: Number(e.target.value) }))}
                className="w-full"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={rules.applyWeightToDropsets !== false}
                  onChange={(e) =>
                    setRules((prev) => ({
                      ...prev,
                      applyWeightToDropsets: e.target.checked,
                    }))
                  }
                />
                Gewicht auch auf Dropsets anwenden
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          {onDiscard && (
            <button
              type="button"
              onClick={onDiscard}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-orange-200 border border-orange-400/40"
            >
              Deload verwerfen
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => onConfirm(startISO, endISO, rules)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-black"
            style={{ background: "rgb(251,146,60)" }}
          >
            {onDiscard ? "Deload anpassen" : "Deload planen"}
          </button>
        </div>
      </div>
    </div>
  );
}
