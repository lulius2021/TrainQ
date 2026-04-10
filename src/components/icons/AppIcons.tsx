// src/components/icons/AppIcons.tsx
// Custom icon components for TrainQ — replaces all emoji usage in the app.
// Use Lucide icons where available; custom SVGs for everything else.

import React from "react";
import {
  Dumbbell, Zap, Target, Brain, Flame, Wind, Bike,
  Trophy, Briefcase, Sprout, Camera, MapPin, Bell,
  Lightbulb, TriangleAlert, Info, Rocket, Sparkles,
  Activity,
} from "lucide-react";

// ─── Re-exports for convenience ───────────────────────────────────────────────

export {
  Dumbbell, Zap, Target, Brain, Flame, Wind, Bike,
  Trophy, Briefcase, Sprout, Camera, MapPin, Bell,
  Lightbulb, TriangleAlert, Info, Rocket, Sparkles,
  Activity,
};

// ─── Custom SVG Icons ─────────────────────────────────────────────────────────

export const BicepIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Forearm */}
    <path d="M3 16 L8 14" />
    {/* Elbow to upper arm */}
    <path d="M8 14 C9 13 10 11 10 10" />
    {/* Bicep peak */}
    <path d="M10 10 C10 7 13 5 16 7 C18 8 18 11 17 13" />
    {/* Shoulder */}
    <path d="M17 13 C18 13 20 12 21 11" />
    {/* Forearm end / fist hint */}
    <path d="M3 16 L3 18" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const RunnerIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Head */}
    <circle cx="15" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
    {/* Torso leaning forward */}
    <line x1="15" y1="5" x2="11" y2="11" />
    {/* Front arm (back-swinging) */}
    <line x1="13" y1="7.5" x2="10" y2="5.5" />
    {/* Back arm (forward-swinging) */}
    <line x1="12" y1="9.5" x2="15" y2="12" />
    {/* Front leg (stepping forward) */}
    <line x1="11" y1="11" x2="8.5" y2="17" />
    <line x1="8.5" y1="17" x2="6" y2="21" />
    {/* Back leg (trailing) */}
    <line x1="11" y1="11" x2="13.5" y2="17" />
    <line x1="13.5" y1="17" x2="17" y2="20" />
  </svg>
);

export const SwimmerIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Head */}
    <circle cx="18.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    {/* Body horizontal */}
    <line x1="18.5" y1="9" x2="7" y2="13" />
    {/* Reaching arm forward */}
    <line x1="7" y1="13" x2="3.5" y2="10.5" />
    {/* Trailing arm above body */}
    <line x1="13" y1="11" x2="15" y2="8" />
    {/* Kick legs */}
    <line x1="7" y1="13" x2="8.5" y2="17" />
    <line x1="7" y1="13" x2="5" y2="16" />
    {/* Water line */}
    <path d="M2 15 Q5 14 8 15 Q11 16 14 15 Q17 14 20 15" opacity="0.4" />
  </svg>
);

export const SkierIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Head */}
    <circle cx="14" cy="3.5" r="1.5" fill="currentColor" stroke="none" />
    {/* Crouching body */}
    <line x1="14" y1="5" x2="10" y2="11" />
    {/* Right arm with pole */}
    <line x1="12" y1="8" x2="16" y2="9" />
    <line x1="16" y1="9" x2="17.5" y2="17" />
    {/* Left arm with pole */}
    <line x1="12" y1="8" x2="9" y2="7" />
    <line x1="9" y1="7" x2="7" y2="15" />
    {/* Legs */}
    <line x1="10" y1="11" x2="8.5" y2="17" />
    <line x1="10" y1="11" x2="12" y2="17" />
    {/* Skis */}
    <path d="M6 18.5 L11 18.5 L12.5 18" strokeWidth="2.5" />
    <path d="M10 18.5 L15 18.5 L17 18" strokeWidth="2.5" />
  </svg>
);

// ─── Parametric Face Icons ─────────────────────────────────────────────────────

