// src/components/plates/PlateCalculatorSheet.tsx
//
// ✅ UI wieder wie im Screenshot (iOS-style)
// ✅ Kein Theme-Button (Hell/Dunkel kommt über App-Theme / Tailwind dark:)
// ✅ Frauenstange entfernt (nur Standard 20kg + Kurz 15kg)
// ✅ “Verwalten” toggelt nur, ob du verfügbare Scheiben an/aus klicken kannst
// ✅ Minimal, keine extra Karten / keine unnötigen Buttons

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getScopedItem, setScopedItem } from "../../utils/scopedStorage";

type BarType = "standard" | "short";

type Props = {
  open: boolean;
  onClose: () => void;
  initialTotalKg?: number;
  onApply: (totalKg: number) => void;
};

const LS_AVAILABLE_KEY = "trainq_platecalc_available_v1";
const LS_BAR_KEY = "trainq_platecalc_bar_v1";

const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = getScopedItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJSON(key: string, v: unknown) {
  try {
    setScopedItem(key, JSON.stringify(v));
  } catch {
    // ignore
  }
}

function barWeight(type: BarType): number {
  return type === "short" ? 15 : 20;
}

function roundToQuarter(n: number) {
  return Math.round(n * 4) / 4;
}

function fmtKg(n: number): string {
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

function sum(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0);
}

function greedyBuildSide(targetPerSide: number, available: number[]): number[] {
  const sorted = [...available].sort((a, b) => b - a);
  let left = roundToQuarter(Math.max(0, targetPerSide));
  const result: number[] = [];

  for (const p of sorted) {
    while (left + 1e-9 >= p) {
      result.push(p);
      left = roundToQuarter(left - p);
      if (result.length > 24) break;
    }
    if (result.length > 24) break;
  }
  return result;
}

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

/* ---------------- Visual: Bar + Plates (eine Seite) ---------------- */

