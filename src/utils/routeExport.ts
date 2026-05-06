// src/utils/routeExport.ts
// Canvas-based workout image generator for sharing/export.
// All drawing is done on a 1080×1080 offscreen canvas.

import type { WorkoutHistoryEntry } from "./workoutHistory";

// ─── Theme definitions ────────────────────────────────────────────────────────

export type ExportTheme = "dark" | "gradient" | "light" | "minimal" | "transparent";

export type ThemeDef = {
  id: ExportTheme;
  label: string;
  /** CSS value for live preview background */
  previewBg: string;
  /** Canvas background fill (null = transparent) */
  canvasBg: string | null;
  canvasBg2: string | null; // for gradient (bottom color), null = solid
  textPrimary: string;
  textMuted: string;
  routeColor: string;
  routeGlow: string;
  divider: string;
};

export const EXPORT_THEMES: ThemeDef[] = [
  {
    id: "dark",
    label: "Dunkel",
    previewBg: "#061226",
    canvasBg: "#061226",
    canvasBg2: null,
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.45)",
    routeColor: "#3b82f6",
    routeGlow: "rgba(59,130,246,0.5)",
    divider: "rgba(255,255,255,0.08)",
  },
  {
    id: "gradient",
    label: "Gradient",
    previewBg: "linear-gradient(160deg,#0a1f44,#061226)",
    canvasBg: "#0a1f44",
    canvasBg2: "#061226",
    textPrimary: "#ffffff",
    textMuted: "rgba(255,255,255,0.45)",
    routeColor: "#60a5fa",
    routeGlow: "rgba(96,165,250,0.5)",
    divider: "rgba(255,255,255,0.08)",
  },
  {
    id: "light",
    label: "Hell",
    previewBg: "#f1f5f9",
    canvasBg: "#f1f5f9",
    canvasBg2: null,
    textPrimary: "#0f172a",
    textMuted: "#64748b",
    routeColor: "#2563eb",
    routeGlow: "rgba(37,99,235,0.35)",
    divider: "rgba(15,23,42,0.10)",
  },
  {
    id: "minimal",
    label: "Minimal",
    previewBg: "#0b1622",
    canvasBg: "#0b1622",
    canvasBg2: null,
    textPrimary: "#94a3b8",
    textMuted: "#475569",
    routeColor: "#38bdf8",
    routeGlow: "rgba(56,189,248,0.4)",
    divider: "rgba(148,163,184,0.08)",
  },
  {
    id: "transparent",
    label: "Kein Hintergrund",
    previewBg: "repeating-conic-gradient(#aaa 0% 25%, #fff 0% 50%) 0 0/16px 16px",
    canvasBg: null,
    canvasBg2: null,
    textPrimary: "#1e3a5f",
    textMuted: "#3b82f6",
    routeColor: "#2563eb",
    routeGlow: "rgba(37,99,235,0.4)",
    divider: "rgba(37,99,235,0.15)",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(paceSecPerKm: number): string {
  const m = Math.floor(paceSecPerKm / 60);
  const s = Math.round(paceSecPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Canvas route drawing ─────────────────────────────────────────────────────

function drawRoute(
  ctx: CanvasRenderingContext2D,
  points: Array<{ lat: number; lng: number }>,
  areaX: number,
  areaY: number,
  areaW: number,
  areaH: number,
  theme: ThemeDef,
) {
  if (points.length < 2) return;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.0001;
  const lngRange = maxLng - minLng || 0.0001;

  const scaleX = (areaW * 0.82) / lngRange;
  const scaleY = (areaH * 0.82) / latRange;
  const scale = Math.min(scaleX, scaleY);

  const usedW = lngRange * scale;
  const usedH = latRange * scale;
  const offX = areaX + (areaW - usedW) / 2;
  const offY = areaY + (areaH - usedH) / 2;

  const toX = (lng: number) => offX + (lng - minLng) * scale;
  const toY = (lat: number) => offY + usedH - (lat - minLat) * scale;

  // Glow pass
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(toX(p.lng), toY(p.lat));
    else ctx.lineTo(toX(p.lng), toY(p.lat));
  });
  ctx.strokeStyle = theme.routeGlow;
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  // Main line
  ctx.save();
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(toX(p.lng), toY(p.lat));
    else ctx.lineTo(toX(p.lng), toY(p.lat));
  });
  ctx.strokeStyle = theme.routeColor;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();

  const DOT = 16;

  // Start dot — green
  const s = points[0];
  ctx.beginPath();
  ctx.arc(toX(s.lng), toY(s.lat), DOT, 0, Math.PI * 2);
  ctx.fillStyle = "#22c55e";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();

  // End dot — route color
  const e = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(toX(e.lng), toY(e.lat), DOT, 0, Math.PI * 2);
  ctx.fillStyle = theme.routeColor;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

