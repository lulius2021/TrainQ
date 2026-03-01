// src/components/training/MinimizedLiveTrainingDock.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LiveWorkout } from "../../types/training";
import { useI18n } from "../../i18n/useI18n";
import {
  getActiveLiveWorkout,
  persistActiveLiveWorkout,
  completeLiveWorkout,
} from "../../utils/trainingHistory";

type Props = {
  /**
   * Wird aufgerufen, wenn der User auf "Fortsetzen" drückt.
   * App.tsx sollte dann LiveTrainingPage öffnen (wie du es bisher machst).
   */
  onResume: (workout: LiveWorkout) => void;

  /**
   * Optional: App.tsx kann hier Kalender-Status etc. updaten.
   * (z.B. Event als completed/skipped markieren)
   */
  onFinished?: (workout: LiveWorkout) => void;
  onAborted?: (workout: LiveWorkout) => void;

  /**
   * Layout tuning (falls du später feinjustieren willst)
   */
  navBarStackPx?: number; // Höhe+Abstand der NavBar “Zone”
  gapPx?: number;         // zusätzlicher Abstand zwischen Dock und NavBar
};

function formatHMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function computeElapsedSec(startedAtISO?: string): number {
  if (!startedAtISO) return 0;
  const ms = new Date(startedAtISO).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

export default function MinimizedLiveTrainingDock({
  onResume,
  onFinished,
  onAborted,
  navBarStackPx = 92,
  gapPx = 12,
}: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState<LiveWorkout | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const tickRef = useRef<number | null>(null);

  // Quelle: Active workout aus trainingHistory (LocalStorage)
  useEffect(() => {
    const read = () => {
      const w = getActiveLiveWorkout() as LiveWorkout | null;
      // Nur anzeigen wenn wirklich aktiv + minimiert
      if (w && w.isActive && w.isMinimized) setActive(w);
      else setActive(null);
    };

    read();

    // Storage-Events (z.B. mehrere Tabs) + Poll als robustes Fallback
    const onStorage = () => read();
    window.addEventListener("storage", onStorage);

    const pollId = window.setInterval(read, 800);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(pollId);
    };
  }, []);

  // Elapsed timer nur wenn sichtbar
  useEffect(() => {
    if (!active) return;

    setElapsed(computeElapsedSec(active.startedAt));

    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setElapsed(computeElapsedSec(active.startedAt));
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [active?.id, active?.startedAt]);

  const safeBottom = "env(safe-area-inset-bottom, 0px)";
  const bottomStyle = useMemo(() => {
    // Fixed positioning just above the TabBar (TabBar is ~83px tall including padding)
    // We want ~10px gap. So 83 + 10 = 93px.
    return { bottom: "calc(env(safe-area-inset-bottom) + 94px)" };
  }, []);

  if (!active) return null;

  const title = active.title || "Live-Training";
  const sport = active.sport;
  const exCount = Array.isArray(active.exercises) ? active.exercises.length : 0;

  return (
    <div className="fixed left-0 right-0 z-[60] flex justify-center px-4" style={bottomStyle}>
      <div
        className="
          w-full max-w-md rounded-2xl border backdrop-blur-2xl shadow-lg
        "
        style={{
          backgroundColor: "var(--mini-bar-bg)",
          borderColor: "var(--border-color)",
          color: "var(--text-color)",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="tabular-nums font-mono text-sm opacity-90">
                {formatHMMSS(elapsed)}
              </span>
              <span className="text-[11px] opacity-70">
                {active.sport || "Training"} • {t(exCount === 1 ? "training.exercise.countOne" : "training.exercise.countOther", { count: exCount })}
              </span>
            </div>

            <div className="truncate text-[13px] font-bold">
              {title}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = { ...active, isMinimized: false };
                persistActiveLiveWorkout(next);
                onResume(next);
              }}
              className="h-9 rounded-3xl px-3 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--accent-color)" }}
              title={t("live.resumeTitle")}
            >
              {t("live.resume")}
            </button>




          </div>
        </div>
      </div>
    </div>
  );
}
