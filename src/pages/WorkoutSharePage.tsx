// src/pages/WorkoutSharePage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { WorkoutHistoryEntry } from "../utils/workoutHistory";
import { loadWorkoutHistory, onWorkoutHistoryUpdated } from "../utils/workoutHistory";
import { computeWorkoutShareStats } from "../utils/workoutShare";
import { Capacitor } from "@capacitor/core";
import { sharePng, savePngToPhotos } from "../utils/shareImage";
import { useI18n } from "../i18n/useI18n";
import StoryExportPicker from "../components/share/StoryExportPicker";
import StoryExportCanvas from "../components/share/StoryExportCanvas";
import { blobToDataUrl, renderWorkoutStoryPng, STORY_TEMPLATES, type StoryTemplateId } from "../utils/share/renderStoryExport";
import { mapWorkoutToShareModel } from "../utils/share/mapWorkoutToShareModel";

type Props = {
  workoutId: string | null;
  onDone: () => void;
};

const STORY_SIZE = { w: 1080, h: 1920 };

export default function WorkoutSharePage({ workoutId, onDone }: Props) {
  const { t, lang } = useI18n();
  const [workout, setWorkout] = useState<WorkoutHistoryEntry | null>(null);
  const [previewScale, setPreviewScale] = useState(0.25);
  const [activeStoryTemplate, setActiveStoryTemplate] = useState<StoryTemplateId>("RESULT_CARD");
  const [storyExporting, setStoryExporting] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);

  const previewRef = useRef<HTMLDivElement | null>(null);

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
    if (!previewRef.current) return;
    const el = previewRef.current;
    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      const sx = (w - 16) / STORY_SIZE.w;
      const sy = (h - 16) / STORY_SIZE.h;
      const nextScale = Math.min(1, Math.max(0.12, Math.min(sx, sy)));
      setPreviewScale(nextScale);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stats = useMemo(() => (workout ? computeWorkoutShareStats(workout) : null), [workout]);
  const storyModel = useMemo(() => (workout ? mapWorkoutToShareModel(workout, lang) : null), [workout, lang]);
  const isGym = storyModel?.sportType.toLowerCase() === "gym";

  const storyTemplates = useMemo(() => {
    const list = STORY_TEMPLATES.filter((tpl) => {
      if (isGym) return true;
      return tpl.id !== "EXERCISE_SPOTLIGHT" && tpl.id !== "STICKER_EXERCISE";
    });
    return list.map((tpl) => ({ ...tpl, label: t(tpl.nameKey) }));
  }, [isGym, t]);

  useEffect(() => {
    if (!storyTemplates.length) return;
    const active = storyTemplates.find((tpl) => tpl.id === activeStoryTemplate);
    if (!active) setActiveStoryTemplate(storyTemplates[0].id);
  }, [storyTemplates, activeStoryTemplate]);

  const handleShare = async () => {
    if (!storyModel) return;
    const active = storyTemplates.find((tpl) => tpl.id === activeStoryTemplate);
    if (!active) return;
    setStoryExporting(true);
    try {
      const blob = await renderWorkoutStoryPng({
        templateId: active.id,
        mode: active.mode,
        workout: storyModel,
        locale: lang,
      });
      const filename = `trainq-story-${storyModel.dateISO.slice(0, 10)}.png`;
      const dataUrl = await blobToDataUrl(blob);
      await sharePng(dataUrl, filename);
    } catch (error) {
      const msg = String((error as any)?.message ?? error ?? "unknown");
      console.error("[StoryExport] failed", {
        platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web",
        templateId: active?.id,
        mode: active?.mode,
        error,
      });
      alert(`Export fehlgeschlagen: ${msg}`);
    } finally {
      setStoryExporting(false);
    }
  };

  const handleSave = async () => {
    if (!storyModel) return;
    const active = storyTemplates.find((tpl) => tpl.id === activeStoryTemplate);
    if (!active) return;
    setStoryExporting(true);
    try {
      const blob = await renderWorkoutStoryPng({
        templateId: active.id,
        mode: active.mode,
        workout: storyModel,
        locale: lang,
      });
      const filename = `trainq-story-${storyModel.dateISO.slice(0, 10)}.png`;
      const dataUrl = await blobToDataUrl(blob);
      await savePngToPhotos(dataUrl, filename);
    } catch (error) {
      const msg = String((error as any)?.message ?? error ?? "unknown");
      console.error("[StoryExport] failed", {
        platform: Capacitor.isNativePlatform() ? Capacitor.getPlatform() : "web",
        templateId: active?.id,
        mode: active?.mode,
        error,
      });
      alert(`Export fehlgeschlagen: ${msg}`);
    } finally {
      setStoryExporting(false);
    }
  };

  const handleCopyCaption = async () => {
    if (!storyModel) return;
    const duration = stats?.durationLabel ?? "";
    const volume = storyModel.totalVolumeKg ? `${Math.round(storyModel.totalVolumeKg)} kg` : "";
    const distance = storyModel.distanceKm ? `${Math.round(storyModel.distanceKm * 10) / 10} km` : "";
    const metric = volume || distance;
    const caption = [
      `${storyModel.title}`,
      [duration, metric].filter(Boolean).join(" · "),
      "#trainq",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(caption);
      setCaptionCopied(true);
      window.setTimeout(() => setCaptionCopied(false), 1200);
    } catch {
      alert(caption);
    }
  };

  const previewW = Math.max(1, Math.round(STORY_SIZE.w * previewScale));
  const previewH = Math.max(1, Math.round(STORY_SIZE.h * previewScale));
  const activeTemplate = storyTemplates.find((tpl) => tpl.id === activeStoryTemplate);

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

      {!stats && (
        <div className="rounded-2xl p-4 text-sm" style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          {t("share.page.loading")}
        </div>
      )}

      {stats && (
        <>
          <div
            ref={previewRef}
            className="w-full min-h-[360px] flex items-center justify-center overflow-hidden rounded-2xl"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
          >
            {activeTemplate && storyModel && (
              <div style={{ width: previewW, height: previewH }}>
                <div
                  style={{
                    width: STORY_SIZE.w,
                    height: STORY_SIZE.h,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {activeTemplate.mode === "full" ? (
                    <StoryExportCanvas>
                      <activeTemplate.Component model={storyModel} locale={lang} />
                    </StoryExportCanvas>
                  ) : (
                    <div
                      style={{
                        width: STORY_SIZE.w,
                        height: STORY_SIZE.h,
                        position: "relative",
                        background: "transparent",
                        color: "#0f172a",
                        fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
                      }}
                    >
                      <activeTemplate.Component model={storyModel} locale={lang} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {storyModel && (
            <>
              <div className="mt-4">
                <StoryExportPicker
                  templates={storyTemplates}
                  activeId={activeStoryTemplate}
                  onChange={setActiveStoryTemplate}
                  locale={lang}
                  model={storyModel}
                  stickerLabel={t("share.storyExport.stickerBadge")}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={storyExporting}
                  className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                  style={{ background: "var(--primary)", color: "#061226", border: "1px solid var(--border)" }}
                >
                  {storyExporting ? t("share.page.sharing") : t("common.share")}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={storyExporting}
                  className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95 disabled:opacity-60"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {t("share.page.saveToPhotos")}
                </button>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="rounded-xl px-5 py-2 text-sm font-semibold hover:opacity-95"
                  style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                >
                  {captionCopied ? t("share.storyExport.copied") : t("share.storyExport.copyCaption")}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
