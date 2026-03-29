// src/components/training/RestTimerBar.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n";

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

const BAR_PRESETS = [
  { label: "1:00", seconds: 60 },
  { label: "1:30", seconds: 90 },
  { label: "2:00", seconds: 120 },
  { label: "3:00", seconds: 180 },
];

export default function RestTimerBar({ seconds, running, onDone }: Props) {
  const { t } = useI18n();
  const total = useMemo(() => clampSeconds(seconds), [seconds]);
  const [left, setLeft] = useState<number>(total);
  const [localTotal, setLocalTotal] = useState<number>(total);

  const tickIdRef = useRef<number | null>(null);

  const onDoneRef = useRef<(() => void) | undefined>(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    setLeft(total);
    setLocalTotal(total);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    clearTick();
    if (!running || left <= 0) return;
    tickIdRef.current = window.setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearTick();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearTick();
  }, [running, total, left, clearTick]);

  useEffect(() => {
    if (!running || left !== 0 || doneCalledRef.current) return;
    doneCalledRef.current = true;
    if (!skippedRef.current) playBoxingBellDouble();
    skippedRef.current = false;
    onDoneRef.current?.();
  }, [running, left]);

  const progressPct = useMemo(() => {
    const done = localTotal - left;
    return Math.min(100, Math.max(0, (done / localTotal) * 100));
  }, [left, localTotal]);

  const adjustLeft = useCallback(async (delta: number) => {
    await ensureAudioUnlocked();
    setLeft((v) => Math.max(0, Math.min(v + delta, 300)));
    doneCalledRef.current = false;
  }, []);

  const holdIntervalRef = useRef<number | null>(null);
  const stopHold = useCallback(() => {
    if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
  }, []);

  const startHold = useCallback((delta: number, pointerId?: number, el?: HTMLElement | null) => {
    void ensureAudioUnlocked();
    void adjustLeft(delta);
    stopHold();
    try {
      if (el && pointerId != null) (el as any).setPointerCapture?.(pointerId);
    } catch {}
    holdIntervalRef.current = window.setInterval(() => {
      void adjustLeft(delta);
    }, 120);
  }, [adjustLeft, stopHold]);

  useEffect(() => () => stopHold(), [stopHold]);

  const skipRest = useCallback(async () => {
    await ensureAudioUnlocked();
    skippedRef.current = true;
    doneCalledRef.current = false;
    setLeft(0);
  }, []);

  const applyPreset = useCallback(async (sec: number) => {
    await ensureAudioUnlocked();
    setLeft(sec);
    setLocalTotal(sec);
    doneCalledRef.current = false;
  }, []);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-3 shadow-lg" onPointerDown={() => void ensureAudioUnlocked()}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onPointerDown={(e) => startHold(-10, e.pointerId, e.currentTarget)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className="shrink-0 rounded-full h-11 w-11 border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 touch-manipulation"
        >
          -10
        </button>

        <div className="flex-1 text-center">
          <div className="text-sm text-gray-400">Pause</div>
          <div className="text-3xl font-bold text-white tabular-nums" style={{ textShadow: "0 0 10px rgba(255,255,255,0.2)" }}>
            {formatHMMSS(left)}
          </div>
        </div>

        <button
          type="button"
          onPointerDown={(e) => startHold(+10, e.pointerId, e.currentTarget)}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onPointerLeave={stopHold}
          className="shrink-0 rounded-full h-11 w-11 border border-white/10 bg-white/5 text-sm text-white hover:bg-white/10 touch-manipulation"
        >
          +10
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {/* Quick presets */}
        <div className="flex gap-1.5">
          {BAR_PRESETS.map((p) => (
            <button
              key={p.seconds}
              type="button"
              onClick={() => void applyPreset(p.seconds)}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold text-white/70 bg-white/10 hover:bg-white/15 active:scale-[0.95] transition-all touch-manipulation"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-brand-primary transition-all duration-300"
            style={{
              width: `${progressPct}%`,
              boxShadow: '0 0 10px 0px rgba(37, 99, 235, 0.7)'
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void skipRest()}
          className="w-full rounded-3xl py-2 text-sm font-semibold text-gray-300 hover:bg-white/5"
          title={t("training.rest.skipTitle")}
        >
          {t("training.rest.skip")}
        </button>
      </div>
    </div>
  );
}