/** Interpolates a hex color from red (level 1) through yellow (5) to green (10) */
function moodColor(level: number): string {
  const t = (Math.max(1, Math.min(10, level)) - 1) / 9;
  if (t < 0.5) {
    // red → yellow
    const s = t * 2;
    const r = 239;
    const g = Math.round(68 + (188 - 68) * s);
    const b = Math.round(68 + (10 - 68) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    // yellow → green
    const s = (t - 0.5) * 2;
    const r = Math.round(239 + (34 - 239) * s);
    const g = Math.round(188 + (197 - 188) * s);
    const b = Math.round(10 + (94 - 10) * s);
    return `rgb(${r},${g},${b})`;
  }
}

/** Parametric mood face — level 1 (sad) to 10 (very happy) */
export const MoodFaceIcon: React.FC<{ level: number; size?: number }> = ({
  level,
  size = 28,
}) => {
  const color = moodColor(level);
  const t = (Math.max(1, Math.min(10, level)) - 1) / 9;
  // Mouth curve: +3.5 = sad (control point below baseline), -3.5 = happy (above baseline)
  const curve = 3.5 - t * 7;
  const mouthPath = `M8,17 Q12,${(17 + curve).toFixed(1)} 16,17`;
  // Eyebrows: sad = inner brow raised (anguish), happy = lifted
  const browOffset = 3 - t * 2; // 3 = low/sad, 1 = lifted
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Face */}
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.12" />
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
      {/* Eyebrows */}
      <path
        d={`M7,${(9.5 - browOffset + 1).toFixed(1)} Q8.5,${(9.5 - browOffset).toFixed(1)} 10,${(9.5 - browOffset + 0.5).toFixed(1)}`}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M14,${(9.5 - browOffset + 0.5).toFixed(1)} Q15.5,${(9.5 - browOffset).toFixed(1)} 17,${(9.5 - browOffset + 1).toFixed(1)}`}
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Eyes */}
      <circle cx="8.5" cy="12" r="1" fill={color} />
      <circle cx="15.5" cy="12" r="1" fill={color} />
      {/* Mouth */}
      <path
        d={mouthPath}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

/** Parametric sleep-quality face — level 1 (terrible sleep) to 10 (best sleep) */
export const SleepFaceIcon: React.FC<{ level: number; size?: number }> = ({
  level,
  size = 28,
}) => {
  const color = moodColor(level);
  const t = (Math.max(1, Math.min(10, level)) - 1) / 9;
  const curve = 3.5 - t * 7;
  const mouthPath = `M8,17 Q12,${(17 + curve).toFixed(1)} 16,17`;
  // Low level: heavy-lidded eyes (small ry = nearly closed)
  const eyeRy = 0.5 + t * 1.2;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill={color} opacity="0.12" />
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" />
      {/* Eye whites/outline */}
      <ellipse cx="8.5" cy="11.5" rx="1.5" ry="1.8" stroke={color} strokeWidth="1" fill="none" />
      <ellipse cx="15.5" cy="11.5" rx="1.5" ry="1.8" stroke={color} strokeWidth="1" fill="none" />
      {/* Pupils (heavy-lidded at low level) */}
      <ellipse cx="8.5" cy="11.8" rx="0.9" ry={eyeRy.toFixed(1) as unknown as number} fill={color} />
      <ellipse cx="15.5" cy="11.8" rx="0.9" ry={eyeRy.toFixed(1) as unknown as number} fill={color} />
      {/* Eyelid line (only at low levels) */}
      {level <= 4 && (
        <>
          <line x1="7" y1="10.5" x2="10" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="14" y1="10.5" x2="17" y2="10.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {/* Mouth */}
      <path d={mouthPath} stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
};

// ─── Template Icon System ──────────────────────────────────────────────────────

export type TemplateIconId =
  | "bicep"
  | "dumbbell"
  | "flame"
  | "zap"
  | "target"
  | "brain"
  | "trophy"
  | "sparkles"
  | "runner"
  | "bike"
  | "swimmer"
  | "skier"
  | "wind"
  | "activity";

/** Gym icon IDs for the template picker */
export const TEMPLATE_ICON_IDS_GYM: TemplateIconId[] = [
  "bicep",
  "dumbbell",
  "flame",
  "zap",
  "target",
  "brain",
  "trophy",
  "sparkles",
];

/** Cardio icon IDs for the template picker */
export const TEMPLATE_ICON_IDS_CARDIO: TemplateIconId[] = [
  "runner",
  "bike",
  "swimmer",
  "skier",
  "flame",
  "zap",
  "wind",
  "activity",
];

type IconComponent = React.FC<{ size?: number; className?: string }>;

const ICON_MAP: Record<TemplateIconId, IconComponent> = {
  bicep:    (p) => <BicepIcon    {...p} />,
  dumbbell: (p) => <Dumbbell     size={p.size} className={p.className} />,
  flame:    (p) => <Flame        size={p.size} className={p.className} />,
  zap:      (p) => <Zap          size={p.size} className={p.className} />,
  target:   (p) => <Target       size={p.size} className={p.className} />,
  brain:    (p) => <Brain        size={p.size} className={p.className} />,
  trophy:   (p) => <Trophy       size={p.size} className={p.className} />,
  sparkles: (p) => <Sparkles     size={p.size} className={p.className} />,
  runner:   (p) => <RunnerIcon   {...p} />,
  bike:     (p) => <Bike         size={p.size} className={p.className} />,
  swimmer:  (p) => <SwimmerIcon  {...p} />,
  skier:    (p) => <SkierIcon    {...p} />,
  wind:     (p) => <Wind         size={p.size} className={p.className} />,
  activity: (p) => <Activity     size={p.size} className={p.className} />,
};

/** Renders a template icon by ID. Falls back to Dumbbell for unknown / legacy values. */
export const TemplateIcon: React.FC<{
  iconId: string;
  size?: number;
  className?: string;
}> = ({ iconId, size = 24, className }) => {
  const Comp = ICON_MAP[iconId as TemplateIconId];
  if (Comp) return <Comp size={size} className={className} />;
  return <Dumbbell size={size} className={className} />;
};
