// src/components/avatar/RobotAvatarSvg.tsx
// Programmatic SVG robot avatar that visually evolves through 12 stages.

import React from "react";
import { motion } from "framer-motion";

// Workaround for Framer Motion typing issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionSvg = motion.svg as any;

type Props = {
  stage: number; // 0-11
  variant: "bulk" | "speed";
  size?: number;
  animate?: boolean;
};

// Color palettes per variant
const PALETTES = {
  bulk: {
    primary: "#FF6B35",    // warm orange
    secondary: "#E63946",  // red accent
    glow: "#FF9F1C",       // amber glow
    metal: "#8D99AE",      // steel
    dark: "#2B2D42",       // dark body
    highlight: "#FFD166",  // gold highlight
  },
  speed: {
    primary: "#00B4D8",    // cyan
    secondary: "#0077B6",  // deep blue
    glow: "#90E0EF",       // light cyan glow
    metal: "#8D99AE",      // steel
    dark: "#2B2D42",       // dark body
    highlight: "#CAF0F8",  // ice highlight
  },
} as const;

// Tier → how many features to show
function tier(stage: number): "basic" | "mid" | "advanced" | "legendary" {
  if (stage <= 2) return "basic";
  if (stage <= 5) return "mid";
  if (stage <= 8) return "advanced";
  return "legendary";
}

