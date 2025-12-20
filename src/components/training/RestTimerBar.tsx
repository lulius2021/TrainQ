// src/components/training/RestTimerBar.tsx

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  seconds: number; // z.B. 60
  running: boolean;
  onDone?: () => void;
};

function clampSeconds(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.floor(v));
}

function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export default function RestTimerBar({ seconds, running, onDone }: Props) {
  const total = useMemo(() => clampSeconds(seconds), [seconds]);

  // reset when total changes
  const [left, setLeft] = useState<number>(total);
  useEffect(() => setLeft(total), [total]);

  // prevent duplicate onDone calls
  const doneCalledRef = useRef(false);
  useEffect(() => {
    doneCalledRef.current = false;
  }, [total]);

  useEffect(() => {
    if (!running) return;
    if (left <= 0) return;

    const t = window.setInterval(() => {
      setLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(t);
  }, [running, left]);

  useEffect(() => {
    if (!running) return;
    if (left !== 0) return;
    if (doneCalledRef.current) return;

    doneCalledRef.current = true;
    onDone?.();
  }, [running, left, onDone]);

  const progressPct = useMemo(() => {
    const done = total - left;
    return Math.min(100, Math.max(0, (done / total) * 100));
  }, [left, total]);

  return (
    <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] text-white/70">Pause</span>
        <span className="text-[11px] font-mono text-white/80">{formatMMSS(left)}</span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-brand-primary" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/45">
        <span>{running ? "läuft…" : "pausiert"}</span>
        <span className="font-mono">{Math.round(progressPct)}%</span>
      </div>
    </div>
  );
}