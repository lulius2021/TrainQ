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
  const sportIcon = sport === "laufen" ? "🏃" : sport === "radfahren" ? "🚴" : "💪";
  const sportLabel = sport === "laufen" ? "Laufen" : sport === "radfahren" ? "Radfahren" : (entry.sport ?? "Training");

  const hasRoute = Array.isArray(entry.gpsTrack) && entry.gpsTrack.length >= 2;
  const HEADER_H = 140;
  const FOOTER_H = 200;
  const routeAreaY = HEADER_H;
  const routeAreaH = H - HEADER_H - FOOTER_H;

  // ── Route area background panel ──────────────────────────────────────────────
  if (hasRoute) {
    ctx.fillStyle = t.canvasBg
      ? "rgba(0,0,0,0.12)"
      : "rgba(0,0,0,0.04)";
    if (theme === "light") ctx.fillStyle = "rgba(255,255,255,0.6)";
    roundRect(ctx, PAD / 2, routeAreaY + 8, W - PAD, routeAreaH - 16, 32);
    ctx.fill();

    drawRoute(ctx, entry.gpsTrack!, PAD * 1.5, routeAreaY + 24, W - PAD * 3, routeAreaH - 48, t);
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

  // ── Stats section ─────────────────────────────────────────────────────────────
  // Stat items depend on sport
  const stats: Array<{ value: string; label: string }> = [];

  if (entry.distanceKm != null && entry.distanceKm > 0) {
    stats.push({ value: entry.distanceKm.toFixed(2), label: "km" });
  }

  if (entry.durationSec > 0) {
    stats.push({ value: formatDuration(entry.durationSec), label: "Zeit" });
  }

  if (entry.paceSecPerKm != null && entry.paceSecPerKm > 0) {
    stats.push({ value: formatPace(entry.paceSecPerKm), label: "min/km" });
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