// ─── Main export function ─────────────────────────────────────────────────────

/**
 * Renders a 1080×1080 workout card image and returns a Blob (PNG).
 * Falls back to a simple stats card if there are no GPS track points.
 */
export async function generateWorkoutImage(
  entry: WorkoutHistoryEntry,
  theme: ExportTheme,
  userName?: string,
): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const PAD = 64;

  const t = EXPORT_THEMES.find((th) => th.id === theme) ?? EXPORT_THEMES[0];

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ── Background ──────────────────────────────────────────────────────────────
  if (t.canvasBg) {
    if (t.canvasBg2) {
      // Diagonal gradient
      const grad = ctx.createLinearGradient(0, 0, W * 0.4, H);
      grad.addColorStop(0, t.canvasBg);
      grad.addColorStop(1, t.canvasBg2);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = t.canvasBg;
    }
    ctx.fillRect(0, 0, W, H);
  }

  const sport = (entry.sport ?? "").toLowerCase();
  const isCardio = sport === "laufen" || sport === "radfahren";
  const isGym = sport === "gym";
  const sportIcon = sport === "laufen" ? "🏃" : sport === "radfahren" ? "🚴" : isGym ? "💪" : "🎯";
  const sportLabel = sport === "laufen"
    ? "Laufen"
    : sport === "radfahren"
    ? "Radfahren"
    : isGym
    ? "Gym"
    : (entry.sport ?? "Training");

  const hasRoute = Array.isArray(entry.gpsTrack) && entry.gpsTrack.length >= 2;
  const HEADER_H = 140;
  const FOOTER_H = 200;
  const routeAreaY = HEADER_H;
  const routeAreaH = H - HEADER_H - FOOTER_H;

  // ── Hero panel background ───────────────────────────────────────────────────
  ctx.fillStyle = t.canvasBg
    ? "rgba(0,0,0,0.12)"
    : "rgba(0,0,0,0.04)";
  if (theme === "light") ctx.fillStyle = "rgba(255,255,255,0.6)";
  roundRect(ctx, PAD / 2, routeAreaY + 8, W - PAD, routeAreaH - 16, 32);
  ctx.fill();

  // ── Hero content (route OR exercises OR sport visual) ──────────────────────
  if (hasRoute) {
    drawRoute(ctx, entry.gpsTrack!, PAD * 1.5, routeAreaY + 24, W - PAD * 3, routeAreaH - 48, t);
  } else if (isGym && (entry.exercises?.length ?? 0) > 0) {
    drawExercisesPanel(ctx, entry, t, PAD * 1.5, routeAreaY + 40, W - PAD * 3, routeAreaH - 80);
  } else {
    drawSportHero(ctx, sportIcon, entry.title ?? sportLabel, t, W / 2, routeAreaY + routeAreaH / 2);
  }

  // ── Top bar: sport + date ────────────────────────────────────────────────────
  ctx.font = `bold 56px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = t.textPrimary;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(`${sportIcon} ${sportLabel}`, PAD, HEADER_H / 2);

  const dateStr = formatDate(entry.endedAt ?? entry.startedAt);
  if (dateStr) {
    ctx.font = `400 36px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = t.textMuted;
    ctx.textAlign = "right";
    ctx.fillText(dateStr, W - PAD, HEADER_H / 2);
  }

  // ── Divider ──────────────────────────────────────────────────────────────────
  const divY = H - FOOTER_H;
  ctx.strokeStyle = t.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, divY);
  ctx.lineTo(W - PAD, divY);
  ctx.stroke();

  // ── Stats section (sport-aware) ─────────────────────────────────────────────
  const stats: Array<{ value: string; label: string }> = [];

  if (isCardio) {
    if (entry.distanceKm != null && entry.distanceKm > 0) {
      stats.push({ value: entry.distanceKm.toFixed(2), label: "km" });
    }
    if (entry.durationSec > 0) {
      stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
    }
    if (entry.paceSecPerKm != null && entry.paceSecPerKm > 0) {
      stats.push({ value: formatPace(entry.paceSecPerKm), label: "min/km" });
    }
  } else if (isGym) {
    if (entry.totalVolume > 0) {
      stats.push({ value: formatKg(entry.totalVolume), label: "Volumen" });
    }
    const setCount = (entry.exercises ?? []).reduce((acc, ex) => acc + (ex.sets?.length ?? 0), 0);
    if (setCount > 0) stats.push({ value: String(setCount), label: setCount === 1 ? "Satz" : "Sätze" });
    if (entry.durationSec > 0) {
      stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
    }
  } else {
    if (entry.durationSec > 0) {
      stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
    }
    const exCount = (entry.exercises ?? []).length;
    if (exCount > 0) stats.push({ value: String(exCount), label: exCount === 1 ? "Übung" : "Übungen" });
  }

  if (stats.length === 0) {
    stats.push({ value: "—", label: "Training" });
  }

  const statsY = divY + 20;
  const statsH = FOOTER_H - 60;
  const colW = (W - PAD * 2) / stats.length;

  stats.forEach((st, i) => {
    const cx = PAD + colW * i + colW / 2;
    const centerY = statsY + statsH / 2;

    ctx.textAlign = "center";

    // Value
    ctx.font = `bold 80px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = t.textPrimary;
    ctx.textBaseline = "bottom";
    ctx.fillText(st.value, cx, centerY + 4);

    // Label
    ctx.font = `400 34px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = t.textMuted;
    ctx.textBaseline = "top";
    ctx.fillText(st.label, cx, centerY + 12);
  });

  // ── Watermark (workout title + "TrainQ") ─────────────────────────────────────
  const wmY = H - 36;
  ctx.font = `400 28px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = t.textMuted;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  const titleStr = entry.title ? `${entry.title}  •  ` : "";
  ctx.fillText(`${titleStr}TrainQ`, W / 2, wmY);

  if (userName) {
    ctx.font = `400 26px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(userName, PAD, wmY);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/png",
    );
  });
}