function PlateVisual({
  plates,
  barLabelKg,
}: {
  plates: number[];
  barLabelKg: number;
}) {
  const widthFor = (kg: number) => {
    // iOS-ish: 1.25 klein, 25 groß
    const minW = 58;
    const maxW = 132;
    const t = Math.max(0, Math.min(1, (kg - 1.25) / (25 - 1.25)));
    return Math.round(minW + t * (maxW - minW));
  };

  return (
    <div className="relative mx-auto mt-2 flex h-[120px] w-full items-center justify-center">
      {/* Bar (hinter den Plates) */}
      <div className="relative h-6 w-[72%] rounded-md bg-black/25 dark:bg-white/20">
        <div className="absolute left-0 top-0 h-full w-4 rounded-l-md bg-black/30 dark:bg-white/25" />
        <div className="absolute right-0 top-0 h-full w-4 rounded-r-md bg-black/30 dark:bg-white/25" />

        {/* Label am Bar-Schaft (wie “0” im Screenshot) */}
        <div className="absolute left-[44%] top-1/2 -translate-y-1/2">
          <span className="text-[18px] font-semibold tabular-nums text-white/70 dark:text-white/70">
            {fmtKg(barLabelKg)}
          </span>
        </div>
      </div>

      {/* Plates rechts (eine Seite) */}
      <div className="absolute right-[12%] top-1/2 -translate-y-1/2 flex items-center">
        {plates.map((kg, idx) => {
          const w = widthFor(kg);
          return (
            <div
              key={`${kg}_${idx}`}
              style={{
                width: w,
                height: 86,
                marginLeft: -Math.round(w * 0.55),
                borderRadius: 14,
                background: "rgba(72,140,255,0.95)",
                boxShadow: "0 14px 32px rgba(0,0,0,0.32)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition: "width 180ms ease, margin 180ms ease",
              }}
              className="relative flex items-center justify-center"
              title={`${fmtKg(kg)} kg`}
            >
              <div
                className="absolute inset-0 rounded-[14px]"
                style={{
                  background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.12))",
                }}
              />
              <span className="relative text-white font-semibold text-[26px] tabular-nums">
                {fmtKg(kg)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Component ---------------- */

export function PlateCalculatorSheet({ open, onClose, initialTotalKg = 0, onApply }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const [manageOpen, setManageOpen] = useState(false);
  const [barType, setBarType] = useState<BarType>(() => safeReadJSON(LS_BAR_KEY, "standard"));
  const [available, setAvailable] = useState<number[]>(() => {
    const stored = safeReadJSON<number[]>(LS_AVAILABLE_KEY, [...DEFAULT_PLATES]);
    const cleaned = stored
      .filter((x) => typeof x === "number" && Number.isFinite(x))
      .filter((x) => (DEFAULT_PLATES as readonly number[]).includes(x));
    return cleaned.length ? cleaned : [...DEFAULT_PLATES];
  });

  const [targetKg, setTargetKg] = useState<number>(() =>
    Number.isFinite(initialTotalKg) ? Math.max(0, initialTotalKg) : 0
  );
  const [sidePlates, setSidePlates] = useState<number[]>([]);

  useEffect(() => safeWriteJSON(LS_AVAILABLE_KEY, available), [available]);
  useEffect(() => safeWriteJSON(LS_BAR_KEY, barType), [barType]);

  // Open sync
  useEffect(() => {
    if (!open) return;

    const init = Number.isFinite(initialTotalKg) ? Math.max(0, initialTotalKg) : 0;
    setTargetKg(init);
    setManageOpen(false);

    const bw = barWeight(barType);
    const perSide = (Math.max(0, init - bw)) / 2;
    setSidePlates(greedyBuildSide(perSide, available));
  }, [open, initialTotalKg]); // bewusst “stabil” wie vorher

  // Lock scroll + ESC
  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);


  // Rebuild on changes
  useEffect(() => {
    if (!open) return;
    const bw = barWeight(barType);
    const perSide = (Math.max(0, targetKg - bw)) / 2;
    setSidePlates(greedyBuildSide(perSide, available));
  }, [open, barType, available, targetKg]);

  const bw = barWeight(barType);
  const sideSum = sum(sidePlates);
  const computedTotal = roundToQuarter(bw + 2 * sideSum);

  const togglePlateAvailable = (kg: number) => {
    setAvailable((prev) => {
      const has = prev.includes(kg);
      const next = has ? prev.filter((x) => x !== kg) : [...prev, kg].sort((a, b) => b - a);
      return next.length ? next : prev;
    });
  };

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[10000]"
      data-overlay-open="true"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      onTouchStart={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="absolute left-0 right-0 bottom-0">
        {/* Sheet */}
        <div
          className={cx(
            "mx-auto max-w-2xl rounded-t-[28px] border shadow-[0_-22px_70px_rgba(0,0,0,0.55)]",
            // iOS dark like screenshot
            "bg-[#1c1c1e] border-white/10",
            // light theme support via dark:
            "dark:bg-[#1c1c1e] dark:border-white/10",
            "bg-white border-black/10 dark:bg-[#1c1c1e] dark:border-white/10"
          )}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3">
            <div className="h-[5px] w-11 rounded-full bg-black/10 dark:bg-white/15" />
          </div>

          {/* Title + Target */}
          <div className="px-5 pt-4 pb-3 text-center">
            <div className="text-[28px] leading-none font-semibold text-black/85 dark:text-white/90">
              Plattenrechner
            </div>
            <div className="mt-2 text-[22px] font-semibold text-black/35 dark:text-white/35">
              Zielgewicht: {fmtKg(targetKg)}kg
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-black/10 dark:bg-white/10" />

          {/* Visual */}
          <div className="px-6 py-4">
            {/* im Screenshot steht am Bar “0”; hier zeigen wir die Stange als Zahl.
               Wenn du exakt “0” willst: barLabelKg={0} setzen. */}
            <PlateVisual plates={sidePlates} barLabelKg={bw} />
          </div>

          {/* Section: Verfügbare Fitnessgeräte */}
          <div className="px-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="text-[20px] font-semibold text-black/35 dark:text-white/35">
                Verfügbare Fitnessgeräte
              </div>
              <button
                type="button"
                onClick={() => setManageOpen((v) => !v)}
                className="text-[22px] font-semibold"
                style={{ color: "rgba(72,140,255,0.95)" }}
              >
                {manageOpen ? "Fertig" : "Verwalten"}
              </button>
            </div>

            {/* Gewicht row */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-[26px] font-semibold text-black/85 dark:text-white/90">
                Gewicht (kg)
              </div>
            </div>

            <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DEFAULT_PLATES.map((kg) => {
                const active = available.includes(kg);
                return (
                  <button
                    key={kg}
                    type="button"
                    disabled={!manageOpen}
                    onClick={() => togglePlateAvailable(kg)}
                    className={cx(
                      "h-[64px] w-[64px] rounded-full flex items-center justify-center text-[24px] font-semibold tabular-nums",
                      "transition",
                      active
                        ? "bg-[rgba(72,140,255,0.95)] text-white"
                        : "bg-black/20 text-white/80 dark:bg-white/12 dark:text-white/80",
                      !manageOpen && "cursor-default"
                    )}
                    title={manageOpen ? "Tippen zum Aktivieren/Deaktivieren" : "Zum Ändern: Verwalten"}
                  >
                    {fmtKg(kg)}
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="mt-6 h-px bg-black/10 dark:bg-white/10" />

            {/* Hantel */}
            <div className="mt-6 text-[26px] font-semibold text-black/85 dark:text-white/90">
              Hantel (kg)
            </div>

            <div className="mt-4 flex gap-4">
              <button
                type="button"
                onClick={() => setBarType("standard")}
                className={cx(
                  "h-14 flex-1 rounded-full text-[22px] font-semibold",
                  barType === "standard"
                    ? "bg-white/12 text-white dark:bg-white/12 dark:text-white"
                    : "bg-black/18 text-white/80 dark:bg-white/10 dark:text-white/80"
                )}
              >
                Standard (20kg)
              </button>

              <button
                type="button"
                onClick={() => setBarType("short")}
                className={cx(
                  "h-14 flex-1 rounded-full text-[22px] font-semibold",
                  barType === "short"
                    ? "bg-white/12 text-white dark:bg-white/12 dark:text-white"
                    : "bg-black/18 text-white/80 dark:bg-white/10 dark:text-white/80"
                )}
              >
                Kurz (15kg)
              </button>
            </div>

            {/* Optional: “anwenden” ohne extra UI — wir wenden live an,
                damit es sich wie ein Tool anfühlt. */}
            <div className="mt-1 hidden" />
          </div>
        </div>
      </div>

      {/* ✅ Live-Apply: sobald Sheet offen ist und sich computedTotal ändert, updaten wir das Feld */}
      <LiveApplyEffect value={computedTotal} onApply={onApply} />
    </div>
  );
}

/** ruft onApply ohne UI-Noise auf (damit der Rechner “wie iOS” wirkt) */
function LiveApplyEffect({ value, onApply }: { value: number; onApply: (n: number) => void }) {
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (lastRef.current === value) return;
    lastRef.current = value;
    onApply(value);
  }, [value, onApply]);

  return null;
}
