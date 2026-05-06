import React, { useMemo } from "react";

export type RoutePoint = { lat: number; lng: number };

type Props = {
  points: RoutePoint[];
  /** Height of the SVG in px (width is always 100%) */
  height?: number;
  /** Whether to show the pulsing current-position dot */
  showLiveDot?: boolean;
};

export default function RouteSVG({ points, height = 160, showLiveDot = false }: Props) {
  const layout = useMemo(() => {
    if (points.length < 2) return null;

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const W = 320;
    const H = height;
    const pad = 16;

    const latRange = maxLat - minLat || 0.0001;
    const lngRange = maxLng - minLng || 0.0001;
    const scaleX = (W - pad * 2) / lngRange;
    const scaleY = (H - pad * 2) / latRange;
    const scale = Math.min(scaleX, scaleY);

    const usedW = lngRange * scale;
    const usedH = latRange * scale;
    const offsetX = (W - usedW) / 2;
    const offsetY = (H - usedH) / 2;

    const toX = (lng: number) => offsetX + (lng - minLng) * scale;
    const toY = (lat: number) => H - offsetY - (lat - minLat) * scale;

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.lng).toFixed(1)} ${toY(p.lat).toFixed(1)}`)
      .join(" ");

    return { d, W, H, start: points[0], end: points[points.length - 1], toX, toY };
  }, [points, height]);

  if (!layout) return null;

  const { d, W, H, start, end, toX, toY } = layout;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxHeight: height }}
    >
      <defs>
        <filter id="routeGlow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Route line — solid blue */}
      <path
        d={d}
        stroke="#3b82f6"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#routeGlow)"
      />

      {/* Start dot — green */}
      <circle
        cx={toX(start.lng)}
        cy={toY(start.lat)}
        r="4.5"
        fill="#22c55e"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="1.5"
      />

      {showLiveDot ? (
        /* Live pulsing dot at current position */
        <>
          <circle cx={toX(end.lng)} cy={toY(end.lat)} r="7" fill="#3b82f6" opacity="0.2">
            <animate attributeName="r" values="5;11;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={toX(end.lng)}
            cy={toY(end.lat)}
            r="5"
            fill="#60a5fa"
            stroke="white"
            strokeWidth="1.5"
          />
        </>
      ) : (
        /* Static end dot for history view */
        <circle
          cx={toX(end.lng)}
          cy={toY(end.lat)}
          r="4.5"
          fill="#3b82f6"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
