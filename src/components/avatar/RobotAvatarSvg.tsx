// src/components/avatar/RobotAvatarSvg.tsx
// Programmatic SVG cyborg hero — athletic V-shape torso, sleek armor,
// glowing energy nodes. Evolves from small bot to armored superhero.

import React from "react";
import { motion } from "framer-motion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionSvg = motion.svg as any;

type Props = {
  stage: number; // 0-11
  variant: "bulk" | "speed";
  size?: number;
  animate?: boolean;
};

const PALETTES = {
  bulk: { glow: "#FF9F1C", glowBright: "#FFD166", accent: "#FF6B35" },
  speed: { glow: "#4CC9F0", glowBright: "#CAF0F8", accent: "#00B4D8" },
} as const;

const M = {
  body: "#1B1D2A",
  bodyLt: "#252840",
  metal: "#3A3D56",
  metalLt: "#5C5F7A",
  steel: "#6B6E8A",
} as const;

function tier(stage: number): "basic" | "mid" | "advanced" | "legendary" {
  if (stage <= 2) return "basic";
  if (stage <= 5) return "mid";
  if (stage <= 8) return "advanced";
  return "legendary";
}

function Glow({ cx, cy, r, color, i = 0.8 }: { cx: number; cy: number; r: number; color: string; i?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r * 2.5} fill={color} opacity={i * 0.15} />
      <circle cx={cx} cy={cy} r={r * 1.5} fill={color} opacity={i * 0.4} />
      <circle cx={cx} cy={cy} r={r} fill="#fff" opacity={i * 0.7} />
    </>
  );
}