// ─── Share / download ─────────────────────────────────────────────────────────

// Module-level dedup + serialization for image generation.
// Prevents two issues:
//   1. UI freeze when many WorkoutPostCard instances all generate at once.
//      Canvas drawing + toBlob() PNG encoding is synchronous-ish and blocks
//      the main thread; serializing keeps the UI responsive between cards.
//   2. Duplicate generation when the auto-save (LiveTrainingPage) and lazy
//      generation (WorkoutPostCard) both fire for the same workout id.
const inFlightImages = new Map<string, Promise<Blob>>();
let imageChain: Promise<unknown> = Promise.resolve();

/**
 * Generates the workout image, but:
 *  - dedupes concurrent requests by entry.id + theme (returns the same promise)
 *  - serializes work so multiple cards don't all encode PNGs in parallel
 */
export function getOrGenerateWorkoutImage(
  entry: WorkoutHistoryEntry,
  theme: ExportTheme,
  userName?: string,
): Promise<Blob> {
  const key = `${entry.id}__${theme}`;
  const existing = inFlightImages.get(key);
  if (existing) return existing;

  const p = imageChain.then(() => generateWorkoutImage(entry, theme, userName));
  inFlightImages.set(key, p);
  // Keep the chain alive even if one task fails so later tasks still run.
  imageChain = p.catch(() => {});
  // Free the dedup slot once resolved/rejected so a later request can kick
  // off a fresh generation if needed.
  p.finally(() => {
    if (inFlightImages.get(key) === p) inFlightImages.delete(key);
  });
  return p;
}

/**
 * Tries Web Share API first (native sheet on iOS/Android).
 * Falls back to a direct PNG download if sharing is unavailable.
 */
