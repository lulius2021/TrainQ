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
    const minW = 58;
    const maxW = 132;
    const t = Math.max(0, Math.min(1, (kg - 1.25) / (25 - 1.25)));
    return Math.round(minW + t * (maxW - minW));
  };

  return (
    <div className="relative mx-auto mt-2 flex h-[120px] w-full items-center justify-center">
      <div className="relative h-6 w-[72%] rounded-md bg-white/10">
        <div className="absolute left-0 top-0 h-full w-4 rounded-l-md bg-white/10" />
        <div className="absolute right-0 top-0 h-full w-4 rounded-r-md bg-white/10" />
        <div className="absolute left-[44%] top-1/2 -translate-y-1/2">
          <span className="text-xl font-semibold tabular-nums text-white/70">{fmtKg(barLabelKg)}</span>
        </div>
      </div>
      <div className="absolute right-[12%] top-1/2 -translate-y-1/2 flex items-center">
        {plates.map((kg, idx) => (
          <div
            key={`${kg}_${idx}`}
            style={{ width: widthFor(kg), height: 86, marginLeft: -Math.round(widthFor(kg) * 0.55), transition: "width 180ms ease, margin 180ms ease" }}
            className="relative flex items-center justify-center rounded-[14px] border border-white/10 bg-brand-primary"
            title={`${fmtKg(kg)} kg`}
          >
            <div className="absolute inset-0 rounded-[14px] bg-gradient-to-b from-white/20 to-transparent" />
            <span className="relative text-white font-semibold text-3xl tabular-nums">{fmtKg(kg)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlateCalculatorSheet({ open, onClose, initialTotalKg = 0, onApply }: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [barType, setBarType] = useState<BarType>(() => safeReadJSON(LS_BAR_KEY, "standard"));
  const [available, setAvailable] = useState<number[]>(() => {
    const stored = safeReadJSON<number[]>(LS_AVAILABLE_KEY, [...DEFAULT_PLATES]);
    const cleaned = stored.filter((x) => typeof x === "number" && Number.isFinite(x) && (DEFAULT_PLATES as readonly number[]).includes(x));
    return cleaned.length ? cleaned : [...DEFAULT_PLATES];
  });
  const [targetKg, setTargetKg] = useState<number>(() => Number.isFinite(initialTotalKg) ? Math.max(0, initialTotalKg) : 0);
  const [sidePlates, setSidePlates] = useState<number[]>([]);

  useEffect(() => safeWriteJSON(LS_AVAILABLE_KEY, available), [available]);
  useEffect(() => safeWriteJSON(LS_BAR_KEY, barType), [barType]);

  useEffect(() => {
    if (!open) return;
    const init = Number.isFinite(initialTotalKg) ? Math.max(0, initialTotalKg) : 0;
    setTargetKg(init);
    setManageOpen(false);
    const bw = barWeight(barType);
    const perSide = (Math.max(0, init - bw)) / 2;
    setSidePlates(greedyBuildSide(perSide, available));
  }, [open, initialTotalKg, barType, available]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

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
      const next = prev.includes(kg) ? prev.filter((x) => x !== kg) : [...prev, kg].sort((a, b) => b - a);
      return next.length ? next : prev;
    });
  };

  if (!open) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="absolute left-0 right-0 bottom-0">
        <div className="mx-auto max-w-2xl rounded-t-3xl border-t border-x border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
          <div className="flex justify-center pt-3"><div className="h-1.5 w-12 rounded-full bg-white/20" /></div>
          <div className="px-5 pt-4 pb-3 text-center">
            <div className="text-2xl leading-none font-bold text-white">Plattenrechner</div>
            <div className="mt-2 text-xl font-semibold text-gray-400">Ziel: {fmtKg(targetKg)}kg</div>
          </div>
          <div className="h-px bg-white/10" />
          <div className="px-6 py-4"><PlateVisual plates={sidePlates} barLabelKg={bw} /></div>
          <div className="px-6 pb-5">
            <div className="flex items-center justify-between">
              <div className="text-xl font-bold text-white">Verfügbare Scheiben</div>
              <button type="button" onClick={() => setManageOpen((v) => !v)} className="text-lg font-semibold text-brand-primary">{manageOpen ? "Fertig" : "Verwalten"}</button>
            </div>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DEFAULT_PLATES.map((kg) => {
                const active = available.includes(kg);
                return (
                  <button key={kg} type="button" disabled={!manageOpen} onClick={() => togglePlateAvailable(kg)} className={`h-16 w-16 rounded-full flex items-center justify-center text-2xl font-bold tabular-nums transition-all ${active ? "bg-brand-primary text-white shadow-[0_0_10px_rgba(37,99,235,0.7)]" : "bg-white/5 text-gray-400"} ${!manageOpen && "cursor-default"}`} title={manageOpen ? "Tippen zum Aktivieren/Deaktivieren" : "Zum Ändern: Verwalten"}>{fmtKg(kg)}</button>
                );
              })}
            </div>
            <div className="mt-6 h-px bg-white/10" />
            <div className="mt-6 text-xl font-bold text-white">Hantel</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setBarType("standard")} className={`h-16 rounded-2xl text-xl font-semibold transition-colors ${barType === "standard" ? "bg-white/10 text-white" : "bg-white/5 text-gray-400"}`}>Standard (20kg)</button>
              <button type="button" onClick={() => setBarType("short")} className={`h-16 rounded-2xl text-xl font-semibold transition-colors ${barType === "short" ? "bg-white/10 text-white" : "bg-white/5 text-gray-400"}`}>Kurz (15kg)</button>
            </div>
          </div>
        </div>
      </div>
      <LiveApplyEffect value={computedTotal} onApply={onApply} />
    </div>
  );
}

function LiveApplyEffect({ value, onApply }: { value: number; onApply: (n: number) => void }) {
  const lastRef = useRef<number | null>(null);
  useEffect(() => {
    if (Number.isFinite(value) && lastRef.current !== value) {
      lastRef.current = value;
      onApply(value);
    }
  }, [value, onApply]);
  return null;
}