export default function RobotAvatarSvg({ stage, variant, size = 120, animate = false }: Props) {
  const s = Math.max(0, Math.min(11, stage));
  const c = PALETTES[variant];
  const t = tier(s);
  const X = 60; // center

  const scale = 0.58 + (s / 11) * 0.47;

  // ── Hero proportions: wide chest, narrow waist, long legs ──
  const chestW = 22 + s * 2;          // shoulder/chest width
  const waistW = 16 + s * 1;          // narrow waist
  const torsoH = 26 + s * 1.5;        // torso height
  const torsoY = 42;                   // torso top

  const headW = 16 + s * 0.8;
  const headH = 14 + s * 0.5;
  const headY = torsoY - headH - (t === "basic" ? 1 : 3);

  // Slim athletic arms
  const armW = 4 + s * 0.5;
  const armH = 18 + s * 1.5;
  const armX_L = X - chestW / 2 - armW;
  const armX_R = X + chestW / 2;
  const armY = torsoY + 2;

  // Long athletic legs
  const legW = 5 + s * 0.5;
  const legH = 16 + s * 1;
  const legY = torsoY + torsoH;
  const legGap = 2 + s * 0.15;
  const footW = legW + 2 + s * 0.2;

  // Shoulders
  const shW = 5 + s * 0.8;
  const shH = 3.5 + s * 0.3;

  const Wrapper = animate ? MotionSvg : "svg";
  const animProps = animate
    ? { animate: { y: [0, -3, 0] }, transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" } }
    : {};
  const uid = `r${s}${variant[0]}`;

  return (
    <Wrapper viewBox="0 0 120 120" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" {...animProps}>
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={M.bodyLt} />
          <stop offset="100%" stopColor={M.body} />
        </linearGradient>
        <radialGradient id={`${uid}g`}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="30%" stopColor={c.glowBright} stopOpacity={0.8} />
          <stop offset="70%" stopColor={c.accent} stopOpacity={0.3} />
          <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${uid}e`}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="40%" stopColor={c.glow} stopOpacity={0.7} />
          <stop offset="100%" stopColor={c.accent} stopOpacity={0} />
        </radialGradient>
      </defs>

      <g transform={`translate(60,60) scale(${scale}) translate(-60,-60)`}>

        {/* ═══ LEGS ═══ */}
        {/* Left leg */}
        <path
          d={`M${X - legGap - legW},${legY} L${X - legGap},${legY} L${X - legGap + 1},${legY + legH} L${X - legGap - legW - 1},${legY + legH} Z`}
          fill={`url(#${uid}b)`} stroke={M.metal} strokeWidth={0.7}
        />
        {/* Right leg */}
        <path
          d={`M${X + legGap},${legY} L${X + legGap + legW},${legY} L${X + legGap + legW + 1},${legY + legH} L${X + legGap - 1},${legY + legH} Z`}
          fill={`url(#${uid}b)`} stroke={M.metal} strokeWidth={0.7}
        />
        {/* Leg armor (mid+) */}
        {t !== "basic" && (
          <>
            <rect x={X - legGap - legW + 1} y={legY + 2} width={legW - 2} height={3} rx={1} fill={M.metalLt} opacity={0.12} />
            <rect x={X + legGap + 1} y={legY + 2} width={legW - 2} height={3} rx={1} fill={M.metalLt} opacity={0.12} />
            <Glow cx={X - legGap - legW / 2} cy={legY + legH * 0.4} r={1 + s * 0.06} color={c.accent} i={0.5} />
            <Glow cx={X + legGap + legW / 2} cy={legY + legH * 0.4} r={1 + s * 0.06} color={c.accent} i={0.5} />
          </>
        )}
        {/* Shin plates (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <rect x={X - legGap - legW + 1} y={legY + legH * 0.55} width={legW - 1} height={legH * 0.3} rx={1} fill={M.metalLt} opacity={0.08} />
            <rect x={X + legGap + 1} y={legY + legH * 0.55} width={legW - 1} height={legH * 0.3} rx={1} fill={M.metalLt} opacity={0.08} />
          </>
        )}
        {/* Feet */}
        <rect x={X - legGap - legW / 2 - footW / 2} y={legY + legH} width={footW} height={3.5 + s * 0.15} rx={1.5} fill={M.metal} stroke={M.metalLt} strokeWidth={0.4} />
        <rect x={X + legGap + legW / 2 - footW / 2} y={legY + legH} width={footW} height={3.5 + s * 0.15} rx={1.5} fill={M.metal} stroke={M.metalLt} strokeWidth={0.4} />

        {/* ═══ TORSO — V-shaped (wide chest → narrow waist) ═══ */}
        <path
          d={`M${X - chestW / 2},${torsoY + 2}
              Q${X - chestW / 2 - 1},${torsoY} ${X - chestW / 2 + 2},${torsoY}
              L${X + chestW / 2 - 2},${torsoY}
              Q${X + chestW / 2 + 1},${torsoY} ${X + chestW / 2},${torsoY + 2}
              L${X + waistW / 2},${torsoY + torsoH}
              L${X - waistW / 2},${torsoY + torsoH} Z`}
          fill={`url(#${uid}b)`}
          stroke={M.metal}
          strokeWidth={1.2}
        />

        {/* ── Chest V-line (mid+) ── */}
        {t !== "basic" && (
          <>
            <line x1={X} y1={torsoY + 3} x2={X - chestW / 3} y2={torsoY + torsoH * 0.45} stroke={M.metalLt} strokeWidth={0.5} opacity={0.2} />
            <line x1={X} y1={torsoY + 3} x2={X + chestW / 3} y2={torsoY + torsoH * 0.45} stroke={M.metalLt} strokeWidth={0.5} opacity={0.2} />
          </>
        )}

        {/* ── Pec plates (mid+) ── */}
        {t !== "basic" && (
          <>
            <path
              d={`M${X - 1},${torsoY + 3} L${X - chestW / 2 + 4},${torsoY + 5} L${X - chestW / 3},${torsoY + torsoH * 0.4} L${X - 2},${torsoY + torsoH * 0.35} Z`}
              fill={M.metalLt} opacity={0.1} stroke={M.steel} strokeWidth={0.3} strokeOpacity={0.12}
            />
            <path
              d={`M${X + 1},${torsoY + 3} L${X + chestW / 2 - 4},${torsoY + 5} L${X + chestW / 3},${torsoY + torsoH * 0.4} L${X + 2},${torsoY + torsoH * 0.35} Z`}
              fill={M.metalLt} opacity={0.1} stroke={M.steel} strokeWidth={0.3} strokeOpacity={0.12}
            />
          </>
        )}

        {/* ── Ab segments (advanced+) ── */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <line x1={X} y1={torsoY + torsoH * 0.45} x2={X} y2={torsoY + torsoH - 4} stroke={M.metalLt} strokeWidth={0.4} opacity={0.18} />
            {[0.52, 0.62, 0.72].map((f, i) => {
              const w = waistW / 2 + (chestW / 2 - waistW / 2) * (1 - f) * 0.8;
              return (
                <React.Fragment key={i}>
                  <rect x={X - w + 2} y={torsoY + torsoH * f} width={w - 3} height={torsoH * 0.06} rx={0.8} fill={M.metalLt} opacity={0.07} />
                  <rect x={X + 1} y={torsoY + torsoH * f} width={w - 3} height={torsoH * 0.06} rx={0.8} fill={M.metalLt} opacity={0.07} />
                </React.Fragment>
              );
            })}
          </>
        )}

        {/* ══ ARC REACTOR ══ */}
        {s === 0 ? (
          <circle cx={X} cy={torsoY + torsoH * 0.25} r={1.5} fill={c.accent} opacity={0.3} />
        ) : t === "basic" ? (
          <>
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={3} fill={c.accent} opacity={0.12} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={1.5} fill={c.glow} opacity={0.6} />
          </>
        ) : t === "mid" ? (
          <>
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={3.5 + (s - 3) * 0.4} fill={`url(#${uid}g)`} opacity={0.5} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={2 + (s - 3) * 0.2} fill="none" stroke={c.accent} strokeWidth={0.5} opacity={0.4} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={1} fill="#fff" opacity={0.8} />
          </>
        ) : (
          <>
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={5 + (s - 6) * 0.4} fill={`url(#${uid}g)`} opacity={0.35} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={3.5 + (s - 6) * 0.3} fill="none" stroke={c.accent} strokeWidth={0.6} opacity={0.35} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={2 + (s - 6) * 0.15} fill="none" stroke={c.glow} strokeWidth={0.4} opacity={0.45} />
            <circle cx={X} cy={torsoY + torsoH * 0.25} r={1.2} fill="#fff" opacity={0.9} />
            {t === "legendary" && [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const cY = torsoY + torsoH * 0.25;
              return (
                <line key={deg}
                  x1={X + Math.cos(rad) * 2} y1={cY + Math.sin(rad) * 2}
                  x2={X + Math.cos(rad) * (4 + (s - 9) * 0.3)} y2={cY + Math.sin(rad) * (4 + (s - 9) * 0.3)}
                  stroke={c.glow} strokeWidth={0.4} opacity={0.3}
                />
              );
            })}
          </>
        )}

        {/* Pec glow nodes (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <Glow cx={X - chestW / 3} cy={torsoY + 8} r={0.9 + s * 0.04} color={c.accent} i={0.45} />
            <Glow cx={X + chestW / 3} cy={torsoY + 8} r={0.9 + s * 0.04} color={c.accent} i={0.45} />
          </>
        )}

        {/* Belt (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <rect x={X - waistW / 2 + 1} y={torsoY + torsoH - 4} width={waistW - 2} height={3} rx={1.5} fill={M.metal} opacity={0.25} />
            <Glow cx={X} cy={torsoY + torsoH - 2.5} r={0.8 + s * 0.04} color={c.accent} i={0.45} />
          </>
        )}

        {/* ═══ ARMS ═══ */}
        <rect x={armX_L} y={armY} width={armW} height={armH} rx={armW / 2} fill={`url(#${uid}b)`} stroke={M.metal} strokeWidth={0.7} />
        <rect x={armX_R} y={armY} width={armW} height={armH} rx={armW / 2} fill={`url(#${uid}b)`} stroke={M.metal} strokeWidth={0.7} />
        {/* Bicep (mid+) */}
        {t !== "basic" && (
          <>
            <ellipse cx={armX_L + armW / 2} cy={armY + armH * 0.25} rx={armW / 2 + 0.8 + s * 0.1} ry={2.5 + s * 0.15} fill={M.body} stroke={M.metal} strokeWidth={0.4} />
            <ellipse cx={armX_R + armW / 2} cy={armY + armH * 0.25} rx={armW / 2 + 0.8 + s * 0.1} ry={2.5 + s * 0.15} fill={M.body} stroke={M.metal} strokeWidth={0.4} />
          </>
        )}
        {/* Forearm plate (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <rect x={armX_L + 0.5} y={armY + armH * 0.55} width={armW - 1} height={armH * 0.22} rx={1} fill={M.metalLt} opacity={0.1} />
            <rect x={armX_R + 0.5} y={armY + armH * 0.55} width={armW - 1} height={armH * 0.22} rx={1} fill={M.metalLt} opacity={0.1} />
          </>
        )}
        {/* Elbow glow (mid+) */}
        {t !== "basic" && (
          <>
            <Glow cx={armX_L + armW / 2} cy={armY + armH * 0.45} r={0.8 + s * 0.05} color={c.accent} i={0.5} />
            <Glow cx={armX_R + armW / 2} cy={armY + armH * 0.45} r={0.8 + s * 0.05} color={c.accent} i={0.5} />
          </>
        )}
        {/* Hands */}
        <circle cx={armX_L + armW / 2} cy={armY + armH + 1.5 + s * 0.15} r={2 + s * 0.2} fill={M.metal} stroke={M.metalLt} strokeWidth={0.3} />
        <circle cx={armX_R + armW / 2} cy={armY + armH + 1.5 + s * 0.15} r={2 + s * 0.2} fill={M.metal} stroke={M.metalLt} strokeWidth={0.3} />

        {/* ═══ SHOULDERS ═══ */}
        <ellipse cx={X - chestW / 2} cy={armY + 1} rx={shW * 0.5} ry={shH * 0.5} fill={M.metal} opacity={0.4} />
        <ellipse cx={X + chestW / 2} cy={armY + 1} rx={shW * 0.5} ry={shH * 0.5} fill={M.metal} opacity={0.4} />
        {t !== "basic" && (
          <>
            <ellipse cx={X - chestW / 2 - 1} cy={armY} rx={shW} ry={shH} fill={M.bodyLt} stroke={M.metalLt} strokeWidth={0.4} opacity={0.65} />
            <ellipse cx={X + chestW / 2 + 1} cy={armY} rx={shW} ry={shH} fill={M.bodyLt} stroke={M.metalLt} strokeWidth={0.4} opacity={0.65} />
            <Glow cx={X - chestW / 2 - 1} cy={armY} r={1 + s * 0.06} color={c.accent} i={0.55} />
            <Glow cx={X + chestW / 2 + 1} cy={armY} r={1 + s * 0.06} color={c.accent} i={0.55} />
          </>
        )}
        {(t === "advanced" || t === "legendary") && (
          <>
            <ellipse cx={X - chestW / 2 - 1} cy={armY - 1} rx={shW + 1.5} ry={shH + 1} fill={M.body} stroke={M.metalLt} strokeWidth={0.3} opacity={0.4} />
            <ellipse cx={X + chestW / 2 + 1} cy={armY - 1} rx={shW + 1.5} ry={shH + 1} fill={M.body} stroke={M.metalLt} strokeWidth={0.3} opacity={0.4} />
          </>
        )}
        {t === "legendary" && (
          <>
            <polygon points={`${X - chestW / 2 - shW},${armY} ${X - chestW / 2 - shW - 3},${armY - shH - 3} ${X - chestW / 2 - shW + 4},${armY - 1}`} fill={M.metalLt} opacity={0.25} />
            <polygon points={`${X + chestW / 2 + shW},${armY} ${X + chestW / 2 + shW + 3},${armY - shH - 3} ${X + chestW / 2 + shW - 4},${armY - 1}`} fill={M.metalLt} opacity={0.25} />
          </>
        )}

        {/* ═══ NECK ═══ */}
        <rect x={X - (1.5 + s * 0.12)} y={headY + headH - 1} width={(1.5 + s * 0.12) * 2} height={torsoY - headY - headH + 3} rx={1.2} fill={M.body} stroke={M.metal} strokeWidth={0.3} />

        {/* ═══ HEAD ═══ */}
        <rect x={X - headW / 2} y={headY} width={headW} height={headH} rx={3.5 + s * 0.15} fill={`url(#${uid}b)`} stroke={M.metal} strokeWidth={1} />
        <rect x={X - headW / 2 + 2} y={headY + 2} width={headW - 4} height={headH * 0.45} rx={2} fill={M.bodyLt} opacity={0.25} />

        {/* Side head plates (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <rect x={X - headW / 2 - 1} y={headY + 3} width={2} height={headH - 6} rx={0.8} fill={M.metal} opacity={0.35} />
            <rect x={X + headW / 2 - 1} y={headY + 3} width={2} height={headH - 6} rx={0.8} fill={M.metal} opacity={0.35} />
            <Glow cx={X - headW / 2} cy={headY + headH * 0.4} r={0.7} color={c.accent} i={0.45} />
            <Glow cx={X + headW / 2} cy={headY + headH * 0.4} r={0.7} color={c.accent} i={0.45} />
          </>
        )}
        {t !== "basic" && (
          <rect x={X - headW / 2 + 3} y={headY + headH - 3.5} width={headW - 6} height={2} rx={0.8} fill={M.metal} opacity={0.18} />
        )}

        {/* ── EYES ── */}
        {t === "basic" ? (
          <>
            <circle cx={X - headW * 0.18} cy={headY + headH * 0.37} r={1.6 + s * 0.12} fill={c.accent} />
            <circle cx={X + headW * 0.18} cy={headY + headH * 0.37} r={1.6 + s * 0.12} fill={c.accent} />
            <circle cx={X - headW * 0.18} cy={headY + headH * 0.37} r={0.7} fill="#fff" opacity={0.5} />
            <circle cx={X + headW * 0.18} cy={headY + headH * 0.37} r={0.7} fill="#fff" opacity={0.5} />
          </>
        ) : t === "mid" ? (
          <>
            <rect x={X - headW * 0.22 - 2.5} y={headY + headH * 0.3} width={5 + s * 0.15} height={3} rx={0.8} fill={c.glow} />
            <rect x={X + headW * 0.22 - 2.5} y={headY + headH * 0.3} width={5 + s * 0.15} height={3} rx={0.8} fill={c.glow} />
            <rect x={X - headW * 0.22 - 1} y={headY + headH * 0.3 + 0.4} width={1.5} height={1.2} rx={0.4} fill="#fff" opacity={0.5} />
            <rect x={X + headW * 0.22 - 1} y={headY + headH * 0.3 + 0.4} width={1.5} height={1.2} rx={0.4} fill="#fff" opacity={0.5} />
            <rect x={X - headW * 0.22 - 4} y={headY + headH * 0.3 - 1} width={8 + s * 0.15} height={5} rx={1.5} fill={c.accent} opacity={0.08} />
            <rect x={X + headW * 0.22 - 4} y={headY + headH * 0.3 - 1} width={8 + s * 0.15} height={5} rx={1.5} fill={c.accent} opacity={0.08} />
          </>
        ) : (
          <>
            <rect x={X - headW * 0.24 - 4} y={headY + headH * 0.27 - 1} width={8 + s * 0.2} height={5.5} rx={1.5} fill={c.accent} opacity={0.06} />
            <rect x={X + headW * 0.24 - 4} y={headY + headH * 0.27 - 1} width={8 + s * 0.2} height={5.5} rx={1.5} fill={c.accent} opacity={0.06} />
            <rect x={X - headW * 0.24 - 3} y={headY + headH * 0.27} width={6 + s * 0.15} height={3.5} rx={1.2} fill={`url(#${uid}e)`} />
            <rect x={X + headW * 0.24 - 3} y={headY + headH * 0.27} width={6 + s * 0.15} height={3.5} rx={1.2} fill={`url(#${uid}e)`} />
            <rect x={X - headW * 0.24 - 1.5} y={headY + headH * 0.27 + 0.8} width={3.5} height={1.5} rx={0.6} fill="#fff" opacity={0.65} />
            <rect x={X + headW * 0.24 - 1.5} y={headY + headH * 0.27 + 0.8} width={3.5} height={1.5} rx={0.6} fill="#fff" opacity={0.65} />
            {t === "legendary" && (
              <rect x={X - headW / 2 + 3} y={headY + headH * 0.27 + 1} width={headW - 6} height={1.5} rx={0.6} fill={c.accent} opacity={0.08} />
            )}
          </>
        )}

        {/* ═══ ANTENNA / SENSORS ═══ */}
        {t === "mid" && (
          <>
            <line x1={X} y1={headY} x2={X} y2={headY - 6} stroke={M.metalLt} strokeWidth={1} />
            <Glow cx={X} cy={headY - 7} r={1.2} color={c.accent} i={0.65} />
          </>
        )}
        {t === "advanced" && (
          <>
            <line x1={X} y1={headY} x2={X} y2={headY - 8} stroke={M.metalLt} strokeWidth={1.1} />
            <Glow cx={X} cy={headY - 9} r={1.5} color={c.glow} i={0.75} />
            <line x1={X - headW / 2} y1={headY + 2} x2={X - headW / 2 - 3} y2={headY - 2} stroke={M.metalLt} strokeWidth={0.7} />
            <line x1={X + headW / 2} y1={headY + 2} x2={X + headW / 2 + 3} y2={headY - 2} stroke={M.metalLt} strokeWidth={0.7} />
            <Glow cx={X - headW / 2 - 3} cy={headY - 2} r={0.8} color={c.accent} i={0.45} />
            <Glow cx={X + headW / 2 + 3} cy={headY - 2} r={0.8} color={c.accent} i={0.45} />
          </>
        )}
        {t === "legendary" && (
          <>
            <line x1={X} y1={headY} x2={X} y2={headY - 9} stroke={M.steel} strokeWidth={1.3} />
            <Glow cx={X} cy={headY - 10} r={1.8} color={c.glowBright} i={0.85} />
            <line x1={X - headW / 2 + 1} y1={headY + 1} x2={X - headW / 2 - 6} y2={headY - 8} stroke={M.steel} strokeWidth={1.1} />
            <line x1={X + headW / 2 - 1} y1={headY + 1} x2={X + headW / 2 + 6} y2={headY - 8} stroke={M.steel} strokeWidth={1.1} />
            <Glow cx={X - headW / 2 - 6} cy={headY - 8} r={1} color={c.glow} i={0.6} />
            <Glow cx={X + headW / 2 + 6} cy={headY - 8} r={1} color={c.glow} i={0.6} />
          </>
        )}

        {/* ═══ BACK WINGS (legendary) ═══ */}
        {t === "legendary" && (
          <>
            <path d={`M${X - chestW / 2},${torsoY + 3} L${X - chestW / 2 - 10},${torsoY - 5} L${X - chestW / 2 - 6},${torsoY + 12} Z`} fill={M.metalLt} opacity={0.18} stroke={M.steel} strokeWidth={0.3} strokeOpacity={0.2} />
            <path d={`M${X + chestW / 2},${torsoY + 3} L${X + chestW / 2 + 10},${torsoY - 5} L${X + chestW / 2 + 6},${torsoY + 12} Z`} fill={M.metalLt} opacity={0.18} stroke={M.steel} strokeWidth={0.3} strokeOpacity={0.2} />
          </>
        )}

        {/* ═══ STAGE BADGE ═══ */}
        {s > 0 && (
          <g>
            <circle cx={X + headW / 2 + 3} cy={headY + 2} r={4} fill={c.accent} opacity={0.85} />
            <text x={X + headW / 2 + 3} y={headY + 4.8} textAnchor="middle" fontSize={5} fontWeight="bold" fill="#fff">{s}</text>
          </g>
        )}
      </g>
    </Wrapper>
  );
}
