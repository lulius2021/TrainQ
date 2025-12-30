// src/components/training/RestTimerBar.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  seconds: number;
  running: boolean;
  onDone?: () => void;
};

function clampSeconds(v: number): number {
  if (!Number.isFinite(v)) return 10;
  return Math.max(10, Math.min(300, Math.floor(v))); // 10s..5min
}

function formatHMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;

  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Audio: Boxing Bell (synthetisch)                                   */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

async function ensureAudioUnlocked(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }
}

function playBellOnce(when: number, gain = 0.78) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const master = ctx.createGain();
  master.gain.setValueAtTime(gain, when);
  master.connect(ctx.destination);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1100;
  bp.Q.value = 1.2;
  bp.connect(master);

  const partials = [780, 1180, 1560, 2080, 2630];

  partials.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(f, when);

    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.4 / (i + 1), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.2);

    osc.connect(g);
    g.connect(bp);

    osc.start(when);
    osc.stop(when + 1.3);
  });
}

function playBoxingBellDouble() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  playBellOnce(t);
  playBellOnce(t + 0.32);
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function RestTimerBar({ seconds, running, onDone }: Props) {
  const total = useMemo(() => clampSeconds(seconds), [seconds]);
  const [left, setLeft] = useState<number>(total);

  const tickIdRef = useRef<number | null>(null);

  const onDoneRef = useRef<(() => void) | undefined>(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Reset wenn total sich ändert
  useEffect(() => {
    setLeft(total);
  }, [total]);

  const doneCalledRef = useRef(false);
  useEffect(() => {
    doneCalledRef.current = false;
  }, [total]);

  const skippedRef = useRef(false);

  const clearTick = useCallback(() => {
    if (typeof window === "undefined") return;
    if (tickIdRef.current) {
      window.clearInterval(tickIdRef.current);
      tickIdRef.current = null;
    }
  }, []);

  // Tick: genau 1 Interval
  useEffect(() => {
    if (typeof window === "undefined") return;

    clearTick();

    if (!running) return;
    if (left <= 0) return;

    tickIdRef.current = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          // ✅ stoppt Interval genau beim Ende
          clearTick();
          return 0;
        }
        return v - 1;
      });
    }, 1000);

    return () => clearTick();
  }, [running, total, left, clearTick]);

  // Done: genau 1x
  useEffect(() => {
    if (!running) return;
    if (left !== 0) return;
    if (doneCalledRef.current) return;

    doneCalledRef.current = true;

    if (!skippedRef.current) playBoxingBellDouble();
    skippedRef.current = false;

    onDoneRef.current?.();
  }, [running, left]);

  const progressPct = useMemo(() => {
    const done = total - left;
    return Math.min(100, Math.max(0, (done / total) * 100));
  }, [left, total]);

  const adjustLeft = useCallback(async (delta: number) => {
    await ensureAudioUnlocked();
    setLeft((v) => Math.max(0, Math.min(v + delta, 300))); // hard cap 5min
    doneCalledRef.current = false; // falls user wieder hochzieht nach 0
  }, []);

  // Hold (+/-) repeat
  const holdIntervalRef = useRef<number | null>(null);

  const stopHold = useCallback(() => {
    if (typeof window === "undefined") return;
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
  }, []);

  const startHold = useCallback(
    (delta: number, pointerId?: number, el?: HTMLElement | null) => {
      void ensureAudioUnlocked();
      void adjustLeft(delta);

      stopHold();

      if (typeof window === "undefined") return;

      try {
        if (el && pointerId != null) (el as any).setPointerCapture?.(pointerId);
      } catch {
        // ignore
      }

      holdIntervalRef.current = window.setInterval(() => {
        void adjustLeft(delta);
      }, 120);
    },
    [adjustLeft, stopHold]
  );

  useEffect(() => {
    return () => stopHold();
  }, [stopHold]);

  const skipRest = useCallback(async () => {
    await ensureAudioUnlocked();
    skippedRef.current = true;
    doneCalledRef.current = false;
    setLeft(0);
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3" onPointerDown={() => void ensureAudioUnlocked()}>
      <div className="mb-2 text-center">
        <span className="text-[11px] font-mono text-white/80">{formatHMMSS(left)}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void adjustLeft(-10)}
          onPointerDown={(e) => startHold(-10, e.pointerId, e.currentTarget)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/5"
        >
          - 10
        </button>

        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${progressPct}%` }} />
        </div>

        <button
          type="button"
          onClick={() => void adjustLeft(+10)}
          onPointerDown={(e) => startHold(+10, e.pointerId, e.currentTarget)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/5"
        >
          + 10
        </button>

        <button
          type="button"
          onClick={() => void skipRest()}
          className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-semibold text-white/90 hover:bg-white/5"
          title="Rest überspringen"
        >
          Skip
        </button>
      </div>
    </div>
  );
}