export async function shareOrDownloadImage(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });

  if (
    typeof navigator !== "undefined" &&
    "share" in navigator &&
    "canShare" in navigator &&
    (navigator as any).canShare({ files: [file] })
  ) {
    await (navigator as any).share({ files: [file], title: "TrainQ Workout" });
    return "shared";
  }

  // Download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}

// ─── Hero variants for non-cardio sports ──────────────────────────────────────

function drawExercisesPanel(
  ctx: CanvasRenderingContext2D,
  entry: WorkoutHistoryEntry,
  theme: ThemeDef,
  x: number, y: number, w: number, h: number,
) {
  const exercises = entry.exercises ?? [];
  if (exercises.length === 0) return;

  // Section title
  ctx.font = `600 32px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = theme.textMuted;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("Übungen", x + 8, y);

  // Top exercises by volume — show up to 5
  const ranked = exercises
    .map((ex) => {
      const sets = ex.sets ?? [];
      const volume = sets.reduce(
        (a, s) => a + (Number(s.reps) || 0) * (Number(s.weight) || 0),
        0,
      );
      const bestSet = sets.reduce<typeof sets[number] | null>((best, s) => {
        const v = (Number(s.reps) || 0) * (Number(s.weight) || 0);
        const bv = best ? (Number(best.reps) || 0) * (Number(best.weight) || 0) : -1;
        return v > bv ? s : best;
      }, null);
      return { name: ex.name || "Übung", volume, sets: sets.length, best: bestSet };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  const startY = y + 56;
  const rowH = Math.min(72, (h - 80) / Math.max(1, ranked.length));
  ranked.forEach((r, i) => {
    const ry = startY + i * rowH;

    // Index circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 32, ry + rowH / 2, 18, 0, Math.PI * 2);
    ctx.fillStyle = theme.routeColor;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.restore();

    ctx.font = `600 24px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = theme.routeColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), x + 32, ry + rowH / 2 + 1);

    // Name (truncate to fit)
    ctx.font = `600 30px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = theme.textPrimary;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(ctx, r.name, w - 380), x + 64, ry + rowH / 2 - 8);

    // Detail
    const detail = r.best && (Number(r.best.weight) || 0) > 0 && (Number(r.best.reps) || 0) > 0
      ? `${r.sets}× • Best ${Number(r.best.weight)}kg × ${Number(r.best.reps)}`
      : r.sets > 0
      ? `${r.sets} Satz${r.sets === 1 ? "" : "z"}`
      : "—";
    ctx.font = `400 22px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = theme.textMuted;
    ctx.fillText(detail, x + 64, ry + rowH / 2 + 18);

    // Volume on right
    if (r.volume > 0) {
      ctx.font = `600 26px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
      ctx.fillStyle = theme.textPrimary;
      ctx.textAlign = "right";
      ctx.fillText(`${formatKg(Math.round(r.volume))}`, x + w - 16, ry + rowH / 2);
    }
  });

  // "+N weitere"
  if (exercises.length > ranked.length) {
    ctx.font = `400 22px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
    ctx.fillStyle = theme.textMuted;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`+ ${exercises.length - ranked.length} weitere`, x + w / 2, y + h - 4);
  }
}

function drawSportHero(
  ctx: CanvasRenderingContext2D,
  icon: string,
  title: string,
  theme: ThemeDef,
  cx: number, cy: number,
) {
  ctx.textAlign = "center";

  ctx.save();
  ctx.font = `200px -apple-system, 'Apple Color Emoji', 'Helvetica Neue', Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = theme.textPrimary;
  ctx.globalAlpha = 0.85;
  ctx.fillText(icon, cx, cy - 40);
  ctx.restore();

  ctx.font = `600 44px -apple-system, 'Helvetica Neue', Arial, sans-serif`;
  ctx.fillStyle = theme.textPrimary;
  ctx.textBaseline = "top";
  ctx.fillText(truncate(ctx, title, 800), cx, cy + 100);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const candidate = text.slice(0, mid) + "…";
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}

function formatKg(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}t`;
  return `${Math.round(v)}kg`;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
