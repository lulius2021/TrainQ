// src/pages/WorkoutSharePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory, onWorkoutHistoryUpdated } from "../utils/workoutHistory";
import WorkoutShareStoryCard from "../components/share/WorkoutShareStoryCard";
import WorkoutShareSticker from "../components/share/WorkoutShareSticker";
import { computeWorkoutShareStats } from "../utils/workoutShare";
import { Capacitor } from "@capacitor/core";
import { downloadPng, exportNodeToPng, sharePng, savePngToPhotos } from "../utils/shareImage";
import { useI18n } from "../i18n/useI18n";

type Props = {
  workoutId: string | null;
  onDone: () => void;
};

type Mode = "story" | "sticker";

const STORY_SIZE = { w: 1080, h: 1920 };
const STICKER_SIZE = { w: 1024, h: 1024 };

export default function WorkoutSharePage({ workoutId, onDone }: Props) {
  const { t } = useI18n();
  const [workout, setWorkout] = useState<WorkoutHistoryEntry | null>(null);
  const [exporting, setExporting] = useState(false);
  const [mode, setMode] = useState<Mode>("story");
  const [scale, setScale] = useState(0.25);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      if (!workoutId) {
        setWorkout(null);
        return;
      }
      const list = loadWorkoutHistory();
      const found = list.find((w) => w.id === workoutId) ?? null;
      setWorkout(found);
    };
    update();
    const off = onWorkoutHistoryUpdated(update);
    return () => off();
  }, [workoutId]);

  useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      const base = mode === "story" ? STORY_SIZE : STICKER_SIZE;
      const sx = (w - 16) / base.w;
      const sy = (h - 16) / base.h;
      const nextScale = Math.min(1, Math.max(0.12, Math.min(sx, sy)));
      setScale(nextScale);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  const stats = useMemo(() => (workout ? computeWorkoutShareStats(workout) : null), [workout]);

  const handleExport = async (action: "share" | "download" | "save") => {
    if (!stats) return;
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const base = mode === "story" ? STORY_SIZE : STICKER_SIZE;
      const backgroundColor = mode === "story" ? undefined : "transparent";
      const dataUrl = await exportNodeToPng(exportRef.current, {
        width: base.w,
        height: base.h,
        backgroundColor,
      });
      const filename = `workout-${stats.dateLabel.replace(/\s+/g, "-")}-${mode}.png`;
      if (action === "share") await sharePng(dataUrl, filename);
      else if (action === "save") await savePngToPhotos(dataUrl, filename);
      else downloadPng(dataUrl, filename);
    } finally {
      setExporting(false);
    }
  };

  const activeBase = mode === "story" ? STORY_SIZE : STICKER_SIZE;
  const scaledW = Math.max(1, Math.round(activeBase.w * scale));
  const scaledH = Math.max(1, Math.round(activeBase.h * scale));

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {t("share.page.title")}
          </div>
          <h1 className="text-lg font-semibold" style={{ color: "var(--text)" }}>
            {stats?.title ?? t("share.page.fallbackTitle")}
          </h1>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="rounded-xl px-4 py-2 text-xs font-semibold hover:opacity-95"
          style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
        >
          {t("common.finish")}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("story")}
          className="rounded-xl px-4 py-2 text-xs font-semibold hover:opacity-95"
          style={{
            background: mode === "story" ? "var(--primary)" : "var(--surface2)",
            color: mode === "story" ? "#061226" : "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {t("share.page.mode.story")}
        </button>
        <button
          type="button"
          onClick={() => setMode("sticker")}
          className="rounded-xl px-4 py-2 text-xs font-semibold hover:opacity-95"
          style={{
            background: mode === "sticker" ? "var(--primary)" : "var(--surface2)",
            color: mode === "sticker" ? "#061226" : "var(--text)",
            border: "1px solid var(--border)",
          }}
        >
          {t("share.page.mode.sticker")}
        </button>
      </div>

      {!stats && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          {t("share.page.loading")}
        </div>
      )}

      {stats && (
        <>
          <div
            ref={stageRef}
            className="w-full min-h-[360px] flex items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            <div
              style={{
                width: scaledW,
                height: scaledH,
              }}
            >
              <div
                ref={exportRef}
                style={{
                  width: activeBase.w,
                  height: activeBase.h,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              >
                {mode === "story" ? <WorkoutShareStoryCard stats={stats} /> : <WorkoutShareSticker stats={stats} />}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleExport("share")}
              disabled={exporting}
              className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
              style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
            >
              {exporting ? t("share.page.sharing") : t("common.share")}
            </button>
            {Capacitor.isNativePlatform() ? (
              <button
                type="button"
                onClick={() => handleExport("save")}
                disabled={exporting}
                className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {t("share.page.saveToPhotos")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleExport("download")}
                disabled={exporting}
                className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
              >
                {t("common.download")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