export default function RobotAvatarSvg({ stage, variant, size = 120, animate = false }: Props) {
  const s = Math.max(0, Math.min(11, stage));
  const p = PALETTES[variant];
  const t = tier(s);
  const isBulk = variant === "bulk";

  // Scale factor for progressive growth: 0.85 at stage 0, 1.0 at stage 11
  const scale = 0.85 + (s / 11) * 0.15;
  // Body width varies by variant and stage
  const bodyW = isBulk ? 36 + s * 1.5 : 30 + s * 0.8;
  const bodyH = 40 + s * 1;
  const headSize = 22 + s * 0.5;

  const Wrapper = animate ? MotionSvg : "svg";
  const animProps = animate
    ? {
        animate: { y: [0, -3, 0] },
        transition: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
      }
    : {};

  return (
    <Wrapper
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...animProps}
    >
      <g transform={`translate(60,60) scale(${scale}) translate(-60,-60)`}>
        {/* ── LEGS ── */}
        <rect x={42} y={85} width={isBulk ? 12 : 9} height={16} rx={3} fill={p.dark} />
        <rect x={120 - 42 - (isBulk ? 12 : 9)} y={85} width={isBulk ? 12 : 9} height={16} rx={3} fill={p.dark} />
        {/* Feet */}
        <rect x={40} y={97} width={isBulk ? 16 : 13} height={6} rx={3} fill={p.metal} />
        <rect x={120 - 40 - (isBulk ? 16 : 13)} y={97} width={isBulk ? 16 : 13} height={6} rx={3} fill={p.metal} />
        {t !== "basic" && (
          <>
            {/* Knee joints */}
            <circle cx={48} cy={88} r={3} fill={p.primary} opacity={0.6} />
            <circle cx={72} cy={88} r={3} fill={p.primary} opacity={0.6} />
          </>
        )}

        {/* ── BODY / TORSO ── */}
        <rect
          x={60 - bodyW / 2}
          y={50}
          width={bodyW}
          height={bodyH}
          rx={isBulk ? 8 : 12}
          fill={p.dark}
          stroke={p.metal}
          strokeWidth={1.5}
        />
        {/* Chest plate */}
        {t !== "basic" && (
          <rect
            x={60 - bodyW / 2 + 5}
            y={55}
            width={bodyW - 10}
            height={bodyH - 15}
            rx={isBulk ? 5 : 8}
            fill={p.primary}
            opacity={0.15}
          />
        )}
        {/* Energy core (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <circle cx={60} cy={68} r={6 + s * 0.3} fill={p.glow} opacity={0.3} />
            <circle cx={60} cy={68} r={3 + s * 0.15} fill={p.glow} opacity={0.7} />
          </>
        )}
        {/* Legendary core ring */}
        {t === "legendary" && (
          <circle cx={60} cy={68} r={9} fill="none" stroke={p.highlight} strokeWidth={1} opacity={0.5} />
        )}

        {/* ── ARMS ── */}
        {/* Left arm */}
        <rect
          x={60 - bodyW / 2 - (isBulk ? 11 : 8)}
          y={54}
          width={isBulk ? 10 : 7}
          height={isBulk ? 28 + s : 24 + s * 0.5}
          rx={isBulk ? 5 : 3.5}
          fill={p.dark}
          stroke={p.metal}
          strokeWidth={1}
        />
        {/* Right arm */}
        <rect
          x={60 + bodyW / 2 + 1}
          y={54}
          width={isBulk ? 10 : 7}
          height={isBulk ? 28 + s : 24 + s * 0.5}
          rx={isBulk ? 5 : 3.5}
          fill={p.dark}
          stroke={p.metal}
          strokeWidth={1}
        />
        {/* Hands */}
        <circle cx={60 - bodyW / 2 - (isBulk ? 6 : 4.5)} cy={83 + (isBulk ? s : s * 0.5)} r={isBulk ? 5 : 3.5} fill={p.metal} />
        <circle cx={60 + bodyW / 2 + (isBulk ? 6 : 4.5)} cy={83 + (isBulk ? s : s * 0.5)} r={isBulk ? 5 : 3.5} fill={p.metal} />

        {/* Shoulder pads (mid+) */}
        {t !== "basic" && (
          <>
            <ellipse cx={60 - bodyW / 2 - 2} cy={54} rx={isBulk ? 8 : 5} ry={5} fill={p.primary} opacity={0.5} />
            <ellipse cx={60 + bodyW / 2 + 2} cy={54} rx={isBulk ? 8 : 5} ry={5} fill={p.primary} opacity={0.5} />
          </>
        )}
        {/* Shoulder armor (advanced+) */}
        {(t === "advanced" || t === "legendary") && (
          <>
            <ellipse cx={60 - bodyW / 2 - 2} cy={54} rx={isBulk ? 10 : 7} ry={6} fill={p.primary} opacity={0.3} />
            <ellipse cx={60 + bodyW / 2 + 2} cy={54} rx={isBulk ? 10 : 7} ry={6} fill={p.primary} opacity={0.3} />
          </>
        )}

        {/* ── HEAD ── */}
        <rect
          x={60 - headSize / 2}
          y={50 - headSize - 4}
          width={headSize}
          height={headSize}
          rx={isBulk ? 6 : 8}
          fill={p.dark}
          stroke={p.metal}
          strokeWidth={1.5}
        />
        {/* Visor / face plate */}
        <rect
          x={60 - headSize / 2 + 3}
          y={50 - headSize - 1}
          width={headSize - 6}
          height={headSize * 0.55}
          rx={4}
          fill={p.primary}
          opacity={0.15}
        />

        {/* ── EYES ── */}
        {t === "basic" ? (
          <>
            {/* Simple dot eyes */}
            <circle cx={53} cy={35} r={2.5} fill={p.primary} />
            <circle cx={67} cy={35} r={2.5} fill={p.primary} />
          </>
        ) : t === "mid" ? (
          <>
            {/* Glowing rectangular eyes */}
            <rect x={50} y={33} width={7} height={4} rx={1} fill={p.primary} />
            <rect x={63} y={33} width={7} height={4} rx={1} fill={p.primary} />
          </>
        ) : (
          <>
            {/* Bright glowing eyes with outer glow */}
            <rect x={49} y={32} width={8} height={5} rx={1.5} fill={p.glow} />
            <rect x={63} y={32} width={8} height={5} rx={1.5} fill={p.glow} />
            <rect x={49} y={32} width={8} height={5} rx={1.5} fill={p.primary} opacity={0.5} />
            <rect x={63} y={32} width={8} height={5} rx={1.5} fill={p.primary} opacity={0.5} />
          </>
        )}

        {/* ── ANTENNA (mid+) ── */}
        {t !== "basic" && (
          <>
            <line x1={60} y1={50 - headSize - 4} x2={60} y2={50 - headSize - 12} stroke={p.metal} strokeWidth={1.5} />
            <circle cx={60} cy={50 - headSize - 13} r={2.5} fill={t === "legendary" ? p.highlight : p.primary} />
          </>
        )}

        {/* ── WINGS / JETS (legendary) ── */}
        {t === "legendary" && (
          <>
            {/* Left wing/jet */}
            <path
              d={isBulk
                ? "M28,50 L15,38 L18,55 Z"
                : "M30,48 L14,32 L20,52 Z"
              }
              fill={p.primary}
              opacity={0.4}
            />
            <path
              d={isBulk
                ? "M28,52 L12,42 L18,58 Z"
                : "M30,50 L12,36 L20,54 Z"
              }
              fill={p.secondary}
              opacity={0.2}
            />
            {/* Right wing/jet */}
            <path
              d={isBulk
                ? "M92,50 L105,38 L102,55 Z"
                : "M90,48 L106,32 L100,52 Z"
              }
              fill={p.primary}
              opacity={0.4}
            />
            <path
              d={isBulk
                ? "M92,52 L108,42 L102,58 Z"
                : "M90,50 L108,36 L100,54 Z"
              }
              fill={p.secondary}
              opacity={0.2}
            />
            {/* Jet exhaust lines */}
            {!isBulk && (
              <>
                <line x1={44} y1={100} x2={44} y2={108} stroke={p.glow} strokeWidth={2} opacity={0.4} />
                <line x1={76} y1={100} x2={76} y2={108} stroke={p.glow} strokeWidth={2} opacity={0.4} />
              </>
            )}
          </>
        )}

        {/* ── ARMOR PLATING (advanced+) ── */}
        {(t === "advanced" || t === "legendary") && (
          <>
            {/* Belt / waist armor */}
            <rect
              x={60 - bodyW / 2 + 2}
              y={78}
              width={bodyW - 4}
              height={5}
              rx={2}
              fill={p.primary}
              opacity={0.35}
            />
          </>
        )}

        {/* ── SPEED VARIANT: lightning accents ── */}
        {!isBulk && t !== "basic" && (
          <>
            <path d="M55,60 L58,65 L55,65 L58,72" stroke={p.glow} strokeWidth={1.2} fill="none" opacity={0.6} />
            <path d="M62,58 L65,63 L62,63 L65,70" stroke={p.glow} strokeWidth={1.2} fill="none" opacity={0.6} />
          </>
        )}

        {/* ── BULK VARIANT: weight plate indicators ── */}
        {isBulk && t !== "basic" && (
          <>
            <circle cx={60} cy={78} r={2} fill={p.glow} opacity={0.5} />
            {(t === "advanced" || t === "legendary") && (
              <>
                <circle cx={54} cy={78} r={1.5} fill={p.glow} opacity={0.4} />
                <circle cx={66} cy={78} r={1.5} fill={p.glow} opacity={0.4} />
              </>
            )}
          </>
        )}

        {/* ── STAGE BADGE (small indicator) ── */}
        {s > 0 && (
          <g>
            <circle cx={60 + bodyW / 2 - 2} cy={50 - headSize / 2 - 4} r={5} fill={p.primary} opacity={0.8} />
            <text
              x={60 + bodyW / 2 - 2}
              y={50 - headSize / 2 - 1}
              textAnchor="middle"
              fontSize={6}
              fontWeight="bold"
              fill="#fff"
            >
              {s}
            </text>
          </g>
        )}
      </g>
    </Wrapper>
  );
}
