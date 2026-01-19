import React from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import type { WorkoutShareModel } from "./mapWorkoutToShareModel";
import StoryExportCanvas from "../../components/share/StoryExportCanvas";
import ResultCardStory from "../../components/share/templates/ResultCardStory";
import ExerciseSpotlightStory from "../../components/share/templates/ExerciseSpotlightStory";
import PrPosterStory from "../../components/share/templates/PrPosterStory";
import WeeklyStreakStory from "../../components/share/templates/WeeklyStreakStory";
import CleanReceiptStory from "../../components/share/templates/CleanReceiptStory";
import StickerMinimalStory from "../../components/share/templates/StickerMinimalStory";
import StickerExerciseStory from "../../components/share/templates/StickerExerciseStory";
import StickerPrStory from "../../components/share/templates/StickerPrStory";
import WatermarkOnlyStory from "../../components/share/templates/WatermarkOnlyStory";

export type { WorkoutShareModel } from "./mapWorkoutToShareModel";

export type StoryTemplateId =
  | "RESULT_CARD"
  | "EXERCISE_SPOTLIGHT"
  | "PR_POSTER"
  | "WEEKLY_STREAK"
  | "CLEAN_RECEIPT"
  | "STICKER_MINIMAL"
  | "STICKER_EXERCISE"
  | "STICKER_PR"
  | "WATERMARK_ONLY";

export type StoryTemplateMode = "full" | "sticker";

export type StoryTemplateDef = {
  id: StoryTemplateId;
  mode: StoryTemplateMode;
  nameKey: string;
  Component: React.ComponentType<StoryTemplateProps>;
};

type StoryTemplateProps = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

export const STORY_TEMPLATES: StoryTemplateDef[] = [
  { id: "RESULT_CARD", mode: "full", nameKey: "share.storyExport.template.result", Component: ResultCardStory },
  {
    id: "EXERCISE_SPOTLIGHT",
    mode: "full",
    nameKey: "share.storyExport.template.exercise",
    Component: ExerciseSpotlightStory,
  },
  { id: "PR_POSTER", mode: "full", nameKey: "share.storyExport.template.prPoster", Component: PrPosterStory },
  { id: "WEEKLY_STREAK", mode: "full", nameKey: "share.storyExport.template.weeklyStreak", Component: WeeklyStreakStory },
  { id: "CLEAN_RECEIPT", mode: "full", nameKey: "share.storyExport.template.cleanReceipt", Component: CleanReceiptStory },
  {
    id: "STICKER_MINIMAL",
    mode: "sticker",
    nameKey: "share.storyExport.template.stickerMinimal",
    Component: StickerMinimalStory,
  },
  {
    id: "STICKER_EXERCISE",
    mode: "sticker",
    nameKey: "share.storyExport.template.stickerExercise",
    Component: StickerExerciseStory,
  },
  {
    id: "STICKER_PR",
    mode: "sticker",
    nameKey: "share.storyExport.template.stickerPr",
    Component: StickerPrStory,
  },
  {
    id: "WATERMARK_ONLY",
    mode: "sticker",
    nameKey: "share.storyExport.template.watermark",
    Component: WatermarkOnlyStory,
  },
];

type RenderOpts = {
  templateId: StoryTemplateId;
  mode: StoryTemplateMode;
  workout: WorkoutShareModel;
  locale: "de" | "en";
};

async function waitForImages(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img")) as HTMLImageElement[];
  await Promise.all(
    imgs.map((img) => {
      if (!img.src) return Promise.resolve();
      const waitLoad = () =>
        new Promise<void>((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        });
      const needsLoad = !img.complete || img.naturalWidth === 0;
      const decodePromise = typeof img.decode === "function" ? img.decode().catch(() => undefined) : Promise.resolve();
      return Promise.all([needsLoad ? waitLoad() : Promise.resolve(), decodePromise]).then(() => undefined);
    })
  );
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = meta?.match(/data:(.*?);base64/i);
  const mime = mimeMatch?.[1] || "image/png";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function renderWorkoutStoryPng(opts: RenderOpts): Promise<Blob> {
  const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
  const platform = typeof cap?.getPlatform === "function" ? cap.getPlatform() : "web";
  const isIOS = platform === "ios";
  const def = STORY_TEMPLATES.find((tpl) => tpl.id === opts.templateId) ?? STORY_TEMPLATES[0];
  const isSticker = opts.mode === "sticker";
  const W = 1080;
  const H = isSticker ? 1080 : 1920;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = `${W}px`;
  container.style.height = `${H}px`;
  container.style.pointerEvents = "none";
  container.style.zIndex = "-1";
  document.body.appendChild(container);
  const root = createRoot(container);
  root.render(
    isSticker ? (
      <div
        data-story-export-root="true"
        style={{
          width: W,
          height: H,
          position: "relative",
          background: "transparent",
          color: "#0f172a",
          fontFamily: '"SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <def.Component model={opts.workout} locale={opts.locale} />
      </div>
    ) : (
      <StoryExportCanvas exportSafe>
        <def.Component model={opts.workout} locale={opts.locale} />
      </StoryExportCanvas>
    )
  );

  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (document.fonts?.ready) await document.fonts.ready;
    const node = container.querySelector('[data-story-export-root="true"]') as HTMLElement | null;
    if (!node) throw new Error("Export root not found");
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      throw new Error("Export root has zero size");
    }
    await waitForImages(node);

    const logo = node.querySelector('img[data-brand-logo="true"]') as HTMLImageElement | null;
    let logoObjectUrl: string | null = null;
    let logoPrevSrc: string | null = null;
    if (logo?.src) {
      try {
        const response = await fetch(logo.src, { cache: "force-cache" });
        if (response.ok) {
          const blob = await response.blob();
          logoObjectUrl = URL.createObjectURL(blob);
          logoPrevSrc = logo.src;
          logo.src = logoObjectUrl;
          await logo.decode?.().catch(() => undefined);
        }
      } catch {
        // ignore, fallback to original src
      }
    }

    const dataUrl = await toPng(node, {
      cacheBust: true,
      width: W,
      height: H,
      pixelRatio: isIOS ? 1.5 : 2,
      backgroundColor: isSticker ? "transparent" : undefined,
      style: {
        width: `${W}px`,
        height: `${H}px`,
        transform: "scale(1)",
        transformOrigin: "top left",
        ...(isSticker ? { backgroundColor: "transparent" } : {}),
      },
    });

    const blob = dataUrlToBlob(dataUrl);
    if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    if (logo && logoPrevSrc) logo.src = logoPrevSrc;
    return blob;
  } catch (error) {
    const node = container.querySelector('[data-story-export-root="true"]') as HTMLElement | null;
    const rect = node?.getBoundingClientRect();
    const imgCount = node ? node.querySelectorAll("img").length : 0;
    console.error("Story export failed", {
      platform,
      templateId: opts.templateId,
      mode: opts.mode,
      nodeExists: !!node,
      rect,
      imgCount,
      error,
    });
    throw error;
  } finally {
    root.unmount();
    container.remove();
  }
}
